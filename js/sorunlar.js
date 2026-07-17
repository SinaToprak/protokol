import { db } from "../db/firebase.js";
import { ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Giriş kontrolü
const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    window.location.href = "./index.html";
}

// Elemanları Seçme
const formContainer = document.getElementById('sorun-form-container');
const form = document.getElementById('sorun-form');
const sorunList = document.getElementById('sorun-list');
const sorunCount = document.getElementById('sorun-count');

// Tüm sorunları tutacak yerel hafıza
let tumSorunlar = {};

// Sohbetlerin açılıp kapanma durumunu hafızada tutma (ID -> true/false)
const collapsedChats = {};

// 1. ROL BAZLI FORM GÖSTERİMİ (Sorun bildirme formunu sadece personeller görebilir)
if (loggedInUser.rol === 'personel') {
    if (formContainer) formContainer.classList.remove('hidden');
} else {
    if (formContainer) formContainer.remove();
}

// 2. YENİ SORUN BİLDİRME (Sadece Personeller)
if (form && loggedInUser.rol === 'personel') {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;

        const baslikInput = document.getElementById('sorun-baslik').value.trim();
        const aciklamaInput = document.getElementById('sorun-aciklama').value.trim();
        const oncelikInput = document.getElementById('sorun-oncelik').value;
        const dosyaInput = document.getElementById('sorun-dosya');
        const file = dosyaInput ? dosyaInput.files[0] : null;

        const issueData = {
            baslik: baslikInput,
            aciklama: aciklamaInput,
            oncelik: oncelikInput,
            durum: 'beklemede',
            olusturanId: loggedInUser.uid,
            olusturanIsim: loggedInUser.adSoyad,
            olusturmaTarihi: new Date().toISOString()
        };
        if (file) {
            issueData.dosyaAdi = file.name;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Bildiriliyor...</span>`;

        try {
            const newSorunRef = push(ref(db, 'sorunlar'));
            await set(newSorunRef, issueData);
            window.showToast("Sorun başarıyla yöneticiye bildirildi.", "success");
            
            // Bildirim Ayarlarını Sorgula
            const notifSettings = await window.getNotificationSettings();

            // FCM Bildirimi Gönder (Tüm yöneticilere)
            if (notifSettings.ariza_yeni_fcm && window.sendNotificationToAllManagers) {
                window.sendNotificationToAllManagers(
                    "Yeni Arıza Bildirildi ⚠️",
                    `${loggedInUser.adSoyad}: "${baslikInput}"`
                );
            }

            // Telegram Bildirimi Gönder
            if (notifSettings.ariza_yeni_telegram) {
                const messageText = `⚠️ <b>Yeni Arıza Bildirildi</b>\n\n👤 <b>Bildiren:</b> ${loggedInUser.adSoyad}\n📌 <b>Başlık:</b> ${baslikInput}\n📖 <b>Detay:</b> ${aciklamaInput}${file ? `\n📎 <b>Ek Dosya:</b> ${file.name}` : ''}`;
                if (file && window.sendTelegramFileNotification) {
                    await window.sendTelegramFileNotification(file, messageText);
                } else if (window.sendTelegramGroupNotification) {
                    await window.sendTelegramGroupNotification(messageText);
                }
            }
            
            form.reset();
        } catch (error) {
            console.error("Sorun Bildirim Hatası: ", error);
            window.showToast("Sorun bildirilirken hata oluştu: " + error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });
}

// 3. SORUNLARIN LİSTELENMESİ VE ETKİLEŞİMLER
if (sorunList) {
    const sorunlarRef = ref(db, 'sorunlar');

    // Gecikmeli yükleniyor spinner gösterimi
    let loadingTimeout = setTimeout(() => {
        if (sorunList.innerHTML === '') {
            sorunList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-500 bg-black border border-neutral-900 rounded-xl">
                    <svg class="animate-spin h-8 w-8 text-brandOrange mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sorun kayıtları yükleniyor...</span>
                </div>
            `;
        }
    }, 300);

    onValue(sorunlarRef, (snapshot) => {
        clearTimeout(loadingTimeout);
        const data = snapshot.val() || {};
        tumSorunlar = data;

        // Form girdilerinin değerini ve focusunu koruma
        const focusedTaskId = document.activeElement && document.activeElement.closest('.msg-send-form') 
            ? document.activeElement.closest('.msg-send-form').getAttribute('data-id') 
            : null;
        
        const activeInputValues = {};
        document.querySelectorAll('.msg-input').forEach(input => {
            const formEl = input.closest('.msg-send-form');
            if (formEl) {
                const taskId = formEl.getAttribute('data-id');
                activeInputValues[taskId] = input.value;
            }
        });

        sorunList.innerHTML = '';
        const keys = Object.keys(data);

        // Kullanıcı rolüne göre listeleme
        let filtrelenmisSorunlar = keys.map(key => ({
            id: key,
            ...data[key]
        }));

        if (loggedInUser.rol !== 'yonetici') {
            // Personel: Sadece kendi bildirdiği aktif sorunları görebilir
            filtrelenmisSorunlar = filtrelenmisSorunlar.filter(s => 
                s.olusturanId === loggedInUser.uid && 
                s.durum !== 'tamamlandi' && 
                s.durum !== 'iptal'
            );
        }

        if (sorunCount) {
            sorunCount.classList.remove('hidden');
            sorunCount.textContent = `${filtrelenmisSorunlar.length} Sorun`;
        }

        if (filtrelenmisSorunlar.length === 0) {
            sorunList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-650 bg-black border border-neutral-900 rounded-xl">
                    <svg class="h-8 w-8 text-neutral-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Şu anda kayıtlı sorun bildirimi bulunmuyor.</span>
                </div>
            `;
            return;
        }

        // Tarihe göre sıralama (Yeniden eskiye)
        filtrelenmisSorunlar.sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi));

        // Sorun Kartlarını Render Etme
        filtrelenmisSorunlar.forEach(sorun => {
            const card = document.createElement('div');
            card.className = "bg-black border border-neutral-900 rounded-lg p-5 transition-all duration-300 flex flex-col justify-between hover:border-neutral-800 relative group";

            // Öncelik etiketleri
            let oncelikRenk = 'bg-neutral-955 border-neutral-900 text-neutral-500';
            let oncelikIsim = 'Düşük';
            if (sorun.oncelik === 'orta') {
                oncelikRenk = 'bg-neutral-955 border-brandYellow/15 text-brandYellow';
                oncelikIsim = 'Orta';
            } else if (sorun.oncelik === 'yuksek') {
                oncelikRenk = 'bg-neutral-955 border-brandOrange/15 text-brandOrange';
                oncelikIsim = 'Yüksek';
            }

            // Durum etiketleri
            let durumRenk = 'bg-neutral-955 border-neutral-900 text-neutral-500';
            let durumIsim = 'Beklemede';
            if (sorun.durum === 'yapiliyor') {
                durumRenk = 'bg-neutral-955 border-blue-900/20 text-blue-400';
                durumIsim = 'Çözülüyor';
            } else if (sorun.durum === 'revize') {
                durumRenk = 'bg-neutral-955 border-amber-900/20 text-amber-400';
                durumIsim = 'Revize';
            } else if (sorun.durum === 'tamamlandi') {
                durumRenk = 'bg-neutral-955 border-emerald-900/20 text-emerald-400';
                durumIsim = 'Çözüldü';
            } else if (sorun.durum === 'iptal') {
                durumRenk = 'bg-neutral-955 border-red-955/25 text-red-400';
                durumIsim = 'İptal';
            }

            const isActive = sorun.durum !== 'tamamlandi' && sorun.durum !== 'iptal';

            // Aksiyon Butonları (YÖNETİCİ: Son karar merciidir)
            let aksiyonButonlari = '';
            let silButonu = '';

            if (loggedInUser.rol === 'yonetici') {
                if (isActive) {
                    aksiyonButonlari += `
                        <button class="btn-status-change-sorun px-2 py-1 bg-neutral-955 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-emerald-400 rounded transition-colors cursor-pointer flex items-center space-x-1" data-id="${sorun.id}">
                            <span>Çözüldü Olarak İşaretle</span>
                        </button>
                        <button class="btn-direct-status-change px-2 py-1 bg-neutral-955 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-brandYellow rounded transition-colors cursor-pointer" data-id="${sorun.id}" data-target="revize">
                            Revize İste
                        </button>
                        <button class="btn-direct-status-change px-2 py-1 bg-neutral-955 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-red-400 rounded transition-colors cursor-pointer" data-id="${sorun.id}" data-target="iptal">
                            İptal
                        </button>
                    `;
                } else {
                    aksiyonButonlari += `
                        <button class="btn-direct-status-change px-2.5 py-1 bg-neutral-955 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-blue-400 rounded transition-colors cursor-pointer" data-id="${sorun.id}" data-target="yapiliyor">
                            Aktifleştir
                        </button>
                    `;
                    silButonu = `
                        <button class="btn-delete px-2.5 py-1 bg-neutral-955 hover:bg-red-955/10 border border-neutral-900 text-[10px] font-bold text-red-500 rounded transition-colors cursor-pointer" data-id="${sorun.id}">
                            <span>Sil</span>
                        </button>
                    `;
                }
            }

            // --- YAZIŞMA GEÇMİŞİ LİSTELEME ---
            let mesajlarHtml = '';
            if (sorun.mesajlar) {
                const msgKeys = Object.keys(sorun.mesajlar);
                const msgList = msgKeys.map(k => ({ id: k, ...sorun.mesajlar[k] }));
                msgList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                msgList.forEach(msg => {
                    const msgDate = new Date(msg.timestamp);
                    const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(msgDate);
                    const timeStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(msgDate);
                    const dateTimeStr = `${dateStr} ${timeStr}`;

                    if (msg.isSystem) {
                        let sysColorClass = "text-neutral-600";
                        if (msg.text.includes("onayladı") || msg.text.includes("çözüldü") || msg.text.includes("tamamlandı")) {
                            sysColorClass = "text-emerald-500/80";
                        } else if (msg.text.includes("revize")) {
                            sysColorClass = "text-brandYellow/80";
                        } else if (msg.text.includes("iptal")) {
                            sysColorClass = "text-red-500/80";
                        } else if (msg.text.includes("aktifleştirdi")) {
                            sysColorClass = "text-blue-500/80";
                        }

                        mesajlarHtml += `
                            <div class="text-center py-1 text-[9px] ${sysColorClass} select-none font-semibold flex items-center justify-center space-x-1.5">
                                <span>•</span>
                                <span>${msg.text}</span>
                                <span class="text-neutral-700 font-mono text-[8px]">${dateTimeStr}</span>
                            </div>
                        `;
                    } else {
                        const isMe = msg.senderId === loggedInUser.uid;
                        if (isMe) {
                            mesajlarHtml += `
                                <div class="flex justify-end">
                                    <div class="bg-brandOrange/10 text-white rounded px-2.5 py-1.5 max-w-[85%] text-[11px]">
                                        <div class="flex items-center justify-between gap-4 mb-0.5 select-none">
                                            <span class="font-bold text-[9px] text-brandOrange">${msg.senderName}</span>
                                            <span class="text-[8px] text-neutral-500">${dateTimeStr}</span>
                                        </div>
                                        <p class="break-words leading-relaxed">${msg.text}</p>
                                    </div>
                                </div>
                            `;
                        } else {
                            mesajlarHtml += `
                                <div class="flex justify-start">
                                    <div class="bg-neutral-900 text-neutral-300 rounded px-2.5 py-1.5 max-w-[85%] text-[11px]">
                                        <div class="flex items-center justify-between gap-4 mb-0.5 select-none">
                                            <span class="font-bold text-[9px] text-neutral-400">${msg.senderName}</span>
                                            <span class="text-[8px] text-neutral-500">${dateTimeStr}</span>
                                        </div>
                                        <p class="break-words leading-relaxed">${msg.text}</p>
                                    </div>
                                </div>
                            `;
                        }
                    }
                });
            } else {
                mesajlarHtml = `<div class="text-center py-4 text-[10px] text-neutral-650 italic">Bu sorun hakkında henüz yazışma yapılmamış.</div>`;
            }

            if (collapsedChats[sorun.id] === undefined) {
                collapsedChats[sorun.id] = !isActive; 
            }
            const isCollapsed = collapsedChats[sorun.id];

            const isWriteable = sorun.durum !== 'tamamlandi' && sorun.durum !== 'iptal';

            card.innerHTML = `
                <div class="flex items-start justify-between gap-2 select-none">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-base font-bold text-white truncate leading-tight">${sorun.baslik}</h3>
                        <p class="text-[10px] text-neutral-600 mt-0.5">Bildiren: ${sorun.olusturanIsim}</p>
                    </div>
                    
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${oncelikRenk}">
                            ${oncelikIsim}
                        </span>
                        <span class="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${durumRenk}">
                            ${durumIsim}
                        </span>
                    </div>
                </div>

                <p class="text-xs text-brandYellow mt-3 leading-relaxed whitespace-pre-line bg-neutral-950/40 p-2.5 rounded border border-neutral-900/60">${sorun.aciklama}</p>

                ${sorun.dosyaAdi ? `
                    <div class="flex items-center text-[10px] text-neutral-400 bg-neutral-950/60 py-1.5 px-2.5 rounded border border-neutral-900/60 mt-2 select-none">
                        <svg class="h-3.5 w-3.5 mr-2 text-brandOrange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span>Ekli Dosya (Telegram'da): <strong class="text-white">${sorun.dosyaAdi}</strong></span>
                    </div>
                ` : ''}

                <div class="mt-3.5 pt-2.5 border-t border-neutral-900 space-y-1.5 text-[11px] text-neutral-550 select-none">
                    <div class="flex items-center">
                        <svg class="h-3.5 w-3.5 mr-2 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Bildirilme Tarihi: <span class="font-mono">${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(sorun.olusturmaTarihi))} ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(sorun.olusturmaTarihi))}</span></span>
                    </div>
                </div>

                <!-- --- SOHBET / YAZIŞMA ALANI --- -->
                <div class="chat-section mt-3">
                    <div class="flex items-center justify-between mb-2 select-none">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-600">Yazışma Geçmişi</span>
                        <button class="btn-toggle-chat text-[9px] font-bold text-neutral-500 hover:text-brandOrange cursor-pointer focus:outline-none" data-id="${sorun.id}">
                            ${isCollapsed ? 'Mesajları Göster' : 'Mesajları Gizle'}
                        </button>
                    </div>
                    
                    <div class="chat-container space-y-2.5 ${isCollapsed ? 'hidden' : ''}" id="chat-container-${sorun.id}">
                        <div class="message-history max-h-80 overflow-y-auto space-y-2 mb-2 pr-1 border border-neutral-900 bg-neutral-950/20 p-2.5 rounded" id="messages-${sorun.id}">
                            ${mesajlarHtml}
                        </div>
                        
                        ${isWriteable ? `
                        <form class="msg-send-form flex gap-2" data-id="${sorun.id}">
                            <input type="text" class="msg-input flex-1 bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-brandOrange transition-colors" placeholder="Mesajınızı yazın..." required>
                            <button type="submit" class="bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-400 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center shrink-0 cursor-pointer">
                                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </form>
                        ` : `
                        <div class="text-center py-2 bg-neutral-950 border border-neutral-900 rounded text-[9px] text-neutral-600 italic">
                            Bu sorun çözüldüğü veya kapatıldığı için yazışmaya kapalıdır.
                        </div>
                        `}
                    </div>
                </div>

                <!-- İşlem Butonları (Sadece Yönetici için görünür) -->
                ${loggedInUser.rol === 'yonetici' ? `
                <div class="mt-4 pt-3.5 border-t border-neutral-900 flex flex-wrap gap-2 justify-between items-center select-none">
                    <div class="flex flex-wrap gap-1.5">
                        ${aksiyonButonlari}
                    </div>
                    ${silButonu}
                </div>
                ` : ''}
            `;

            sorunList.appendChild(card);
        });

        // Form girdilerini geri yükleme
        document.querySelectorAll('.msg-input').forEach(input => {
            const formEl = input.closest('.msg-send-form');
            if (formEl) {
                const taskId = formEl.getAttribute('data-id');
                if (activeInputValues[taskId]) {
                    input.value = activeInputValues[taskId];
                }
            }
        });

        // Focus koruma
        if (focusedTaskId) {
            const focusedForm = document.querySelector(`.msg-send-form[data-id="${focusedTaskId}"]`);
            if (focusedForm) {
                const input = focusedForm.querySelector('.msg-input');
                if (input) input.focus();
            }
        }

        // Scroll en alta kaydır
        document.querySelectorAll('.message-history').forEach(history => {
            history.scrollTop = history.scrollHeight;
        });
    }, (error) => {
        clearTimeout(loadingTimeout);
        console.error("Sorunları yükleme hatası: ", error);
        sorunList.innerHTML = `
            <div class="col-span-full py-16 text-center text-red-500 bg-neutral-950 border border-neutral-900 rounded-xl">
                <span class="text-xs">Sorunlar yüklenirken yetkilendirme (Permission) hatası oluştu. Lütfen Firebase Console'da Realtime Database kurallarınızı güncelleyin.</span>
            </div>
        `;
    });

    // Sorun Kartları Etkileşimleri
    sorunList.addEventListener('click', async (e) => {
        // A. YÖNETİCİ DİREKT DURUM GÜNCELLEME BUTONLARI (İptal, Revize, Aktifleştir)
        const directStatusBtn = e.target.closest('.btn-direct-status-change');
        if (directStatusBtn) {
            const id = directStatusBtn.getAttribute('data-id');
            const targetStatus = directStatusBtn.getAttribute('data-target');

            const originalContent = directStatusBtn.innerHTML;
            directStatusBtn.disabled = true;
            directStatusBtn.innerHTML = '...';

            try {
                let activityText = "";
                if (targetStatus === "revize") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} sorun için revize talep etti.`;
                } else if (targetStatus === "iptal") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} sorunu iptal etti.`;
                } else if (targetStatus === "yapiliyor") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} sorunu yeniden aktifleştirdi.`;
                }

                if (activityText) {
                    const msgListRef = ref(db, `sorunlar/${id}/mesajlar`);
                    const newMsgRef = push(msgListRef);
                    await set(newMsgRef, {
                        isSystem: true,
                        text: activityText,
                        timestamp: new Date().toISOString()
                    });
                }

                const statusRef = ref(db, `sorunlar/${id}`);
                await update(statusRef, { durum: targetStatus });
                window.showToast("Sorun durumu güncellendi.", "success");

                // Bildirim Ayarlarını Sorgula
                const notifSettings = await window.getNotificationSettings();
                const sorun = tumSorunlar[id];

                // FCM Bildirimi Gönder
                if (notifSettings.ariza_durum_fcm && sorun && window.sendNotificationToUser) {
                    let title = "Arıza Güncellendi 🔔";
                    let body = `"${sorun.baslik}" başlıklı arıza bildiriminizin durumu güncellendi.`;
                    
                    if (targetStatus === "revize") {
                        title = "Arıza Revize İstendi 🔄";
                        body = `"${sorun.baslik}" başlıklı arıza için revize istendi.`;
                    } else if (targetStatus === "iptal") {
                        title = "Arıza İptal Edildi ❌";
                        body = `"${sorun.baslik}" başlıklı arıza iptal edildi.`;
                    } else if (targetStatus === "yapiliyor") {
                        title = "Arıza Yeniden Aktif 🚀";
                        body = `"${sorun.baslik}" başlıklı arıza yeniden çalışılıyor durumuna alındı.`;
                    }
                    window.sendNotificationToUser(sorun.olusturanId, title, body);
                }

                // Telegram Bildirimi Gönder
                if (notifSettings.ariza_durum_telegram && sorun) {
                    if (window.sendTelegramNotification) {
                        let text = `🔔 <b>Arıza Bildirimi Güncellendi</b>\n\n"${sorun.baslik}" başlıklı arızanızın durumu güncellendi.`;
                        if (targetStatus === "revize") {
                            text = `🔄 <b>Arıza Revize İstendi</b>\n\n"${sorun.baslik}" başlıklı arızanız için revize istendi.`;
                        } else if (targetStatus === "iptal") {
                            text = `❌ <b>Arıza İptal Edildi</b>\n\n"${sorun.baslik}" başlıklı arızanız iptal edildi.`;
                        } else if (targetStatus === "yapiliyor") {
                            text = `🚀 <b>Arıza Durumu: Çalışılıyor</b>\n\n"${sorun.baslik}" başlıklı arızanız üzerinde çalışılmaya başlandı.`;
                        }
                        window.sendTelegramNotification(sorun.olusturanId, text);
                    }

                }
            } catch (error) {
                console.error("Durum Güncelleme Hatası: ", error);
                window.showToast("Hata oluştu: " + error.message, "error");
            } finally {
                directStatusBtn.disabled = false;
                directStatusBtn.innerHTML = originalContent;
            }
            return;
        }

        // B. YÖNETİCİ ÇÖZÜLDÜ OLARAK İŞARETLE BUTONU (Açıklama/kapanış mesajı zorunlu)
        const completeBtn = e.target.closest('.btn-status-change-sorun');
        if (completeBtn) {
            const id = completeBtn.getAttribute('data-id');
            const card = completeBtn.closest('.group');
            const input = card.querySelector('.msg-input');
            const text = input ? input.value.trim() : "";

            if (!text) {
                window.showToast("Lütfen sorunu çözüldü olarak işaretlemeden önce yazışma alanına (mesaj kutusuna) bir çözüm raporu/mesajı yazın!", "warning");
                if (input) input.focus();
                return;
            }

            const confirmComplete = await window.showAlert("Onay Gerekiyor", "Bu sorunu çözüldü olarak işaretlemek istediğinizden emin misiniz?", true);
            if (confirmComplete) {
                const originalContent = completeBtn.innerHTML;
                completeBtn.disabled = true;
                completeBtn.innerHTML = 'İşleniyor...';

                if (input) input.value = '';

                try {
                    // 1. Çözüm mesajını gönder
                    const messageData = {
                        senderId: loggedInUser.uid,
                        senderName: loggedInUser.adSoyad,
                        text: text,
                        timestamp: new Date().toISOString()
                    };
                    const msgListRef = ref(db, `sorunlar/${id}/mesajlar`);
                    const newMsgRef = push(msgListRef);
                    await set(newMsgRef, messageData);

                    // 2. Sistem bildirim mesajı
                    const systemMsgRef = push(msgListRef);
                    await set(systemMsgRef, {
                        isSystem: true,
                        text: `Yönetici ${loggedInUser.adSoyad} sorunu çözüldü olarak onayladı.`,
                        timestamp: new Date().toISOString()
                    });

                    // 3. Durumu tamamlandı yap
                    const statusRef = ref(db, `sorunlar/${id}`);
                    await update(statusRef, { durum: 'tamamlandi' });

                    window.showToast("Sorun çözüldü olarak işaretlendi.", "success");

                    // Bildirim Ayarlarını Sorgula
                    const notifSettings = await window.getNotificationSettings();
                    const sorun = tumSorunlar[id];

                    // FCM Bildirimi Gönder
                    if (notifSettings.ariza_durum_fcm && sorun && window.sendNotificationToUser) {
                        window.sendNotificationToUser(
                            sorun.olusturanId,
                            "Arıza Çözüldü ✅",
                            `"${sorun.baslik}" başlıklı arıza bildiriminiz çözüldü olarak onaylandı.`
                        );
                    }

                    // Telegram Bildirimi Gönder
                    if (notifSettings.ariza_durum_telegram && sorun) {
                        if (window.sendTelegramNotification) {
                            window.sendTelegramNotification(
                                sorun.olusturanId,
                                `✅ <b>Arıza Çözüldü</b>\n\n"${sorun.baslik}" başlıklı arıza bildiriminiz çözüldü olarak onaylandı.`
                            );
                        }
                    }
                } catch (error) {
                    console.error("Sorun Kapatma Hatası: ", error);
                    window.showToast("Hata oluştu: " + error.message, "error");
                    if (input) input.value = text;
                } finally {
                    completeBtn.disabled = false;
                    completeBtn.innerHTML = originalContent;
                }
            }
            return;
        }

        // C. YÖNETİCİ SİLME AKSİYONU
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            const confirmDelete = await window.showAlert("Onay Gerekiyor", "Bu sorunu kalıcı olarak silmek istediğinizden emin misiniz?", true);
            if (confirmDelete) {
                const originalContent = deleteBtn.innerHTML;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '...';

                try {
                    const sorun = tumSorunlar[id];
                    const sorunRef = ref(db, `sorunlar/${id}`);
                    await remove(sorunRef);
                    window.showToast("Sorun kaydı silindi.", "success");

                    // Bildirim Ayarlarını Sorgula
                    const notifSettings = await window.getNotificationSettings();

                    // FCM Bildirimi Gönder
                    if (notifSettings.ariza_durum_fcm && sorun && window.sendNotificationToUser) {
                        window.sendNotificationToUser(
                            sorun.olusturanId,
                            "Arıza Kaydı Silindi 🗑️",
                            `"${sorun.baslik}" başlıklı arıza bildiriminiz yönetici tarafından silindi.`
                        );
                    }

                    // Telegram Bildirimi Gönder
                    if (notifSettings.ariza_durum_telegram && sorun && window.sendTelegramNotification) {
                        window.sendTelegramNotification(
                            sorun.olusturanId,
                            `🗑️ <b>Arıza Kaydı Silindi</b>\n\n"${sorun.baslik}" başlıklı arıza bildiriminiz yönetici tarafından silindi.`
                        );
                    }
                } catch (error) {
                    console.error("Sorun Silme Hatası: ", error);
                    window.showToast("Silme hatası: " + error.message, "error");
                } finally {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalContent;
                }
            }
            return;
        }

        // D. SOHBET GÖSTER/GİZLE AKSİYONU
        const toggleChatBtn = e.target.closest('.btn-toggle-chat');
        if (toggleChatBtn) {
            const id = toggleChatBtn.getAttribute('data-id');
            const container = document.getElementById(`chat-container-${id}`);
            
            if (container) {
                const isCurrentlyCollapsed = container.classList.contains('hidden');
                
                if (isCurrentlyCollapsed) {
                    container.classList.remove('hidden');
                    toggleChatBtn.textContent = 'Mesajları Gizle';
                    collapsedChats[id] = false;
                    
                    const msgHistory = document.getElementById(`messages-${id}`);
                    if (msgHistory) {
                        msgHistory.scrollTop = msgHistory.scrollHeight;
                    }
                } else {
                    container.classList.add('hidden');
                    toggleChatBtn.textContent = 'Mesajları Göster';
                    collapsedChats[id] = true;
                }
            }
            return;
        }
    });

    // Mesaj Gönderme Form Gönderimi (Normal Mesaj Yazma)
    sorunList.addEventListener('submit', async (e) => {
        const sendForm = e.target.closest('.msg-send-form');
        if (sendForm) {
            e.preventDefault();
            const id = sendForm.getAttribute('data-id');
            const input = sendForm.querySelector('.msg-input');
            const text = input.value.trim();

            if (!text) return;

            input.value = '';

            const sendBtn = sendForm.querySelector('button[type="submit"]');
            sendBtn.disabled = true;

            const messageData = {
                senderId: loggedInUser.uid,
                senderName: loggedInUser.adSoyad,
                text: text,
                timestamp: new Date().toISOString()
            };

            try {
                // Eğer sorun beklemede durumundaysa ve ilk defa bir mesaj/yazışma oluyorsa durumu 'yapiliyor' (çözülüyor) olarak güncelle
                const sorunRef = ref(db, `sorunlar/${id}`);
                const currentSorun = tumSorunlar[id];
                if (currentSorun && currentSorun.durum === 'beklemede') {
                    await update(sorunRef, { durum: 'yapiliyor' });
                }

                const msgListRef = ref(db, `sorunlar/${id}/mesajlar`);
                const newMsgRef = push(msgListRef);
                await set(newMsgRef, messageData);

                // Bildirim Ayarlarını Sorgula
                const notifSettings = await window.getNotificationSettings();
                const sorun = tumSorunlar[id];

                // FCM Bildirimi Gönder
                if (notifSettings.ariza_mesaj_fcm && sorun) {
                    if (loggedInUser.rol === 'yonetici') {
                        if (window.sendNotificationToUser) {
                            window.sendNotificationToUser(
                                sorun.olusturanId,
                                "Arızada Yeni Mesaj 💬",
                                `${loggedInUser.adSoyad}: ${text}`
                            );
                        }
                    } else {
                        if (window.sendNotificationToAllManagers) {
                            window.sendNotificationToAllManagers(
                                "Arızada Yeni Mesaj 💬",
                                `${loggedInUser.adSoyad}: ${text}`
                            );
                        }
                    }
                }

                // Telegram Bildirimi Gönder
                if (notifSettings.ariza_mesaj_telegram && sorun) {
                    const msgContent = `💬 <b>Arıza Sohbetinde Yeni Mesaj</b>\n\n<b>Konu:</b> ${sorun.baslik}\n<b>Gönderen:</b> ${loggedInUser.adSoyad}\n<b>Mesaj:</b> ${text}`;
                    if (loggedInUser.rol === 'yonetici') {
                        if (window.sendTelegramNotification) {
                            window.sendTelegramNotification(sorun.olusturanId, msgContent);
                        }
                    } else {
                        if (window.sendTelegramGroupNotification) {
                            window.sendTelegramGroupNotification(msgContent);
                        }
                    }
                }
            } catch (error) {
                console.error("Mesaj Gönderme Hatası: ", error);
                window.showToast("Mesaj gönderilemedi: " + error.message, "error");
                input.value = text;
            } finally {
                sendBtn.disabled = false;
                
                const currentForm = document.querySelector(`.msg-send-form[data-id="${id}"]`);
                if (currentForm) {
                    const currentInput = currentForm.querySelector('.msg-input');
                    if (currentInput) currentInput.focus();
                }
            }
        }
    });
}
