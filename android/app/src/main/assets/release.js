'use strict';
// Integrasi rilis: tidak menyimpan password, token atau kode pemulihan di localStorage.
let shownRecoveryCode = '';
function clearRecoveryCode() {
  shownRecoveryCode = '';
  document.getElementById('recoveryCodeValue').textContent = '';
  document.getElementById('recoveryCodeModal').classList.remove('open');
}
function showRecoveryCode(code) {
  if (typeof code !== 'string' || code.length < 20) return;
  shownRecoveryCode = code;
  document.getElementById('recoveryCodeValue').textContent = code;
  document.getElementById('recoveryCodeSaved').checked = false;
  document.getElementById('recoveryCodeClose').disabled = true;
  document.getElementById('recoveryCodeModal').classList.add('open');
}
async function saveBlobFile(blob, filename) {
  if (!(blob instanceof Blob) || blob.size === 0 || blob.size > 10 * 1024 * 1024) throw Error('File harus berukuran 1 byte–10 MiB.');
  if (location.hostname === 'appassets.androidplatform.net') {
    if (typeof window.xyroSaveBlob !== 'function') throw Error('Penyimpanan aman belum tersedia. Perbarui Android System WebView lalu coba lagi.');
    await window.xyroSaveBlob(blob, filename);
    return 'File berhasil disimpan';
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.hidden = true;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'Permintaan unduhan dikirim ke browser';
}
async function saveRecoveryCode() {
  if (!shownRecoveryCode) return;
  const btn = document.getElementById('recoveryCodeDownload'); btn.disabled = true;
  try { await saveBlobFile(new Blob(['XyroPlay — kode pemulihan akun\n\n' + shownRecoveryCode + '\n\nSimpan secara pribadi. Kode ini dapat mengganti password tanpa email. Jangan bagikan kepada siapa pun.\n'], {type:'text/plain'}), 'xyroplay-kode-pemulihan.txt'); }
  catch (err) { document.getElementById('recoveryCodeStatus').textContent = err.message; }
  finally { btn.disabled = false; }
}
function openRecoveryRotation() {
  if (!sessionUser) return;
  xyroToggleDrawer(false);
  document.getElementById('rotateRecoveryPassword').value = '';
  document.getElementById('rotateRecoveryStatus').textContent = '';
  document.getElementById('rotateRecoveryModal').classList.add('open');
}
async function rotateRecoveryCode() {
  const input = document.getElementById('rotateRecoveryPassword'), status = document.getElementById('rotateRecoveryStatus');
  if (!input.value) { status.textContent = 'Masukkan password saat ini.'; return; }
  const btn = document.getElementById('rotateRecoveryConfirm'); btn.disabled = true;
  try {
    const result = await api('/api/auth/recovery-code', 'POST', {password:input.value});
    xyroCloseModal('rotateRecoveryModal'); showRecoveryCode(result.recoveryCode);
  } catch (err) { status.textContent = err.message; }
  finally { input.value = ''; btn.disabled = false; }
}
window.xyroHandleBack = function () {
  if (document.getElementById('recoveryCodeModal').classList.contains('open')) return true;
  const modal = document.querySelector('.xyro-modal.open, #spotifySearchModal.open');
  if (modal) { modal.classList.remove('open'); return true; }
  if (document.getElementById('xyroDrawerShade').classList.contains('open')) { xyroToggleDrawer(false); return true; }
  if (typeof navHistory !== 'undefined' && navHistory.length > 1) { goBack(); return true; }
  return false;
};
async function updateCapabilities() {
  const status = document.getElementById('serviceStatus');
  if (!API_BASE) { status.textContent = 'Backend belum dihubungkan. Login dan fitur online belum aktif.'; return; }
  try {
    const result = await api('/api/capabilities');
    status.textContent = result.online ? 'Server terhubung; layanan pihak ketiga sudah dikonfigurasi. Ketersediaan setiap fitur mengikuti penyedia.' : 'Server akun terhubung. Fitur AI, musik dan alat online belum aktif karena API penyedia belum dikonfigurasi.';
  } catch (_) { status.textContent = 'Server belum dapat dihubungi. Periksa koneksi atau hubungi pengelola.'; }
}
document.getElementById('recoveryCodeSaved').addEventListener('change', e => { document.getElementById('recoveryCodeClose').disabled = !e.target.checked; });
document.getElementById('recoveryCodeClose').addEventListener('click', () => { if (document.getElementById('recoveryCodeSaved').checked) clearRecoveryCode(); });
document.getElementById('recoveryCodeDownload').addEventListener('click', saveRecoveryCode);
document.getElementById('rotateRecoveryBtn').addEventListener('click', openRecoveryRotation);
document.getElementById('rotateRecoveryCancel').addEventListener('click', () => xyroCloseModal('rotateRecoveryModal'));
document.getElementById('rotateRecoveryConfirm').addEventListener('click', rotateRecoveryCode);
document.addEventListener('click', async e => {
  const link = e.target.closest('a[download]');
  if (!link || !link.href.startsWith('blob:')) return;
  e.preventDefault();
  try { const response = await fetch(link.href); await saveBlobFile(await response.blob(), link.download || 'xyroplay-hasil.bin'); }
  catch (err) { alert(err.message); }
});
updateCapabilities();
