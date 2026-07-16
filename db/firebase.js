import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

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

// Firebase & Realtime Database Başlatma
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Saf JS Şifreleme Yardımcıları (XOR + Base64)
const SALT = "ProtokolSecretKey2026";

function encryptPassword(text) {
    if (!text) return "";
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
        result += String.fromCharCode(charCode);
    }
    return btoa(unescape(encodeURIComponent(result)));
}

function decryptPassword(cipher) {
    if (!cipher) return "";
    try {
        const decoded = decodeURIComponent(escape(atob(cipher)));
        let result = "";
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (e) {
        return cipher; // Hata durumunda veya eski düz metin şifreler için tolerans
    }
}

// Diğer JS dosyalarında import edebilmek için export ediyoruz
export { db, auth, firebaseConfig, encryptPassword, decryptPassword };
