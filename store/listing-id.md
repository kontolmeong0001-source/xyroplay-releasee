# Materi listing XyroPlay — draf

> **Status publikasi:** Kandidat signed APK/AAB 1.1-rc1 (versionCode 3, app ID `id.xyroplay.app`) telah disiapkan, tetapi **belum dipublikasikan ke Google Play**. Listing/data safety, screenshot, dan pengajuan publik final masih menunggu peninjauan. Deployment backend saat ini adalah Netlify + PostgreSQL; rujuk [panduan deployment Netlify](../deploy/NETLIFY.md). Materi di bawah tetap draf dan bukan bukti bahwa aplikasi tersedia di Play Store.

**Nama:** XyroPlay

**Deskripsi singkat:** Alat digital, hasil gambar, dan pencarian dalam satu aplikasi.

**Deskripsi lengkap:**

XyroPlay menyatukan akses alat digital, pembuatan hasil gambar dan fitur pencarian melalui layanan yang dikonfigurasi pengelola. Masuk dengan akun untuk menggunakan fitur yang tersedia, simpan preferensi profil di perangkat, dan lihat riwayat penggunaan lokal.

Kontrol akun mencakup logout, penghapusan akun, serta kode pemulihan sekali pakai untuk mengganti password yang terlupa. Tidak perlu menyerahkan email untuk membuat akun username/password. Simpan kode pemulihan secara pribadi.

Fitur online memerlukan koneksi internet dan layanan penyedia yang aktif. Hasil, ketersediaan dan izin penggunaan konten mengikuti layanan penyedia dan pemilik konten. Jangan memasukkan password atau data sensitif ke fitur alat dan AI. Gunakan unduhan hanya untuk konten yang menjadi hakmu atau yang diizinkan pemiliknya.

**Belum boleh disubmit sebelum:** kontak pengelola diverifikasi, fitur ditinjau satu per satu, deklarasi Data safety/listing diselesaikan, serta screenshot Android nyata tersedia dan ditinjau. Server produksi telah aktif, tetapi itu sendiri bukan persetujuan untuk mengirim aplikasi. Synox masih nonaktif karena API key belum tersedia; sesuaikan klaim fitur dalam draf sebelum submission. Tidak ada jaminan fitur pihak ketiga atau klaim aktivasi premium.

## Aset

`icon-512.png` adalah ekspor 512×512 dari desain X lokal yang sudah ada. Ini belum merupakan bukti kepemilikan merek. Gunakan nama dan ikon ini hanya jika pemilik aplikasi menyetujui.

Screenshot bukti uji browser adalah dokumentasi pengujian web, **bukan** screenshot Android untuk Play Store. Ambil screenshot asli setelah aplikasi bekerja di ponsel/emulator. Gambar feature graphic dan materi promosi final masih perlu dibuat/disetujui sesuai fitur yang benar-benar aktif.

## Data safety — petunjuk peninjauan, bukan jawaban otomatis

Data akun berisi username, hash password, peran, waktu pembuatan serta hash sesi/kode pemulihan. Log audit dapat memuat username. Permintaan fitur online dapat mengandung teks, URL, pencarian dan pesan AI yang diteruskan ke penyedia. Media eksternal dapat menyebabkan pengungkapan IP kepada server media. Profil/foto/riwayat lokal tidak otomatis berarti "dikumpulkan" di server; tinjau implementasi akhir dan definisi Google Play sebelum mengisi.

Jangan memilih "tidak mengumpulkan data" hanya karena tidak ada SDK analitik. Deklarasikan penggunaan dan pembagian data sesuai perilaku produksi dan kebijakan penyedia yang telah diperiksa. Jangan mengisi rating konten, target usia atau pernyataan hukum tanpa keputusan pemilik aplikasi.
