#!/usr/bin/env python3
"""Pemeriksaan source dan kesamaan aset AAB; tidak mengakses layanan eksternal."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import zipfile
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.scripts=[];self.inline=[];self.csp=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        self.inline.extend(k for k in a if k.startswith('on'))
        if tag=='script':self.scripts.append(a.get('src'))
        if tag=='meta' and a.get('http-equiv')=='Content-Security-Policy':self.csp=a.get('content','')
p=argparse.ArgumentParser();p.add_argument('bundle',nargs='?');p.add_argument('--signed',action='store_true');a=p.parse_args()
for name in ('index.html','privacy.html','recovery.html','deletion.html'):
    page=Page();page.feed((ROOT/'web'/name).read_text())
    assert not page.inline,name+': inline handlers'
    assert len(page.ids)==len(set(page.ids)),name+': duplicate ids'
    assert "default-src 'self'" in page.csp,name+': CSP missing'
    for source in page.scripts:assert source and (ROOT/'web'/source).is_file(),name+': script missing'
    if name=='index.html':assert page.scripts==['config.js','app.js','spotify.js','release.js','events.js']
js='\n'.join(f.read_text() for f in (ROOT/'web').glob('*.js'))
for forbidden in ('XYRO_ADMIN_PASSWORD','apikey=',"localStorage.setItem('xyro_user_","localStorage.setItem('xyro_role_"):
    assert forbidden not in js,'Forbidden credential/role pattern: '+forbidden
assert 'let authToken =' in js
assert 'xyroSaveBlob' in js and '/api/auth/recover' in js and '/api/account/delete' in js
print('Source checks: PASS (CSP, script order, ids, account pages, no embedded key/password accounts).')
if a.bundle:
    with zipfile.ZipFile(a.bundle) as z:
        assert z.testzip() is None
        for required in ('BundleConfig.pb','base/manifest/AndroidManifest.xml'):assert required in z.namelist()
        assert any(x.startswith('base/dex/') for x in z.namelist())
        signature=any(x.startswith('META-INF/') and x.upper().endswith(('.RSA','.DSA','.EC')) for x in z.namelist())
        assert signature==a.signed,'Unexpected signing state (pass --signed for signed bundle)'
        for f in (ROOT/'web').iterdir():
            if f.is_file():assert z.read('base/assets/'+f.name)==f.read_bytes(),'Asset mismatch: '+f.name
    print('AAB checks: PASS (ZIP, manifest/dex, signing marker, exact final web assets). Verify cryptographic signatures separately.')
