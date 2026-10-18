#!/usr/bin/env python3
"""Konfigurasi publik saja. Jangan berikan API key atau password kepada skrip ini."""
import argparse
import html
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--backend'); p.add_argument('--operator'); p.add_argument('--contact')
p.add_argument('--application-id'); p.add_argument('--version-code', type=int); p.add_argument('--version-name')
p.add_argument('--draft', action='store_true', help='Boleh menghasilkan draf tanpa identitas/backend lengkap; bukan rilis produksi.')
a = p.parse_args()
file = ROOT/'release.json'
c = json.loads(file.read_text()) if file.exists() else {'apiBase':'','operatorName':'','contactEmail':'','applicationId':'id.xyroplay.app','versionCode':2,'versionName':'1.1'}
for key, value in {'apiBase':a.backend,'operatorName':a.operator,'contactEmail':a.contact,'applicationId':a.application_id,'versionCode':a.version_code,'versionName':a.version_name}.items():
    if value is not None: c[key] = value.strip() if isinstance(value,str) else value
if c['apiBase']:
    u = urlsplit(c['apiBase'])
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.query or u.fragment or u.path not in ('','/') or u.port not in (None,443): raise SystemExit('Backend harus origin HTTPS tanpa kredensial, path atau port non-443.')
    if u.hostname in ('localhost','appassets.androidplatform.net') or u.hostname.endswith(('.example','.invalid','.localhost')): raise SystemExit('Gunakan hostname server publik milik pengelola, bukan contoh atau hostname lokal.')
    try:
        if not ipaddress.ip_address(u.hostname).is_global: raise SystemExit('Alamat backend harus publik.')
    except ValueError: pass
    c['apiBase'] = 'https://' + u.netloc
if c['contactEmail'] and not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',c['contactEmail']): raise SystemExit('Format email kontak tidak valid.')
if not re.fullmatch(r'[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}',c['applicationId']): raise SystemExit('Application ID harus memiliki paling sedikit tiga segmen huruf kecil.')
if not isinstance(c['versionCode'],int) or not 1 <= c['versionCode'] <= 2100000000: raise SystemExit('versionCode tidak valid.')
if not re.fullmatch(r'[A-Za-z0-9._+-]{1,32}',c['versionName']): raise SystemExit('versionName tidak valid.')
ready = all(c.get(k) for k in ('apiBase','operatorName','contactEmail'))
if not a.draft and not ready: raise SystemExit('Lengkapi --backend, --operator dan --contact; gunakan --draft hanya untuk paket pengujian.')
c['releaseReady'] = ready and not a.draft
file.write_text(json.dumps(c,indent=2,ensure_ascii=False)+'\n')
(ROOT/'web/config.js').write_text('// Konfigurasi publik. Kunci API hanya boleh berada di server.\nwindow.XYRO_CONFIG = Object.freeze(' + json.dumps({'apiBase':c['apiBase']},ensure_ascii=False) + ');\n')
operator = html.escape(c['operatorName'] or 'Belum diisi — perlu identitas pengelola')
contact = '<a href="mailto:'+html.escape(c['contactEmail'],quote=True)+'">'+html.escape(c['contactEmail'])+'</a>' if c['contactEmail'] else '<strong>Belum diisi — perlu email kontak pengelola</strong>'
banner = '' if c['releaseReady'] else '<p class="note"><strong>Draf—belum untuk publikasi.</strong> Server, identitas/kontak pengelola atau persetujuan konfigurasi rilis belum lengkap. Paket ini tidak mengklaim kebijakan final maupun layanan yang sudah aktif.</p>'
policy = f'''<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'"><meta name="referrer" content="no-referrer"><title>Privasi XyroPlay</title><link rel="stylesheet" href="site.css"></head><body><main><div class="brand">XYROPLAY</div><h1>Kebijakan privasi</h1>{banner}
<p>Pengelola aplikasi: <strong>{operator}</strong>. Kontak permintaan privasi dan bantuan kepemilikan akun: {contact}.</p>
<h2>Data akun dan keamanan</h2><p>Untuk membuat akun, XyroPlay menggunakan username dan password. Server menyimpan username, hash password scrypt dengan salt, peran dan waktu pembuatan akun. Server menyimpan hash token sesi dengan masa berlaku satu jam dan hash kode pemulihan. Password, token sesi dan kode pemulihan tidak disimpan sebagai teks biasa di database.</p><p>Kode pemulihan ditampilkan sekali dan dapat digunakan mengganti password tanpa email. Setelah digunakan, kode diganti dan semua sesi lama dicabut. Jangan bagikan kode tersebut. Password dan token tidak disimpan di localStorage; token berada di memori aplikasi sampai sesi lokal ditutup.</p>
<h2>Profil, foto, riwayat dan file</h2><p>Nama tampilan, foto profil yang diperkecil dan riwayat penggunaan disimpan lokal pada perangkat. Foto profil tidak diunggah ke server oleh fitur profil. Pemilih dokumen hanya mengakses file yang dipilih pengguna. Hasil gambar/JSON dapat disimpan melalui pemilih lokasi sistem Android; aplikasi tidak memperoleh akses umum ke seluruh penyimpanan.</p>
<h2>Fitur online dan penyedia pihak ketiga</h2><p>Jika dikonfigurasi pengelola, permintaan alat, pencarian, pesan AI, teks dan URL yang dimasukkan dikirim melalui backend ke Synox Cloud (api.synoxcloud.xyz). Hasil media dapat dimuat langsung dari alamat HTTPS pihak ketiga. Server media menerima informasi jaringan seperti IP perangkat saat media dimuat. Jangan memasukkan password, kunci API, kode pemulihan, data kesehatan/keuangan atau informasi rahasia ke fitur alat dan AI.</p><p>Penggunaan konten harus sesuai izin pemiliknya dan ketentuan penyedia. XyroPlay tidak menjamin tersedianya semua endpoint penyedia. Pengelola perlu memverifikasi kebijakan, izin pemrosesan serta ketentuan penyedia sebelum mengaktifkannya bagi publik. Aktivasi premium pihak ketiga tidak tersedia.</p>
<h2>Tujuan dan retensi</h2><p>Data akun dipakai untuk autentikasi, kontrol akses, pemulihan dan penghapusan akun; disimpan sampai akun dihapus. Hash sesi yang kedaluwarsa dan pengenal pembatasan permintaan dibersihkan saat operasi pemeliharaan permintaan berikutnya. Pembatasan permintaan memakai pseudonim SHA-256 dari IP/username, bukan menyimpan alamat IP asli pada tabel tersebut; pseudonim tetap dianggap data yang berpotensi terkait pengguna. Bucket pembatasan dipertahankan paling lama satu jam sebelum pembersihan berikutnya.</p><p>Log audit keamanan dapat memuat username, jenis tindakan dan waktu; catatan berumur lebih dari 30 hari dihapus pada pemeliharaan berikutnya. Retensi ini tidak menjamin penghapusan tepat pada detik batas bila server tidak menerima permintaan. Server hosting/reverse proxy dapat mempunyai log tersendiri; pengelola wajib membatasi retensinya dan menghapus atau menganonimkan data sesuai kewajiban yang berlaku. Kebijakan backup produksi harus ditetapkan pengelola; backup tidak otomatis dibuat oleh paket ini.</p>
<h2>Penghapusan dan kontrol pengguna</h2><p>Di aplikasi, gunakan menu akun → Hapus akun &amp; data lokal lalu konfirmasi password. Tanpa memasang aplikasi, gunakan <a href="deletion.html">halaman penghapusan akun</a> dengan username dan password. Akun, sesi dan hash kode pemulihan di server dihapus setelah autentikasi berhasil. Log keamanan dapat dipertahankan sampai batas retensi di atas untuk penanganan penyalahgunaan.</p><p>Profil/riwayat lokal harus dibersihkan di setiap perangkat; penghapusan dari web tidak dapat menghapus file lokal aplikasi di perangkat lain. Tombol Bersihkan profil &amp; riwayat lokal hanya menghapus data perangkat, bukan akun server. Mencopot aplikasi juga tidak menghapus akun server. Untuk password yang terlupa, gunakan <a href="recovery.html">pemulihan dengan kode</a>; jika tidak memiliki kode, hubungi pengelola untuk verifikasi kepemilikan tanpa jaminan pemulihan otomatis.</p><p>Data yang sudah dikirim ke penyedia pihak ketiga mengikuti kebijakan penyedia dan perlu dikoordinasikan pengelola sesuai kewajiban yang berlaku. Paket source ini tidak memasang SDK iklan atau pelacak analitik; perubahan integrasi di masa depan harus diikuti pembaruan kebijakan dan deklarasi toko.</p>
<h2>Hubungi pengelola</h2><p>Untuk pertanyaan privasi, koreksi, akses atau penghapusan data, gunakan kontak pengelola di atas. Jangan mengirimkan password atau kode pemulihan sebagai bukti kepemilikan.</p><nav><a href="index.html">Aplikasi</a><a href="deletion.html">Hapus akun</a><a href="recovery.html">Pemulihan akun</a></nav></main></body></html>
'''
(ROOT/'web/privacy.html').write_text(policy)
print('Konfigurasi publik dan halaman privasi diperbarui. Status:', 'siap pemeriksaan rilis' if c['releaseReady'] else 'DRAF / pengujian saja')
