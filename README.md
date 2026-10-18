# XyroPlay — paket Android lanjutan

## Source Netlify terbaru — belum di-deploy

Pilihan terbaru yang disiapkan adalah frontend statis + JavaScript Functions + PostgreSQL privat untuk Netlify. Source ini disiapkan untuk repo publik yang disetujui pemilik, `kontolmeong0001-source/xyroplay-releasee`. Lihat [`deploy/NETLIFY.md`](deploy/NETLIFY.md) untuk uji lokal, batas kredit database, dan langkah yang tetap memerlukan persetujuan. Backend Flask/SQLite serta rencana Render di bawah tetap merupakan alternatif lama, bukan deployment yang sedang aktif. Situs utama `xyroplay.web.id` tidak diubah; `app.xyroplay.web.id` tetap rencana saja. Unggah source tidak mencakup login atau koneksi hosting, provisioning database cloud, deployment, DNS, maupun pengeluaran.

Paket ini melengkapi versi HTML menjadi frontend, backend akun, dan aplikasi Android. **APK dan AAB yang dibagikan adalah build signed untuk pengujian, bukan rilis siap Play Store.** Backend Android masih belum dihubungkan dan fitur pihak ketiga belum aktif. Pengelola publik sudah diisi `xyro`, dengan kontak `agus1234567pa@gmail.com`. Kebijakan privasi masih draf sampai hosting, operasi data dan rilis disetujui.

## Sudah dibuat

Password akun di-hash scrypt dengan salt di server, bukan disimpan di localStorage. Tidak ada akun/password admin bawaan. Otorisasi admin diperiksa server. Token sesi acak hanya berada di memori frontend; database menyimpan hash token dan sesi berlaku satu jam.

Pendaftaran memberi kode pemulihan sekali tampil. Server hanya menyimpan hash kode. Halaman `recovery.html` mengganti password, mengganti kode, dan mencabut seluruh sesi lama. Pengguna yang sudah login dapat mengganti kode dari menu akun setelah mengonfirmasi password. Belum ada email/OTP; kehilangan password sekaligus kode tidak dapat dipulihkan otomatis.

Penghapusan tersedia dari menu akun dan halaman web `deletion.html`, dengan konfirmasi password. Akun server, sesi dan hash kode pemulihan dihapus. Profil/foto/riwayat lokal harus dibersihkan di setiap perangkat. Log keamanan mempunyai retensi 30 hari; data usang dipangkas saat operasi pembatasan permintaan berikutnya, bukan melalui scheduler yang sudah dipasang.

Android memakai WebViewAssetLoader, HTTPS saja, tanpa `addJavascriptInterface`. Penyimpanan hasil lokal memakai AndroidX WebMessageListener yang dibatasi exact origin dan main frame, validasi tipe/nama/ukuran 10 MiB, serta pemilih lokasi sistem. Promise sukses hanya dikirim setelah stream file ditutup. Dukungan ini telah dibangun dan kebijakannya diuji unit; perilaku pemilih dokumen pada ponsel nyata masih perlu diuji.

Toolkit `deploy/` menyediakan Docker Compose, Caddy HTTPS, database persisten dan pemeriksaan kesiapan. Gunicorn tidak dipublikasikan langsung. Skrip backup menggunakan SQLite online backup API dan pemeriksaan integritas, bukan menyalin database hidup begitu saja. Backup tidak otomatis dijadwalkan, dienkripsi atau diunggah.

## Isi proyek

- `web/`: frontend, halaman privasi, pemulihan dan penghapusan akun.
- `backend/`: API Flask/SQLite, CLI pembuat owner dan tes backend.
- `android/`: Java/Gradle, kebijakan unduhan dan empat tes unit.
- `scripts/`: konfigurasi publik, signing, build signed, dan backup.
- `deploy/`: template VPS/HTTPS serta pemeriksaan rilis.
- `store/`: ikon PNG dari aset lokal, draf deskripsi toko dan sumber resmi.
- `VERIFIKASI.md`: pemeriksaan yang dijalankan beserta keterbatasannya.

HTML awal yang mengandung kredensial tidak disalin. Kunci lama tetap perlu dicabut di layanan asal oleh pemiliknya; menghapus dari source tidak membatalkan kunci yang sudah bocor. Jangan pakai ulang password lama yang pernah tersebar.

## Mencoba akun secara lokal

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
python backend/app.py
```

Buka `http://127.0.0.1:5000`. Daftar akun dengan username 5–32 karakter dan password 12–128 karakter, lalu simpan kode pemulihan yang ditampilkan. Fitur alat, AI dan musik sengaja menampilkan status belum aktif jika tidak ada API key server.

Untuk membuat owner awal, gunakan environment database yang sama dan jalankan:

```sh
python backend/manage.py create-admin
```

Username/password diminta interaktif; tidak ada password default. Default role owner dapat membuat admin lain. Jangan membuat akun dengan password contoh untuk layanan publik.

## Mengaktifkan produksi

Rencana terbaru adalah backend pada `app.xyroplay.web.id`; situs Netlify yang sudah ada di apex `xyroplay.web.id` dan `www.xyroplay.web.id` tetap berjalan tanpa perubahan. DNS authoritative tetap Netlify/NS1, sementara IDWebhost adalah registrar. Jangan ubah DNS atau nameserver, jangan migrasikan NS, dan jangan deploy. Hanya setelah service tersedia, hostname Render nyata diketahui, dan record final disetujui, rencana DNS terbatas pada CNAME `app` ke hostname Render tersebut. Tidak ada perubahan A apex, penghapusan AAAA apex/www, atau migrasi NS dalam rencana ini. Pemeriksaan publik saat ini mengembalikan NXDOMAIN untuk CNAME/A/AAAA `app.xyroplay.web.id`; ini bukan bukti bahwa seluruh zone Netlify telah diinspeksi. Lihat [`deploy/RENDER.md`](deploy/RENDER.md) dan [`deploy/domain-plan.json`](deploy/domain-plan.json) untuk status/rincian.

Backend produksi direncanakan memakai `https://app.xyroplay.web.id` **hanya setelah backend nyata diverifikasi**. Sampai saat itu `apiBase` harus tetap kosong dan `releaseReady` false; jangan mengisi `release.json` atau `web/config.js`, dan jangan menambahkan `domains` ke `render.yaml` sebelum review. Biaya Render serta blocker izin GitHub belum beres; jangan menganggap layanan sudah dibuat atau aplikasi sudah di-deploy. Tidak ada perubahan DNS atau situs publik yang dilakukan. Template VPS alternatif tetap ada di `deploy/README.md`. Dua repositori publik lama pengguna tidak ditimpa. API key Synox baru belum diberikan dan harus tetap kosong; jangan gunakan kunci lama.

Isi konfigurasi publik setelah data sebenarnya tersedia:

```sh
python3 scripts/configure_release.py \
  --backend https://HOSTNAME-ASLI \
  --operator "NAMA-PENGELOLA-ASLI" \
  --contact "EMAIL-KONTAK-ASLI"
python3 deploy/release_preflight.py --online https://HOSTNAME-ASLI
```

Perintah memperbarui `release.json`, `web/config.js`, dan halaman privasi. **Tidak menerima API key.** API key hanya ada di environment backend. Origin Android diizinkan secara default; jika frontend web terpisah, tambahkan exact origin-nya ke `XYRO_ALLOWED_ORIGINS`, tanpa wildcard. Pada template Caddy, backend mempercayai satu proxy yang menimpa forwarded headers. Jangan mengekspos port 5000 atau menambahkan proxy lain tanpa meninjau ulang kepercayaan ini.

Sesuaikan kebijakan privasi dengan hosting, log, backup dan penyedia yang benar-benar dipakai. Template teknis tidak menggantikan tinjauan hukum atau deklarasi pemilik. Pastikan hak penggunaan downloader, media dan AI. Endpoint yang menjanjikan aktivasi premium pihak ketiga tetap dinonaktifkan.

## Signing dan build Android

Pakai JDK 21, Android SDK platform/build-tools 36, Gradle Wrapper 8.13. Identitas sementara: application ID `id.xyroplay.app`, versionCode `2`, versionName `1.1`. Build uji memakai label `XyroPlay (uji)` dan versi `1.1-test`. Min SDK 26 dan target SDK 36.

Upload key baru dibuat untuk persiapan **aplikasi baru**, bukan pengganti identitas aplikasi yang sudah terbit. Key dan password diserahkan dalam cadangan privat terpisah; tidak disertakan dalam source atau GitHub. Cadangan itu memuat password: jangan bagikan ke publik. Setelah dipindahkan, sesuaikan `XYRO_KEYSTORE` pada `signing.env` ke lokasi aktual `.p12`.

```sh
export ANDROID_SDK_ROOT=/lokasi/Android/Sdk
. /folder-privat/signing.env
./scripts/build_release.sh --test-build
```

Build produksi menghapus flag uji dan mewajibkan pemeriksaan metadata serta health/capabilities server:

```sh
./scripts/build_release.sh
```

Pemeriksaan server hanya membuktikan endpoint health/capabilities tersedia, **bukan** bahwa semua endpoint penyedia sudah diuji. Untuk aplikasi yang sudah terbit, gunakan package ID, versi meningkat dan key yang sesuai/diakui Play Console. Jangan memakai key baru ini untuk menimpa update aplikasi lama tanpa proses resmi.

`android/build-unsigned.sh` tetap tersedia untuk bundle tanpa signing. AAB tidak dapat dipasang langsung seperti APK. File APK uji dapat dipasang untuk meninjau tampilan, tetapi login Android belum aktif sampai backend diisi dan aplikasi dibangun ulang.

## Belum selesai karena memerlukan pemilik/akses nyata

Identitas/email sudah diberikan dan aplikasi dikonfirmasi baru, belum pernah terbit. Yang masih diperlukan: persetujuan deployment publik dan biaya Render, URL backend sebenarnya, API key baru beserta pemeriksaan izin penyedia, serta akses Play Console. Selain itu: pengujian ponsel/emulator, screenshot Android nyata, feature graphic final, Data safety, rating konten, target usia, kredensial review dan persyaratan testing akun Play perlu dituntaskan sesuai akun/fitur nyata.

APK/AAB signed tidak berarti sudah diterbitkan, lolos review atau semua layanan online aktif. Belum dilakukan audit penetrasi independen dan tidak ada jaminan persetujuan Google Play.

## Pilihan penyimpanan source

Pengguna mengizinkan repository Public khusus `kontolmeong0001-source/xyroplay-releasee`, tanpa mengubah visibilitas atau menyentuh repository lama. Unggah hanya setelah repo tujuan dapat diverifikasi dan source beserta riwayat Git lolos pemeriksaan rahasia. Kunci signing dan backup privat tetap di luar repository. Persetujuan ini tidak mengaktifkan layanan Render atau perubahan DNS.
