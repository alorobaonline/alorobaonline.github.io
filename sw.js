// Service Worker - العروبة أونلاين
// الهدف الوحيد: التأكد إنه كل زبون يشوف آخر نسخة من الموقع دايماً تلقائياً،
// بدون ما يحتاج يمسح كاش المتصفح يدوياً. ما بنخزن أي شي بشكل عدواني.

const SW_VERSION = 'aloroba-sw-v1';

self.addEventListener('install', () => {
    self.skipWaiting(); // فعّل النسخة الجديدة من الـService Worker نفسه فوراً بدون انتظار
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // بس لطلبات فتح الصفحة نفسها (navigation) - يعني لما الزبون يفتح أو يحدّث الموقع
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { cache: 'reload' }) // تجاوز أي نسخة محفوظة بالمتصفح، اطلب الأحدث من السيرفر دايماً
                .catch(() => caches.match(event.request)) // لو ما في إنترنت أصلاً، استخدم أي نسخة سابقة كحل أخير
        );
    }
});
