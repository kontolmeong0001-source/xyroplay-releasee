'use strict';
(() => {
  const configured = String(window.XYRO_CONFIG?.apiBase || '').replace(/\/$/, '');
  const base = configured || (location.hostname === 'appassets.androidplatform.net' || location.protocol === 'file:' ? '' : location.origin);
  let recoveryCode = '';
  async function call(path, data) {
    if (!base) throw Error('Server belum dikonfigurasi oleh pengelola.');
    const target = new URL(path, base);
    if (target.origin !== new URL(base).origin || !target.pathname.startsWith('/api/')) throw Error('Tujuan tidak diizinkan.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(target.href, {method:'POST', credentials:'omit', cache:'no-store', redirect:'error', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), signal:controller.signal});
      const result = await response.json();
      if (!response.ok) throw Error(response.status === 429 ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' : 'Permintaan tidak dapat diproses. Periksa data atau hubungi pengelola.');
      return result;
    } finally { clearTimeout(timer); }
  }
  const form = document.querySelector('form[data-account-action]');
  if (!form) return;
  const status = document.getElementById('accountStatus'), submit = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const username = document.getElementById('accountUsername').value.trim();
    submit.disabled = true; status.textContent = 'Memproses…';
    try {
      if (form.dataset.accountAction === 'delete') {
        await call('/api/account/delete', {username, password:document.getElementById('accountPassword').value});
        for (const key of Object.keys(localStorage)) if (['xyro_display_','xyro_photo_','xyro_history_'].some(prefix => key.toLowerCase() === (prefix + username).toLowerCase())) localStorage.removeItem(key);
        form.hidden = true;
        status.textContent = 'Akun, sesi login dan kode pemulihan telah dihapus dari server. Data profil/riwayat lokal pada origin dan perangkat ini sudah dibersihkan. Pada perangkat lain, bersihkan data aplikasinya juga. Log audit keamanan dipertahankan hingga 30 hari.';
      } else {
        const password = document.getElementById('accountPassword').value;
        if (password !== document.getElementById('accountPasswordConfirm').value) throw Error('Konfirmasi password tidak sama.');
        const result = await call('/api/auth/recover', {username, recoveryCode:document.getElementById('accountRecoveryCode').value.trim(), newPassword:password});
        recoveryCode = result.recoveryCode;
        form.hidden = true; document.getElementById('newRecoveryPanel').hidden = false;
        document.getElementById('newRecoveryCode').textContent = recoveryCode;
        status.textContent = 'Password berhasil diganti dan semua sesi lama dicabut. Simpan kode baru di bawah; kode sebelumnya tidak berlaku lagi.';
      }
    } catch (error) { status.textContent = error.name === 'AbortError' ? 'Koneksi terlalu lama. Jangan langsung mengulang penghapusan; periksa keadaan akun terlebih dahulu.' : error.message; }
    finally { form.querySelectorAll('input[type=password]').forEach(input => input.value = ''); submit.disabled = false; }
  });
  document.getElementById('saveNewRecovery')?.addEventListener('click', async () => {
    if (!recoveryCode) return;
    const blob = new Blob(['XyroPlay — kode pemulihan akun\n\n' + recoveryCode + '\n\nJangan bagikan kode ini. Kode dapat mengganti password akun.\n'], {type:'text/plain'});
    try {
      if (location.hostname === 'appassets.androidplatform.net') {
        if (!window.xyroSaveBlob) throw Error('Perbarui Android System WebView untuk menyimpan file. Anda juga dapat menyalin kode secara manual.');
        await window.xyroSaveBlob(blob, 'xyroplay-kode-pemulihan-baru.txt');
      } else {
        const url = URL.createObjectURL(blob), link = document.createElement('a');link.href = url;link.download = 'xyroplay-kode-pemulihan-baru.txt';link.click();setTimeout(() => URL.revokeObjectURL(url),30000);
      }
    } catch (error) { status.textContent = error.message; }
  });
  document.getElementById('savedNewRecovery')?.addEventListener('change', event => { document.getElementById('returnToLogin').hidden = !event.target.checked; });
  window.addEventListener('pagehide', () => { recoveryCode = ''; const value = document.getElementById('newRecoveryCode'); if(value)value.textContent = ''; });
})();
