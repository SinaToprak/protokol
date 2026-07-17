importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Firebase Yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyAJx7ceuyXw88t9D5HG2bYYEfhjX0601oI",
    authDomain: "protokol-0903.firebaseapp.com",
    projectId: "protokol-0903",
    storageBucket: "protokol-0903.firebasestorage.app",
    messagingSenderId: "1034868761644",
    appId: "1:1034868761644:web:48bac13ebdc77c2323dd89",
    databaseURL: "https://protokol-0903-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Arka plan mesaj dinleyicisi
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Arka plan mesajı alındı:', payload);
    
    const notificationTitle = payload.notification.title || "Protokol Bildirimi";
    const notificationOptions = {
        body: payload.notification.body || "",
        icon: payload.notification.icon || './assets/icons/icon-192x192.png',
        badge: './assets/icons/icon-192x192.png',
        data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
