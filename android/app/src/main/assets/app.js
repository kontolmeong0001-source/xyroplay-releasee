
  /* ============ TOGGLE PASSWORD ============ */
  function togglePass(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  }

  /* ============ LIVE CLOCK ============ */
  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function pad(n) { return n < 10 ? '0' + n : n; }

  function updateClock() {
    const now = new Date();
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    const timeEl = document.getElementById('liveClock');
    if (timeEl) timeEl.textContent = `${hh}:${mm}:${ss}`;

    const hari = HARI[now.getDay()];
    const tgl = now.getDate();
    const bln = BULAN[now.getMonth()];
    const thn = now.getFullYear();

    const dateEl = document.getElementById('liveDate');
    if (dateEl) dateEl.textContent = `${hari}, ${tgl} ${bln} ${thn}`;

    const hour = now.getHours();
    let greet = '';
    if (hour >= 4 && hour < 11) greet = '🌅 Pagi';
    else if (hour >= 11 && hour < 15) greet = '☀️ Siang';
    else if (hour >= 15 && hour < 18) greet = '🌇 Sore';
    else greet = '🌙 Malam';

    const greetEl = document.getElementById('liveGreeting');
    if (greetEl) greetEl.textContent = greet;
  }

  setInterval(updateClock, 1000);
  updateClock();

  /* ============ NAV ============ */
  let navHistory = ['home'];
  let currentUser = '';

  function navTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (navHistory[navHistory.length - 1] !== page) navHistory.push(page);
    document.getElementById('content').scrollTop = 0;
  }

  function goBack() {
    navHistory.pop();
    const prev = navHistory[navHistory.length - 1] || 'home';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + prev).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${prev}"]`);
    if (navBtn) navBtn.classList.add('active');
    document.getElementById('content').scrollTop = 0;
  }

  /* ============ AUTH ============ */
  function switchTab(tab, btn) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
    document.getElementById(tab === 'login' ? 'loginForm' : 'registerForm').classList.add('active');
  }

  // Akun, password dan hak akses hanya dikelola backend. Token tidak dipersistenkan.
  const configuredBase = String(window.XYRO_CONFIG?.apiBase || '').replace(/\/$/, '');
  const localDev = ['localhost','127.0.0.1'].includes(location.hostname);
  const API_BASE = configuredBase || (location.hostname === 'appassets.androidplatform.net' || location.protocol === 'file:' ? '' : location.origin);
  if (configuredBase && !/^https:\/\/[^/]+$/.test(configuredBase) && !(localDev && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configuredBase))) throw Error('Origin backend harus HTTPS.');
  let authToken = '', sessionUser = null, currentRole = 'user', authBusy = false;
  let adminState = {notice:'',maintenance:false,siteName:'XYROPLAY',activity:[]}, adminUserCache = [];
  // Hapus kredensial/role lama di origin yang sama, tanpa mengimpor password plaintext.
  for (const key of Object.keys(localStorage)) {
    if (/^xyro_(user_|role_|admin_)/.test(key) || ['xyro_maintenance','xyro_site_name'].includes(key)) localStorage.removeItem(key);
  }
  function ensureBackend() {
    if (!API_BASE) throw Error('Backend belum diaktifkan. Pengembang perlu mengisi origin HTTPS server di config.js lalu membangun ulang aplikasi.');
  }
  async function apiRaw(url, options={}) {
    ensureBackend();
    const parsed=new URL(url,API_BASE);
    if(parsed.origin!==new URL(API_BASE).origin || !parsed.pathname.startsWith('/api/')) throw Error('Tujuan API tidak diizinkan.');
    const headers=new Headers(options.headers || {});
    if(authToken)headers.set('Authorization','Bearer '+authToken);
    if(options.body)headers.set('Content-Type','application/json');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try {
      const res=await fetch(parsed.href,{...options,headers,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!res.ok){
        let message='Permintaan gagal (HTTP '+res.status+').';
        try{const data=await res.json();message=data.error||data.message||message;}catch(_){}
        if(res.status===401&&authToken&&!['/api/auth/account','/api/auth/recovery-code'].includes(parsed.pathname)){authToken='';sessionUser=null;resetAuthUI();}
        throw Error(message);
      }
      return res;
    } finally {clearTimeout(timer);}
  }
  async function api(path,method='GET',body) {
    const res=await apiRaw(API_BASE+path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
    return res.status===204?{}:await res.json();
  }
  function setSession(data){authToken=data.token;sessionUser=data.user;currentRole=['admin','owner','developer'].includes(data.user.role)?'admin':'user';}
  async function doRegister(){
    if(authBusy)return;
    const username=document.getElementById('regUser').value.trim(),password=document.getElementById('regPass').value;
    const msg=document.getElementById('regMsg');
    if(!/^[a-zA-Z0-9_.-]{5,32}$/.test(username)){msg.textContent='Username: 5–32 huruf, angka, titik, _ atau -.';return;}
    if(password.length<12 || password.length>128){msg.textContent='Password harus 12–128 karakter.';return;}
    if(password!==document.getElementById('regPass2').value){msg.textContent='Konfirmasi password tidak sama.';return;}
    authBusy=true;msg.textContent='Mendaftarkan akun...';
    try{const result=await api('/api/auth/register','POST',{username,password});showRecoveryCode(result.recoveryCode);document.getElementById('regPass').value='';document.getElementById('regPass2').value='';msg.textContent='Akun berhasil dibuat. Silakan login.';}
    catch(err){msg.textContent=err.message;}finally{authBusy=false;}
  }
  async function doLogin(){
    if(authBusy)return;
    const username=document.getElementById('loginUser').value.trim(),password=document.getElementById('loginPass').value,msg=document.getElementById('loginMsg');
    if(!username||!password){msg.textContent='Isi username dan password.';return;}
    authBusy=true;msg.textContent='Memverifikasi akun...';
    try{const data=await api('/api/auth/login','POST',{username,password});setSession(data);document.getElementById('loginPass').value='';msg.textContent='';showApp(data.user.username);}
    catch(err){msg.textContent=err.message;}finally{authBusy=false;}
  }
  function playIntro(){if(sessionUser)showApp(sessionUser.username);}
  function skipVideo(){if(sessionUser)showApp(sessionUser.username);}
  function showApp(username){
    if(!sessionUser || sessionUser.username!==username)return;
    currentUser=username;document.getElementById('authBox').style.display='none';document.getElementById('videoScreen').style.display='none';document.getElementById('app').style.display='flex';
    document.getElementById('spotifySearchOpen').style.display='flex';
    const name=localStorage.getItem('xyro_display_'+username)||username;
    document.getElementById('userName').textContent=name;document.getElementById('greetName').textContent=name;document.getElementById('userAvatar').textContent=username.charAt(0).toUpperCase();
    document.getElementById('adminNavItem').style.display=currentRole==='admin'?'flex':'none';
    document.querySelector('.user-card-v2 .role').textContent=xyroRole().toUpperCase();xyroRefreshDrawer();xyroLogUsage('Login / membuka XYROPLAY');if(currentRole==='admin')renderAdminPanel();navTo('home');
  }
  function resetAuthUI(){
    document.getElementById('app').style.display='none';document.getElementById('videoScreen').style.display='none';document.getElementById('xyroHamburger').style.display='none';xyroToggleDrawer(false);
    document.getElementById('spotifySearchOpen').style.display='none';document.getElementById('spotifySearchModal').classList.remove('open');document.getElementById('authBox').style.display='flex';
    document.querySelectorAll('.xyro-modal').forEach(el=>el.classList.remove('open'));
    document.getElementById('loginPass').value='';currentUser='';currentRole='user';navHistory=['home'];adminUserCache=[];
    document.getElementById('adminUsersList').textContent='';document.getElementById('adminActivityList').textContent='';
  }
  async function logout(){
    try{if(authToken)await api('/api/auth/logout','POST',{});}catch(err){alert('Sesi lokal ditutup. Pencabutan sesi server belum terkonfirmasi; sesi server akan kedaluwarsa otomatis.');}
    finally{authToken='';sessionUser=null;resetAuthUI();}
  }
  function adminRequire(){if(!sessionUser||currentRole!=='admin'){alert('Akses khusus admin.');return false;}return true;}
  function escapeAdminText(v){return escapeHtml(v);}
  async function renderAdminPanel(){
    if(!adminRequire())return;
    try{
      const [state,users]=await Promise.all([api('/api/admin/state'),api('/api/admin/users')]);adminState=state;adminUserCache=users.users;
      document.getElementById('adminUserCount').textContent=adminUserCache.length;
      document.getElementById('adminNoticeCount').textContent=state.notice?1:0;
      document.getElementById('adminMaintenanceStatus').textContent=state.maintenance?'Maintenance':'Aktif';
      document.getElementById('adminStatusHint').textContent='Data terverifikasi server';
      document.getElementById('adminMaintenanceBtn').textContent=state.maintenance?'Matikan maintenance':'Aktifkan maintenance';
      document.getElementById('adminNoticeInput').value=state.notice;document.getElementById('adminNoticePreview').textContent=state.notice||'Belum ada pengumuman.';
      document.getElementById('adminSiteNamePreview').textContent=state.siteName;document.getElementById('adminActivityCount').textContent=state.activity.length+' log';
      document.getElementById('adminActivityList').innerHTML=state.activity.map(a=>`<div class="admin-activity-row"><b>${escapeHtml(a.text)}</b><small>${escapeHtml(a.at)}</small></div>`).join('')||'Belum ada aktivitas.';
      renderAdminUsers();
    }catch(err){document.getElementById('adminStatusHint').textContent=err.message;}
  }
  function renderAdminUsers(){
    const el=document.getElementById('adminUsersList');el.replaceChildren();const q=document.getElementById('adminUserSearch').value.toLowerCase();
    const users=adminUserCache.filter(u=>u.username.toLowerCase().includes(q));document.getElementById('adminVisibleUsers').textContent=users.length+' akun';
    for(const u of users){const row=document.createElement('div');row.className='admin-user-row';const text=document.createElement('span');text.textContent=u.username+' · '+u.role;const btn=document.createElement('button');btn.textContent='Hapus';btn.addEventListener('click',()=>adminDeleteUser(u.username));row.append(text,btn);el.append(row);}
  }
  async function adminChange(patch){if(!adminRequire())return;try{await api('/api/admin/state','PUT',patch);await renderAdminPanel();}catch(err){alert(err.message);}}
  function adminSaveNotice(){adminChange({notice:document.getElementById('adminNoticeInput').value.trim()});}
  function adminClearNotice(){if(confirm('Hapus pengumuman?'))adminChange({notice:''});}
  async function adminCreateUser(){
    if(!adminRequire())return;
    try{await api('/api/admin/users','POST',{username:document.getElementById('adminNewUser').value.trim(),password:document.getElementById('adminNewPass').value,role:document.getElementById('adminNewRole').value});document.getElementById('adminNewPass').value='';await renderAdminPanel();alert('Akun dibuat di server.');}catch(err){alert(err.message);}
  }
  async function adminDeleteUser(username){if(!adminRequire()||!confirm('Hapus akun '+username+'?'))return;try{await api('/api/admin/users/'+encodeURIComponent(username),'DELETE');await renderAdminPanel();}catch(err){alert(err.message);}}
  function adminToggleMaintenance(){adminChange({maintenance:!adminState.maintenance});}
  function adminToggleTheme(){if(adminRequire())document.body.classList.toggle('admin-light-theme');}
  function adminSetSiteName(){if(!adminRequire())return;const name=prompt('Nama aplikasi:',adminState.siteName);if(name!==null)adminChange({siteName:name.trim()});}
  async function adminExportData(){
    if(!adminRequire())return;
    try{await saveBlobFile(new Blob([JSON.stringify({notice:adminState.notice,maintenance:adminState.maintenance,siteName:adminState.siteName},null,2)],{type:'application/json'}),'xyroplay-pengaturan.json');}catch(err){alert(err.message);}
  }
  function adminImportData(event){
    if(!adminRequire())return;const file=event.target.files?.[0];if(!file)return;if(file.size>20000){alert('File terlalu besar.');return;}const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);const patch={};for(const k of ['notice','maintenance','siteName'])if(Object.hasOwn(d,k))patch[k]=d[k];adminChange(patch);}catch(_){alert('JSON tidak valid.');}event.target.value='';};reader.readAsText(file);
  }
  function adminClearActivity(){alert('Log audit server tidak dapat dihapus dari aplikasi untuk menjaga integritas keamanan.');}
  function adminResetLocalSettings(){if(confirm('Reset pengaturan server? Akun tidak dihapus.'))adminChange({notice:'',maintenance:false,siteName:'XYROPLAY'});}
  let xyroPendingPhoto='';
  function xyroIsDeveloper(){return sessionUser?.role==='developer';}
  function xyroRole(){return sessionUser?.role||'member';}
  function xyroToggleDrawer(open){document.getElementById('xyroDrawerShade')?.classList.toggle('open',!!open);}
  function xyroCloseModal(id){document.getElementById(id)?.classList.remove('open');}
  function profileImage(){const photo=localStorage.getItem('xyro_photo_'+currentUser)||'';return /^data:image\/(png|jpeg|webp);base64,/.test(photo)?photo:'brand.svg';}
  function xyroOpenProfile(){xyroToggleDrawer(false);document.getElementById('xyroProfileUsername').textContent=currentUser;document.getElementById('xyroDisplayNameInput').value=localStorage.getItem('xyro_display_'+currentUser)||currentUser;document.getElementById('xyroProfilePreview').src=profileImage();xyroPendingPhoto='';document.getElementById('xyroProfileModal').classList.add('open');}
  function xyroPreviewPhoto(event){
    const file=event.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){alert('Gunakan PNG/JPEG/WebP maksimal 2 MB.');return;}
    const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(img,0,0,256,256);xyroPendingPhoto=canvas.toDataURL('image/png');document.getElementById('xyroProfilePreview').src=xyroPendingPhoto;URL.revokeObjectURL(url);};img.onerror=()=>{URL.revokeObjectURL(url);alert('Gambar tidak valid.');};img.src=url;
  }
  function xyroSaveProfile(){const name=document.getElementById('xyroDisplayNameInput').value.trim().slice(0,32);if(!name)return;try{localStorage.setItem('xyro_display_'+currentUser,name);if(xyroPendingPhoto)localStorage.setItem('xyro_photo_'+currentUser,xyroPendingPhoto);}catch(_){alert('Penyimpanan lokal penuh.');return;}xyroRefreshDrawer();document.getElementById('userName').textContent=name;document.getElementById('greetName').textContent=name;xyroCloseModal('xyroProfileModal');}
  function xyroRefreshDrawer(){const name=localStorage.getItem('xyro_display_'+currentUser)||currentUser;document.getElementById('xyroDrawerName').textContent=name;document.getElementById('xyroDrawerRole').textContent=xyroRole().toUpperCase();document.getElementById('xyroDrawerPhoto').src=profileImage();document.getElementById('xyroDeveloperMenu').style.display=currentRole==='admin'?'block':'none';document.getElementById('xyroHamburger').style.display='flex';}
  function xyroLogUsage(action){if(!currentUser)return;try{const key='xyro_history_'+currentUser;let list=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(list))list=[];list.unshift({action:String(action).slice(0,100),at:new Date().toLocaleString('id-ID')});localStorage.setItem(key,JSON.stringify(list.slice(0,100)));}catch(_){}}
  function xyroOpenHistory(){xyroToggleDrawer(false);let list=[];try{list=JSON.parse(localStorage.getItem('xyro_history_'+currentUser)||'[]');if(!Array.isArray(list))list=[];}catch(_){}document.getElementById('xyroHistorySummary').textContent=list.length+' aktivitas lokal';document.getElementById('xyroHistoryList').innerHTML=list.map(x=>'<div class="xyro-history-row"><b>'+escapeHtml(x.action)+'</b><small>'+escapeHtml(x.at)+'</small></div>').join('')||'Belum ada aktivitas.';document.getElementById('xyroHistoryModal').classList.add('open');}
  function xyroOpenCreateAccount(){if(!adminRequire())return;xyroToggleDrawer(false);document.getElementById('xyroCreateUsername').value='';document.getElementById('xyroCreatePassword').value='';document.getElementById('xyroCreateMessage').textContent='';document.getElementById('xyroCreateModal').classList.add('open');}
  async function xyroCreateAccount(){if(!adminRequire())return;const msg=document.getElementById('xyroCreateMessage');try{await api('/api/admin/users','POST',{username:document.getElementById('xyroCreateUsername').value.trim(),password:document.getElementById('xyroCreatePassword').value,role:document.getElementById('xyroCreateRole').value});document.getElementById('xyroCreatePassword').value='';msg.textContent='Akun berhasil dibuat di server.';renderAdminPanel();}catch(err){msg.textContent=err.message;}}
  function removeUserLocalData(username){for(const prefix of ['xyro_display_','xyro_photo_','xyro_history_'])localStorage.removeItem(prefix+username);}
  function clearLocalData(){if(confirm('Hapus profil dan riwayat lokal akun ini?')){removeUserLocalData(currentUser);xyroRefreshDrawer();}}
  function deleteAccount(){if(sessionUser){document.getElementById('deletePassword').value='';document.getElementById('deleteStatus').textContent='';document.getElementById('deleteAccountModal').classList.add('open');}}
  async function confirmDeleteAccount(){
    const input=document.getElementById('deletePassword'),status=document.getElementById('deleteStatus');
    if(!input.value){status.textContent='Masukkan password akun.';return;}
    const name=currentUser;
    try{await api('/api/auth/account','DELETE',{password:input.value});removeUserLocalData(name);authToken='';sessionUser=null;resetAuthUI();alert('Akun dihapus.');}catch(err){status.textContent=err.message;}finally{input.value='';}
  }
  if(!API_BASE)document.getElementById('loginMsg').textContent='Versi persiapan: backend HTTPS belum dikonfigurasi.';

  /* ============ TOOLS ============ */
  const BASE = API_BASE + '/api/proxy';

  const TOOL_DEFS = {
    web2zip: { title: '🌐 Web to ZIP', desc: 'Convert website jadi ZIP',
      fields: [{ id: 'url', label: 'URL Website', placeholder: 'https://example.com' }],
      build: (v) => `${BASE}/tools/web2zip?url=${encodeURIComponent(v.url)}` },
    tiktok: { title: '🎵 TikTok Downloader', desc: 'Download video TikTok',
      fields: [{ id: 'url', label: 'URL TikTok', placeholder: 'https://vt.tiktok.com/xxxx/' }],
      build: (v) => `${BASE}/download/tiktok?url=${encodeURIComponent(v.url)}` },
    youtube: { title: '▶️ YouTube Downloader', desc: 'Download video/audio YouTube',
      fields: [{ id: 'url', label: 'URL YouTube', placeholder: 'https://youtu.be/xxxx' }],
      build: (v) => `${BASE}/download/youtube?url=${encodeURIComponent(v.url)}` },
    spotify: { title: '🎧 Spotify Downloader', desc: 'Download lagu Spotify',
      fields: [{ id: 'url', label: 'URL Spotify', placeholder: 'https://open.spotify.com/track/xxxx' }],
      build: (v) => `${BASE}/download/spotify?url=${encodeURIComponent(v.url)}` },
    cuaca: { title: '🌤️ Cuaca', desc: 'Info cuaca kota',
      fields: [{ id: 'city', label: 'Nama Kota', placeholder: 'Jakarta' }],
      build: (v) => `${BASE}/tools/cuaca?city=${encodeURIComponent(v.city)}` },
    meme: { title: '😂 Random Meme', desc: 'Meme random tiap klik',
      fields: [], build: () => `${BASE}/random/meme` },
    fakedev: { title: '👨‍💻 FakeDev', desc: 'Buat kartu profil developer untuk meme/parodi',
      fields: [
        { id: 'urlfoto', label: 'URL Foto', placeholder: 'https://example.com/foto.jpg' },
        { id: 'teks', label: 'Nama/Teks', placeholder: 'Lordsaurus' }
      ],
      build: (v) => `${BASE}/canvas/fakedev-2?urlfoto=${encodeURIComponent(v.urlfoto)}&teks=${encodeURIComponent(v.teks)}` },
    iqc: { title: '📱 IQC', desc: 'Buat tampilan chat IQC',
      fields: [
        { id: 'text', label: 'Teks', placeholder: 'Halo! Namaku saurus 🤪' },
        { id: 'time', label: 'Waktu', placeholder: '09:41' },
        { id: 'baterai', label: 'Baterai (%)', placeholder: '80' },
        { id: 'operator', label: 'Operator', placeholder: 'tampilkan' },
        { id: 'wifi', label: 'WiFi', placeholder: 'tampilkan' }
      ],
      build: (v) => `${BASE}/canvas/iqc?text=${encodeURIComponent(v.text)}&time=${encodeURIComponent(v.time)}&baterai=${encodeURIComponent(v.baterai)}&operator=${encodeURIComponent(v.operator)}&wifi=${encodeURIComponent(v.wifi)}` },
    jarvismeme: { title: '🤖 Jarvis Meme', desc: 'Buat meme percakapan Jarvis',
      fields: [{ id: 'text', label: 'Teks', placeholder: 'jarvis tolong itu anunya di anu anukan' }],
      build: (v) => `${BASE}/canvas/jarvis-meme?text=${encodeURIComponent(v.text)}` },
    pakustadz: { title: '🕌 Pak Ustadz', desc: 'Buat meme percakapan Pak Ustadz',
      fields: [{ id: 'teks', label: 'Teks', placeholder: 'Pak ustad, apa hukumnya menyukai anime' }],
      build: (v) => `${BASE}/canvas/pakustadz?teks=${encodeURIComponent(v.teks)}` },
    fakeml: { title: '🎮 FakeML', desc: 'Buat kartu profil game untuk meme/parodi',
      fields: [
        { id: 'avatar', label: 'URL Avatar', placeholder: 'https://example.com/avatar.jpg' },
        { id: 'username', label: 'Username', placeholder: 'Saurus' },
        { id: 'rank', label: 'Rank', placeholder: 'imo' },
        { id: 'border', label: 'Border', placeholder: '16' }
      ],
      build: (v) => `${BASE}/canvas/fakeml?avatar=${encodeURIComponent(v.avatar)}&username=${encodeURIComponent(v.username)}&rank=${encodeURIComponent(v.rank)}&border=${encodeURIComponent(v.border)}` },
    fakeff: { title: '🔥 FakeFF', desc: 'Buat kartu lobby game untuk meme/parodi',
      fields: [
        { id: 'username', label: 'Username', placeholder: 'Saurus' },
        { id: 'lobby', label: 'Lobby', placeholder: '30' }
      ],
      build: (v) => `${BASE}/canvas/fakeff?username=${encodeURIComponent(v.username)}&lobby=${encodeURIComponent(v.lobby)}` },
    windowsquoted: { title: '🪟 Windows Quoted', desc: 'Buat meme quote bergaya Windows',
      fields: [{ id: 'text', label: 'Teks', placeholder: 'ngapain cemburu kan cuman sebatas teman' }],
      build: (v) => `${BASE}/canvas/windows-quoted?text=${encodeURIComponent(v.text)}` },
    wasted: { title: '💥 Wasted', desc: 'Tambahkan efek Wasted untuk meme',
      fields: [{ id: 'url', label: 'URL Foto', placeholder: 'https://example.com/foto.jpg' }],
      build: (v) => `${BASE}/canvas/wasted?url=${encodeURIComponent(v.url)}` },
    wanted: { title: '🎯 Wanted', desc: 'Buat poster Wanted untuk meme',
      fields: [{ id: 'image', label: 'URL Foto', placeholder: 'https://example.com/foto.jpg' }],
      build: (v) => `${BASE}/canvas/wanted?image=${encodeURIComponent(v.image)}` },
    sudahsaatnya: { title: '⏰ Sudah Saatnya', desc: 'Buat meme teks',
      fields: [{ id: 'text', label: 'Teks', placeholder: 'sudah saatnya aku berubah' }],
      build: (v) => `${BASE}/canvas/sudahsaatnya?text=${encodeURIComponent(v.text)}` },
    amsend: { title: '📧 AM — Send Email Link', desc: 'Kirim link verifikasi ke gmail',
      note: '📨 Masukin <b>email Alight Motion</b> kamu. Link verifikasi bakal dikirim ke gmail. Copy link-nya, terus pakai di menu <b>AM — Verify & Activate</b>.',
      fields: [{ id: 'email', label: 'Email Alight Motion', placeholder: 'user@gmail.com' }],
      build: (v) => `${BASE}/premium/amsendoob?email=${encodeURIComponent(v.email)}` },
    amverify: { title: '🎬 AM — Verify & Activate', desc: 'Aktivasi pakai oobCode dari email',
      note: '🔗 Tempel <b>link oobCode</b> yang kamu terima di gmail (dari step Send Email Link). Link bentuknya kaya <code>https://alightcreative.com/?oobCode=xxxxx</code>.',
      fields: [
        { id: 'email', label: 'Email Alight Motion', placeholder: 'user@gmail.com' },
        { id: 'link',  label: 'Link Verifikasi (oobCode)', placeholder: 'https://alightcreative.com/?oobCode=xxxxx' }
      ],
      build: (v) => `${BASE}/premium/amverify?email=${encodeURIComponent(v.email)}&link=${encodeURIComponent(v.link)}` }
,
    iqcsticker: { title: '🏷️ IQC Sticker', desc: 'Buat sticker IQC',
      fields: [
        { id: 'nama', label: 'Nama', placeholder: 'Synox Cloud.' },
        { id: 'waktu', label: 'Waktu', placeholder: '00.00' },
        { id: 'photo', label: 'URL Foto', placeholder: 'https://api.synoxcloud.xyz/assets/icon.jpg' }
      ],
      build: (v) => `${BASE}/canvas/iqc-sticker?nama=${encodeURIComponent(v.nama)}&waktu=${encodeURIComponent(v.waktu)}&photo=${encodeURIComponent(v.photo)}` },
    getcodehtml: { title: '🧩 Get Code HTML', desc: 'Ambil kode HTML dari URL',
      fields: [
        { id: 'url', label: 'URL Website', placeholder: 'https://example.com' }
      ],
      build: (v) => `${BASE}/tools/getcodehtml?url=${encodeURIComponent(v.url)}` },
    reactch: { title: '💬 React Channel WhatsApp', desc: 'Kirim reaksi ke postingan Channel WhatsApp',
      note: '🔗 Masukkan <b>link postingan channel WhatsApp</b>, lalu isi emoji. Contoh: <code>https://whatsapp.com/channel/xxx/6767</code>',
      fields: [
        { id: 'link', label: 'Link Channel WhatsApp', placeholder: 'https://whatsapp.com/channel/xxx/6767' },
        { id: 'emoji', label: 'Emoji', placeholder: '🖕,😠' }
      ],
      build: (v) => `${BASE}/tools/reactch?link=${encodeURIComponent(v.link)}&emoji=${encodeURIComponent(v.emoji)}` },
    web2appv2: { title: '📦 Web to APK', desc: 'Build website menjadi file APK',
      note: '📦 Setelah diproses, hasilnya berupa <b>file APK</b> untuk disimpan, bukan gambar.',
      fields: [
        { id: 'url', label: 'URL Website', placeholder: 'https://example.com' },
        { id: 'appname', label: 'Nama App', placeholder: 'MyApp' },
        { id: 'icon', label: 'URL Icon', placeholder: 'https://example.com/icon.png' },
        { id: 'package', label: 'Package Name', placeholder: 'com.example.app' },
        { id: 'version', label: 'Version', placeholder: '1.0.0' },
        { id: 'versioncode', label: 'Version Code', placeholder: '1' }
      ],
      build: (v) => `${BASE}/tools/web2appv2?url=${encodeURIComponent(v.url)}&appname=${encodeURIComponent(v.appname)}&icon=${encodeURIComponent(v.icon)}&package=${encodeURIComponent(v.package)}&version=${encodeURIComponent(v.version)}&versioncode=${encodeURIComponent(v.versioncode)}` }
  };

  let currentTool = null;

  function openTool(key) {
    if (['amsend','amverify'].includes(key)) { alert('Fitur ini dinonaktifkan sampai izin penyedia terverifikasi.'); return; }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-tool-worker').classList.add('active');
    navHistory.push('tool-worker');
    currentTool = key;
    const def = TOOL_DEFS[key];
    document.getElementById('toolTitle').textContent = def.title;
    document.getElementById('toolDesc').textContent = def.desc;

    const noteEl = document.getElementById('toolNote');
    noteEl.innerHTML = def.note ? `<div class="info-note">${def.note}</div>` : '';

    const form = document.getElementById('toolForm');
    if (def.fields.length === 0) {
      form.innerHTML = `<button class="btn-run" id="toolRunBtn" data-action="run-tool">Proses 🚀</button>`;
    } else {
      form.innerHTML = def.fields.map(f =>
        `<label>${f.label}</label><input type="text" id="tf_${f.id}" placeholder="${f.placeholder}">`
      ).join('') + `<button class="btn-run" id="toolRunBtn" data-action="run-tool">Proses 🚀</button>`;
    }

    document.getElementById('toolResult').textContent = 'Hasil akan muncul di sini...';
    document.getElementById('content').scrollTop = 0;
  }

  const IMAGE_TOOLS = new Set([
    'meme','fakedev','iqc','iqcsticker','jarvismeme','pakustadz',
    'fakeml','fakeff','windowsquoted','wasted','wanted','sudahsaatnya'
  ]);

  async function runTool() {
    if (!currentTool) return;
    const def = TOOL_DEFS[currentTool];
    const values = {};
    (def.fields || []).forEach(f => values[f.id] = document.getElementById('tf_' + f.id).value.trim());

    for (const f of (def.fields || [])) {
      if (!values[f.id]) { alert('Isi ' + f.label + ' dulu!'); return; }
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      alert('Format email salah!'); return;
    }
    // AM Verify: Firebase sering mengirim link bersarang seperti:
    // https://<project>.firebaseapp.com/__/auth/links?link=https://.../auth_action/?apiKey%3D...%26oobCode%3D...
    // Jadi oobCode tidak selalu tampil sebagai `oobCode=` di string mentah.
    if (currentTool === 'amverify' && values.link) {
      const rawLink = values.link.trim();
      let actionLink = rawLink;
      let oobCode = '';

      // Decode beberapa lapis encoding, tetapi batasi agar tidak error pada input aneh.
      let decoded = rawLink;
      for (let i = 0; i < 3; i++) {
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        } catch (_) { break; }
      }

      // Jika ini Firebase Hosting link dengan ?link=..., ambil URL action di dalamnya.
      try {
        const outer = new URL(rawLink);
        const nested = outer.searchParams.get('link');
        if (nested) actionLink = nested;
      } catch (_) {
        // Bukan URL yang bisa diparse; lanjutkan dengan hasil decode.
      }

      // Coba ambil oobCode dari action URL. URLSearchParams menangani query biasa.
      try {
        const actionUrl = new URL(actionLink);
        oobCode = actionUrl.searchParams.get('oobCode') || '';
      } catch (_) {}

      // Fallback untuk URL yang masih memiliki %3D / %26 atau format non-standar.
      if (!oobCode) {
        const m = decoded.match(/[?&]oobCode(?:=|%3D)([^&%\s]+)/i);
        if (m) {
          try { oobCode = decodeURIComponent(m[1]); } catch (_) { oobCode = m[1]; }
        }
      }

      if (!oobCode) {
        alert('Link Firebase tidak memiliki oobCode yang valid. Pastikan kamu menempel seluruh link dari email.');
        return;
      }

      // Kirim action URL yang sudah dinormalisasi agar endpoint menerima oobCode
      // sebagai query parameter sungguhan, bukan %3D/%26 yang masih bersarang.
      values.link = actionLink;
    }
    if (currentTool === 'reactch' && values.link &&
        !/^https?:\/\/([\w-]+\.)?whatsapp\.com\/channel\//i.test(values.link)) {
      alert('Masukkan link postingan Channel WhatsApp yang valid!'); return;
    }

    const url = def.build(values);
    const btn = document.getElementById('toolRunBtn');
    const out = document.getElementById('toolResult');
    btn.disabled = true;

    const loadingText =
      IMAGE_TOOLS.has(currentTool) ? '⏳ Memproses gambar... sabar master' :
      currentTool === 'web2appv2' ? '⏳ Sedang memproses website menjadi APK... jangan tutup halaman' :
      currentTool === 'reactch' ? '⏳ Mengirim reaksi ke Channel WhatsApp...' :
      ['tiktok','youtube','spotify'].includes(currentTool) ? '⏳ Mengambil link media...' :
      '⏳ Memproses...';
    out.innerHTML = `<span class="loading">${loadingText}</span>`;

    try {
      const res = await apiRaw(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      // Canvas/image tools only: show an actual image preview.
      if (IMAGE_TOOLS.has(currentTool)) {
        const blob = await res.blob();
        const mime = blob.type.startsWith('image/') ? blob.type : 'image/png';
        const finalBlob = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: mime });
        const imageUrl = URL.createObjectURL(finalBlob);
        showImageResult(out, imageUrl, currentTool, mime);
        return;
      }

      // Web to APK: never treat the result as an image.
      // Support both direct APK binary responses and JSON/text responses containing an APK URL.
      if (currentTool === 'web2appv2') {
        if (contentType.includes('application/vnd.android.package-archive') ||
            contentType.includes('application/octet-stream') ||
            contentType.includes('application/apk')) {
          const blob = await res.blob();
          const apkUrl = URL.createObjectURL(blob);
          showApkResult(out, apkUrl, 'xyroplay_app_' + Date.now() + '.apk');
          return;
        }

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }

        const apkLinks = extractHttpUrls(data).filter(u =>
          /\.apk(?:[?#]|$)/i.test(u) || /apk/i.test(u)
        );

        if (apkLinks.length) {
          showApkResult(out, apkLinks[0], 'xyroplay_app_' + Date.now() + '.apk');
          return;
        }

        out.innerHTML = `<div class="download-result">
          <div class="img-title">⚠️ APK belum siap / API mengembalikan respons</div>
          <pre>${escapeHtml(typeof data === 'string' ? data : JSON.stringify(data, null, 2))}</pre>
        </div>`;
        return;
      }

      // Downloader: show video/audio/link controls, never an image preview.
      if (['tiktok','youtube','spotify'].includes(currentTool)) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }
        renderDownloaderResult(data, out, currentTool);
        return;
      }

      // Other normal tools.
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = text; }

      // Pesan ringkas khusus dua tool AM; request tetap memakai endpoint yang sama.
      if (currentTool === 'amsend' || currentTool === 'amverify') {
        const payloadText = typeof data === 'string' ? data : JSON.stringify(data);
        const reportsError = /\b(error|failed|failure|gagal|invalid|invalid|not found|unauthorized)\b/i.test(payloadText);
        const explicitSuccess = typeof data === 'object' && data !== null &&
          (data.success === true || data.ok === true || data.status === 'success' || data.status === 'ok');
        if (explicitSuccess || (res.ok && !reportsError)) {
          out.textContent = currentTool === 'amsend'
            ? 'BERHASIL DI KIRIM! CEK INBOX/SPAM'
            : 'BERHASIL! MENJADI PRO';
          return;
        }
      }

      out.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      renderLinksIfAny(data, out);

    } catch (err) {
      out.textContent = '❌ Error: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  }

  function extractHttpUrls(data) {
    const found = [];
    const seen = new Set();
    function walk(obj) {
      if (obj == null) return;
      if (typeof obj === 'string') {
        const matches = obj.match(/https?:\/\/[^\s"'<>]+/g) || [];
        matches.forEach(u => {
          u = u.replace(/[),.;]+$/g, '');
          if (!seen.has(u)) { seen.add(u); found.push(u); }
        });
      } else if (typeof obj === 'object') {
        Object.keys(obj).forEach(k => walk(obj[k]));
      }
    }
    walk(data);
    return found;
  }

  function showApkResult(container, apkUrl, filename) {
    if (!/^https:\/\//.test(apkUrl) && !apkUrl.startsWith('blob:')) throw Error('URL unduhan tidak aman');
    container.innerHTML = `
      <div class="download-result">
        <div class="img-title">✅ APK berhasil diproses</div>
        <div style="margin:8px 0;color:#bbb">File APK siap disimpan ke perangkat.</div>
        <div class="img-action-row">
          <a class="btn-save" href="${escapeHtml(apkUrl)}" download="${escapeHtml(filename)}">⬇️ Simpan APK</a>
          <a class="btn-open" href="${escapeHtml(apkUrl)}" target="_blank" rel="noopener">🔗 Buka</a>
        </div>
      </div>`;
  }

  function renderDownloaderResult(data, container, toolName) {
    const urls = extractHttpUrls(data).filter(u => u.startsWith('https://'));
    if (!urls.length) {
      container.innerHTML = `<pre>${escapeHtml(typeof data === 'string' ? data : JSON.stringify(data, null, 2))}</pre>`;
      return;
    }

    const isSpotify = toolName === 'spotify';
    const title = isSpotify ? '🎧 Hasil Spotify' : '🎬 Hasil Video';
    const items = urls.map((u, i) => {
      const isVideo = /\.(mp4|webm|mkv|mov)(?:[?#]|$)/i.test(u) || (!isSpotify && i === 0);
      const isAudio = /\.(mp3|m4a|aac|wav|ogg)(?:[?#]|$)/i.test(u) || isSpotify;

      let media = '';
      if (isVideo) {
        media = `<video controls playsinline preload="metadata" src="${escapeHtml(u)}" style="width:100%;max-height:420px;border-radius:12px;margin-top:10px"></video>`;
      } else if (isAudio) {
        media = `<audio controls preload="metadata" src="${escapeHtml(u)}" style="width:100%;margin-top:10px"></audio>`;
      }

      return `<div style="margin-top:12px;padding:12px;border:1px solid rgba(180,0,255,.25);border-radius:12px">
        ${media}
        <div class="img-action-row">
          <a class="btn-save" href="${escapeHtml(u)}" target="_blank" rel="noopener">⬇️ Buka / Download</a>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="download-result">
        <div class="img-title">${title}</div>
        <div style="color:#aaa">Link media ditemukan. Hasil downloader ditampilkan sebagai video/audio atau link download, bukan gambar.</div>
        ${items}
      </div>`;
  }

  let lastImageUrl = null;
  let lastImageMime = 'image/png';

  function showImageResult(container, imageUrl, toolName, mime) {
    lastImageUrl = imageUrl;
    lastImageMime = mime || 'image/png';
    const title = TOOL_DEFS[toolName]?.title || 'Hasil';
    container.innerHTML = `
      <div class="img-result">
        <div class="img-title">✅ ${escapeHtml(title)}</div>
        <img src="${imageUrl}" alt="Hasil ${escapeHtml(title)}">
        <div class="img-action-row">
          <a class="btn-open" href="${imageUrl}" target="_blank" rel="noopener">🔗 Buka</a>
          <button class="btn-save" data-action="save-image">💾 Simpan Gambar</button>
        </div>
      </div>
    `;
  }

  async function saveLastImage(btn) {
    if(!lastImageUrl){alert('Belum ada gambar untuk disimpan.');return;}
    btn.disabled=true;const original=btn.textContent;btn.textContent='Menyiapkan penyimpanan…';
    try{const response=await fetch(lastImageUrl);if(!response.ok)throw Error('Gambar tidak dapat dibaca.');const blob=await response.blob();btn.textContent=await saveBlobFile(blob,'xyroplay_'+Date.now()+'.'+mimeToExt(blob.type||lastImageMime));}
    catch(err){alert('Penyimpanan tidak selesai: '+err.message);}
    finally{setTimeout(()=>{btn.textContent=original;btn.disabled=false;},1800);}
  }

  function mimeToExt(mime) {
    if (!mime) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    return 'png';
  }

  function renderLinksIfAny(data, container) {
    const links=extractHttpUrls(data).filter(u=>u.startsWith('https://')).slice(0,30);
    for(const url of links){
      const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Buka hasil';a.style.display='block';container.appendChild(a);
      if(/\.(jpg|jpeg|png|gif|webp)(?:[?#]|$)/i.test(url)){const img=document.createElement('img');img.src=url;img.alt='Pratinjau hasil';img.addEventListener('error',()=>img.remove());container.appendChild(img);}
    }
  }
  /* ============ TOOLS SEARCH & FILTER ============ */
  (function initToolsUI(){
    const search = document.getElementById('toolSearch');
    const clear = document.getElementById('clearToolSearch');
    const count = document.getElementById('toolsCount');
    const empty = document.getElementById('toolsEmpty');
    const grid = document.getElementById('toolsGrid');
    const filters = document.querySelectorAll('#toolsFilter button');
    if (!search || !grid) return;

    let activeFilter = 'all';
    const cards = [...grid.querySelectorAll('.tool-card')];

    function applyToolsFilter(){
      const q = search.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const category = card.dataset.category || 'other';
        const haystack = (card.dataset.search || '').toLowerCase();
        const matchFilter = activeFilter === 'all' || category === activeFilter;
        const matchSearch = !q || haystack.includes(q);
        const show = matchFilter && matchSearch;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      count.textContent = `${visible} Tool${visible === 1 ? '' : 's'}`;
      empty.style.display = visible ? 'none' : 'block';
      clear.style.display = search.value ? 'flex' : 'none';
    }

    filters.forEach(btn => btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'all';
      applyToolsFilter();
    }));
    search.addEventListener('input', applyToolsFilter);
    clear.addEventListener('click', () => {
      search.value = '';
      search.focus();
      applyToolsFilter();
    });
    applyToolsFilter();
  })();

  /* ============ AI ============ */
  const AI_DEFS = { novaai: { title: '✨ Nova AI', desc: 'Chat AI serba bisa', endpoint: 'novaai' } };
  let currentAI = null;

  function openAI(key) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-ai-worker').classList.add('active');
    navHistory.push('ai-worker');
    currentAI = key;
    const def = AI_DEFS[key];
    document.getElementById('aiTitle').textContent = def.title;
    document.getElementById('aiDesc').textContent = def.desc;
    document.getElementById('aiResult').textContent = 'Balasan akan muncul di sini...';
    document.getElementById('content').scrollTop = 0;
  }

  async function sendAIChat() {
    if (!currentAI) return;
    const input = document.getElementById('aiInput').value.trim();
    const out = document.getElementById('aiResult');
    const btn = document.getElementById('aiSendBtn');
    if (!input) { alert('Tulis pesan dulu!'); return; }
    btn.disabled = true;
    out.innerHTML = '<span class="loading">⏳ Lagi mikir...</span>';
    try {
      const res = await apiRaw(`${BASE}/ai-chat/${AI_DEFS[currentAI].endpoint}?text=${encodeURIComponent(input)}`);
      const data = await res.json();
      let reply = '❓ Nggak ada balasan.';
      if (data && data.result) {
        reply = typeof data.result === 'string' ? data.result : (data.result.reply || JSON.stringify(data.result));
      } else if (data) reply = JSON.stringify(data);
      out.innerHTML = `<b style="color:#00e5ff">Kamu:</b> ${escapeHtml(input)}\n\n<b style="color:#c800ff">AI:</b> ${escapeHtml(reply)}`;
    } catch (err) {
      out.textContent = '❌ Error: ' + err.message;
    } finally { btn.disabled = false; }
  }

  /* ============ UTIL ============ */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (document.activeElement.id === 'aiInput') { e.preventDefault(); sendAIChat(); }
    }
  });
