# XyroPlay — web aktif dan kandidat Android

## Status saat ini

Project Netlify **`xyroplay-app` sudah publik** di [xyroplay-app.netlify.app](https://xyroplay-app.netlify.app). Host produksi [app.xyroplay.web.id](https://app.xyroplay.web.id) sudah dikonfigurasi dan HTTPS tervalidasi. Backend JavaScript Netlify Functions memakai **PostgreSQL yang sudah aktif**.

CNAME `app.xyroplay.web.id -> xyroplay-app.netlify.app` telah disetujui secara eksplisit dan dipasang. Situs utama `xyroplay.web.id`, `www.xyroplay.web.id`, serta DNS lainnya tetap tidak berubah. Render dan VPS/SQLite dalam panduan lama adalah alternatif, bukan layanan produksi saat ini. Rincian operasional ada di [`deploy/NETLIFY.md`](deploy/NETLIFY.md).

Status verifikasi yang telah dilaporkan: **24 pemeriksaan online dan 17 tes Netlify/PostgreSQL lulus**. Tes regresi Python terakhir juga lulus 23 tes. Angka ini mencatat hasil yang sudah tersedia, bukan klaim bahwa tes atau deployment baru dijalankan oleh pembaruan dokumentasi ini.

Paket Netlify saat ini adalah **Free, 300 kredit/bulan, tanpa kartu dan tanpa auto-top-up**. Ini bukan jaminan penggunaan tanpa batas; perubahan paket, penambahan kartu atau top-up tidak dilakukan oleh pembaruan dokumentasi ini.

**Synox masih dinonaktifkan karena API key belum tersedia.** Jangan memakai ulang kunci lama. Hosting aktif tidak berarti semua fitur pihak ketiga sudah aktif.

## Kandidat Android, belum terbit di Google Play

Kandidat **AAB dan APK signed `1.1-rc1`, versionCode `3`, application ID `id.xyroplay.app`** sudah disiapkan. Kandidat tersebut **belum dipublikasikan ke Google Play** dan bukan bukti bahwa review toko sudah selesai. Min SDK 26 dan target SDK 36 tetap menjadi basis proyek.

Listing, Data safety, screenshot, dan pengajuan publik final masih memerlukan review. Pastikan deklarasi privasi, fitur yang benar-benar aktif, hak penggunaan media/AI, rating konten, target usia, akses review serta persyaratan testing akun Play sesuai keadaan nyata sebelum submission. Pengelola publik adalah `xyro`, dengan kontak `agus1234567pa@gmail.com`.

Status kandidat di atas tidak berarti semua metadata/build default pada source dasar telah diubah. Pembaruan ini hanya dokumentasi: tidak mengubah `release.json`, `web/config.js`, Gradle, kode aplikasi atau paket kandidat. Uji perangkat nyata dan review konfigurasi kandidat tetap penting; AAB tidak dapat dipasang langsung seperti APK.

## Keamanan akun dan data

Password akun di-hash scrypt dengan salt di server. Tidak ada akun/password admin bawaan. Role dan otorisasi diperiksa server, bukan dipercaya dari localStorage. Token sesi acak berada di memori frontend; database menyimpan hash token dan sesi berlaku satu jam.

Pendaftaran memberi kode pemulihan sekali tampil. Server hanya menyimpan hash kode. Pemulihan mengganti password, mengganti kode sekali pakai dan mencabut sesi lama. Belum ada email/OTP; kehilangan password sekaligus kode tidak dapat dipulihkan otomatis.

Penghapusan akun memerlukan konfirmasi password dan menghapus akun, sesi serta hash kode pemulihan. Profil/foto/riwayat lokal harus dibersihkan di setiap perangkat. Rate limit Netlify memakai PostgreSQL bersama. Backup, retensi dan prosedur restore harus ditinjau sebagai operasi tersendiri; skrip backup SQLite lama bukan backup PostgreSQL produksi.

Android memakai WebViewAssetLoader, HTTPS saja dan tanpa `addJavascriptInterface`. Penyimpanan hasil memakai AndroidX WebMessageListener dengan pembatasan origin/frame, validasi tipe/nama/ukuran, serta pemilih lokasi sistem. Perilaku unduhan dan pemilih dokumen tetap perlu diuji pada perangkat nyata.

HTML awal yang mengandung kredensial tidak disalin. Menghapus kunci dari source tidak membatalkan kunci yang pernah bocor; kunci lama harus dicabut di layanan asal dan tidak dipakai ulang. Kunci signing, password, database, backup privat dan token tidak boleh masuk repo publik.

## Isi proyek

- `web/`: frontend dan halaman privasi, pemulihan serta penghapusan akun.
- `netlify/`: API Functions, koneksi PostgreSQL dan migrasi database untuk arsitektur produksi.
- `backend/`: alternatif Flask/SQLite dan tes regresinya, bukan backend produksi Netlify.
- `android/`: source Java/Gradle dan tes kebijakan unduhan.
- `scripts/`: build, konfigurasi publik, signing serta alat lokal.
- `deploy/NETLIFY.md`: status Netlify, domain, pengujian dan panduan lokal saat ini.
- `deploy/README.md`, `deploy/RENDER.md`, `deploy/domain-plan.json`: alternatif atau rencana lama; bukan sumber status DNS/deployment saat ini.
- `store/`: bahan listing dan referensi yang tetap perlu review sebelum publikasi.
- `VERIFIKASI.md`: catatan verifikasi sebelumnya beserta keterbatasannya.

## Menjalankan lokal

Untuk arsitektur yang sama dengan produksi, ikuti [`panduan Netlify lokal`](deploy/NETLIFY.md#menjalankan-lokal): Node 22+, PostgreSQL loopback dan database tes sekali pakai. **Jangan menjalankan tes destruktif pada database produksi.**

Alternatif Flask/SQLite lama masih bisa dijalankan secara lokal:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
python backend/app.py
```

Buka `http://127.0.0.1:5000`. Akun SQLite lokal tidak otomatis menjadi akun PostgreSQL produksi. Jangan mengunggah database lokal atau menjalankan migrasi data privat melalui repo publik.

## Build dan signing

Toolchain dasar: JDK 21, Android SDK platform/build-tools 36 dan Gradle Wrapper 8.13. Simpan upload key dan password di luar repo. Jangan memakai key baru untuk memperbarui aplikasi lama tanpa identitas signing yang sesuai/diakui Play Console. Build signed tidak menjamin persetujuan Google Play.

Skrip build dasar yang tersedia tidak otomatis membuktikan paket kandidat identik atau siap submission. Review versi, endpoint produksi, signing dan metadata kandidat sebelum build lanjutan; jangan menandai layanan Synox aktif tanpa key dan pengujian yang sah.

## Repo dan batas perubahan

Source berada di repo publik yang disetujui, [`kontolmeong0001-source/xyroplay-releasee`](https://github.com/kontolmeong0001-source/xyroplay-releasee). Visibilitas dan repo lain tidak diubah. Pembaruan status ini hanya mengubah dokumentasi: tidak melakukan deployment, provisioning database, perubahan DNS atau submission Google Play. Perubahan operasional baru tetap memerlukan persetujuan sesuai cakupannya.
