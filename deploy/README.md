# Operasional deployment XyroPlay (VPS)

Toolkit ini memakai Docker Compose, backend Flask/Gunicorn privat di jaringan internal, dan Caddy untuk HTTPS otomatis. Tidak ada port Gunicorn yang dipublikasikan. Anda tetap bertanggung jawab menyediakan VPS, DNS, firewall, kredensial provider, dan memantau layanan.

## Persiapan dan deploy

1. Arahkan record DNS `A` (dan bila digunakan `AAAA`) domain ke IP VPS. Buka TCP 80/443 serta UDP 443 di firewall/provider; SSH sebaiknya dibatasi ke alamat tepercaya. Docker dan Compose plugin v2 harus terpasang.
2. Jalankan dari direktori `deploy/`:
   ```sh
   cp .env.example .env
   chmod 600 .env
   ${EDITOR:-vi} .env
   ```
   Isi `XYRO_DOMAIN` dengan hostname publik sebenarnya. `ACME_EMAIL` opsional. File `.env` hanya memuat konfigurasi publik, bukan rahasia.
3. Buat `backend.env` secara manual dengan izin `0600`. Set `SYNOX_API_KEY` ke API key yang disediakan operator/provider dan isi hanya konfigurasi backend yang memang diperlukan. Jangan commit file ini, tempelkan ke tiket/chat, atau masukkan secret ke image; template sengaja tidak berisi secret. Jangan hidupkan API tanpa kunci yang benar.
4. Pastikan release config telah dibuat dan periksa kesiapan:
   ```sh
   python3 release_preflight.py
   ```
   Tanpa `release.json` release preflight semestinya gagal. Setelah metadata dikonfigurasi, `--online https://nama-domain` juga menguji `/api/health` dan memastikan `/api/capabilities` melaporkan `online: true`.
5. Build/start dan cek:
   ```sh
   docker compose -f compose.yaml config
   docker compose -f compose.yaml up -d --build
   docker compose -f compose.yaml ps
   docker compose -f compose.yaml logs --tail=100 caddy backend
   ```
   Verifikasi HTTPS, halaman privacy/deletion/recovery, dan API sebelum mengumumkan rilis. Backend mempercayai tepat satu proxy; Caddy menimpa header forwarded dan menjadi satu-satunya ingress. Jangan publikasikan port 5000 atau menaruh proxy lain di depannya tanpa menyesuaikan batas kepercayaan. Simpan `.env` dan `backend.env` secara privat.

## Data dan backup

Volume `xyroplay-data` menyimpan SQLite persisten. Caddy menyimpan state sertifikat dalam volume `caddy-data` dan `caddy-config`. Backup database secara manual sebelum upgrade/maintenance:

```sh
mkdir -p ./backups && chmod 700 ./backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T backend python /app/scripts/backup_db.py /var/lib/xyroplay/backups/xyroplay-$STAMP.sqlite3
docker compose cp backend:/var/lib/xyroplay/backups/xyroplay-$STAMP.sqlite3 ./backups/
chmod 600 ./backups/*.sqlite3
```

Salinan awal di volume yang sama bukan cadangan offsite. Pindahkan salinan host ke lokasi terpisah setelah dienkripsi, lalu kelola salinan sementara dan masa retensinya.

Skrip menggunakan SQLite online backup API (bukan menyalin file DB aktif), menjalankan `integrity_check`, dan membuat file mode `0600`. Backup berisi data pribadi: enkripsi dengan mekanisme yang Anda kendalikan sebelum mengirim/menaruh offsite, batasi akses, dan uji pemulihan secara berkala. Skrip tidak mengenkripsi, mengunggah, menjadwalkan, menghapus backup lama, atau menjamin retensi; operator harus melakukan semua itu secara manual. Simpan setidaknya satu backup terpisah, terenkripsi, dan teruji; tentukan retensi berdasarkan kebijakan organisasi.

### Pemulihan

Hentikan backend agar tidak ada perubahan selama restore. Simpan salinan volume/file database saat ini sebelum mengganti. Pulihkan backup yang telah didekripsi ke lokasi database di volume, pastikan pemilik/izin cocok dengan user container `xyroplay` (UID 10001, file dapat dibaca/ditulis hanya olehnya), lalu jalankan `PRAGMA integrity_check` sebelum menyalakan backend. Cara termudah untuk memulihkan adalah menggunakan container sementara pada volume yang sama atau prosedur pemeliharaan yang Anda uji terlebih dahulu; jangan menghapus volume untuk mencoba-coba. Jalankan `docker compose up -d` dan verifikasi health/API serta data yang diharapkan. Jangan menguji restore langsung pada database produksi.

## Upgrade, rollback, dan privasi

Sebelum rilis baru, buat dan verifikasi backup. Review perubahan, build image, deploy dengan `docker compose up -d --build`, lalu cek health, log, autentikasi, dan alur penting. Untuk rollback image, checkout versi kode terdahulu dan build kembali; perubahan skema mungkin tidak kompatibel mundur, sehingga pemulihan backup dapat diperlukan. Jangan menghapus volume saat menjalankan `down`; hindari `down -v` karena menghapus data persisten.

Halaman penghapusan akun menjelaskan penghapusan akun server, sesi, kode pemulihan, serta batasan data lokal dan log. Sampaikan URL halaman penghapusan yang publik kepada pengguna. Penghapusan akun bukan penghapusan backup historis: backup sensitif harus dienkripsi, dibatasi aksesnya, dan dihapus sesuai retensi/kebijakan yang Anda tetapkan. Tool ini tidak membuat jadwal retensi atau menghapus backup secara otomatis. Pastikan DNS, sertifikat, backup, pemantauan, serta kebijakan privasi dan kontak operator benar sebelum produksi.
