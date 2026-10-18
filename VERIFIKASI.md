# Hasil verifikasi XyroPlay

## Yang benar-benar diuji

Backend: `python3 -m pytest -q` menghasilkan **13 lulus**. Cakupan termasuk autentikasi, batas peran, penghapusan akun, kode pemulihan satu kali, rotasi kode, pencabutan sesi dan kapabilitas/proxy tanpa kunci.

Android: `testDebugUnitTest` menghasilkan **4 kasus, 0 gagal, 0 error** untuk nama file, batas base64, whitelist MIME dan exact origin/allowlist. Pemeriksaan origin memakai `java.net.URI` dalam utilitas sehingga tidak bergantung pada stub `android.net.Uri` di tes JVM.

Build: `testDebugUnitTest lintRelease bundleRelease assembleRelease` berhasil. Lint memiliki **0 error, 0 fatal, 8 warning**. Warning dan peringatan deprecasi Gradle tidak disembunyikan; ini bukan audit keamanan independen.

APK: `apksigner verify --verbose --print-certs` berhasil, signature v2. Manifest melaporkan `id.xyroplay.app`, versionCode `2`, versionName `1.1-test`, minSdk 26, targetSdk 36, label `XyroPlay (uji)`, izin INTERNET. Tidak ada debugging WebView atau izin akses penyimpanan luas.

AAB: `bundletool validate` 1.18.3 berhasil; pemeriksaan ZIP, manifest, DEX, penanda signature dan kecocokan setiap aset web terhadap source. Urutan entri JAR dinormalisasi agar manifest dan signature berada di depan; isi tiap entri tidak diubah. `jarsigner -verify` memverifikasi signature. Peringatan sertifikat self-signed/tanpa timestamp wajar untuk upload key Android baru; bukan sertifikat identitas hukum atau jaminan toko.

Browser lokal: akun sintetis `ujirilis2026` dibuat lewat UI. Modal kode pemulihan menampilkan kode 43 karakter tanpa menyimpannya ke localStorage dan membersihkan tampilannya setelah disetujui. Halaman pemulihan mengganti password dan memberikan kode baru. Login dengan password baru berhasil; menu admin tidak muncul untuk akun biasa dan status layanan menunjukkan API penyedia belum dikonfigurasi. Akun sintetis lalu dihapus lewat halaman penghapusan publik dengan password; UI mengonfirmasi penghapusan. Bukti dashboard dan penghapusan disimpan sebagai screenshot web, bukan screenshot Android toko.

Tooling: skrip Python dikompilasi, skrip shell diperiksa dengan `bash -n`, dan semua JavaScript diperiksa `node --check`. Compose terbaca sebagai YAML dan backend tidak memiliki port publik. Backup SQLite online diuji pada database sementara, integritas baik dan mode output 0600. Toolkit tidak membuat backup produksi, scheduler atau pekerjaan rutin.

## Pemeriksaan yang sengaja belum lolos

`release_preflight.py` tetap menolak konfigurasi: backend publik belum diisi dan konfigurasi/kebijakan masih draf. Identitas publik `xyro` serta email `agus1234567pa@gmail.com` sudah diisi. Penolakan ini diharapkan dan melindungi dari build produksi yang mengklaim siap padahal belum siap. Build uji menggunakan flag khusus dan diberi label/versi uji.

`/api/capabilities` lokal mengembalikan `online:false`; tidak ada kunci Synox baru dan tidak ada fitur penyedia yang dinyatakan sudah berfungsi. Kehadiran kunci nantinya hanya menandakan konfigurasi, bukan bukti semua endpoint berfungsi.

## Belum diuji/dilakukan

Belum menjalankan aplikasi di emulator atau ponsel Android. Penyimpanan file SAF, pemilih foto, perilaku Back, lifecycle dan aksesibilitas perlu uji perangkat. Belum menguji semua API pihak ketiga, beban, pemulihan bencana atau penetrasi independen.

Docker tidak tersedia, sehingga container, Compose runtime, Caddy/TLS dan deployment VPS belum dijalankan. Belum ada backend publik aktif, DNS atau domain baru. Akun admin produksi belum dibuat. Kunci lama belum dicabut karena memerlukan akun penyedia pemilik.

Belum mengakses atau mengirim aplikasi ke Play Console, menyetujui biaya hosting, mengisi deklarasi hukum/Data safety/rating, atau mengklaim persetujuan toko. Key baru bukan pengganti signing key aplikasi yang sudah terbit. Cadangan key/password disimpan terpisah dari source dan GitHub.

## Lanjutan persiapan Render dan kontak publik

Konfigurasi Render ditambahkan untuk satu instance Docker di Singapore, disk persisten 1 GB, database di dalam mount disk, health check, dan deployment otomatis dimatikan. Belum dibuat layanan atau pengeluaran hosting. GitHub dan Render berhasil diakses; akses bukan persetujuan untuk deploy/pembelian.

Lima tes konfigurasi Render lulus (`python3 -m unittest discover -s tests -p test_render_config.py -v`; membutuhkan PyYAML di lingkungan tes). Tes memeriksa pemilihan instance, disk/DB, key kosong, health path, port dinamis, penolakan injeksi shell pada port, serta file runtime container. Mutasi filesystem dan pergantian user di-stub: ini bukan bukti container/disk Render sudah berjalan. `sh -n` lulus. Docker masih tidak tersedia.

APK dan AAB uji dibangun ulang memakai upload key yang sama agar identitas/kontak ikut tersalin ke aset Android. Build `testDebugUnitTest lintRelease bundleRelease assembleRelease` berhasil; pemeriksaan kesamaan seluruh aset AAB lulus. Signature APK diverifikasi `apksigner` (v2) dan AAB `jarsigner` (peringatan self-signed/tanpa timestamp tetap ada). Belum merupakan build produksi, uji perangkat, atau persetujuan Play Store.
