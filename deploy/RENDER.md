# Deploy XyroPlay ke Render

Konfigurasi `render.yaml` di root membuat satu Docker Web Service dan memasang **persistent disk** di `/var/lib/xyroplay`; SQLite diarahkan ke `/var/lib/xyroplay/xyroplay.sqlite3`. Jangan mengganti ini dengan filesystem container: filesystem di luar disk persisten bersifat ephemeral dan data dapat hilang saat deploy/restart/instance diganti. Persistent disk Render umumnya membatasi service ke satu instance; SQLite tidak cocok untuk beberapa instance/replica atau akses tulis serentak lintas host.

## Setup

1. Setelah pemilik menyetujui publikasi dan biaya, gunakan repository Git privat yang dapat diakses Render, lalu pilih **New → Blueprint** dan repository/branch. Review `render.yaml` sebelum menekan apply/create. Jangan menekan apply/create sebelum persetujuan tersebut.
2. Tetapkan nama service unik dan pilih region. Hostname publik Render berbentuk `https://<nama-service>.onrender.com`; hostname itu dibuat oleh Render dan harus digunakan sebagai URL backend. Jangan mengasumsikan nama tertentu sampai service dibuat.
3. Persistent disk ditentukan di Blueprint pada `/var/lib/xyroplay`, ukuran awal 1 GB. Verifikasi status disk terpasang dan dapat ditulis sebelum mengandalkan data. Jangan menghapus disk saat mengubah konfigurasi. Disk persisten dan filesystem ephemeral bukan hal yang sama.
4. Simpan `SYNOX_API_KEY` kosong sebagaimana template. Provider API belum aktif; jangan mengisi key atau menganggap fitur provider bekerja. Jangan menaruh rahasia di Git, Dockerfile, atau image.
5. Setelah service sehat, uji `https://<nama-service>.onrender.com/api/health` dan pastikan JSON berisi `{"status":"ok"}`. Endpoint health tidak membuktikan bahwa backup/restore atau penyimpanan disk telah teruji.

## Rencana backend dan DNS (belum diterapkan)

Rencana terbaru adalah backend pada `app.xyroplay.web.id`. Situs Netlify existing di apex `xyroplay.web.id` dan `www.xyroplay.web.id` harus tetap berjalan tanpa perubahan. Registrar adalah IDWebhost; DNS authoritative adalah Netlify/NS1. Jangan ubah DNS/NS, jangan deploy, dan jangan migrasi nameserver. Biaya Render serta blocker izin GitHub belum beres; belum ada service Render yang boleh dianggap sudah dibuat.

Pemeriksaan DNS publik saat ini menunjukkan NXDOMAIN untuk CNAME, A, dan AAAA pada `app.xyroplay.web.id`. Hasil ini hanya untuk nama/tipe yang diperiksa, bukan bukti bahwa seluruh zone Netlify telah diinspeksi. Sampai ada service, hostname Render nyata, dan persetujuan record final, jangan membuat perubahan DNS. Setelah semua prasyarat tersebut terpenuhi dan record final disetujui, satu-satunya perubahan DNS yang direncanakan adalah CNAME `app` menuju hostname Render nyata. Jangan mengubah A apex, jangan menghapus AAAA apex/www, dan jangan migrasikan NS. Jangan menambahkan `domains` ke `render.yaml` sebelum review.

URL backend produksi yang direncanakan adalah `https://app.xyroplay.web.id`, tetapi jangan langsung mengisikannya. `apiBase` tetap kosong dan `releaseReady` tetap `false` sampai backend nyata diverifikasi. Jangan mengisi `release.json` atau `web/config.js`, atau rebuild APK, sebelum prasyarat tersebut terpenuhi dan perubahan koneksi disetujui. Setelah backend ada dan domain/TLS terverifikasi, uji `/api/health` serta fungsi yang diperlukan sebelum mengaktifkan konfigurasi.

Nameserver publik yang diketahui adalah `dns1.p03.nsone.net`, `dns2.p03.nsone.net`, `dns3.p03.nsone.net`, dan `dns4.p03.nsone.net` (Netlify/NS1; SOA `domains+netlify.netlify.com`). Mengedit panel DNS IDWebhost tidak mengubah DNS publik selama delegasi tetap di sana. Tidak ada pemeriksaan menyeluruh terhadap zone Netlify; jangan menyimpulkan record lain tidak ada atau tidak digunakan. Tidak ada DNS/NS yang diubah dan tidak ada deployment yang dilakukan.

Panduan record mengikuti [dokumentasi resmi DNS Render](https://render.com/docs/configure-other-dns).

Status mesin dan rincian domain yang belum diterapkan dicatat di [`domain-plan.json`](domain-plan.json).

## Runtime, proxy, dan izin

Docker image membaca `PORT` dari Render (fallback lokal 5000) dan bind ke `0.0.0.0`; jangan hard-code port publik. Health check Blueprint memeriksa `/api/health`. `TRUST_PROXY_HOPS=1` hanya mempercayai satu hop proxy untuk IP/protokol; jangan terbitkan backend di jalur lain yang memungkinkan klien memalsukan forwarded headers. TLS dan hostname `onrender.com` dikelola pada layanan Render.

Image berjalan sebagai UID/GID 10001 untuk aplikasi. Entrypoint singkat berjalan sebagai root hanya untuk memastikan direktori mount disk dimiliki `xyroplay`, lalu menurunkan hak akses sebelum menjalankan Gunicorn; SQLite mengatur direktori/file menjadi 0700/0600. Pastikan konfigurasi mount disk mendukung perbaikan ownership tersebut. Bila startup gagal dengan `Permission denied`, jangan memindahkan DB ke `/tmp` atau direktori ephemeral: periksa log, mount path, dan izin disk. Proses memerlukan akses tulis ke disk karena SQLite membuat file database/journal.

## Biaya, batasan dan operasi

Template memilih satu instance `0.5c-512mb`, region Singapore, disk 1 GB, branch `main`, dan `autoDeployTrigger: off`. Push Git tidak otomatis menerbitkan versi baru; pembuatan layanan pertama tetap merupakan publikasi dan memerlukan persetujuan. Menurut [harga resmi Render](https://render.com/pricing), compute tersebut USD 7/bulan dan disk USD 0,25/GB/bulan: biaya dasar USD 7,25/bulan pada workspace Hobby, sebelum pajak, kelebihan bandwidth, build atau penggunaan lain. Harga dan total akhir harus diperiksa kembali di dashboard sebelum konfirmasi. Tidak ada pembelian/berlangganan dibuat oleh persiapan ini.

[Disk persisten hanya tersedia untuk layanan berbayar](https://render.com/docs/disks). Jangan memakai paket gratis dengan SQLite ephemeral untuk akun produksi: akun bisa hilang saat restart/deploy. [Referensi Blueprint](https://render.com/docs/blueprint-spec) menjelaskan ID paket dan pengaturan deployment manual.

Persistent disk bukan backup. Tidak ada scheduler atau backup otomatis yang dikonfigurasi. Buat dan uji prosedur backup serta restore secara manual/terpisah, lindungi backup (database berisi data akun), batasi akses dan retensi. Hindari dua proses/replica yang membuka file SQLite yang sama. Jangan hapus atau detach disk sebagai bagian dari deploy tanpa memahami dampak data. Deploy dan perubahan skema tetap perlu diuji; health check saja tidak membuktikan migrasi atau integritas DB.
