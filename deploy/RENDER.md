# Deploy XyroPlay ke Render

Konfigurasi `render.yaml` di root membuat satu Docker Web Service dan memasang **persistent disk** di `/var/lib/xyroplay`; SQLite diarahkan ke `/var/lib/xyroplay/xyroplay.sqlite3`. Jangan mengganti ini dengan filesystem container: filesystem di luar disk persisten bersifat ephemeral dan data dapat hilang saat deploy/restart/instance diganti. Persistent disk Render umumnya membatasi service ke satu instance; SQLite tidak cocok untuk beberapa instance/replica atau akses tulis serentak lintas host.

## Setup

1. Setelah pemilik menyetujui publikasi dan biaya, gunakan repository Git privat yang dapat diakses Render, lalu pilih **New → Blueprint** dan repository/branch. Review `render.yaml` sebelum menekan apply/create. Jangan menekan apply/create sebelum persetujuan tersebut.
2. Tetapkan nama service unik dan pilih region. Hostname publik Render berbentuk `https://<nama-service>.onrender.com`; hostname itu dibuat oleh Render dan harus digunakan sebagai URL backend. Jangan mengasumsikan nama tertentu sampai service dibuat.
3. Persistent disk ditentukan di Blueprint pada `/var/lib/xyroplay`, ukuran awal 1 GB. Verifikasi status disk terpasang dan dapat ditulis sebelum mengandalkan data. Jangan menghapus disk saat mengubah konfigurasi. Disk persisten dan filesystem ephemeral bukan hal yang sama.
4. Simpan `SYNOX_API_KEY` kosong sebagaimana template. Provider API belum aktif; jangan mengisi key atau menganggap fitur provider bekerja. Jangan menaruh rahasia di Git, Dockerfile, atau image.
5. Setelah service sehat, uji `https://<nama-service>.onrender.com/api/health` dan pastikan JSON berisi `{"status":"ok"}`. Endpoint health tidak membuktikan bahwa backup/restore atau penyimpanan disk telah teruji.

## Runtime, proxy, dan izin

Docker image membaca `PORT` dari Render (fallback lokal 5000) dan bind ke `0.0.0.0`; jangan hard-code port publik. Health check Blueprint memeriksa `/api/health`. `TRUST_PROXY_HOPS=1` hanya mempercayai satu hop proxy untuk IP/protokol; jangan terbitkan backend di jalur lain yang memungkinkan klien memalsukan forwarded headers. TLS dan hostname `onrender.com` dikelola pada layanan Render.

Image berjalan sebagai UID/GID 10001 untuk aplikasi. Entrypoint singkat berjalan sebagai root hanya untuk memastikan direktori mount disk dimiliki `xyroplay`, lalu menurunkan hak akses sebelum menjalankan Gunicorn; SQLite mengatur direktori/file menjadi 0700/0600. Pastikan konfigurasi mount disk mendukung perbaikan ownership tersebut. Bila startup gagal dengan `Permission denied`, jangan memindahkan DB ke `/tmp` atau direktori ephemeral: periksa log, mount path, dan izin disk. Proses memerlukan akses tulis ke disk karena SQLite membuat file database/journal.

## Biaya, batasan dan operasi

Template memilih satu instance `0.5c-512mb`, region Singapore, disk 1 GB, branch `main`, dan `autoDeployTrigger: off`. Push Git tidak otomatis menerbitkan versi baru; pembuatan layanan pertama tetap merupakan publikasi dan memerlukan persetujuan. Menurut [harga resmi Render](https://render.com/pricing), compute tersebut USD 7/bulan dan disk USD 0,25/GB/bulan: biaya dasar USD 7,25/bulan pada workspace Hobby, sebelum pajak, kelebihan bandwidth, build atau penggunaan lain. Harga dan total akhir harus diperiksa kembali di dashboard sebelum konfirmasi. Tidak ada pembelian/berlangganan dibuat oleh persiapan ini.

[Disk persisten hanya tersedia untuk layanan berbayar](https://render.com/docs/disks). Jangan memakai paket gratis dengan SQLite ephemeral untuk akun produksi: akun bisa hilang saat restart/deploy. [Referensi Blueprint](https://render.com/docs/blueprint-spec) menjelaskan ID paket dan pengaturan deployment manual.

Persistent disk bukan backup. Tidak ada scheduler atau backup otomatis yang dikonfigurasi. Buat dan uji prosedur backup serta restore secara manual/terpisah, lindungi backup (database berisi data akun), batasi akses dan retensi. Hindari dua proses/replica yang membuka file SQLite yang sama. Jangan hapus atau detach disk sebagai bagian dari deploy tanpa memahami dampak data. Deploy dan perubahan skema tetap perlu diuji; health check saja tidak membuktikan migrasi atau integritas DB.
