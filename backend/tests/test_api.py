import hashlib, time
import pytest
import app as backend

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend,'DB_PATH',str(tmp_path/'db.sqlite3'))
    backend.init_db()
    with backend.app.test_client() as c: yield c

def register(c,name='person',password='long-passphrase!'):
    return c.post('/api/auth/register',json={'username':name,'password':password})
def login(c,name='person',password='long-passphrase!'):
    return c.post('/api/auth/login',json={'username':name,'password':password})
def bearer(r): return {'Authorization':'Bearer '+r.json['token']}
def create_admin(c, role='admin'):
    with backend.app.app_context():
        con=backend.db_conn()
        from werkzeug.security import generate_password_hash
        con.execute('INSERT INTO users VALUES(?,?,?,?)',('root',generate_password_hash('secret-password-123',method='scrypt'),role,time.time())); con.commit()

def test_register_role_hash_and_bearer_hash(client):
    r=client.post('/api/auth/register',json={'username':'hacker1','password':'long-passphrase!','role':'owner'})
    assert r.status_code==201 and r.json['user']['role']=='member'
    with backend.app.app_context():
        row=backend.db_conn().execute('select password_hash from users').fetchone()
        assert row['password_hash']!='long-passphrase!' and 'scrypt' in row['password_hash']
    l=login(client,'hacker1'); assert l.status_code==200
    with backend.app.app_context():
        stored=backend.db_conn().execute('select token_hash from sessions').fetchone()['token_hash']
        assert stored==hashlib.sha256(l.json['token'].encode()).hexdigest() and stored!=l.json['token']
    assert client.get('/api/auth/me',headers=bearer(l)).json['user']['role']=='member'

def test_logout_expiry_and_delete_own(client):
    register(client); l=login(client); assert client.post('/api/auth/logout',headers=bearer(l)).status_code==200
    assert client.get('/api/auth/me',headers=bearer(l)).status_code==401
    l=login(client)
    with backend.app.app_context(): backend.db_conn().execute('update sessions set expires=?',(time.time()-1,)); backend.db_conn().commit()
    assert client.get('/api/auth/me',headers=bearer(l)).status_code==401
    l=login(client); assert client.delete('/api/auth/account',json={'password':'long-passphrase!'},headers=bearer(l)).status_code==200
    assert client.get('/api/auth/me',headers=bearer(l)).status_code==401

def test_admin_guards_and_hierarchy(client):
    register(client); member=login(client)
    assert client.get('/api/admin/users',headers=bearer(member)).status_code==403
    assert client.post('/api/admin/users',json={'username':'other','password':'123456789012','role':'owner'},headers=bearer(member)).status_code==403
    create_admin(client); admin=login(client,'root','secret-password-123')
    assert client.post('/api/admin/users',json={'username':'newadmin','password':'123456789012','role':'admin'},headers=bearer(admin)).status_code==403
    assert client.post('/api/admin/users',json={'username':'newmember','password':'123456789012','role':'member'},headers=bearer(admin)).status_code==201
    assert client.delete('/api/admin/users/root',headers=bearer(admin)).status_code==403

def test_rate_limit_uses_ip_and_username(client):
    for i in range(5): login(client,'blocked','wrong-passphrase')
    assert login(client,'blocked','wrong-passphrase').status_code==429
    assert client.post('/api/auth/login',json={'username':'xx','password':'x'},headers={'X-Forwarded-For':'1.2.3.4'}).status_code in (401,429)

def test_cors_and_maintenance(client):
    assert client.get('/api/health',headers={'Origin':'https://evil.invalid'}).headers.get('Access-Control-Allow-Origin') is None
    assert client.get('/api/health',headers={'Origin':'https://appassets.androidplatform.net'}).headers['Access-Control-Allow-Origin']=='https://appassets.androidplatform.net'
    create_admin(client); admin=login(client,'root','secret-password-123')
    client.put('/api/admin/state',json={'notice':'Hi','maintenance':True,'siteName':'X'},headers=bearer(admin))
    register(client); assert login(client).status_code==503
    # Existing member sessions are also denied by maintenance enforcement.
    assert client.get('/api/state').json['maintenance'] is True

def test_proxy_fixed_route_scrubs_key_and_streams_mock(client,monkeypatch):
    monkeypatch.setenv('SYNOX_API_KEY','server-secret')
    register(client); l=login(client)
    class Up:
        status_code=200; headers={'Content-Type':'application/json; charset=utf-8'}
        def iter_content(self,n): yield b'{"ok":true}'
        def close(self): pass
    got={}
    def fake(url,**kwargs): got.update(url=url,**kwargs); return Up()
    monkeypatch.setattr(backend.requests,'get',fake)
    r=client.get('/api/proxy/tools/cuaca?apikey=attacker&city=Bandung',headers=bearer(l))
    assert r.status_code==200 and r.json=={'ok':True}
    assert got['url']=='https://api.synoxcloud.xyz/tools/cuaca' and got['params']=={'city':'Bandung','apikey':'server-secret'} and got['allow_redirects'] is False
    assert client.get('/api/proxy/premium/foo',headers=bearer(l)).status_code==404

def test_proxy_rejects_private_url_and_active_types(client,monkeypatch):
    monkeypatch.setenv('SYNOX_API_KEY','secret'); register(client); l=login(client)
    assert client.get('/api/proxy/tools/web2zip?url=http%3A%2F%2F127.0.0.1',headers=bearer(l)).status_code==400
    class Up:
        status_code=200; headers={'Content-Type':'text/html'}
        def close(self): pass
        def iter_content(self,n): yield b'<script>alert(1)</script>'
    monkeypatch.setattr(backend.requests,'get',lambda *a,**k:Up())
    assert client.get('/api/proxy/tools/cuaca',headers=bearer(l)).status_code==502


def test_partial_state_strict_and_limits(client):
    create_admin(client); admin=login(client,'root','secret-password-123'); h=bearer(admin)
    assert client.put('/api/admin/state',json={'notice':'partial'},headers=h).status_code==200
    assert client.get('/api/state').json['notice']=='partial'
    assert client.put('/api/admin/state',json={'unexpected':1},headers=h).status_code==400
    assert client.put('/api/admin/state',json={'siteName':'x'*41},headers=h).status_code==400
    assert client.put('/api/admin/state',json={'notice':'x'*1001},headers=h).status_code==400


def test_maintenance_blocks_member_login(client):
    register(client,'person1')
    create_admin(client); a=login(client,'root','secret-password-123')
    assert client.put('/api/admin/state',json={'maintenance':True},headers=bearer(a)).status_code==200
    assert login(client,'person1').status_code==503


def test_proxy_url_validation_and_key_redaction(client,monkeypatch):
    monkeypatch.setenv('SYNOX_API_KEY','server-secret'); register(client); l=login(client)
    for param in ('urlfoto','avatar','image','photo','icon'):
        assert client.get('/api/proxy/tools/cuaca',query_string={param:'https://u:p@example.com/a'},headers=bearer(l)).status_code==400
        assert client.get('/api/proxy/tools/cuaca',query_string={param:'https://example.com:444/a'},headers=bearer(l)).status_code==400
    class Up:
        status_code=200; headers={'Content-Type':'application/json'}
        def iter_content(self,n): yield b'{"key":"server-secret"}'
        def close(self): pass
    monkeypatch.setattr(backend.requests,'get',lambda *a,**k:Up())
    r=client.get('/api/proxy/tools/cuaca',headers=bearer(l))
    assert b'server-secret' not in r.data and b'[REDACTED]' in r.data
    assert r.headers['Cache-Control']=='no-store'


def test_recovery_code_is_one_time_rotates_and_revokes_sessions(client):
    created=register(client,'recovery1')
    assert created.status_code==201 and created.json['user']['role']=='member'
    code=created.json['recoveryCode']
    assert len(code)>=40
    with backend.app.app_context():
        saved=backend.db_conn().execute('select code_hash from recovery_codes').fetchone()['code_hash']
        assert saved==hashlib.sha256(code.encode()).hexdigest() and saved!=code
    old_session=login(client,'recovery1')
    reset=client.post('/api/auth/recover',json={'username':'recovery1','recoveryCode':code,'newPassword':'new-long-passphrase!'})
    assert reset.status_code==200
    rotated=reset.json['recoveryCode']; assert rotated != code
    assert client.get('/api/auth/me',headers=bearer(old_session)).status_code==401
    assert client.post('/api/auth/recover',json={'username':'recovery1','recoveryCode':code,'newPassword':'another-long-passphrase'}).status_code==400
    assert login(client,'recovery1').status_code==401
    assert login(client,'recovery1','new-long-passphrase!').status_code==200
    again=client.post('/api/auth/recover',json={'username':'recovery1','recoveryCode':rotated,'newPassword':'yet-another-passphrase!'})
    assert again.status_code==200


def test_authenticated_code_rotation_and_public_delete_password_gate(client):
    created=register(client,'deleteme')
    code=created.json['recoveryCode']; session=login(client,'deleteme')
    rotated=client.post('/api/auth/recovery-code',json={'password':'long-passphrase!'},headers=bearer(session))
    assert rotated.status_code==200 and rotated.json['recoveryCode'] != code
    assert client.post('/api/auth/recover',json={'username':'deleteme','recoveryCode':code,'newPassword':'new-password-12345'}).status_code==400
    assert client.post('/api/account/delete',json={'username':'deleteme','password':'wrong-password'}).status_code==401
    # Knowing a username alone never authorizes deletion.
    assert client.post('/api/account/delete',json={'username':'deleteme'}).status_code==401
    assert client.post('/api/account/delete',json={'username':'deleteme','password':'long-passphrase!'}).status_code==200
    assert client.post('/api/auth/login',json={'username':'deleteme','password':'long-passphrase!'}).status_code==401
    with backend.app.app_context():
        assert backend.db_conn().execute('select count(*) from recovery_codes').fetchone()[0]==0


def test_capabilities_and_legacy_database_migration(client,monkeypatch):
    monkeypatch.delenv('SYNOX_API_KEY',raising=False)
    caps=client.get('/api/capabilities').json
    assert caps['online'] is False and caps['tools']==[]
    register(client,'capable')
    session=login(client,'capable')
    assert client.get('/api/proxy/tools/cuaca',headers=bearer(session)).status_code==503
    monkeypatch.setenv('SYNOX_API_KEY','only-server-side')
    caps=client.get('/api/capabilities').json
    assert caps['online'] is True and caps['tools']==sorted(backend.ALLOWED_ROUTES)
