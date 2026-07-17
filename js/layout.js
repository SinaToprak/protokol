// ============================================================================
// FCM (Firebase Cloud Messaging) YAPILANDIRMA ANAHTARLARI
// ============================================================================
window.VAPID_KEY = "BAlCTmQT-hFKUOvzjMiatnEz_c8ikNlyWmeqD8t3f8keoOWKA1mogeAo3LjEhg8wA0bqVLSf5I8FxHpr8LCU-iA"; 

// Google Service Account Yetkilendirme Bilgileri (FCM HTTP v1 için)
window.SERVICE_ACCOUNT = {
  project_id: "protokol-0903",
  client_email: "firebase-adminsdk-fbsvc@protokol-0903.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDV3SXV0qGoyDZO\nMlbXgpNLGdqThwAo28XT7nmB06NluR9CCtPabOobAZTiu+KThn4u88jckFyH6UQW\n7V2PzuAa5xmlvo6azin4f/1V/j/VA7dLIGsLCYSRkaw/wPOcSxVs/AJtdc8e/YCr\n8a/C6CcYB2/A+Im9tLoQQkxL5vsDTEBgIaXrLIeTb8oG18UEKZYTypnOURnCMwgP\nDKjMUQrrmDwvbnW0mEz1itZtMxdCNesmekBvYWJe2jaCcox7RfPtOcSB+NNaWmSL\nCTu8/u3aFAIsvP0HaCclVGD97Kj9ud15uCzX8eepca9njEkyU77lcneBv1pv2aEd\nagntd77xAgMBAAECggEAEbQlX354uGvz0Y7+5lyI9z9peytCmvSae0ad/gki2RcK\nhzaLPrp5D17sUBqlO84h4El5ArKGnmTz0ywMweH/u5UO5/a5f7IlAk0Mun4kvZb5\nqOPtnd5zVXOS0pI/+Fu00dlIwClE9I1KsLEopMCqtSVZyHEqly7V9OZFbPEZgrZk\nmSDNs7F8K9oHmrEIAWr6jqlknlUljmQi+b7WucDw/noQgWkh7SKn4ymQoql2on1G\nrwlXdPh5IUDTqcwWiAIStBNPmm1CdgobV51qIrjQGuODV14QlO+zRHrBZu1aK5nf\nrHDhE0+WtwwrWXl2g9Q/MbR5G89II+P9q+i2LyzimQKBgQD1KbAP0YgkYTCRi4Lg\ns7GCBUi2M5qd6HJEpAPYHOUsGOG9y0P1dK5Klgesc2NLYUB2veGcGMewegf1p61O\nOaURUZ5JvC2+FRNDsSfFhnw18pDLp6M/qC57lW4yeSHzuhy/5rPzAyhP5//SDexp\neznC83BZmQTijizsNHUSKp3gPQKBgQDfUUZArNu4oQqj3rvIYbmFTM4ZcUcOR4qT\nJp8PvzinBRcyi+ItmJNVKAmwdxb/Bju3cn8fJw/xJ1mPPiy/yhLzcl9mxwrYtwcn\n0QdfelRPTcMkI18vtw8xGiJByUO9R8Ofj5vQoCZiwfYg0EVEPAIpR3DyCPRquUyv\nYMeBkdXwxQKBgCRyaSFA5jt6U20fz3o2XKpWvMORkmftWaeItqWXTh6rKEw9/sFr\n8klWWpexo85eC+ZbPkIlkPJUggBsSCB8A2U6vAx8NFSw72c93ArKfobKo+oS5vsc\ntqRax8IrLff88C87Tf9PtduDQw3oUgAweJrZ9Bbt38MKnfUTq1/jBAuFAoGAUgFE\nbQeM//WTNK3cAy9vsvWLUWh5kVLQHk02Z8/ue9awuA0KF3hJ0iGLvVNeDHQ7hZfz\n+nqbrhCnIKTSRfNslh1PzywUXZSIeiSWMod3Yk/J8wFSOPFeEMfqAIJp753kxjk0\nHJ5Suj1DprUUWoQ2vvXPEfIb3v0Anf5KBNiK2YkCgYEA0/9yJ0SzjRT5u4fIKrEv\nmqB14TJdR7NbWVDlpV2shWG+oU471bKTAH7E5IgdEKmt6MCzmqQL9Cp2r6UIVatG\nxIEirjOEI65BVSc1iRU7ebwmnqiqL1jtBRo+7QNWFBz850i/6ljbBcV8OGISX7Ok\nRtKAq2SUSDB3qplXb4teMm8=\n-----END PRIVATE KEY-----\n"
};

// Telegram Bot Bildirim Yapılandırması (Kendi Botunuzun bilgilerini buraya girin)
window.TELEGRAM_BOT_TOKEN = "8642510865:AAGMcXAr2RXlGo0H5LFEvSthvpiEgl1JsCQ";
window.TELEGRAM_GROUP_CHAT_ID = "-1003929611989";

// 1. Dinamik Kütüphane Yükleyici
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 2. Google OAuth2 Access Token Üretme (FCM Yetkilendirme)
async function getFCMTokenOAuth2() {
    if (typeof KJUR === "undefined") {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/10.9.0/jsrsasign-all-min.js");
    }

    const sa = window.SERVICE_ACCOUNT;
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now
    };

    const sHeader = JSON.stringify(header);
    const sClaim = JSON.stringify(claim);
    const jwt = KJUR.jws.JWS.sign("RS256", sHeader, sClaim, sa.private_key);

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt
            })
        });
        const data = await response.json();
        return data.access_token;
    } catch (err) {
        console.error("[FCM] OAuth2 Access Token alma hatası:", err);
        return null;
    }
}

// 3. FCM Başlatma ve Token Kaydı
async function initializeFirebaseMessaging() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser) return;

    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
        const { getDatabase, ref, set } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
        const { getMessaging, getToken, onMessage } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging.js");
        const { firebaseConfig } = await import("../db/firebase.js");

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const messaging = getMessaging(app);

        Notification.requestPermission().then(async (permission) => {
            if (permission === 'granted') {
                try {
                    const token = await getToken(messaging, { vapidKey: window.VAPID_KEY });
                    if (token) {
                        console.log("[FCM] Token Alındı:", token);
                        const tokenRef = ref(db, `personeller/${loggedInUser.uid}/fcmTokens/${token}`);
                        await set(tokenRef, true);
                        localStorage.setItem('fcmToken', token);
                    }
                } catch (err) {
                    console.error("[FCM] Token alma hatası:", err);
                }
            }
        });

        onMessage(messaging, (payload) => {
            console.log("[FCM] Ön planda bildirim alındı:", payload);
            window.showToast(`${payload.notification.title}: ${payload.notification.body}`, "warning");
        });

    } catch (err) {
        console.error("[FCM] Başlatılırken hata oluştu:", err);
    }
}

// 4. Belirli Bir Kullanıcıya Bildirim Gönderme Yardımcısı (FCM HTTP v1)
window.sendNotificationToUser = async (targetUid, title, body) => {
    try {
        const accessToken = await getFCMTokenOAuth2();
        if (!accessToken) return;

        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
        const { getDatabase, ref, get, remove } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
        const { firebaseConfig } = await import("../db/firebase.js");

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        const snapshot = await get(ref(db, `personeller/${targetUid}/fcmTokens`));
        const tokens = snapshot.val() || {};
        const tokenList = Object.keys(tokens);

        if (tokenList.length === 0) return;

        const sendPromises = tokenList.map(async (token) => {
            const requestBody = {
                message: {
                    token: token,
                    notification: {
                        title: title,
                        body: body
                    },
                    data: {
                        click_action: "./index.html"
                    }
                }
            };
            try {
                const res = await fetch(`https://fcm.googleapis.com/v1/projects/${window.SERVICE_ACCOUNT.project_id}/messages:send`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`[FCM Error] Gönderim başarısız (${token.substring(0, 8)}...):`, errText);
                    
                    // Eski/Geçersiz Token Kendi Kendini Temizleme Mekanizması
                    if (errText.includes("UNREGISTERED") || errText.includes("NotRegistered")) {
                        console.log(`[FCM Cleanup] Geçersiz/Süresi dolmuş token tespit edildi, veritabanından siliniyor: ${token.substring(0, 8)}...`);
                        try {
                            await remove(ref(db, `personeller/${targetUid}/fcmTokens/${token}`));
                        } catch (cleanErr) {
                            console.log(`[FCM Cleanup] Yetki kısıtlaması nedeniyle token silinemedi (Yönetici temizleyebilir):`, cleanErr.message);
                        }
                    }
                } else {
                    const data = await res.json();
                    console.log(`[FCM Success] Bildirim başarıyla gönderildi:`, data);
                }
            } catch (err) {
                console.error(`[FCM Network Error]`, err);
            }
        });

        await Promise.all(sendPromises);
    } catch (err) {
        console.error("[FCM] Gönderim hatası:", err);
    }
};

// 5. Tüm Yöneticilere Bildirim Gönderme Yardımcısı (FCM HTTP v1)
window.sendNotificationToAllManagers = async (title, body) => {
    try {
        const accessToken = await getFCMTokenOAuth2();
        if (!accessToken) return;

        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
        const { getDatabase, ref, get, remove } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
        const { firebaseConfig } = await import("../db/firebase.js");

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        const snapshot = await get(ref(db, 'personeller'));
        const personeller = snapshot.val() || {};

        const allTokens = []; // [{ uid, token }] nesneleri tutarak hangi token kimin bilelim
        Object.keys(personeller).forEach(uid => {
            const p = personeller[uid];
            if (p.rol === 'yonetici' && p.fcmTokens) {
                Object.keys(p.fcmTokens).forEach(t => allTokens.push({ uid, token: t }));
            }
        });

        if (allTokens.length === 0) return;

        const sendPromises = allTokens.map(async ({ uid, token }) => {
            const requestBody = {
                message: {
                    token: token,
                    notification: {
                        title: title,
                        body: body
                    },
                    data: {
                        click_action: "./index.html"
                    }
                }
            };
            try {
                const res = await fetch(`https://fcm.googleapis.com/v1/projects/${window.SERVICE_ACCOUNT.project_id}/messages:send`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`[FCM Error] Yöneticiye gönderim başarısız (${token.substring(0, 8)}...):`, errText);
                    
                    // Eski/Geçersiz Token Kendi Kendini Temizleme Mekanizması
                    if (errText.includes("UNREGISTERED") || errText.includes("NotRegistered")) {
                        console.log(`[FCM Cleanup] Yöneticinin geçersiz/süresi dolmuş tokenı siliniyor: ${token.substring(0, 8)}...`);
                        try {
                            await remove(ref(db, `personeller/${uid}/fcmTokens/${token}`));
                        } catch (cleanErr) {
                            console.log(`[FCM Cleanup] Yetki kısıtlaması nedeniyle token silinemedi (Yönetici temizleyebilir):`, cleanErr.message);
                        }
                    }
                } else {
                    const data = await res.json();
                    console.log(`[FCM Success] Yöneticiye bildirim başarıyla gönderildi:`, data);
                }
            } catch (err) {
                console.error(`[FCM Network Error]`, err);
            }
        });

        await Promise.all(sendPromises);
    } catch (err) {
        console.error("[FCM] Yönetici bildirimi hatası:", err);
    }
};

// 6. Belirli Bir Kullanıcıya Telegram Bildirimi Gönderme Yardımcısı (Tüm bildirimler ortak gruba yönlendiriliyor)
window.sendTelegramNotification = async (targetUid, message) => {
    // Kişisel kelimeleri grup akışına uygun olacak şekilde nötrleştiriyoruz
    let cleanMessage = message
        .replace(/size atandı/g, "atandı")
        .replace(/görevinizin durumu/g, "görevin durumu")
        .replace(/göreviniz/g, "görev")
        .replace(/arızanızın durumu/g, "arıza durumu")
        .replace(/arızanız/g, "arıza");

    await window.sendTelegramGroupNotification(cleanMessage);
};

// 7. Ortak Telegram Grubuna Bildirim Gönderme Yardımcısı
window.sendTelegramGroupNotification = async (message) => {
    const token = window.TELEGRAM_BOT_TOKEN || "YOUR_TELEGRAM_BOT_TOKEN_HERE";
    const groupId = window.TELEGRAM_GROUP_CHAT_ID || "YOUR_TELEGRAM_GROUP_CHAT_ID_HERE";
    if (token === "YOUR_TELEGRAM_BOT_TOKEN_HERE" || groupId === "YOUR_TELEGRAM_GROUP_CHAT_ID_HERE") return;

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: groupId,
                text: message,
                parse_mode: "HTML"
            })
        });
        const data = await res.json();
        console.log("[Telegram] Ortak gruba bildirim gönderim sonucu:", data);
    } catch (err) {
        console.error("[Telegram] Gruba bildirim gönderme hatası:", err);
    }
};

// 8. Ortak Telegram Grubuna Dosya (Resim, Video, Belge) Gönderme Yardımcısı
window.sendTelegramFileNotification = async (file, captionText) => {
    const token = window.TELEGRAM_BOT_TOKEN;
    const groupId = window.TELEGRAM_GROUP_CHAT_ID;
    if (!token || !groupId || token.includes("YOUR_") || groupId.includes("YOUR_")) return null;

    try {
        const formData = new FormData();
        formData.append("chat_id", groupId);
        formData.append("caption", captionText);
        formData.append("parse_mode", "HTML");

        let method = "sendDocument";
        let field = "document";

        if (file.type.startsWith("image/")) {
            method = "sendPhoto";
            field = "photo";
        } else if (file.type.startsWith("video/")) {
            method = "sendVideo";
            field = "video";
        }

        formData.append(field, file);

        const url = `https://api.telegram.org/bot${token}/${method}`;
        const res = await fetch(url, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        console.log("[Telegram File] Dosyalı bildirim gönderim sonucu:", data);
        return data;
    } catch (err) {
        console.error("[Telegram File] Gruba dosya gönderme hatası:", err);
        return null;
    }
};


document.addEventListener("DOMContentLoaded", () => {
    // PWA Service Worker Kaydı
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('[Service Worker] Başarıyla kaydedildi. Scope:', reg.scope);
                // Service Worker kurulduktan sonra FCM'i başlat
                initializeFirebaseMessaging();
            })
            .catch((err) => console.error('[Service Worker] Kayıt hatası:', err));
    }

    // Global minimalist kaydırma çubuğu (scrollbar) ve yazıcı (print) stillerini enjekte et
    const scrollStyle = document.createElement("style");
    scrollStyle.textContent = `
        /* Webkit Tarayıcılar (Chrome, Safari, Edge) */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #262626;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #404040;
        }
        /* Firefox */
        * {
            scrollbar-width: thin;
            scrollbar-color: #262626 transparent;
        }

        /* Yazıcı / PDF Çıktısı Stilleri */
        @media print {
            @page {
                size: A4 portrait;
                margin: 0.8cm;
            }
            aside, header, button, form:not(#checklist-submit-form), .no-print, #is-tanim-container, #yonetici-isler-container, #izin-form-container, #vardiya-durum-paneli, #cizelge-view-container > div:first-child, #nobet-form-container, #taslak-container, #panel-izinler, #profile-modal, #duyuru-form-container {
                display: none !important;
            }
            
            /* Sığdırma kuralları (overflow ve pozisyonu sıfırla) */
            html, body, main, #nobet-tablo-container, div, table, tr, td {
                position: static !important;
                overflow: visible !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                float: none !important;
            }

            body, html {
                background: white !important;
                color: black !important;
                font-size: 8.5px !important;
            }
            main, #nobet-tablo-container, #rapor-list {
                display: block !important;
                background: white !important;
                color: black !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
            }
            table {
                border-collapse: collapse !important;
                width: 100% !important;
                margin-top: 10px !important;
            }
            th, td {
                border: 1px solid #000 !important;
                color: black !important;
                background: transparent !important;
                padding: 4px 6px !important;
                font-size: 8.5px !important;
            }
            th {
                font-weight: bold !important;
                text-transform: uppercase !important;
                background-color: #e5e7eb !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Haftasonu günlerini baskıda daha belirgin gri yap */
            tr.weekend-row {
                background-color: #e5e7eb !important;
                font-weight: bold !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Yazıcı başlığı */
            .print-header-title {
                display: block !important;
            }

            #rapor-list > div {
                page-break-inside: avoid !important;
                border: 1px solid #000 !important;
                background: transparent !important;
                color: black !important;
                padding: 10px !important;
                margin-bottom: 10px !important;
                border-radius: 0 !important;
            }
            .md\\:hidden {
                display: none !important;
            }
            .hidden {
                display: block !important;
            }
            .md\\:block {
                display: block !important;
            }
        }
    `;
    document.head.appendChild(scrollStyle);

    const main = document.querySelector("main");
    if (!main) return;

    // Aktif sayfayı belirleme (sol menüde aktif sınıfı vermek için)
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 1. Oturum Kontrolü
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    // Canlı Oturum Doğrulama (Firebase Auth onAuthStateChanged ile)
    if (loggedInUser) {
        (async () => {
            try {
                const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js");
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
                const { firebaseConfig } = await import("../db/firebase.js");

                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);

                onAuthStateChanged(auth, (user) => {
                    if (!user) {
                        console.log("[Auth] Oturum sonlandırıldı, çıkış yapılıyor...");
                        localStorage.removeItem('loggedInUser');
                        localStorage.removeItem('fcmToken');
                        window.location.href = "./index.html";
                    }
                });
            } catch (authErr) {
                console.error("[Auth System Error]", authErr);
            }
        })();
    }

    // Giriş sayfasında (index.html) eğer giriş yapılmamışsa ortak layout'u yükleme
    if ((currentPage === "index.html" || currentPage === "") && !loggedInUser) {
        return;
    }

    // Eğer giriş yapılmamışsa ve başka sayfadaysak giriş sayfasına yönlendir
    if (currentPage !== "index.html" && currentPage !== "" && !loggedInUser) {
        window.location.href = "./index.html";
        return;
    }

    // Yetki Kontrolü: Normal personel "personeller.html" sayfasına erişemez!
    if (currentPage === "personeller.html" && loggedInUser?.rol !== "yonetici") {
        window.location.href = "./index.html";
        return;
    }

    // 2. Ana sarmalayıcıyı (wrapper) oluştur
    const wrapper = document.createElement("div");
    wrapper.className = "w-full min-w-[320px] max-w-[1440px] min-h-screen flex relative bg-neutral-950 overflow-hidden";

    // 3. Mobil menü arkalığını (overlay) oluştur
    const overlay = document.createElement("div");
    overlay.id = "sidebar-overlay";
    overlay.className = "fixed inset-0 bg-black/60 z-40 hidden md:hidden transition-opacity duration-300";
    wrapper.appendChild(overlay);

    // 4. Sol menüyü (sidebar) oluştur
    const sidebar = document.createElement("aside");
    sidebar.id = "sidebar";
    sidebar.className = "fixed md:relative inset-y-0 left-0 z-50 w-64 bg-black border-r border-neutral-900 flex flex-col transition-all duration-300 ease-in-out transform -translate-x-full md:translate-x-0";

    // Sol menü başlığı
    const sidebarHeader = document.createElement("div");
    sidebarHeader.className = "h-14 flex items-center justify-between px-6 border-b border-neutral-900";
    sidebarHeader.innerHTML = `
        <span class="text-xl font-bold tracking-wider text-white">PROTOKOL</span>
        <button id="sidebar-close" class="md:hidden text-neutral-400 hover:text-white focus:outline-none transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    sidebar.appendChild(sidebarHeader);

    // Sol menü navigasyon alanı
    const nav = document.createElement("nav");
    nav.className = "flex-1 px-4 py-6 space-y-2 overflow-y-auto";

    const menuItems = [
        {
            name: "Ana Sayfa",
            path: "index.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>`
        },
        {
            name: "Görevler",
            path: "gorevler.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>`
        },
        {
            name: "Sorunlar",
            path: "sorunlar.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>`
        },
        {
            name: "Duyurular",
            path: "duyurular.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>`
        },
        {
            name: "Kontrol Listesi",
            path: "kontrol-listesi.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`
        },
        {
            name: "Nöbet Listesi",
            path: "nobet-listesi.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>`
        }
    ];

    // Personeller menüsünü sadece Yöneticiler görebilir
    if (loggedInUser && loggedInUser.rol === 'yonetici') {
        menuItems.push({
            name: "Personeller",
            path: "personeller.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>`
        });
    }

    menuItems.forEach(item => {
        const link = document.createElement("a");
        link.href = `./${item.path}`;
        
        const isActive = currentPage === item.path || (currentPage === "" && item.path === "index.html");
        
        if (isActive) {
            link.className = "flex items-center space-x-3 px-4 py-2.5 rounded-md bg-neutral-900 text-white font-medium transition-all";
            link.innerHTML = `
                <div class="text-white">${item.icon}</div>
                <span>${item.name}</span>
            `;
        } else {
            link.className = "flex items-center space-x-3 px-4 py-2.5 rounded-md text-neutral-500 font-medium transition-all hover:bg-neutral-900/40 hover:text-neutral-300";
            link.innerHTML = `
                <div class="text-neutral-600">${item.icon}</div>
                <span>${item.name}</span>
            `;
        }
        nav.appendChild(link);
    });
    sidebar.appendChild(nav);

    // Sol menü alt bilgi (Çıkış Butonu dahil)
    const sidebarFooter = document.createElement("div");
    sidebarFooter.className = "p-4 border-t border-neutral-900 flex items-center justify-between";
    sidebarFooter.innerHTML = `
        <span class="text-xs text-neutral-500">v1.0.0</span>
        <button id="logout-btn" class="flex items-center space-x-1.5 text-xs text-red-500 hover:text-red-400 font-semibold transition-colors cursor-pointer focus:outline-none">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Çıkış</span>
        </button>
    `;
    sidebar.appendChild(sidebarFooter);

    wrapper.appendChild(sidebar);

    // 5. Sağ taraftaki içerik alanını (content area) oluştur
    const contentArea = document.createElement("div");
    contentArea.className = "flex-1 flex flex-col min-h-screen";

    // Üst Navbar (Header)
    const header = document.createElement("header");
    header.className = "h-14 border-b border-neutral-900 bg-black flex items-center px-4 md:px-6 justify-between";
    header.innerHTML = `
        <button id="sidebar-toggle" class="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 focus:outline-none transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
        <div class="flex items-center space-x-3">
            <span class="text-xs text-neutral-500 hidden sm:inline select-none">Protokol Paneli</span>
            <button id="profile-btn" class="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-neutral-850 hover:border-neutral-700 bg-neutral-950/60 hover:bg-neutral-900/80 transition-all cursor-pointer text-xs font-semibold text-neutral-200 focus:outline-none select-none">
                <svg class="h-3.5 w-3.5 text-brandOrange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>${loggedInUser?.adSoyad || 'Profilim'}</span>
            </button>
        </div>
    `;
    contentArea.appendChild(header);

    // 6. Orijinal <main> içeriğini yeni içerik alanının altına taşı
    contentArea.appendChild(main);
    wrapper.appendChild(contentArea);

    // 7. Hazırlanan tüm yapıyı body içerisine yerleştir
    document.body.innerHTML = "";
    document.body.appendChild(wrapper);

    // 7.5. Profil ayarları modalını başlat
    initializeProfileModal(loggedInUser);
 
    // 8. Olay Dinleyicileri (Sidebar Toggle & Logout)
    initializeSidebarToggle();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
            const fcmToken = localStorage.getItem('fcmToken');
            
            if (loggedInUser && fcmToken) {
                try {
                    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
                    const { getDatabase, ref, remove } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
                    const { firebaseConfig } = await import("../db/firebase.js");
                    
                    const app = initializeApp(firebaseConfig);
                    const db = getDatabase(app);
                    await remove(ref(db, `personeller/${loggedInUser.uid}/fcmTokens/${fcmToken}`));
                } catch (err) {
                    console.error("[FCM] Çıkışta token silme hatası:", err);
                }
            }

            localStorage.removeItem('loggedInUser');
            localStorage.removeItem('fcmToken');
            window.location.href = './index.html';
        });
    }
});

function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (window.innerWidth >= 768) {
            sidebar.classList.toggle('md:-ml-64');
        } else {
            sidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
        }
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    });
}

// --- Küresel Toast ve Alert Arayüzleri ---

// 1. Toast Bildirim Fonksiyonu
window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = "fixed bottom-5 right-5 z-[200] flex flex-col space-y-3 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = "flex items-center space-x-3 bg-black border border-neutral-800 rounded-xl px-4 py-3 shadow-2xl text-xs md:text-sm text-white transform translate-y-10 opacity-0 transition-all duration-300 max-w-sm pointer-events-auto select-none";

    let borderClass = 'border-l-4 border-l-brandOrange';
    let iconColor = 'text-brandOrange';
    let svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`; // Onay işareti

    if (type === 'error') {
        borderClass = 'border-l-4 border-l-red-600';
        iconColor = 'text-red-500';
        svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />`; // Hata işareti
    } else if (type === 'warning') {
        borderClass = 'border-l-4 border-l-brandYellow';
        iconColor = 'text-brandYellow';
        svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`; // Uyarı işareti
    }

    toast.className += ` ${borderClass}`;
    toast.innerHTML = `
        <svg class="h-5 w-5 ${iconColor} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            ${svgPath}
        </svg>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    // Animasyonla içeri kaydır
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 50);

    // 4 saniye sonra otomatik temizle
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
};

// 2. Özel Alert/Confirm Modal Fonksiyonu (Promise tabanlı)
window.showAlert = (title, message, isConfirm = false) => {
    return new Promise((resolve) => {
        // Arkalık katmanı
        const backdrop = document.createElement('div');
        backdrop.className = "fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 transition-opacity duration-300 opacity-0";
        
        // Modal kartı
        const modal = document.createElement('div');
        modal.className = "w-full max-w-sm bg-black border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center transform scale-95 transition-all duration-300 opacity-0 select-none";
        
        modal.innerHTML = `
            <h3 class="text-lg font-bold text-white mb-2">${title}</h3>
            <p class="text-xs md:text-sm text-neutral-400 mb-6 leading-relaxed">${message}</p>
            <div class="flex justify-center space-x-3">
                ${isConfirm ? `
                    <button id="alert-cancel" class="px-5 py-2.5 border border-neutral-800 hover:bg-neutral-900 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer">İptal</button>
                ` : ''}
                <button id="alert-ok" class="px-6 py-2.5 bg-brandOrange hover:bg-orange-600 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer">Tamam</button>
            </div>
        `;
        
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        
        // Giriş animasyonları
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
        }, 50);
        
        // Kapatma fonksiyonu
        const closeModal = (result) => {
            backdrop.classList.add('opacity-0');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 300);
        };
        
        modal.querySelector('#alert-ok').addEventListener('click', () => closeModal(true));
        if (isConfirm) {
            modal.querySelector('#alert-cancel').addEventListener('click', () => closeModal(false));
        }
    });
};

// ============================================================================
// PROFİL AYARLARI MODALI VE VERİ YÖNETİMİ
// ============================================================================
async function initializeProfileModal(loggedInUser) {
    if (!loggedInUser) return;

    // Modal HTML'ini oluştur ve body'ye ekle
    const modal = document.createElement("div");
    modal.id = "profile-modal";
    modal.className = "fixed inset-0 z-[100] hidden items-center justify-center bg-black/75 backdrop-blur-sm p-4";
    modal.innerHTML = `
        <div class="w-full max-w-md bg-neutral-950 border border-neutral-900 rounded-xl shadow-2xl p-6 relative">
            <button id="profile-modal-close" class="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors cursor-pointer">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            
            <!-- Başlık -->
            <h3 class="text-lg font-bold text-white tracking-wide border-b border-neutral-900 pb-3 mb-4 flex items-center space-x-2">
                <svg class="h-5 w-5 text-brandOrange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Profil Ayarlarım</span>
            </h3>
            
            <!-- FORM A: PROFİL AYARLARI -->
            <form id="profile-settings-form" class="space-y-4" autocomplete="off">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Ad Soyad</label>
                    <input type="text" id="profile-ad-soyad" disabled class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-neutral-400 opacity-50 cursor-not-allowed">
                </div>
                
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Sicil No (Kullanıcı Adı)</label>
                    <input type="text" id="profile-sicil-no" disabled class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-neutral-400 opacity-50 cursor-not-allowed">
                </div>
                
                <div>
                    <label for="profile-eposta" class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">E-posta Adresi</label>
                    <input type="email" id="profile-eposta" placeholder="Ornek: eposta@protokol.com" class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-brandOrange transition-colors">
                </div>
                
                <div>
                    <label for="profile-telefon" class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Telefon Numarası</label>
                    <input type="tel" id="profile-telefon" placeholder="Ornek: 0555 555 55 55" class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-brandOrange transition-colors">
                </div>

                <!-- Şifre Değiştirme Bölümü (İsteğe Bağlı) -->
                <div class="border-t border-neutral-900 pt-4 mt-4">
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-brandOrange mb-3 select-none">Şifre Değiştir (İsteğe Bağlı)</h4>
                    <div class="space-y-3">
                        <div>
                            <label for="profile-sifre" class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Yeni Şifre</label>
                            <input type="password" id="profile-sifre" placeholder="Boş bırakırsanız değişmez" class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-brandOrange transition-colors">
                        </div>
                        <div>
                            <label for="profile-sifre-tekrar" class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Yeni Şifre (Tekrar)</label>
                            <input type="password" id="profile-sifre-tekrar" placeholder="Yeni şifreyi tekrar yazın" class="w-full bg-neutral-900 border border-neutral-850 rounded py-2 px-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-brandOrange transition-colors">
                        </div>
                    </div>
                </div>
                
                <div class="pt-2">
                    <button type="submit" id="profile-save-btn" class="w-full bg-brandOrange hover:bg-orange-600 text-white font-bold py-2 px-3 rounded text-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5 uppercase tracking-wider">
                        <span>Güncellemeleri Kaydet</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const profileBtn = document.getElementById("profile-btn");
    const closeBtn = document.getElementById("profile-modal-close");
    const settingsForm = document.getElementById("profile-settings-form");

    if (profileBtn) {
        profileBtn.addEventListener("click", async () => {
            modal.classList.remove("hidden");
            modal.classList.add("flex");

            // Firebase'den güncel verileri çekip form alanlarını doldur
            try {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
                const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
                const { firebaseConfig } = await import("../db/firebase.js");

                const app = initializeApp(firebaseConfig);
                const db = getDatabase(app);

                const snapshot = await get(ref(db, `personeller/${loggedInUser.uid}`));
                const user = snapshot.val() || {};

                document.getElementById("profile-ad-soyad").value = user.adSoyad || loggedInUser.adSoyad || "";
                document.getElementById("profile-sicil-no").value = user.sicilNo || loggedInUser.sicilNo || "";
                document.getElementById("profile-eposta").value = user.eposta || "";
                document.getElementById("profile-telefon").value = user.telefon || "";
            } catch (err) {
                console.error("[Profile] Profil bilgileri çekilemedi:", err);
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        });
    }

    // Modal dışına tıklanırsa kapat
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }
    });

    if (settingsForm) {
        settingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById("profile-save-btn");
            const originalBtnHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span>Kaydediliyor...</span>`;

            const eposta = document.getElementById("profile-eposta").value.trim();
            const telefon = document.getElementById("profile-telefon").value.trim();
            const sifreVal = document.getElementById("profile-sifre").value;
            const sifreTekrarVal = document.getElementById("profile-sifre-tekrar").value;

            try {
                // Şifre Değiştirme Kontrolü
                let newPassword = null;
                if (sifreVal) {
                    if (sifreVal !== sifreTekrarVal) {
                        throw new Error("Şifreler uyuşmuyor!");
                    }
                    if (sifreVal.length < 6) {
                        throw new Error("Şifre en az 6 karakter olmalıdır!");
                    }
                    newPassword = sifreVal;
                }

                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js");
                const { getDatabase, ref, update } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js");
                const { firebaseConfig } = await import("../db/firebase.js");

                const app = initializeApp(firebaseConfig);
                const db = getDatabase(app);

                const updatePayload = {
                    eposta: eposta,
                    telefon: telefon
                };

                // Eğer şifre veya e-posta güncellenecekse
                const { getAuth, updatePassword, updateEmail } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js");
                const auth = getAuth(app);
                const user = auth.currentUser;

                if (user) {
                    try {
                        if (eposta && eposta !== user.email) {
                            await updateEmail(user, eposta);
                        }
                        if (newPassword) {
                            await updatePassword(user, newPassword);
                        }
                    } catch (authErr) {
                        if (authErr.code === "auth/requires-recent-login") {
                            throw new Error("Güvenlik nedeniyle profil bilgilerinizi güncellemek için yakın zamanda giriş yapmış olmalısınız. Lütfen oturumu kapatıp tekrar giriş yapın.");
                        } else {
                            throw authErr;
                        }
                    }
                }

                if (newPassword) {
                    const { encryptPassword } = await import("../db/firebase.js");
                    updatePayload.sifre = encryptPassword(newPassword);
                }

                await update(ref(db, `personeller/${loggedInUser.uid}`), updatePayload);

                // Şifre kutularını temizle
                document.getElementById("profile-sifre").value = "";
                document.getElementById("profile-sifre-tekrar").value = "";

                if (window.showToast) {
                    window.showToast("Profil ayarlarınız başarıyla kaydedildi.", "success");
                } else {
                    alert("Profil ayarlarınız başarıyla kaydedildi.");
                }

                modal.classList.add("hidden");
                modal.classList.remove("flex");
            } catch (err) {
                console.error("[Profile] Profil güncellenirken hata oluştu:", err);
                if (window.showToast) {
                    window.showToast(err.message, "error");
                } else {
                    alert("Hata: " + err.message);
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnHtml;
            }
        });
    }

}

// 8. Global Bildirim Ayarı Çekme Yardımcısı (Tüm bildirim tipleri için her zaman true döner)
window.getNotificationSettings = async () => {
    return {
        gorev_yeni_fcm: true,
        gorev_yeni_telegram: true,
        gorev_durum_fcm: true,
        gorev_durum_telegram: true,
        gorev_mesaj_fcm: true,
        gorev_mesaj_telegram: true,
        ariza_yeni_fcm: true,
        ariza_yeni_telegram: true,
        ariza_durum_fcm: true,
        ariza_durum_telegram: true,
        ariza_mesaj_fcm: true,
        ariza_mesaj_telegram: true
    };
};
