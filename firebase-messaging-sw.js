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
