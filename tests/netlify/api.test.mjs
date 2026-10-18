import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createHandler } from '../../netlify/functions/api.mjs';

const { Pool } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;
assert.ok(databaseUrl, 'TEST_DATABASE_URL must point to a disposable PostgreSQL test database');
const testUrl = new URL(databaseUrl);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(testUrl.hostname), 'Tests must only access local PostgreSQL');
assert.match(testUrl.pathname, /_test$/, 'Tests require an explicitly disposable *_test database');
const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 8 });
const handler = createHandler({ pool, fetchImpl: async () => { throw new Error('Unexpected upstream request'); }, lookup: async (host) => [{ address: host, family: 4 }], env: process.env });

async function req(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  if (token) h.set('authorization', `Bearer ${token}`);
  const response = await handler(new Request(`http://localhost${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), {});
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}
const post = (path, body, token, headers) => req(path, { method: 'POST', body, token, headers });
const put = (path, body, token) => req(path, { method: 'PUT', body, token });
async function register(username, password = 'long-passphrase!') {
  return post('/api/auth/register', { username, password });
}
async function login(username, password = 'long-passphrase!') {
  return post('/api/auth/login', { username, password });
}
async function setRole(username, role) {
  await pool.query('UPDATE users SET role=$1 WHERE username=$2', [role, username]);
}
async function adminLogin(username, role = 'admin') {
  await register(username, 'secret-password-123');
  await setRole(username, role);
  const result = await login(username, 'secret-password-123');
  assert.equal(result.response.status, 200);
  return result.data.token;
}
async function hashFor(table, column, username) {
  const { rows } = await pool.query(`SELECT ${column} FROM ${table} WHERE username=$1`, [username]);
  return rows[0]?.[column];
}

before(async () => {
  await pool.query('SELECT 1');
  for (const table of ['users', 'sessions', 'recovery_codes', 'limits', 'settings', 'activity']) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
  await pool.query("INSERT INTO settings(key,value) VALUES ('notice',''),('maintenance','false'),('siteName','XyroPlay') ON CONFLICT (key) DO NOTHING");
});
beforeEach(async () => {
  // Each case starts from a clean state; tests themselves intentionally exercise concurrency.
  for (const table of ['users', 'sessions', 'recovery_codes', 'limits', 'settings', 'activity']) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
  await pool.query("INSERT INTO settings(key,value) VALUES ('notice',''),('maintenance','false'),('siteName','XyroPlay')");
});
after(async () => { await pool.end(); });

test('registration forces member role and stores password/recovery/token digests', async () => {
  const r = await post('/api/auth/register', { username: 'hacker1', password: 'long-passphrase!', role: 'owner' });
  assert.equal(r.response.status, 201);
  assert.equal(r.data.user.role, 'member');
  assert.ok(r.data.recoveryCode);
  const { rows } = await pool.query('SELECT password_hash,role FROM users WHERE username=$1', ['hacker1']);
  assert.equal(rows[0].role, 'member');
  assert.notEqual(rows[0].password_hash, 'long-passphrase!');
  assert.match(rows[0].password_hash, /scrypt/i, 'password hash should use the Python-compatible scrypt format when supported');
  const recoveryHash = await hashFor('recovery_codes', 'code_hash', 'hacker1');
  assert.equal(recoveryHash, crypto.createHash('sha256').update(r.data.recoveryCode).digest('hex'));
  assert.notEqual(recoveryHash, r.data.recoveryCode);
  const l = await login('hacker1');
  assert.equal(l.response.status, 200);
  assert.equal(await hashFor('sessions', 'token_hash', 'hacker1'), crypto.createHash('sha256').update(l.data.token).digest('hex'));
});

test('login, logout, expiry, and bearer authentication', async () => {
  await register('person1');
  const l = await login('person1');
  assert.equal(l.response.status, 200);
  assert.equal((await req('/api/auth/me', { token: l.data.token })).response.status, 200);
  assert.equal((await post('/api/auth/logout', {}, l.data.token)).response.status, 200);
  assert.equal((await req('/api/auth/me', { token: l.data.token })).response.status, 401);
  const fresh = await login('person1');
  await pool.query('UPDATE sessions SET expires=EXTRACT(EPOCH FROM NOW())-2 WHERE username=$1', ['person1']);
  assert.equal((await req('/api/auth/me', { token: fresh.data.token })).response.status, 401);
});

test('member is forbidden; admin can manage non-privileged users but cannot grant privilege or delete protected accounts', async () => {
  await register('member1');
  const member = (await login('member1')).data.token;
  assert.equal((await req('/api/admin/users', { token: member })).response.status, 403);
  const admin = await adminLogin('admin1');
  assert.equal((await post('/api/admin/users', { username: 'badrole', password: '123456789012', role: 'owner' }, admin)).response.status, 403);
  assert.equal((await post('/api/admin/users', { username: 'madeuser', password: '123456789012', role: 'member' }, admin)).response.status, 201);
  assert.equal((await req('/api/admin/users', { token: admin })).response.status, 200);
  assert.equal((await req('/api/admin/users/admin1', { method: 'DELETE', token: admin })).response.status, 403);
  const owner = await adminLogin('owner1', 'owner');
  assert.equal((await post('/api/admin/users', { username: 'newadmin', password: '123456789012', role: 'admin' }, owner)).response.status, 201);
});

test('rate limits are PostgreSQL-distributed by username and concurrent duplicate registration is unique', async () => {
  const attempts = await Promise.all(Array.from({ length: 7 }, () => login('ratelimit', 'wrong-password')));
  assert.ok(attempts.some(x => x.response.status === 429));
  await pool.query('TRUNCATE TABLE users,recovery_codes,sessions RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE limits');
  const registrations = await Promise.all(Array.from({ length: 2 }, () => register('raceuser')));
  assert.equal(registrations.filter(x => x.response.status === 201).length, 1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM users WHERE username=$1', ['raceuser'])).rows[0].n, 1);
});

test('recovery code is one-use, rotates, and revokes all prior sessions, including concurrent replay', async () => {
  const created = await register('recover1');
  const code = created.data.recoveryCode;
  const a = await login('recover1');
  const b = await login('recover1');
  const calls = await Promise.all([
    post('/api/auth/recover', { username: 'recover1', recoveryCode: code, newPassword: 'replacement-pass-123' }),
    post('/api/auth/recover', { username: 'recover1', recoveryCode: code, newPassword: 'replacement-pass-123' }),
  ]);
  assert.equal(calls.filter(x => x.response.status === 200).length, 1);
  assert.equal(calls.filter(x => x.response.status !== 200).length, 1);
  assert.notEqual(calls.find(x => x.response.status === 200).data.recoveryCode, code);
  assert.equal((await req('/api/auth/me', { token: a.data.token })).response.status, 401);
  assert.equal((await req('/api/auth/me', { token: b.data.token })).response.status, 401);
  assert.equal((await login('recover1', 'replacement-pass-123')).response.status, 200);
  assert.equal((await post('/api/auth/recover', { username: 'recover1', recoveryCode: code, newPassword: 'another-pass-123' })).response.status, 400);
});

test('password-protected account deletion cascades sessions and recovery data', async () => {
  await register('delete1');
  const l = await login('delete1');
  assert.equal((await req('/api/account/delete', { method: 'POST', body: { username: 'delete1' } })).response.status, 401);
  assert.equal((await post('/api/account/delete', { username: 'delete1', password: 'incorrect' })).response.status, 401);
  assert.equal((await post('/api/account/delete', { username: 'delete1', password: 'long-passphrase!' })).response.status, 200);
  for (const table of ['users', 'sessions', 'recovery_codes']) {
    assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE username=$1`, ['delete1'])).rows[0].n, 0);
  }
  assert.equal((await req('/api/auth/me', { token: l.data.token })).response.status, 401);
});

test('CORS, body limit, maintenance mode, and settings validation', async () => {
  assert.equal((await req('/api/health', { headers: { origin: 'https://evil.invalid' } })).response.headers.get('access-control-allow-origin'), null);
  assert.equal((await req('/api/health', { headers: { origin: 'https://appassets.androidplatform.net' } })).response.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  const admin = await adminLogin('stateadmin');
  assert.equal((await put('/api/admin/state', { notice: 'hello', maintenance: true, siteName: 'Site' }, admin)).response.status, 200);
  await register('member2');
  assert.equal((await login('member2')).response.status, 503);
  assert.equal((await req('/api/state')).data.maintenance, true);
  assert.equal((await put('/api/admin/state', { unexpected: 1 }, admin)).response.status, 400);
  assert.equal((await put('/api/admin/state', { siteName: 'x'.repeat(41) }, admin)).response.status, 400);
  const oversized = await handler(new Request('http://localhost/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(1_048_577) }), {});
  assert.equal(oversized.status, 413);
});

test('missing PostgreSQL dependency fails closed rather than authenticating anonymously', async () => {
  const unavailable = createHandler({ pool: null, fetchImpl: async () => { throw new Error('must not fetch'); }, lookup: async () => [], env: {} });
  const r = await unavailable(new Request('http://localhost/api/auth/me'), {});
  assert.ok([401, 500, 503].includes(r.status));
  const health = await unavailable(new Request('http://localhost/api/health'), {});
  assert.notEqual(health.status, 200, 'health must not claim healthy DB-backed API without database');
});

test('proxy uses only fixed upstream, scrubs API key, disallows redirects/private destinations and active content', async () => {
  const calls = [];
  const safe = createHandler({
    pool,
    env: { SYNOX_API_KEY: 'server-secret' },
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }); },
  });
  await register('proxy1');
  const token = (await login('proxy1')).data.token;
  const good = await safe(new Request('http://localhost/api/proxy/tools/cuaca?apikey=attacker&city=Bandung', { headers: { authorization: `Bearer ${token}` } }), {});
  assert.equal(good.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.synoxcloud\.xyz\/tools\/cuaca/);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.doesNotMatch(calls[0].url, /attacker/);
  assert.match(calls[0].url, /apikey=server-secret/);
  const beforeCalls = calls.length;
  const privateUrl = await safe(new Request('http://localhost/api/proxy/tools/web2zip?url=http%3A%2F%2F127.0.0.1', { headers: { authorization: `Bearer ${token}` } }), {});
  assert.equal(privateUrl.status, 400);
  assert.equal(calls.length, beforeCalls);
  const redirector = createHandler({ pool, env: { SYNOX_API_KEY: 'server-secret' }, lookup: async () => [{ address: '93.184.216.34', family: 4 }], fetchImpl: async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/' } }) });
  const redir = await redirector(new Request('http://localhost/api/proxy/tools/cuaca', { headers: { authorization: `Bearer ${token}` } }), {});
  assert.notEqual(redir.status, 302, 'upstream redirects must not be relayed');
});

test('Python Werkzeug scrypt hashes authenticate without a plaintext migration', async () => {
  const {execFileSync}=await import('node:child_process');
  const hash=execFileSync('python3',['-c',"from werkzeug.security import generate_password_hash; print(generate_password_hash('legacy-passphrase!', method='scrypt'))"],{encoding:'utf8'}).trim();
  await register('legacy1');
  await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2',[hash,'legacy1']);
  assert.equal((await login('LEGACY1','legacy-passphrase!')).response.status,200);
  assert.equal((await login('legacy1','wrong-password')).response.status,401);
});

test('proxy rejects active SVG/HTML, oversized output, private DNS, and redacts secret output', async()=>{
  await register('proxytwo');
  const token=(await login('proxytwo')).data.token;
  const make=(fetchImpl,lookup=async()=>[{address:'93.184.216.34',family:4}])=>createHandler({pool,env:{SYNOX_API_KEY:'server-secret'},lookup,fetchImpl});
  const request=path=>new Request('http://localhost'+path,{headers:{authorization:`Bearer ${token}`}});
  for(const type of ['text/html','image/svg+xml']){
    const h=make(async()=>new Response('<script>bad()</script>',{headers:{'content-type':type}}));
    assert.equal((await h(request('/api/proxy/tools/cuaca'),{})).status,502);
  }
  const big=make(async()=>new Response(Buffer.alloc(4*1024*1024+1),{headers:{'content-type':'application/octet-stream'}}));
  assert.equal((await big(request('/api/proxy/tools/cuaca'),{})).status,502);
  const redacted=make(async()=>new Response('{"value":"server-secret"}',{headers:{'content-type':'application/json'}}));
  const result=await redacted(request('/api/proxy/tools/cuaca?APIKEY=attacker'),{});
  assert.equal(result.status,200);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(await result.text(),/server-secret/);
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','::ffff:127.0.0.1']){
    const deny=make(async()=>{throw Error('must not reach upstream');},async()=>[{address}]);
    assert.equal((await deny(request('/api/proxy/tools/cuaca?url=https://private.invalid'),{})).status,400);
  }
  assert.equal((await handler(request('/api/proxy/tools/cuaca'),{})).status,503);
});

test('rate limits apply across separate handler instances and ignore forged forwarded headers',async()=>{
  const another=createHandler({pool,env:{}});
  for(let i=0;i<5;i++){
    const h=i%2?handler:another;
    const res=await h(new Request('http://localhost/api/auth/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':`192.0.2.${i}`},body:JSON.stringify({username:'blocked1',password:'wrong-password'})}),{ip:'203.0.113.1'});
    assert.equal(res.status,401);
  }
  const res=await another(new Request('http://localhost/api/auth/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'8.8.8.8'},body:JSON.stringify({username:'blocked1',password:'wrong-password'})}),{ip:'203.0.113.1'});
  assert.equal(res.status,429);
  const limits=(await pool.query('SELECT ident FROM limits')).rows;
  for(const row of limits)assert.match(row.ident,/^[a-f0-9]{64}$/);
});

test('authenticated recovery rotation requires password; account deletion also checks password',async()=>{
  const created=await register('rotate1');
  const token=(await login('rotate1')).data.token;
  assert.equal((await post('/api/auth/recovery-code',{password:'wrong-password'},token)).response.status,401);
  const rotated=await post('/api/auth/recovery-code',{password:'long-passphrase!'},token);
  assert.equal(rotated.response.status,200);
  assert.notEqual(rotated.data.recoveryCode,created.data.recoveryCode);
  assert.equal((await post('/api/auth/recover',{username:'rotate1',recoveryCode:created.data.recoveryCode,newPassword:'new-password-12345'})).response.status,400);
  assert.equal((await req('/api/auth/account',{method:'DELETE',body:{password:'wrong-password'},token})).response.status,401);
  assert.equal((await req('/api/auth/account',{method:'DELETE',body:{password:'long-passphrase!'},token})).response.status,200);
  assert.equal((await req('/api/auth/me',{token})).response.status,401);
});
