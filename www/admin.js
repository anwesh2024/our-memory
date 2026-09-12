const WORKER_URL = 'https://ourmemory.mrony8552.workers.dev'; // আপনার ক্লাউডফ্লেয়ার লিংক
let currentPass = '';

async function login() {
    currentPass = document.getElementById('admin-pass').value;
    const res = await fetch(`${WORKER_URL}/api/admin/files`, { headers: { 'X-Admin-Password': currentPass } });
    
    if (res.ok) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';
        const data = await res.json();
        renderFiles(data.files, data.totalSize);
    } else {
        alert("Wrong Password!");
    }
}

function renderFiles(files, totalSize) {
    const list = document.getElementById('file-list');
    const stats = document.getElementById('storage-stats');
    
    stats.innerHTML = `Total Videos: <b>${files.length}</b> | Space Used: <b>${(totalSize / (1024 * 1024)).toFixed(2)} MB</b>`;
    list.innerHTML = '';

    files.forEach(f => {
        const date = new Date(f.uploaded).toLocaleString();
        const sizeKB = (f.size / 1024).toFixed(1);
        const videoUrl = `${WORKER_URL}/api/admin/video/${f.key}?pass=${currentPass}`;
        const downloadUrl = `${videoUrl}&download=true`;

        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-info">
                <strong>🎥 ${f.key}</strong><br>
                <small>📅 ${date} • 💾 ${sizeKB} KB</small>
            </div>
            <div class="action-btns">
                <button class="btn-play" onclick="playVideo('${videoUrl}')">▶ Play</button>
                <a href="${downloadUrl}" class="btn-dl" download>⬇ Download</a>
                <button class="btn-del" onclick="deleteVideo('${f.key}')">🗑 Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function playVideo(url) {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('admin-video-player');
    player.src = url;
    modal.style.display = 'flex';
    player.play();
}

function closeVideo() {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('admin-video-player');
    player.pause();
    player.src = "";
    modal.style.display = 'none';
}

async function deleteVideo(key) {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    
    const res = await fetch(`${WORKER_URL}/api/admin/files`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': currentPass, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    
    if (res.ok) {
        // Refresh list
        const updatedRes = await fetch(`${WORKER_URL}/api/admin/files`, { headers: { 'X-Admin-Password': currentPass } });
        const data = await updatedRes.json();
        renderFiles(data.files, data.totalSize);
    }
}
