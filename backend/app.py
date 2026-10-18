import os, re, json, time, secrets, hashlib, sqlite3, socket, ipaddress
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from functools import wraps
from werkzeug.middleware.proxy_fix import ProxyFix
from flask import Flask, request, jsonify, g, Response, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import requests

BASE = Path(__file__).resolve().parent
DB_PATH = os.environ.get('XYROPLAY_DB', str(BASE / 'data' / 'xyroplay.sqlite3'))
TOKEN_TTL = 3600
LIMIT_RETENTION = 3600
ACTIVITY_RETENTION = 30 * 86400
MAX_BODY = 1_048_576
MAX_UPSTREAM = 10 * 1024 * 1024
UPSTREAM = 'https://api.synoxcloud.xyz'
ALLOWED_ROUTES = {
 'tools/web2zip','download/tiktok','download/youtube','download/spotify','tools/cuaca','random/meme',
 'canvas/fakedev-2','canvas/iqc','canvas/jarvis-meme','canvas/pakustadz','canvas/fakeml','canvas/fakeff',
 'canvas/windows-quoted','canvas/wasted','canvas/wanted','canvas/sudahsaatnya','canvas/iqc-sticker',
 'tools/getcodehtml','tools/reactch','tools/web2appv2','ai-chat/novaai','search/searchspotify'
}


def db_conn():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH, timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys=ON')
    return g.db


def init_db():
    p = Path(DB_PATH); p.parent.mkdir(mode=0o700, parents=True, exist_ok=True); os.chmod(p.parent, 0o700)
    con = sqlite3.connect(DB_PATH)
    con.executescript('''
    CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('member','reseller','admin','owner','developer')), created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE, expires REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS recovery_codes(username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE, code_hash TEXT NOT NULL, created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(bucket TEXT NOT NULL, ident TEXT NOT NULL, window REAL NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY(bucket,ident));
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, at TEXT NOT NULL);
    ''')
    for k,v in [('notice',''),('maintenance','false'),('siteName','XyroPlay')]:
        con.execute('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',(k,v))
    con.commit(); con.close(); os.chmod(DB_PATH,0o600)


def now_iso(): return datetime.now(timezone.utc).isoformat(timespec='seconds')

def activity(text):
    db_conn().execute('INSERT INTO activity(text,at) VALUES(?,?)',(text[:240],now_iso()))

def settings(): return {r['key']:r['value'] for r in db_conn().execute('SELECT key,value FROM settings')}

def user_public(u): return {'username':u['username'],'role':u['role']}

def error(msg,status): return jsonify(error=msg),status

def valid_user(s): return isinstance(s,str) and re.fullmatch(r'[A-Za-z0-9_.-]{5,32}',s) is not None

def rate(bucket, ident, limit, seconds=60):
    # Independent connection + immediate transaction makes increments race-safe.
    con=sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    try:
        now=time.time(); con.execute('BEGIN IMMEDIATE')
        row=con.execute('SELECT window,hits FROM limits WHERE bucket=? AND ident=?',(bucket,ident)).fetchone()
        if not row or now-row[0]>=seconds:
            con.execute('INSERT OR REPLACE INTO limits VALUES(?,?,?,1)',(bucket,ident,now)); allowed=True
        elif row[1]>=limit: allowed=False
        else: con.execute('UPDATE limits SET hits=hits+1 WHERE bucket=? AND ident=?',(bucket,ident)); allowed=True
        con.execute('DELETE FROM sessions WHERE expires<=?',(now,))
        con.execute('DELETE FROM limits WHERE window<?',(now-LIMIT_RETENTION,))
        con.execute('DELETE FROM activity WHERE at<?',(datetime.fromtimestamp(now-ACTIVITY_RETENTION,timezone.utc).isoformat(timespec='seconds'),))
        con.commit(); return allowed
    finally: con.close()

def remote_ip():
    # ProxyFix is enabled only with explicit one-hop operator configuration.
    return request.remote_addr or 'unknown'

def rate_ident(value):
    # Store only a one-way pseudonymous rate-limit identifier, not the source IP.
    return hashlib.sha256(('xyroplay-rate-v1:' + str(value)).encode()).hexdigest()

def recovery_digest(code): return hashlib.sha256(code.encode()).hexdigest()

def auth_user():
    h=request.headers.get('Authorization','')
    if not h.startswith('Bearer '): return None
    digest=hashlib.sha256(h[7:].encode()).hexdigest()
    return db_conn().execute('SELECT users.* FROM sessions JOIN users USING(username) WHERE token_hash=? AND expires>?',(digest,time.time())).fetchone()

def require_auth(fn):
    @wraps(fn)
    def wrapped(*a,**kw):
        g.user=auth_user()
        if not g.user: return error('Unauthorized',401)
        return fn(*a,**kw)
    return wrapped

def privileged(u): return u['role'] in ('admin','owner','developer')
def require_priv(fn):
    @wraps(fn)
    @require_auth
    def wrapped(*a,**kw):
        if not privileged(g.user): return error('Forbidden',403)
        return fn(*a,**kw)
    return wrapped

def json_body():
    if not request.is_json: return None
    return request.get_json(silent=True)

def enforce_maintenance():
    s=settings()
    return s.get('maintenance')=='true' and not privileged(g.user)

app=Flask(__name__, static_folder=None)
if os.environ.get('TRUST_PROXY_HOPS') == '1':
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0, x_port=0, x_prefix=0)
app.config['MAX_CONTENT_LENGTH']=MAX_BODY
init_db()

@app.after_request
def headers(resp):
    origins={x.strip() for x in os.environ.get('XYRO_ALLOWED_ORIGINS','https://appassets.androidplatform.net').split(',') if x.strip() and x.strip()!='*'}
    if request.path.startswith('/api/') or request.path=='/api': resp.headers['Cache-Control']='no-store'
    origin=request.headers.get('Origin')
    if origin in origins:
        resp.headers['Access-Control-Allow-Origin']=origin; resp.headers['Vary']='Origin'; resp.headers['Access-Control-Allow-Headers']='Authorization, Content-Type'; resp.headers['Access-Control-Allow-Methods']='GET, POST, PUT, DELETE, OPTIONS'
    resp.headers['X-Content-Type-Options']='nosniff'; resp.headers['X-Frame-Options']='DENY'; resp.headers['Referrer-Policy']='no-referrer'
    if request.is_secure: resp.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
    return resp

@app.teardown_appcontext
def close_db(exc):
    con=g.pop('db',None)
    if con is not None: con.close()

@app.before_request
def preflight():
    if request.method=='OPTIONS': return ('',204)

@app.errorhandler(413)
def too_large(e): return error('Request too large',413)

@app.get('/api/health')
def health(): return jsonify(status='ok')

@app.get('/api/capabilities')
def capabilities(): return jsonify(online=bool(os.environ.get('SYNOX_API_KEY')),tools=sorted(ALLOWED_ROUTES) if os.environ.get('SYNOX_API_KEY') else [])

@app.post('/api/auth/register')
def register():
    d=json_body()
    if not isinstance(d,dict): return error('Invalid JSON',400)
    name=d.get('username'); password=d.get('password'); ident=(name.casefold() if isinstance(name,str) else '')
    if not rate('auth-ip',rate_ident(remote_ip()),10) or not rate('auth-user',rate_ident(ident),5): return error('Too many attempts',429)
    if not valid_user(name) or not isinstance(password,str) or not 12<=len(password)<=128: return error('Invalid username or password',400)
    con=db_conn()
    code=secrets.token_urlsafe(32)
    try:
        con.execute('INSERT INTO users VALUES(?,?,?,?)',(name,generate_password_hash(password,method='scrypt'), 'member',time.time()))
        con.execute('INSERT INTO recovery_codes VALUES(?,?,?)',(name,recovery_digest(code),time.time())); activity(f'Account registered: {name}'); con.commit()
    except sqlite3.IntegrityError: return error('Username unavailable',409)
    return jsonify(user={'username':name,'role':'member'},recoveryCode=code),201

@app.post('/api/auth/login')
def login():
    d=json_body()
    if not isinstance(d,dict): return error('Invalid JSON',400)
    name=d.get('username'); pwd=d.get('password'); ident=name.casefold() if isinstance(name,str) else ''
    if not rate('auth-ip',rate_ident(remote_ip()),10) or not rate('auth-user',rate_ident(ident),5): return error('Too many attempts',429)
    u=db_conn().execute('SELECT * FROM users WHERE username=?',(name,)).fetchone() if isinstance(name,str) else None
    if not u or not isinstance(pwd,str) or len(pwd)>128 or not check_password_hash(u['password_hash'],pwd): return error('Invalid credentials',401)
    if settings().get('maintenance')=='true' and not privileged(u): return error('Maintenance mode',503)
    token=secrets.token_urlsafe(32); db_conn().execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),u['username'],time.time()+TOKEN_TTL)); db_conn().commit()
    return jsonify(token=token,user=user_public(u))

@app.post('/api/auth/recover')
def recover_account():
    d=json_body(); name=d.get('username') if isinstance(d,dict) else None
    ident=name.casefold() if isinstance(name,str) else ''
    if not rate('recover-ip',rate_ident(remote_ip()),10) or not rate('recover-user',rate_ident(ident),5): return error('Recovery unavailable',429)
    code=d.get('recoveryCode') if isinstance(d,dict) else None; password=d.get('newPassword') if isinstance(d,dict) else None
    if not valid_user(name) or not isinstance(code,str) or not 20<=len(code)<=128 or not isinstance(password,str) or not 12<=len(password)<=128: return error('Recovery unavailable',400)
    con=db_conn(); con.execute('BEGIN IMMEDIATE')
    row=con.execute('SELECT username,code_hash FROM recovery_codes WHERE username=?',(name,)).fetchone()
    if not row or not secrets.compare_digest(row['code_hash'],recovery_digest(code)):
        con.rollback(); return error('Recovery unavailable',400)
    rotated=secrets.token_urlsafe(32)
    con.execute('UPDATE users SET password_hash=? WHERE username=?',(generate_password_hash(password,method='scrypt'),row['username']))
    con.execute('DELETE FROM sessions WHERE username=?',(row['username'],))
    con.execute('UPDATE recovery_codes SET code_hash=?,created=? WHERE username=?',(recovery_digest(rotated),time.time(),row['username']))
    activity('Account password recovered'); con.commit()
    return jsonify(ok=True,recoveryCode=rotated)

@app.post('/api/auth/recovery-code')
@require_auth
def regenerate_recovery_code():
    d=json_body(); password=d.get('password') if isinstance(d,dict) else None
    if not rate('recovery-rotate-user',rate_ident(g.user['username'].casefold()),5) or not rate('recovery-rotate-ip',rate_ident(remote_ip()),10): return error('Invalid credentials',401)
    if not isinstance(password,str) or len(password)>128 or not check_password_hash(g.user['password_hash'],password): return error('Invalid credentials',401)
    code=secrets.token_urlsafe(32); db_conn().execute('INSERT OR REPLACE INTO recovery_codes VALUES(?,?,?)',(g.user['username'],recovery_digest(code),time.time())); db_conn().commit()
    return jsonify(recoveryCode=code)

@app.get('/api/auth/me')
@require_auth
def me(): return jsonify(user=user_public(g.user))

@app.post('/api/auth/logout')
@require_auth
def logout():
    digest=hashlib.sha256(request.headers['Authorization'][7:].encode()).hexdigest(); db_conn().execute('DELETE FROM sessions WHERE token_hash=?',(digest,)); db_conn().commit(); return jsonify(ok=True)

@app.delete('/api/auth/account')
@require_auth
def delete_account():
    d=json_body(); pwd=d.get('password') if isinstance(d,dict) else None
    if not rate('delete-user',rate_ident(g.user['username'].casefold()),5) or not isinstance(pwd,str) or len(pwd)>128 or not check_password_hash(g.user['password_hash'],pwd): return error('Invalid credentials',401)
    db_conn().execute('DELETE FROM users WHERE username=?',(g.user['username'],)); db_conn().commit(); return jsonify(ok=True)

@app.post('/api/account/delete')
def public_delete_account():
    d=json_body(); name=d.get('username') if isinstance(d,dict) else None; pwd=d.get('password') if isinstance(d,dict) else None
    ident=name.casefold() if isinstance(name,str) else ''
    if not rate('delete-public-ip',rate_ident(remote_ip()),10) or not rate('delete-public-user',rate_ident(ident),5): return error('Invalid credentials',401)
    u=db_conn().execute('SELECT * FROM users WHERE username=?',(name,)).fetchone() if isinstance(name,str) else None
    if not u or not isinstance(pwd,str) or len(pwd)>128 or not check_password_hash(u['password_hash'],pwd): return error('Invalid credentials',401)
    db_conn().execute('DELETE FROM users WHERE username=?',(u['username'],)); db_conn().commit(); return jsonify(ok=True)

@app.get('/api/admin/users')
@require_priv
def users(): return jsonify(users=[{'username':r['username'],'role':r['role']} for r in db_conn().execute('SELECT username,role FROM users ORDER BY username')])

@app.post('/api/admin/users')
@require_priv
def create_user():
    d=json_body()
    if not isinstance(d,dict): return error('Invalid JSON',400)
    name,pwd,role=d.get('username'),d.get('password'),d.get('role')
    if not valid_user(name) or not isinstance(pwd,str) or not 12<=len(pwd)<=128 or role not in ('member','reseller','admin','owner','developer'): return error('Invalid user fields',400)
    if role in ('admin','owner','developer') and g.user['role'] not in ('owner','developer'): return error('Forbidden',403)
    try: db_conn().execute('INSERT INTO users VALUES(?,?,?,?)',(name,generate_password_hash(pwd,method='scrypt'),role,time.time())); activity(f'User created: {name} ({role})'); db_conn().commit()
    except sqlite3.IntegrityError: return error('Username unavailable',409)
    return jsonify(user={'username':name,'role':role}),201

@app.delete('/api/admin/users/<username>')
@require_priv
def delete_user(username):
    target=db_conn().execute('SELECT * FROM users WHERE username=?',(username,)).fetchone()
    if not target: return error('Not found',404)
    if target['username'].casefold()==g.user['username'].casefold() or target['role'] in ('owner','developer'): return error('Forbidden',403)
    if target['role']=='admin' and g.user['role'] not in ('owner','developer'): return error('Forbidden',403)
    db_conn().execute('DELETE FROM users WHERE username=?',(target['username'],)); activity(f'User deleted: {target["username"]}'); db_conn().commit(); return jsonify(ok=True)

@app.get('/api/admin/state')
@require_priv
def admin_state():
    s=settings(); return jsonify(notice=s.get('notice',''),maintenance=s.get('maintenance')=='true',siteName=s.get('siteName','XyroPlay'),activity=[dict(r) for r in db_conn().execute('SELECT text,at FROM activity ORDER BY id DESC LIMIT 100')])

@app.put('/api/admin/state')
@require_priv
def update_state():
    d=json_body()
    known={'notice','maintenance','siteName'}
    if not isinstance(d,dict) or not d or set(d)-known: return error('Invalid state',400)
    if 'notice' in d and (not isinstance(d['notice'],str) or len(d['notice'])>1000): return error('Invalid state',400)
    if 'maintenance' in d and not isinstance(d['maintenance'],bool): return error('Invalid state',400)
    if 'siteName' in d and (not isinstance(d['siteName'],str) or not 1<=len(d['siteName'])<=40): return error('Invalid state',400)
    con=db_conn(); merged=settings()
    for key,val in d.items():
        if key=='maintenance': val=str(val).lower()
        con.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',(key,val)); merged[key]=val
    activity(f'Site state updated by {g.user["username"]}'); con.commit(); return jsonify(notice=merged.get('notice',''),maintenance=merged.get('maintenance')=='true',siteName=merged.get('siteName','XyroPlay'))

@app.get('/api/state')
def public_state():
    s=settings(); return jsonify(notice=s.get('notice',''),maintenance=s.get('maintenance')=='true',siteName=s.get('siteName','XyroPlay'))

@app.route('/api/proxy/<path:route>',methods=['GET'])
@require_auth
def proxy(route):
    if not os.environ.get('SYNOX_API_KEY'): return error('Proxy unavailable',503)
    if enforce_maintenance(): return error('Maintenance mode',503)
    if not rate('proxy-user',rate_ident(g.user['username'].casefold()),30) or not rate('proxy-ip',rate_ident(remote_ip()),60): return error('Too many requests',429)
    if route not in ALLOWED_ROUTES: return error('Route not allowed',404)
    params={}
    for k,v in request.args.items():
        if len(k)>80 or len(v)>2048: return error('Invalid parameter',400)
        if k.casefold()=='apikey': continue
        if k.casefold() in ('url','link','uri','website','target','urlfoto','avatar','image','photo','icon') and v:
            try:
                parsed=urlparse(v)
                if parsed.scheme!='https' or not parsed.hostname or parsed.username is not None or parsed.password is not None or (parsed.port is not None and parsed.port!=443): return error('Invalid URL parameter',400)
                infos=socket.getaddrinfo(parsed.hostname,None,type=socket.SOCK_STREAM)
                if not infos: return error('Invalid URL parameter',400)
                for info in infos:
                    ip=ipaddress.ip_address(info[4][0])
                    if not ip.is_global: return error('Invalid URL parameter',400)
            except (ValueError,socket.gaierror): return error('Invalid URL parameter',400)
        params[k]=v
    if len(params)>30: return error('Too many parameters',400)
    key=os.environ.get('SYNOX_API_KEY')
    if not key: return error('Proxy unavailable',503)
    params['apikey']=key
    try:
        upstream=requests.get(f'{UPSTREAM}/{route}',params=params,timeout=(5,20),stream=True,allow_redirects=False)
        if not 200 <= upstream.status_code < 300:
            upstream.close(); return error('Upstream request failed',502)
        ctype=upstream.headers.get('Content-Type','application/octet-stream').split(';')[0].lower()
        allowed=('application/json','text/plain','application/octet-stream','application/zip','application/vnd.android.package-archive')
        allowed_prefix=('image/','audio/','video/')
        if ctype=='text/html' or ctype=='image/svg+xml' or not (ctype in allowed or ctype.startswith(allowed_prefix)):
            upstream.close(); return error('Upstream response type not allowed',502)
        chunks=[]; size=0
        for chunk in upstream.iter_content(65536):
            size+=len(chunk)
            if size>MAX_UPSTREAM: upstream.close(); return error('Upstream response too large',502)
            chunks.append(chunk)
        status=upstream.status_code; upstream.close()
        outtype='text/plain; charset=utf-8' if ctype in ('text/html','image/svg+xml') else ctype
        body=b''.join(chunks)
        if ctype=='application/json': body=body.replace(key.encode(),b'[REDACTED]')
        elif ctype.startswith('text/'):
            try: body=body.decode('utf-8').replace(key,'[REDACTED]').encode('utf-8')
            except UnicodeDecodeError: pass
        return Response(body,status=status,content_type=outtype,headers={'Content-Disposition':'attachment' if ctype in ('application/zip','application/vnd.android.package-archive') else 'inline','Cache-Control':'no-store'})
    except requests.RequestException: return error('Upstream unavailable',502)

@app.get('/')
def index(): return send_from_directory(str(BASE.parent/'web'),'index.html')
@app.get('/<path:path>')
def web_files(path):
    # Serve the existing frontend plus explicit public account-help pages requested by the site.
    if path in ('privacy.html','deletion.html','recovery.html'):
        return send_from_directory(str(BASE.parent/'web'),path)
    return send_from_directory(str(BASE.parent/'web'),path)

if __name__=='__main__': app.run(host='127.0.0.1',port=int(os.environ.get('PORT','5000')))
