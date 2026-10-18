
(function(){
 const openBtn=document.getElementById('spotifySearchOpen');
 const modal=document.getElementById('spotifySearchModal');
 const closeBtn=document.getElementById('spotifySearchClose');
 const form=document.getElementById('spotifySearchForm');
 const queryInput=document.getElementById('spotifyQuery');
 const submitBtn=document.getElementById('spotifySearchSubmit');
 const status=document.getElementById('spotifySearchStatus');
 const results=document.getElementById('spotifySearchResults');
 openBtn.style.display='none';
 function openSearch(){modal.classList.add('open');openBtn.style.display='none';setTimeout(()=>queryInput.focus(),100)}
 function closeSearch(){modal.classList.remove('open');openBtn.style.display=(document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display!=='none')?'flex':'none'}
 openBtn.addEventListener('click',openSearch);
 closeBtn.addEventListener('click',closeSearch);
 modal.addEventListener('click',e=>{if(e.target===modal)closeSearch()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeSearch()});
 function pick(obj,keys){for(const k of keys){if(obj&&obj[k]!=null&&obj[k]!=='')return obj[k]}return ''}
 function imageFor(item){let v=pick(item,['thumbnail','image','cover','album_image','imageUrl','artwork']);if(Array.isArray(v))v=v[0];if(v&&typeof v==='object')v=pick(v,['url','src']);if(!v&&item.album&&typeof item.album==='object'){v=pick(item.album,['image','cover','thumbnail']);if(Array.isArray(v))v=v[0];if(v&&typeof v==='object')v=pick(v,['url','src'])}return typeof v==='string'?v:''}
 function normalize(data){
   let arr=Array.isArray(data)?data:null;
   if(!arr&&data&&typeof data==='object'){
     for(const k of ['result','results','data','tracks','items']){const v=data[k];if(Array.isArray(v)){arr=v;break}if(v&&typeof v==='object'){for(const kk of ['result','results','tracks','items'])if(Array.isArray(v[kk])){arr=v[kk];break}}if(arr)break}
   }
   return arr||[];
 }
 function render(items){
   results.innerHTML='';
   if(!items.length){status.textContent='Lagu tidak ditemukan. Coba kata kunci lain.';return}
   status.textContent='Ditemukan '+items.length+' hasil.';
   items.forEach(item=>{
     if(!item||typeof item!=='object')return;
     const title=pick(item,['name','title','track_name','trackName'])||'Lagu tanpa judul';
     let artists=pick(item,['artist','artists','artist_name','artists_names']);
     if(Array.isArray(artists))artists=artists.map(a=>typeof a==='string'?a:pick(a,['name','title'])).filter(Boolean).join(', ');
     if(artists&&typeof artists==='object')artists=pick(artists,['name','title']);
     const album=pick(item,['album_name','albumName'])||(item.album&&typeof item.album==='object'?pick(item.album,['name','title']):'');
     const url=pick(item,['spotify_url','spotifyUrl','external_url','externalUrl','url','link']);
     const image=imageFor(item);
     // Prefer a playable full/stream URL if the API provides one; otherwise use Spotify preview.
     const preview=pick(item,['audio_url','audioUrl','stream_url','streamUrl','preview_url','previewUrl','preview']);
     const card=document.createElement('article');card.className='spotify-result';
     const img=document.createElement('img');img.alt='Cover '+title;img.loading='lazy';img.src=(typeof image==='string' && image.startsWith('https://') ? image : '')||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect width=%2260%22 height=%2260%22 fill=%22%2321102a%22/%3E%3Ctext x=%2230%22 y=%2238%22 font-size=%2228%22 text-anchor=%22middle%22 fill=%22%23c800ff%22%3E♫%3C/text%3E%3C/svg%3E';
     img.onerror=()=>{img.style.visibility='hidden'};
     const info=document.createElement('div');info.className='spotify-result-info';
     const name=document.createElement('div');name.className='spotify-result-title';name.textContent=title;
     const meta=document.createElement('div');meta.className='spotify-result-meta';meta.textContent=[artists,album].filter(Boolean).join(' · ')||'Spotify track';
     info.append(name,meta);
     if(url&&/^https:\/\//i.test(url)){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Buka di Spotify ↗';info.appendChild(a)}
     if(typeof preview==='string'&&/^https:\/\//i.test(preview)){
       const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=preview;audio.style.cssText='display:block;width:100%;height:36px;margin-top:7px';
       // Allow up to 60 seconds of playback when the source contains that much audio.
       let stopTimer=null;
       audio.addEventListener('play',()=>{if(stopTimer)clearTimeout(stopTimer);stopTimer=setTimeout(()=>{audio.pause();audio.currentTime=Math.min(audio.currentTime,60)},60000)});
       audio.addEventListener('pause',()=>{if(stopTimer){clearTimeout(stopTimer);stopTimer=null}});
       audio.addEventListener('ended',()=>{if(stopTimer){clearTimeout(stopTimer);stopTimer=null}});
       info.appendChild(audio);
       const note=document.createElement('div');note.className='spotify-result-meta';note.textContent='Maksimal pemutaran 1 menit jika sumber audio mendukung.';info.appendChild(note);
     }
     card.append(img,info);results.appendChild(card);
   });
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault();const q=queryInput.value.trim();if(!q)return;
   submitBtn.disabled=true;submitBtn.textContent='...';status.textContent='Sedang mencari lagu...';results.innerHTML='';
   try{
     const endpoint=API_BASE+'/api/proxy/search/searchspotify?q='+encodeURIComponent(q)+'&limit=10';
     const response=await apiRaw(endpoint);
     if(!response.ok)throw new Error('Server mengembalikan status '+response.status);
     const data=await response.json();const items=normalize(data);render(items);
     if(!items.length&&data&&data.message)status.textContent=String(data.message);
   }catch(err){status.textContent='Gagal mencari lagu. Periksa koneksi atau CORS API, lalu coba lagi.';console.error('Spotify search:',err)}
   finally{submitBtn.disabled=false;submitBtn.textContent='Cari'}
 });
 // Tombol dibuat selalu terlihat agar tetap muncul di WebView/HP.
 openBtn.style.display='none';
})();
