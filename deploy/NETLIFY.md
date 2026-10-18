# XyroPlay untuk Netlify — persiapan lokal

Versi Netlify ini belum di-deploy. Source disiapkan untuk diunggah hanya ke repo publik yang disetujui pemilik, `kontolmeong0001-source/xyroplay-releasee`. Tidak ada akun hosting dihubungkan, database cloud dibuat, atau DNS diubah. `xyroplay.web.id` tetap tidak disentuh. Tujuan yang direncanakan tetap `app.xyroplay.web.id`, tetapi belum dipasang.

## Apa yang berubah

Frontend yang sama dibangun ke `dist/` dari daftar aset publik eksplisit. API tetap memakai jalur `/api/...`, sehingga browser memakai origin yang sama tanpa URL backend hardcoded. Android masih belum diaktifkan: `web/config.js` tetap kosong dan metadata rilis tidak diubah.

Backend Netlify adalah JavaScript serverless dan PostgreSQL privat, bukan proses Flask yang terus berjalan. Backend Flask/SQLite lama dipertahankan sebagai alternatif dan untuk regresi. SQLite tidak diletakkan pada folder publik atau `/tmp` fungsi: penyimpanan sementara tidak aman untuk akun dan sesi permanen. [Cara kerja Netlify Functions](https://docs.netlify.com/build/functions/overview/).

Password memakai salted scrypt berformat kompatibel Werkzeug. Token sesi dan kode pemulihan hanya disimpan sebagai hash SHA-256. Recovery dikunci dalam transaksi, mengganti kode sekali pakai, serta mencabut sesi lama. Rate limit memakai PostgreSQL bersama, bukan memori satu fungsi. Role dan penghapusan diperiksa di server; data sesi/recovery ikut terhapus lewat foreign key. Identifier rate limit berupa hash, bukan IP mentah. IP menggunakan konteks platform, bukan header forwarded dari klien.

Database lama tidak dimodifikasi atau dimigrasikan otomatis. Source baru tidak membawa pengguna atau database privat. Jika akun lama perlu dipindahkan, lakukan backup dan migrasi privat terpisah setelah review; jangan mengunggah file SQLite ke GitHub atau frontend.

## Menjalankan lokal

Memerlukan Node 22+ dan PostgreSQL lokal. Buat database kosong milik sendiri. Isi environment `DATABASE_URL` dengan URL loopback lokal, dan `XYRO_ALLOW_LOCAL_DB=true` untuk mode lokal. Jangan memakai database produksi untuk tes.

```sh
npm ci
npm run build
# Isi DATABASE_URL dan XYRO_ALLOW_LOCAL_DB di terminal privat terlebih dahulu.
npm run db:migrate:local
npm run dev:local
```

Server pengujian hanya bind `127.0.0.1:8888`. Buka URL itu pada komputer yang menjalankannya. Tidak ada tunnel atau publikasi otomatis. Skrip migrasi dan owner sengaja menolak database non-loopback. Daftar akun melalui UI, simpan kode pemulihannya, lalu `npm run db:owner:local` untuk mempromosikan akun lokal dengan konfirmasi password. Tidak ada admin/password default.

Tes integrasi menghapus semua data database uji. Gunakan database loopback terpisah dengan nama berakhiran `_test`, terapkan migrasi pada database itu, lalu isi `TEST_DATABASE_URL` sebelum menjalankan `npm run test:netlify`.

## Database dan paket tanpa kartu

Pilihan yang disiapkan adalah Netlify Database (PostgreSQL) atau PostgreSQL kompatibel yang dipilih kemudian. [SDK resmi](https://docs.netlify.com/build/data-and-storage/netlify-database/api.md) mengambil URL database sesuai konteks deploy; preview tidak boleh memakai koneksi produksi yang di-hardcode. Migrasi berada di `netlify/database/migrations/`, mengikuti [migrasi native Netlify](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations.md).

Netlify Free memiliki batas kredit; ini bukan janji layanan database gratis tanpa batas. Database memakai kredit untuk compute dan bandwidth, di samping pemakaian layanan situs/fungsi. [Dokumentasi database](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/) menyebut compute 10 kredit per unit dan bandwidth 20 kredit/GB. Batas Free dan aturan saat kredit habis perlu diperiksa lagi pada layar akun sebelum deployment. Dokumentasi storage masih memuat tanggal transisi 1 Juli 2026; jangan menganggap storage pasti tetap gratis setelah tanggal itu. Tidak ada estimasi biaya yang menjamin aplikasi dapat aktif sepanjang bulan.

Menurut [paket resmi Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), Free credit-based adalah $0/bulan dengan 300 kredit/bulan, hard limit, dan tanpa auto-recharge. Akun lama dapat berada pada paket legacy yang berbeda; jangan memigrasikan paket akun secara otomatis. Saat batas tercapai, ketersediaan layanan terpengaruh, bukan izin untuk membayar atau upgrade.

Paket Free tanpa kartu menjadi sasaran, tetapi kelayakan akun dan provisioning tanpa kartu belum diverifikasi karena akun belum dihubungkan. Jika platform meminta kartu, upgrade, atau biaya, berhenti dan minta keputusan pemilik. Jangan mengaktifkan top-up atau paket berbayar. Memindahkan database ke penyedia gratis lain akan menambah akun, batas, dan kebijakan privasi tersendiri; tidak dilakukan otomatis.

## Sebelum ada deployment publik

Pemilik harus menyetujui project Netlify baru (bukan situs utama), pilihan database beserta batas kreditnya, serta deployment publik. Menghubungkan repository dapat memicu build/deploy, sehingga itu juga belum dilakukan. Persetujuan unggah source ke repo publik bukan persetujuan menghubungkan hosting atau deployment. Menempatkan folder migrasi native pada project yang kemudian di-deploy dapat memicu provisioning database; jangan lakukan tanpa persetujuan.

Setelah disetujui, verifikasi TLS database, migrasi, owner privat, backup/retensi, recovery, penghapusan, rate limit, serta kebijakan privasi pada staging. Uji URL bawaan project lebih dahulu sebelum meminta persetujuan record DNS final untuk `app`. Jangan mengubah apex/www/nameserver. Isi API Android dan bangun ulang hanya setelah backend nyata diverifikasi. API key Synox opsional tetap kosong: fitur pihak ketiga tidak aktif tanpa key baru yang sah.

Untuk Netlify, keluaran proxy dibatasi 4 MiB (lebih kecil dari batas lama 10 MiB) untuk memberi ruang pada batas respons fungsi. Unduhan besar akan ditolak, bukan dipotong diam-diam. Tes lokal tidak membuktikan kompatibilitas penuh platform, DNS, perangkat Android, atau layanan Synox nyata; semuanya belum dijalankan publik.

## Hasil uji lokal

Seluruh 16 tes Node lulus pada PostgreSQL 16 lokal: API akun, hash kompatibel Werkzeug, sesi, role, recovery sekali pakai dan replay bersamaan, penghapusan, rate limit lintas handler, CORS, batas input/output, proxy dengan upstream mock, build aset publik, dan smoke test server loopback memakai koneksi database nyata. Seluruh 23 tes regresi Python juga lulus. Pemeriksaan paket/source lulus, bundling esbuild target Node 22 berhasil, dan `npm audit --omit=dev` melaporkan 0 kerentanan yang diketahui pada pemeriksaan ini. Ini bukan audit keamanan independen atau jaminan tanpa kerentanan.

Folder `dist/`, dependensi, database lokal dan kunci signing tidak termasuk source publik. Tes dijalankan hanya pada database uji sekali pakai; tidak ada data akun lama yang dipindahkan.
