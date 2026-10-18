#!/usr/bin/env python3
"""Periksa konfigurasi produksi; opsi --online hanya membaca endpoint publik."""
import argparse
import ipaddress
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
def valid_origin(value):
    try:
        u=urlsplit(value)
        if u.scheme!='https' or not u.hostname or u.username or u.password or u.path not in ('','/') or u.query or u.fragment or u.port not in (None,443):return False
        if u.hostname in ('localhost','appassets.androidplatform.net') or u.hostname.endswith(('.example','.invalid','.localhost')):return False
        try:return ipaddress.ip_address(u.hostname).is_global
        except ValueError:return True
    except (ValueError,TypeError):return False

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--online',metavar='BASE_URL');a=p.parse_args();errors=[];meta={}
    try:
        meta=json.loads((ROOT/'release.json').read_text())
        for key in ('apiBase','operatorName','contactEmail','applicationId','versionCode','versionName'):
            if not meta.get(key):errors.append('release.json: '+key+' belum diisi')
        if not valid_origin(meta.get('apiBase')):errors.append('apiBase harus origin HTTPS publik yang valid')
        if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',meta.get('contactEmail','')):errors.append('email kontak tidak valid')
        if meta.get('releaseReady') is not True:errors.append('konfigurasi masih ditandai draf/pengujian')
        if not isinstance(meta.get('versionCode'),int) or meta.get('versionCode',0)<1:errors.append('versionCode tidak valid')
    except (OSError,ValueError) as error:errors.append('metadata tidak dapat dibaca: '+str(error))
    try:
        content=(ROOT/'web/config.js').read_text();match=re.search(r'Object\.freeze\((\{.*\})\)',content)
        configured=json.loads(match.group(1))['apiBase'] if match else ''
        if not valid_origin(configured) or configured!=meta.get('apiBase'):errors.append('web/config.js tidak cocok dengan origin produksi release.json')
    except (OSError,ValueError,KeyError) as error:errors.append('config.js tidak valid: '+str(error))
    for rel in ('privacy.html','deletion.html','recovery.html'):
        file=ROOT/'web'/rel
        if not file.is_file():errors.append('halaman wajib tidak ada: '+rel)
        elif rel=='privacy.html' and any(token in file.read_text() for token in ('Draf—belum','Belum diisi —')):errors.append('halaman privasi masih draf atau identitas/kontaknya kosong')
    if a.online:
        base=a.online.rstrip('/')
        if not valid_origin(base) or base!=meta.get('apiBase'):errors.append('--online harus sama dengan origin HTTPS publik di release.json')
        else:
            for endpoint in ('/api/health','/api/capabilities'):
                try:
                    request=urllib.request.Request(base+endpoint,headers={'Accept':'application/json'})
                    with urllib.request.urlopen(request,timeout=10) as response:
                        if response.geturl()!=base+endpoint:raise ValueError('redirect tidak diizinkan')
                        data=json.loads(response.read(65536))
                        if response.status!=200 or not isinstance(data,dict):raise ValueError('respons tidak valid')
                        if endpoint.endswith('/health') and data.get('status')!='ok':raise ValueError('health tidak sehat')
                        if endpoint.endswith('/capabilities') and data.get('online') is not True:raise ValueError('API key belum dikonfigurasi')
                except (urllib.error.URLError,TimeoutError,ValueError) as error:errors.append(endpoint+': '+str(error))
    if errors:
        print('RELEASE PREFLIGHT FAILED\n'+'\n'.join('- '+e for e in errors));return 1
    print('RELEASE PREFLIGHT PASSED — '+('health/capabilities dibaca; bukan pengujian semua endpoint penyedia' if a.online else 'konfigurasi lokal saja'));return 0
if __name__=='__main__':sys.exit(main())
