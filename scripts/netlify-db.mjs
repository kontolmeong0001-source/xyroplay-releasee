import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { randomBytes, scrypt as rawScrypt } from 'node:crypto';
import { promisify } from 'node:util';
const raw = process.env.DATABASE_URL;
if (!raw) throw Error('Isi DATABASE_URL database PostgreSQL lokal.');
const url = new URL(raw);
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !['postgres:','postgresql:'].includes(url.protocol)) throw Error('Perintah ini hanya menerima database loopback lokal. Produksi memerlukan review/persetujuan terpisah.');
const pool = new pg.Pool({connectionString:raw, ssl:false, max:1, connectionTimeoutMillis:5000});
try {
  if (process.argv[2] === 'migrate') {
    const sql = await readFile(new URL('../netlify/database/migrations/001_initial.sql', import.meta.url),'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(184289,1)');
      await c.query('CREATE TABLE IF NOT EXISTS xyro_local_migrations(name TEXT PRIMARY KEY)');
      const applied = await c.query('SELECT name FROM xyro_local_migrations WHERE name=$1',['001_initial']);
      if (!applied.rowCount) {
        await c.query(sql);
        await c.query('INSERT INTO xyro_local_migrations(name) VALUES($1)',['001_initial']);
      }
      await c.query('COMMIT');
      console.log('Skema database lokal siap. Tidak ada database cloud dibuat.');
    } catch (e) {await c.query('ROLLBACK'); throw e;} finally {c.release();}
  } else if (process.argv[2] === 'create-owner') {
    // Register with the UI first (so its one-time recovery code is delivered),
    // then confirm that account password here. Never create a default credential.
    if (!process.stdin.isTTY) throw Error('Jalankan interaktif pada terminal lokal.');
    const rl = createInterface({input:process.stdin, output:process.stdout});
    const username = (await rl.question('Username akun terdaftar yang akan menjadi owner: ')).trim();
    rl.close();
    if (!/^[A-Za-z0-9_.-]{5,32}$/.test(username)) throw Error('Username tidak valid');
    const {default: hidden} = await import('./netlify-password.mjs');
    const password = await hidden('Password akun (tidak ditampilkan): ');
    const r = await pool.query('SELECT username,password_hash FROM users WHERE lower(username)=lower($1)',[username]);
    const row = r.rows[0];
    if (!row) throw Error('Daftar akun lewat aplikasi lokal dahulu dan simpan kode pemulihannya.');
    const [method,salt,expected] = row.password_hash.split('$');
    const [alg,N,rp,p] = method.split(':');
    if (alg !== 'scrypt' || Number(N)!==32768 || Number(rp)!==8 || Number(p)!==1) throw Error('Format hash tidak didukung oleh CLI lokal.');
    const actual = await promisify(rawScrypt)(password,salt,64,{N:Number(N),r:Number(rp),p:Number(p),maxmem:64*1024*1024});
    const {timingSafeEqual} = await import('node:crypto');
    const saved = Buffer.from(expected,'hex');
    if (saved.length !== actual.length || !timingSafeEqual(saved,actual)) throw Error('Kredensial tidak cocok');
    await pool.query("UPDATE users SET role='owner' WHERE username=$1",[row.username]);
    console.log('Owner lokal diperbarui. Login ulang untuk membaca peran terbaru.');
  } else throw Error('Gunakan migrate atau create-owner');
} finally {await pool.end();}
