#!/usr/bin/env python3
"""Buat upload key BARU; jangan gunakan sebagai pengganti key aplikasi yang sudah terbit."""
import argparse
import os
import secrets
import shlex
import subprocess
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--new-app',action='store_true',required=True,help='Key ini hanya untuk aplikasi baru atau pendaftaran upload key baru yang disetujui pemilik.')
p.add_argument('--output-dir',type=Path,required=True)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]; directory=a.output_dir.expanduser().resolve()
if directory==root or root in directory.parents:raise SystemExit('Folder key harus berada di luar source proyek.')
directory.mkdir(parents=True,mode=0o700,exist_ok=True);directory.chmod(0o700)
key=directory/'xyroplay-upload.p12'
if key.exists():raise SystemExit('Key sudah ada; tidak akan ditimpa.')
password=secrets.token_urlsafe(36);env=os.environ.copy();env['XYRO_KEYSTORE_PASSWORD']=password
subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storetype','PKCS12','-storepass:env','XYRO_KEYSTORE_PASSWORD','-keypass:env','XYRO_KEYSTORE_PASSWORD','-alias','xyroplay-upload','-keyalg','RSA','-keysize','3072','-validity','10000','-sigalg','SHA256withRSA','-dname','CN=XyroPlay Upload Key,O=XyroPlay','-noprompt'],env=env,check=True,capture_output=True)
key.chmod(0o600)
configuration=directory/'signing.env'
configuration.write_text('export XYRO_KEYSTORE='+shlex.quote(str(key))+'\nexport XYRO_KEYSTORE_PASSWORD='+shlex.quote(password)+'\nexport XYRO_KEY_ALIAS=xyroplay-upload\nexport XYRO_KEY_PASSWORD='+shlex.quote(password)+'\n');configuration.chmod(0o600)
cert=directory/'xyroplay-upload-certificate.pem'
result=subprocess.run(['keytool','-exportcert','-rfc','-keystore',str(key),'-storepass:env','XYRO_KEYSTORE_PASSWORD','-alias','xyroplay-upload'],env=env,capture_output=True,check=True,text=True);cert.write_text(result.stdout)
(directory/'BACA-DULU.txt').write_text('CADANGAN KUNCI PRIBADI XYROPLAY\n\nFile signing.env memuat password key. Jangan upload folder/arsip ini ke GitHub, Vercel, hosting web, atau chat publik. Simpan cadangan pribadi sebelum meninggalkan komputer ini.\n\nKey ini BARU, bukan key dari aplikasi yang sudah pernah terbit. Jika aplikasi sudah ada di Play Console, gunakan key yang cocok atau proses reset upload key resmi; jangan menerbitkan update dengan identitas yang tidak cocok.\n\nAlias: xyroplay-upload\nTipe: PKCS12\nSertifikat publik: xyroplay-upload-certificate.pem\n\nUntuk membangun, atur XYRO_KEYSTORE ke lokasi aktual file .p12 di komputermu. signing.env berisi path komputer pembuat dan perlu disesuaikan setelah dipindahkan.\n')
print('Upload key baru dibuat di folder privat. Password tidak ditampilkan. Simpan cadangannya secara pribadi.')
