import { db, firebaseConfig, encryptPassword, decryptPassword } from "../db/firebase.js";
import { ref, push, set, onValue, remove, get, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

// Global durum değişkenleri
let editModeId = null;
let allPersoneller = {};

// Form Elemanları
const form = document.getElementById('personel-form');
const formTitle = form?.querySelector('h2');
const formDesc = form?.querySelector('p');
const submitBtn = form?.querySelector('button[type="submit"]');

// Düzenleme modundan çıkış (Kayıt moduna dönüş)
function exitEditMode() {
    editModeId = null;
    if (form) form.reset();
    
    // Sicil No alanını tekrar aktif et
    const sicilInput = document.getElementById('sicil-no');
    if (sicilInput) {
        sicilInput.disabled = false;
        sicilInput.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    if (formTitle) formTitle.textContent = "Personel Kayıt Formu";
    if (formDesc) formDesc.textContent = "Lütfen yeni personelin bilgilerini eksiksiz doldurun.";
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Kaydet</span>
        `;
    }
}

// Form Gönderim Dinleyicisi (Kayıt & Güncelleme)
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtnContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>${editModeId ? 'Güncelleniyor...' : 'Kaydediliyor...'}</span>
        `;

        // Form verilerini toplama
        const data = {
            adSoyad: document.getElementById('ad-soyad').value.trim(),
            sicilNo: document.getElementById('sicil-no').value.trim(),
            rol: document.getElementById('rol').value,
            eposta: document.getElementById('eposta').value.trim(),
            telefon: document.getElementById('telefon').value.trim(),
            kayitTarihi: editModeId ? allPersoneller[editModeId].kayitTarihi : new Date().toISOString()
        };

        try {
            // Düzenleme modunda değişiklik kontrolü
            if (editModeId) {
                const original = allPersoneller[editModeId];
                const isChanged = 
                    original.adSoyad !== data.adSoyad ||
                    original.sicilNo !== data.sicilNo ||
                    (original.rol || 'personel') !== data.rol ||
                    (original.eposta || '') !== data.eposta ||
                    (original.telefon || '') !== data.telefon;

                if (!isChanged) {
                    window.showToast("Herhangi bir değişiklik yapmadınız!", "warning");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtnContent;
                    return;
                }
            }

            // Sicil No benzersizlik kontrolü (Sadece yeni kayıtta kontrol et)
            if (!editModeId) {
                const duplicateExists = Object.keys(allPersoneller).some(key => 
                    allPersoneller[key].sicilNo.toLowerCase() === data.sicilNo.toLowerCase()
                );

                if (duplicateExists) {
                    window.showToast("Bu sicil numarasına sahip bir personel zaten mevcut!", "warning");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtnContent;
                    return;
                }
            }

            if (editModeId) {
                // Güncelleme işlemi (Veritabanında güncelle)
                const personelRef = ref(db, `personeller/${editModeId}`);
                // Güncelleme esnasında şifreyi koruyoruz
                data.sifre = allPersoneller[editModeId].sifre;
                
                await update(personelRef, data);
                window.showToast("Personel başarıyla güncellendi.", "success");
                exitEditMode();
            } else {
                // Yeni kayıt işlemi
                // 1. Firebase Auth üzerinde geçici uygulama (Secondary App) ile hesabı oluştur
                const tempAppName = `TempApp_${Date.now()}`;
                const tempApp = initializeApp(firebaseConfig, tempAppName);
                const tempAuth = getAuth(tempApp);
                
                let userCredential;
                try {
                    userCredential = await createUserWithEmailAndPassword(
                        tempAuth, 
                        `${data.sicilNo.toLowerCase()}@protokol.local`, 
                        data.sicilNo
                    );
                } catch (authError) {
                    await deleteApp(tempApp);
                    if (authError.code === "auth/email-already-in-use") {
                        window.showToast("Bu sicil numarası Firebase üzerinde zaten kayıtlı!", "error");
                    } else if (authError.code === "auth/weak-password") {
                        window.showToast("Sicil numarası şifre kurallarına uymuyor (En az 6 karakter olmalıdır)!", "error");
                    } else {
                        window.showToast("Authentication Hatası: " + authError.message, "error");
                    }
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtnContent;
                    return;
                }
                
                const uid = userCredential.user.uid;
                await deleteApp(tempApp); // Belleği serbest bırak

                // 2. Veritabanına kullanıcının UID'si anahtar olacak şekilde kaydet (Şifre şifrelenmiş olarak)
                data.sifre = encryptPassword(data.sicilNo);
                const personelRef = ref(db, `personeller/${uid}`);
                await set(personelRef, data);
                
                window.showToast("Personel başarıyla veritabanına kaydedildi.", "success");
                form.reset();
            }
        } catch (error) {
            console.error("Firebase Hatası: ", error);
            window.showToast("İşlem sırasında bir hata oluştu: " + error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtnContent;
        }
    });
}

// Personelleri Gerçek Zamanlı Dinleme ve Listeleme
const personelList = document.getElementById('personel-list');
const personelCount = document.getElementById('personel-count');

if (personelList) {
    const personellerRef = ref(db, 'personeller');
    
    let loadingTimeout = setTimeout(() => {
        if (personelList.innerHTML === '') {
            personelList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-500 bg-black border border-neutral-900 rounded-xl">
                    <svg class="animate-spin h-8 w-8 text-brandOrange mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Veriler yükleniyor...</span>
                </div>
            `;
        }
    }, 300);
    
    onValue(personellerRef, (snapshot) => {
        clearTimeout(loadingTimeout);
        const data = snapshot.val();
        allPersoneller = data || {}; // Yerel veriyi güncelle
        
        personelList.innerHTML = '';
        
        // Eğer veri yoksa
        if (!data) {
            personelList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-500 bg-black border border-neutral-800 rounded-2xl shadow-xl">
                    <svg class="h-10 w-10 text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span>Kayıtlı personel bulunamadı. Yeni bir personel kaydederek başlayabilirsiniz.</span>
                </div>
            `;
            if (personelCount) {
                personelCount.classList.remove('hidden');
                personelCount.textContent = '0 Personel';
            }
            return;
        }
        
        // Verileri diziye çevirme ve en yeniye göre sıralama
        const keys = Object.keys(data);
        
        // Sistem Yöneticisi (admin) bootstrap hesabını personel listesinde gösterme
        const items = keys
            .map(key => ({
                id: key,
                ...data[key]
            }))
            .filter(personel => personel.sicilNo.toLowerCase() !== "admin");
            
        if (personelCount) {
            personelCount.classList.remove('hidden');
            personelCount.textContent = `${items.length} Personel`;
        }
        
        // Kayıt tarihine göre yeniden eskiye sırala
        items.sort((a, b) => new Date(b.kayitTarihi) - new Date(a.kayitTarihi));
        
        // Kartları oluşturup DOM'a ekle
        items.forEach(personel => {
            const card = document.createElement('div');
            card.className = "bg-black border border-neutral-900 rounded-lg p-5 transition-all duration-300 flex flex-col justify-between hover:border-neutral-800 relative group";
            
            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0 mr-2">
                        <h3 class="text-base font-bold text-white truncate leading-tight">${personel.adSoyad}</h3>
                    </div>
                    <span class="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${personel.rol === 'yonetici' ? 'bg-neutral-950 border-brandOrange/15 text-brandOrange' : 'bg-neutral-950 border-neutral-900 text-neutral-500'}">
                        ${personel.rol === 'yonetici' ? 'Yönetici' : 'Personel'}
                    </span>
                </div>

                <div class="mt-4 pt-3.5 border-t border-neutral-900 space-y-1.5 text-[11px] text-neutral-550 select-none">
                    <div class="flex justify-between items-center">
                        <span>Sicil No</span>
                        <span class="font-mono text-neutral-350">${personel.sicilNo}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>E-posta</span>
                        <span class="text-neutral-350 truncate max-w-[160px]">${personel.eposta || 'Belirtilmedi'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Telefon</span>
                        <span class="text-neutral-350">${personel.telefon || 'Belirtilmedi'}</span>
                    </div>
                </div>

                <div class="mt-4 pt-3.5 border-t border-neutral-900 flex flex-wrap gap-1.5 justify-between select-none">
                    <div class="flex gap-1.5">
                        <button class="btn-edit px-2 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-white rounded transition-colors cursor-pointer" data-id="${personel.id}">
                            Düzenle
                        </button>
                        <button class="btn-reset-pw px-2 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-white rounded transition-colors cursor-pointer" data-id="${personel.id}">
                            Şifre Sıfırla
                        </button>
                    </div>
                    <button class="btn-delete px-2 py-1 bg-neutral-950 hover:bg-red-950/10 border border-neutral-900 text-[10px] font-bold text-red-500 rounded transition-colors cursor-pointer" data-id="${personel.id}">
                        Sil
                    </button>
                </div>
            `;
            
            personelList.appendChild(card);
        });
    });

    // Kart Etkileşimleri (Düzenle & Sil & Şifre Sıfırla)
    personelList.addEventListener('click', async (e) => {
        // 1. DÜZENLEME İŞLEMİ
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const personel = allPersoneller[id];
            
            if (personel) {
                editModeId = id;
                
                // Form alanlarını doldur
                document.getElementById('ad-soyad').value = personel.adSoyad;
                document.getElementById('sicil-no').value = personel.sicilNo;
                document.getElementById('rol').value = personel.rol || 'personel';
                document.getElementById('eposta').value = personel.eposta || '';
                document.getElementById('telefon').value = personel.telefon || '';
                
                // Güvenlik & Benzersizlik nedeniyle düzenleme esnasında Sicil No değiştirilemez
                const sicilInput = document.getElementById('sicil-no');
                if (sicilInput) {
                    sicilInput.disabled = true;
                    sicilInput.classList.add('opacity-50', 'cursor-not-allowed');
                }

                // Form arayüzünü Düzenleme Modu yap
                if (formTitle) formTitle.textContent = "Personel Düzenle";
                if (formDesc) formDesc.textContent = "Lütfen personel bilgilerini güncelleyin.";
                if (submitBtn) {
                    submitBtn.innerHTML = `
                        <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Güncelle</span>
                    `;
                }
                
                // Forma yumuşak bir şekilde kaydır
                form.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // 2. SİLME İŞLEMİ
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            const personel = allPersoneller[id];
            if (personel) {
                const confirmDelete = await window.showAlert("Onay Gerekiyor", "Bu personeli silmek istediğinizden emin misiniz? (Authentication kaydı da temizlenecektir)", true);
                if (confirmDelete) {
                    const originalBtnContent = deleteBtn.innerHTML;
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = `
                        <svg class="animate-spin h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    `;

                    try {
                        // Eğer silinen personel o an düzenleniyorsa edit modundan çık
                        if (editModeId === id) {
                            exitEditMode();
                        }

                        // 1. Firebase Authentication kaydını temizle (Geçici oturum açıp silme yöntemiyle)
                        try {
                            const tempAppName = `TempAppDelete_${Date.now()}`;
                            const tempApp = initializeApp(firebaseConfig, tempAppName);
                            const tempAuth = getAuth(tempApp);
                            
                            const tempUserCred = await signInWithEmailAndPassword(
                                tempAuth, 
                                `${personel.sicilNo.toLowerCase()}@protokol.local`, 
                                decryptPassword(personel.sifre)
                            );
                            
                            const { deleteUser } = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js");
                            await deleteUser(tempUserCred.user);
                            await deleteApp(tempApp);
                        } catch (authDeleteError) {
                            console.warn("Authentication kaydı silinemedi (Zaten silinmiş veya şifre uyuşmuyor):", authDeleteError);
                        }

                        // 2. Realtime Database'den kaydı sil
                        const personelRef = ref(db, `personeller/${id}`);
                        await remove(personelRef);
                        
                        window.showToast("Personel başarıyla silindi.", "success");
                    } catch (error) {
                        console.error("Silme Hatası: ", error);
                        window.showToast("Silme işlemi sırasında bir hata oluştu: " + error.message, "error");
                    } finally {
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = originalBtnContent;
                    }
                }
            }
        }

        // 3. ŞİFRE SIFIRLAMA İŞLEMİ
        const resetPwBtn = e.target.closest('.btn-reset-pw');
        if (resetPwBtn) {
            const id = resetPwBtn.getAttribute('data-id');
            const personel = allPersoneller[id];
            if (personel) {
                const confirmReset = await window.showAlert(
                    "Şifre Sıfırlama", 
                    `Bu personelin şifresini sıfırlamak istediğinizden emin misiniz? Şifre, personelin sicil numarası (${personel.sicilNo}) olarak güncellenecektir.`, 
                    true
                );
                if (confirmReset) {
                    // Buton yükleniyor durumuna getirme
                    const originalBtnContent = resetPwBtn.innerHTML;
                    resetPwBtn.disabled = true;
                    resetPwBtn.innerHTML = `
                        <svg class="animate-spin h-3.5 w-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    `;

                    try {
                        // Firebase Auth şifresini güncellemek için kullanıcının hesabıyla geçici olarak oturum açıp şifreyi değiştiriyoruz
                        const tempAppName = `TempAppReset_${Date.now()}`;
                        const tempApp = initializeApp(firebaseConfig, tempAppName);
                        const tempAuth = getAuth(tempApp);
                        
                        const tempUserCred = await signInWithEmailAndPassword(
                            tempAuth, 
                            `${personel.sicilNo.toLowerCase()}@protokol.local`, 
                            decryptPassword(personel.sifre)
                        );
                        
                        await updatePassword(tempUserCred.user, personel.sicilNo);
                        await deleteApp(tempApp);

                        // Veritabanındaki şifre alanını güncelle
                        const personelRef = ref(db, `personeller/${id}`);
                        await update(personelRef, { sifre: encryptPassword(personel.sicilNo) });
                        
                        window.showToast("Şifre başarıyla sicil numarasına sıfırlandı.", "success");
                    } catch (error) {
                        console.error("Şifre Sıfırlama Hatası: ", error);
                        window.showToast("Şifre sıfırlanırken hata oluştu (Kurulum anındaki geçersiz şifrelerde veya ağ hatasında bu durum gözlenebilir): " + error.message, "error");
                    } finally {
                        resetPwBtn.disabled = false;
                        resetPwBtn.innerHTML = originalBtnContent;
                    }
                }
            }
        }
    });
}
