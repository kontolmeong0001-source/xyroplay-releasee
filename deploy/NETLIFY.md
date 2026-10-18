# XyroPlay di Netlify — status produksi dan panduan lokal

## Sudah aktif

Project **`xyroplay-app`** sudah publik di [https://xyroplay-app.netlify.app](https://xyroplay-app.netlify.app). Host produksi **[https://app.xyroplay.web.id](https://app.xyroplay.web.id)** sudah dikonfigurasi dan HTTPS tervalidasi. Backend Netlify Functions dan **PostgreSQL sudah aktif**.

CNAME berikut telah disetujui secara eksplisit dan dipasang:

```text
app.xyroplay.web.id -> xyroplay-app.netlify.app
```

Situs utama `xyroplay.web.id`, `www.xyroplay.web.id` dan DNS lainnya tetap tidak berubah. Rencana Render/VPS serta `domain-plan.json` adalah catatan alternatif/lama, bukan instruksi untuk mengganti DNS produksi saat ini. Jangan memasang ulang record atau mengubah apex, www maupun nameserver berdasarkan panduan lama.

Source publik berada di [`kontolmeong0001-source/xyroplay-releasee`](https://github.com/kontolmeong0001-source/xyroplay-releasee). Pembaruan dokumentasi ini tidak melakukan deployment, provisioning, perubahan DNS atau perubahan kode/config rilis.

## Arsitektur dan keamanan

Frontend dibangun ke `dist/` dari daftar aset publik eksplisit. API web memakai jalur `/api/...` pada origin yang sama. Backend adalah JavaScript serverless dengan PostgreSQL privat, bukan proses Flask yang terus berjalan. Flask/SQLite dipertahankan untuk alternatif lokal dan regresi; SQLite bukan database produksi Netlify dan tidak boleh diletakkan di folder publik atau penyimpanan sementara fungsi.

Password memakai salted scrypt berformat kompatibel Werkzeug. Token sesi dan kode pemulihan disimpan sebagai hash SHA-256. Recovery dikunci dalam transaksi, mengganti kode sekali pakai dan mencabut sesi lama. Rate limit memakai PostgreSQL bersama, bukan memori satu fungsi. Role dan penghapusan diperiksa di server; data sesi/recovery ikut terhapus lewat foreign key. Identifier rate limit berupa hash, bukan IP mentah. IP menggunakan konteks platform, bukan header forwarded dari klien.

SDK database mengambil koneksi sesuai konteks runtime Netlify. Perbaikan runtime tidak lagi mensyaratkan marker build `NETLIFY=true` untuk mengambil koneksi native. Preview tidak boleh memakai URL produksi yang di-hardcode. Migrasi ada di `netlify/database/migrations/`; menjalankan deployment/migrasi baru tetap merupakan tindakan operasional terpisah, bukan bagian pembaruan dokumentasi.

Source publik tidak membawa data akun atau database privat. Akun SQLite lokal tidak otomatis dipindahkan ke PostgreSQL produksi. Migrasi akun lama, backup, retensi dan pemulihan data harus ditangani privat dan ditinjau terpisah; skrip backup SQLite bukan prosedur backup PostgreSQL.

## Paket yang digunakan

Status paket yang telah dilaporkan adalah **Netlify Free dengan 300 kredit/bulan, tanpa kartu dan tanpa auto-top-up**. Ini mencatat konfigurasi yang tersedia, bukan janji layanan tanpa batas atau estimasi sisa kredit. Jangan mengaktifkan top-up, menambahkan kartu, mengganti paket atau memindahkan database tanpa persetujuan tersendiri.

## Hasil verifikasi yang tersedia

**24 pemeriksaan online lulus**, host produksi memiliki HTTPS tervalidasi, dan **17 tes Netlify/PostgreSQL saat ini lulus**. Tes runtime baru mencakup pengambilan koneksi native pada Functions tanpa marker build `NETLIFY`. Tes lainnya mencakup API akun, kompatibilitas hash Werkzeug, sesi, role, recovery sekali pakai/replay bersamaan, penghapusan, rate limit lintas handler, CORS, batas input/output, proxy dengan upstream mock, build aset publik dan smoke test server loopback dengan PostgreSQL nyata.

Hasil regresi terakhir juga mencatat **23 tes Python lulus**, pemeriksaan source/build berhasil dan bundling target Node 22 berhasil. Angka-angka ini merangkum hasil yang sudah dilaporkan; pembaruan dokumentasi ini tidak menjalankan ulang tes online, deployment atau audit keamanan independen. Pemeriksaan online tidak membuktikan semua perilaku perangkat Android atau layanan pihak ketiga telah diuji.

## Synox dan kandidat Android

**Synox tetap dinonaktifkan karena API key belum tersedia.** Jangan memakai ulang kunci lama, menaruh key di frontend/repo, atau menganggap hosting aktif berarti fitur alat/AI/musik pihak ketiga sudah aktif.

Kandidat **AAB/APK signed `1.1-rc1`, versionCode `3`, application ID `id.xyroplay.app`** sudah disiapkan tetapi **belum dipublikasikan ke Google Play**. Listing, Data safety, screenshot dan pengajuan publik final masih memerlukan review. Status kandidat tidak menyatakan semua metadata/build default source dasar sudah diubah; pembaruan ini hanya dokumentasi dan tidak membangun ulang paket Android.

Sebelum submission, cocokkan deklarasi privasi dengan layanan dan fitur yang benar-benar aktif, periksa konfigurasi endpoint/signing kandidat, uji perangkat nyata dan selesaikan review materi toko. Tidak ada submission Google Play yang diotorisasi oleh pembaruan dokumentasi ini.

## Menjalankan lokal

Memerlukan Node 22+ dan PostgreSQL lokal. Buat database lokal kosong. Isi environment `DATABASE_URL` dengan URL loopback lokal dan `XYRO_ALLOW_LOCAL_DB=true`. Jangan memakai database produksi untuk tes.

```sh
npm ci
npm run build
# Isi DATABASE_URL dan XYRO_ALLOW_LOCAL_DB di terminal privat terlebih dahulu.
npm run db:migrate:local
npm run dev:local
```

Server lokal hanya bind `127.0.0.1:8888`. Buka URL itu pada komputer yang menjalankannya. Perintah ini bukan deployment dan tidak membuka tunnel. Skrip migrasi/owner lokal menolak database non-loopback. Daftar melalui UI, simpan kode pemulihan, lalu gunakan `npm run db:owner:local` untuk mempromosikan akun lokal dengan konfirmasi password. Tidak ada admin/password default.

Tes integrasi **menghapus data database uji**. Pakai database loopback terpisah dengan nama berakhiran `_test`, terapkan migrasi pada database itu dan isi `TEST_DATABASE_URL` sebelum menjalankan:

```sh
npm run test:netlify
```

Jangan mengarahkan `TEST_DATABASE_URL` ke produksi. Folder `dist/`, `node_modules/`, `.netlify/`, database lokal, kredensial dan kunci signing tidak termasuk source publik.

## Batas yang tetap perlu diperhatikan

Keluaran proxy Netlify dibatasi 4 MiB untuk memberi ruang pada batas respons fungsi. Unduhan besar ditolak, bukan dipotong diam-diam. Keberhasilan pengujian tidak menjamin bebas kerentanan, layanan selalu tersedia atau persetujuan Google Play. Perubahan hosting, database, DNS, paket dan publikasi aplikasi berikutnya harus ditinjau sesuai cakupannya; panduan ini bukan izin melakukan perubahan tersebut.
