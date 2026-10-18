#!/usr/bin/env python3
"""Kompatibilitas lama: ubah backend pada mode draf; finalkan dengan configure_release.py."""
import subprocess
import sys
from pathlib import Path
if len(sys.argv)!=2:raise SystemExit('Penggunaan: python3 scripts/configure_backend.py https://HOSTNAME-ASLI')
subprocess.run([sys.executable,str(Path(__file__).with_name('configure_release.py')),'--backend',sys.argv[1],'--draft'],check=True)
print('Backend diperbarui sebagai DRAF. Finalkan operator/email dengan scripts/configure_release.py sebelum build produksi.')
