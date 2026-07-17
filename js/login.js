import { db, auth } from "../db/firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

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

        // Giriş girdisi e-posta mı yoksa Sicil No mu kontrolü
        let email = sicilInput;
        if (!email.includes('@')) {
            email = `${sicilInput.toLowerCase()}@protokol.local`;
        }
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
                    eposta: userData.eposta || `${userData.sicilNo.toLowerCase()}@protokol.local`
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
                window.showToast("Hatalı kullanıcı bilgileri veya şifre!", "error");
            } else {
                window.showToast("Giriş hatası: " + error.message, "error");
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });
}

// Şifremi Unuttum Handler
const btnForgotPassword = document.getElementById('btn-forgot-password');
if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', async () => {
        const sicilInput = document.getElementById('login-sicil') ? document.getElementById('login-sicil').value.trim() : '';
        if (!sicilInput) {
            window.showToast("Lütfen önce Sicil No veya kayıtlı E-posta adresinizi girin!", "warning");
            return;
        }

        let email = sicilInput;
        if (!email.includes('@')) {
            email = `${sicilInput.toLowerCase()}@protokol.local`;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            if (email.endsWith("@protokol.local")) {
                window.showToast("Şifre sıfırlama talebi gönderildi, ancak sistemde kayıtlı e-posta adresiniz bulunmamaktadır. Lütfen yöneticinizle iletişime geçin.", "warning");
            } else {
                window.showToast("Şifre sıfırlama e-postası kayıtlı e-posta adresinize gönderildi.", "success");
            }
        } catch (error) {
            console.error("Şifre sıfırlama hatası:", error);
            if (error.code === "auth/user-not-found") {
                window.showToast("Bu bilgilere sahip bir kullanıcı bulunamadı!", "error");
            } else {
                window.showToast("Talep gönderilemedi: " + error.message, "error");
            }
        }
    });
}
