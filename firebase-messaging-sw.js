// هاد الملف لازم يكون بجذر الموقع (نفس مستوى index.html) - هو المسؤول عن استقبال إشعارات
// Firebase Cloud Messaging حتى لو المتصفح/التبويب مسكّر بالكامل (يشتغل بالخلفية دايماً)

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAFk8EX7-EMt--ZU3958nrMogeEdvGtaCs",
    authDomain: "alorobaonline.firebaseapp.com",
    projectId: "alorobaonline",
    storageBucket: "alorobaonline.firebasestorage.app",
    messagingSenderId: "880642361344",
    appId: "1:880642361344:web:9dddec05f81125f0fc30e5",
    measurementId: "G-NL9CS2135V"
});

const messaging = firebase.messaging();

// لما توصل إشعار والمتصفح/التبويب مسكّر أو بالخلفية، هاي الدالة بتعرضه كإشعار حقيقي على الجهاز
messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || 'العروبة أونلاين';
    const options = {
        body: (payload.notification && payload.notification.body) || '',
        icon: '/logo.png',
        badge: '/logo.png'
    };
    self.registration.showNotification(title, options);
});

// ===================== دايماً آخر نسخة من صفحات الموقع =====================
// نفس هاد الملف (مش ملف منفصل) لأنه المتصفح بيسمح بـ service worker واحد بس على نفس الموقع - لو عملنا
// sw.js ثاني، كان رح يحل محل هاد وتوقف إشعارات المطبخ/الإدارة على الأجهزة يلي بتفتح المتجر كمان.
// أي فتح لصفحة (index.html، offers.html...) بيتجاوز كاش المتصفح وبيجيب النسخة الجديدة من السيرفر دايماً.
// إذا ما في إنترنت، بيعرض آخر نسخة انحفظت. باقي الطلبات (صور، بيانات، سكربتات) ما بنلمسها أبداً.
const PAGES_CACHE = 'aloroba-pages-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('aloroba-pages-') && k !== PAGES_CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.mode !== 'navigate' || req.method !== 'GET') return;
    if (new URL(req.url).origin !== self.location.origin) return;

    event.respondWith((async () => {
        try {
            // cache: 'reload' = تجاهل الكاش وجيب من السيرفر (بنستخدم الرابط مش الطلب نفسه، لأنه طلبات
            // التنقل ما بتقبل خيارات إضافية)
            const fresh = await fetch(req.url, { cache: 'reload', credentials: 'same-origin' });
            if (fresh.ok) {
                const copy = fresh.clone();
                caches.open(PAGES_CACHE).then(c => c.put(req.url, copy)).catch(() => {});
            }
            return fresh;
        } catch (e) {
            const cached = await caches.match(req.url);
            if (cached) return cached;
            throw e;
        }
    })());
});
