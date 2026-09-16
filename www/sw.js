const CACHE_NAME = 'gallery-permanent-cache-v1';

self.addEventListener('fetch', event => {
    // শুধুমাত্র ক্লাউডফ্লেয়ারের ছবিগুলো ক্যাশ করবে
    if (event.request.url.includes('/api/image/')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse; // ক্যাশ থেকে ছবি দেখাবে (ডাটা কাটবে না)
                }
                return fetch(event.request).then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
        );
    }
});
