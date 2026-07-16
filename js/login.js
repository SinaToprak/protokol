import { db, auth, encryptPassword, decryptPassword } from "../db/firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sicilInput = document.getElementById('login-sicil').value.trim();
        const sifreInput = document.getElementById('login-sifre').value.trim();

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;

        // Butonu yükleniyor durumuna getirme
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Kimlik Doğrulanıyor...</span>
        `;

        // Mock e-posta adresi üretme (Firebase Auth için benzersiz kimlik)
        const email = `${sicilInput.toLowerCase()}@protokol.local`;
        const password = sifreInput;

        try {
            // 1. Firebase Authentication ile giriş yapmayı dene
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // 2. Kullanıcının rol ve bilgilerini veritabanından çek
            const userSnapshot = await get(ref(db, `personeller/${uid}`));
            const userData = userSnapshot.val();

            if (userData) {
                window.showToast("Giriş başarılı! Yönlendiriliyorsunuz...", "success");
                
                // Oturum bilgisini localStorage'a kaydet
                localStorage.setItem('loggedInUser', JSON.stringify({
                    uid: uid,
                    adSoyad: userData.adSoyad,
                    sicilNo: userData.sicilNo,
                    rol: userData.rol || 'personel',
                    eposta: userData.eposta
                }));

                setTimeout(() => {
                    window.location.href = "./index.html";
                }, 1500);
            } else {
                window.showToast("Kullanıcı kaydı veritabanında bulunamadı!", "error");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }

        } catch (error) {
            console.error("Giriş Hatası: ", error);
            if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                window.showToast("Hatalı sicil numarası veya şifre!", "error");
            } else {
                window.showToast("Giriş hatası: " + error.message, "error");
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });
}
