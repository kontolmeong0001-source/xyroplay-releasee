#!/usr/bin/env python3
"""Letakkan JAR manifest di awal ZIP; isi setiap entry dan signature tidak diubah."""
import os
import sys
import tempfile
import zipfile
from pathlib import Path
if len(sys.argv)!=2:raise SystemExit('Penggunaan: normalize_aab.py file.aab')
p=Path(sys.argv[1]).resolve()
fd,name=tempfile.mkstemp(prefix=p.name+'.',suffix='.tmp',dir=p.parent);os.close(fd)
try:
    with zipfile.ZipFile(p) as source,zipfile.ZipFile(name,'w') as target:
        infos=source.infolist()
        if len({i.filename for i in infos})!=len(infos):raise ValueError('Duplicate ZIP entries are not allowed')
        infos.sort(key=lambda i:0 if i.filename=='META-INF/' else 1 if i.filename=='META-INF/MANIFEST.MF' else 2 if i.filename.startswith('META-INF/') and i.filename.endswith('.SF') else 3 if i.filename.startswith('META-INF/') and i.filename.endswith(('.RSA','.DSA','.EC')) else 4 if i.filename.startswith('META-INF/') else 5)
        for info in infos:target.writestr(info,source.read(info.filename))
    with zipfile.ZipFile(name) as check:
        if check.testzip() is not None:raise ValueError('ZIP validation failed')
    os.chmod(name,p.stat().st_mode);os.replace(name,p)
finally:
    if os.path.exists(name):os.unlink(name)
print('Urutan ZIP AAB dinormalisasi; seluruh isi entry dipertahankan.')
