import { db } from "../db/firebase.js";
import { ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Giriş kontrolü
const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    window.location.href = "./index.html";
}

// Elemanları Seçme
const formContainer = document.getElementById('gorev-form-container');
const form = document.getElementById('gorev-form');
const atananSelect = document.getElementById('atanan-personel');
const gorevList = document.getElementById('gorev-list');
const gorevCount = document.getElementById('gorev-count');

// Tüm personelleri ve görevleri tutacak yerel hafıza
let tumPersoneller = {};
let tumGorevler = {};

// Sohbetlerin açılıp kapanma durumunu hafızada tutma (ID -> true/false)
const collapsedChats = {};

// 1. ROL BAZLI FORM GÖSTERİMİ VE PERSONEL SEÇİM KUTUSUNUN DOLDURULMASI
if (loggedInUser.rol === 'yonetici') {
    if (formContainer) formContainer.classList.remove('hidden');

    const personellerRef = ref(db, 'personeller');
    onValue(personellerRef, (snapshot) => {
        const data = snapshot.val() || {};
        tumPersoneller = data;

        if (atananSelect) {
            atananSelect.innerHTML = '<option value="" disabled selected>Personel seçin</option>';
            
            Object.keys(data).forEach(uid => {
                const personel = data[uid];
                if (personel.sicilNo.toLowerCase() !== "admin") {
                    const opt = document.createElement('option');
                    opt.value = uid;
                    opt.textContent = `${personel.adSoyad} (${personel.rol === 'yonetici' ? 'Yönetici' : 'Personel'})`;
                    opt.className = "bg-neutral-950 text-white";
                    atananSelect.appendChild(opt);
                }
            });
        }
    });
} else {
    if (formContainer) formContainer.remove();
}

// 2. YENİ GÖREV EKLEME (Sadece Yöneticiler)
if (form && loggedInUser.rol === 'yonetici') {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;

        const baslikInput = document.getElementById('gorev-baslik').value.trim();
        const aciklamaInput = document.getElementById('gorev-aciklama').value.trim();
        const oncelikInput = document.getElementById('gorev-oncelik').value;
        const atananId = atananSelect.value;
        const dosyaInput = document.getElementById('gorev-dosya');
        const file = dosyaInput ? dosyaInput.files[0] : null;

        if (!atananId) {
            window.showToast("Lütfen görevin atanacağı personeli seçin!", "warning");
            return;
        }

        const atananPersonelAd = tumPersoneller[atananId] ? tumPersoneller[atananId].adSoyad : "Bilinmeyen Personel";

        const taskData = {
            baslik: baslikInput,
            aciklama: aciklamaInput,
            oncelik: oncelikInput,
            durum: 'beklemede',
            atananPersonelId: atananId,
            atananPersonelIsim: atananPersonelAd,
            olusturanId: loggedInUser.uid,
            olusturanIsim: loggedInUser.adSoyad,
            olusturmaTarihi: new Date().toISOString()
        };
        if (file) {
            taskData.dosyaAdi = file.name;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span>Atanıyor...</span>
        `;

        try {
            const newGorevRef = push(ref(db, 'gorevler'));
            await set(newGorevRef, taskData);
            window.showToast("Görev başarıyla atandı.", "success");
            
            // Bildirim Ayarlarını Sorgula
            const notifSettings = await window.getNotificationSettings();

            // FCM Bildirimi Gönder
            if (notifSettings.gorev_yeni_fcm && window.sendNotificationToUser) {
                window.sendNotificationToUser(atananId, "Yeni Görev Atandı 📝", `"${baslikInput}" başlıklı görev size atandı.`);
            }

            // Telegram Bildirimi Gönder
            if (notifSettings.gorev_yeni_telegram) {
                const messageText = `📋 <b>Yeni Görev Atandı</b>\n\n👤 <b>Atayan:</b> ${loggedInUser.sicilNo}\n👤 <b>Atanan:</b> ${atananPersonelAd}\n📌 <b>Görev:</b> ${baslikInput}\n📖 <b>Detay:</b> ${aciklamaInput}${file ? `\n📎 <b>Ek Dosya:</b> ${file.name}` : ''}`;
                if (file && window.sendTelegramFileNotification) {
                    await window.sendTelegramFileNotification(file, messageText);
                } else if (window.sendTelegramNotification) {
                    await window.sendTelegramNotification(atananId, messageText);
                }
            }
            
            form.reset();
        } catch (error) {
            console.error("Görev Kayıt Hatası: ", error);
            window.showToast("Görev atanırken hata oluştu: " + error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });
}

// 3. GÖREVLERİN GERÇEK ZAMANLI LİSTELENMESİ VE YAZIŞMA KONTROLÜ
if (gorevList) {
    const gorevlerRef = ref(db, 'gorevler');

    let loadingTimeout = setTimeout(() => {
        if (gorevList.innerHTML === '') {
            gorevList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-500 bg-black border border-neutral-900 rounded-xl">
                    <svg class="animate-spin h-8 w-8 text-brandOrange mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Görev verileri yükleniyor...</span>
                </div>
            `;
        }
    }, 300);

    onValue(gorevlerRef, (snapshot) => {
        clearTimeout(loadingTimeout);
        const data = snapshot.val() || {};
        tumGorevler = data;

        // Yeniden render etmeden önce inputlardaki yazıları ve focus durumunu koruyalım
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

        gorevList.innerHTML = '';
        const keys = Object.keys(data);

        // Kullanıcı rolüne göre filtreleme
        let filtrelenmisGorevler = keys.map(key => ({
            id: key,
            ...data[key]
        }));

        if (loggedInUser.rol !== 'yonetici') {
            // Personel: Sadece kendine atanan ve aktif olan (tamamlanmamış / iptal edilmemiş) görevleri görür
            filtrelenmisGorevler = filtrelenmisGorevler.filter(g => 
                g.atananPersonelId === loggedInUser.uid && 
                g.durum !== 'tamamlandi' && 
                g.durum !== 'iptal'
            );
        }

        if (gorevCount) {
            gorevCount.classList.remove('hidden');
            gorevCount.textContent = `${filtrelenmisGorevler.length} Görev`;
        }

        if (filtrelenmisGorevler.length === 0) {
            gorevList.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-650 bg-black border border-neutral-900 rounded-xl">
                    <svg class="h-8 w-8 text-neutral-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Kayıtlı veya atanmış görev bulunmuyor.</span>
                </div>
            `;
            return;
        }

        // Tarihe göre yeniden eskiye sıralama
        filtrelenmisGorevler.sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi));

        // Görev Kartlarını oluşturma
        filtrelenmisGorevler.forEach(gorev => {
            const card = document.createElement('div');
            // Minimalist kart tasarımı (Hover parlaması kaldırıldı, gölgeler kaldırıldı, ince kenarlıklar eklendi)
            card.className = "bg-black border border-neutral-900 rounded-lg p-5 transition-all duration-305 flex flex-col justify-between hover:border-neutral-800 relative group";

            // Öncelik Rozet Rengi (Minimalist, mat kenarlıklı)
            let oncelikRenk = 'bg-neutral-950 border-neutral-900 text-neutral-500';
            let oncelikIsim = 'Düşük';
            if (gorev.oncelik === 'orta') {
                oncelikRenk = 'bg-neutral-950 border-brandYellow/15 text-brandYellow';
                oncelikIsim = 'Orta';
            } else if (gorev.oncelik === 'yuksek') {
                oncelikRenk = 'bg-neutral-950 border-brandOrange/15 text-brandOrange';
                oncelikIsim = 'Yüksek';
            }

            // Durum Rozet Rengi (Minimalist, mat kenarlıklı)
            let durumRenk = 'bg-neutral-950 border-neutral-900 text-neutral-500';
            let durumIsim = 'Beklemede';
            if (gorev.durum === 'yapiliyor') {
                durumRenk = 'bg-neutral-950 border-blue-900/20 text-blue-400';
                durumIsim = 'Yapılıyor';
            } else if (gorev.durum === 'revize') {
                durumRenk = 'bg-neutral-950 border-amber-900/20 text-amber-400';
                durumIsim = 'Revize';
            } else if (gorev.durum === 'onay_bekliyor') {
                durumRenk = 'bg-neutral-950 border-orange-900/25 text-orange-400';
                durumIsim = 'Onay Bekliyor';
            } else if (gorev.durum === 'tamamlandi') {
                durumRenk = 'bg-neutral-950 border-emerald-900/20 text-emerald-400';
                durumIsim = 'Tamamlandı';
            } else if (gorev.durum === 'iptal') {
                durumRenk = 'bg-neutral-950 border-red-950/25 text-red-400';
                durumIsim = 'İptal';
            }

            // --- AKSIYON BUTONLARI ---
            let aksiyonButonlari = '';
            let silButonu = '';

            const isActive = gorev.durum !== 'tamamlandi' && gorev.durum !== 'iptal';

            if (loggedInUser.rol === 'yonetici') {
                if (isActive) {
                    aksiyonButonlari += `
                        <button class="btn-status-change px-2 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-emerald-400 rounded transition-colors cursor-pointer" data-id="${gorev.id}" data-target="tamamlandi">
                            Tamamla
                        </button>
                        <button class="btn-status-change px-2 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-brandYellow rounded transition-colors cursor-pointer" data-id="${gorev.id}" data-target="revize">
                            Revize Et
                        </button>
                        <button class="btn-status-change px-2 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-red-400 rounded transition-colors cursor-pointer" data-id="${gorev.id}" data-target="iptal">
                            İptal
                        </button>
                    `;
                } else {
                    aksiyonButonlari += `
                        <button class="btn-status-change px-2.5 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-blue-400 rounded transition-colors cursor-pointer" data-id="${gorev.id}" data-target="yapiliyor">
                            Aktifleştir
                        </button>
                    `;
                    silButonu = `
                        <button class="btn-delete flex items-center space-x-1 px-2.5 py-1 bg-neutral-950 hover:bg-red-950/10 border border-neutral-900 text-[10px] font-bold text-red-500 rounded transition-colors cursor-pointer" data-id="${gorev.id}">
                            <span>Sil</span>
                        </button>
                    `;
                }
            } else {
                if (gorev.durum !== 'onay_bekliyor') {
                    aksiyonButonlari += `
                        <button class="btn-complete-task px-3 py-1 bg-neutral-950 hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 rounded transition-colors cursor-pointer flex items-center space-x-1" data-id="${gorev.id}">
                            <svg class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Çalışmayı Tamamla</span>
                        </button>
                    `;
                }
            }

            // --- YAZIŞMA GEÇMİŞİ LİSTELEME ---
            let mesajlarHtml = '';
            if (gorev.mesajlar) {
                const msgKeys = Object.keys(gorev.mesajlar);
                const msgList = msgKeys.map(k => ({ id: k, ...gorev.mesajlar[k] }));
                msgList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                msgList.forEach(msg => {
                    const msgDate = new Date(msg.timestamp);
                    const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(msgDate);
                    const timeStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(msgDate);
                    const dateTimeStr = `${dateStr} ${timeStr}`;

                    if (msg.isSystem) {
                        let sysColorClass = "text-neutral-600";
                        if (msg.text.includes("onayınıza sundu")) {
                            sysColorClass = "text-brandOrange/80";
                        } else if (msg.text.includes("onayladı") || msg.text.includes("çözüldü") || msg.text.includes("tamamlandı")) {
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
                        // Normal Kullanıcı Mesajı (Kenarlıksız, düz arka planlı minimalist balonlar)
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
                mesajlarHtml = `<div class="text-center py-4 text-[10px] text-neutral-650 italic">Bu görev hakkında henüz yazışma yapılmamış.</div>`;
            }

            if (collapsedChats[gorev.id] === undefined) {
                collapsedChats[gorev.id] = !isActive || (gorev.durum === 'onay_bekliyor'); 
            }
            const isCollapsed = collapsedChats[gorev.id];

            const isWriteable = gorev.durum !== 'tamamlandi' && gorev.durum !== 'iptal' && gorev.durum !== 'onay_bekliyor';

            card.innerHTML = `
                <div class="flex items-start justify-between gap-2 select-none">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-base font-bold text-white truncate leading-tight">${gorev.baslik}</h3>
                        <p class="text-[10px] text-neutral-600 mt-0.5">Yönetici: ${gorev.olusturanIsim}</p>
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

                <!-- Görev Açıklaması (Sarı renk, üstündeki boşluk kaldırıldı) --><p class="text-xs text-brandYellow mt-3 leading-relaxed whitespace-pre-line bg-neutral-950/40 p-2.5 rounded border border-neutral-900/60">${gorev.aciklama}</p>

                ${gorev.dosyaAdi ? `
                    <div class="flex items-center text-[10px] text-neutral-400 bg-neutral-950/60 py-1.5 px-2.5 rounded border border-neutral-900/60 mt-2 select-none">
                        <svg class="h-3.5 w-3.5 mr-2 text-brandOrange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span>Ekli Dosya (Telegram'da): <strong class="text-white">${gorev.dosyaAdi}</strong></span>
                    </div>
                ` : ''}

                <div class="mt-3.5 pt-2.5 border-t border-neutral-900 space-y-1.5 text-[11px] text-neutral-500 select-none">
                    <div class="flex items-center">
                        <svg class="h-3.5 w-3.5 mr-2 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Atanan: <strong class="text-neutral-300 font-medium">${gorev.atananPersonelIsim}</strong></span>
                    </div>
                    <div class="flex items-center">
                        <svg class="h-3.5 w-3.5 mr-2 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Tarih: <span class="font-mono">${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(gorev.olusturmaTarihi))} ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(gorev.olusturmaTarihi))}</span></span>
                    </div>
                </div>

                <!-- --- SOHBET / YAZIŞMA ALANI --- -->
                <div class="chat-section mt-3">
                    <div class="flex items-center justify-between mb-2 select-none">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-600">Yazışma Geçmişi</span>
                        <button class="btn-toggle-chat text-[9px] font-bold text-neutral-500 hover:text-brandOrange cursor-pointer focus:outline-none" data-id="${gorev.id}">
                            ${isCollapsed ? 'Mesajları Göster' : 'Mesajları Gizle'}
                        </button>
                    </div>
                    
                    <div class="chat-container space-y-2.5 ${isCollapsed ? 'hidden' : ''}" id="chat-container-${gorev.id}">
                        <!-- Mesaj Balonları (Düz kenarlıklar) -->
                        <div class="message-history max-h-80 overflow-y-auto space-y-2 mb-2 pr-1 border border-neutral-900 bg-neutral-950/20 p-2.5 rounded" id="messages-${gorev.id}">
                            ${mesajlarHtml}
                        </div>
                        
                        <!-- Mesaj Yazma Paneli (Minimalist mat butonlar) -->
                        ${isWriteable ? `
                        <form class="msg-send-form flex gap-2" data-id="${gorev.id}">
                            <input type="text" class="msg-input flex-1 bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-brandOrange transition-colors" placeholder="Mesajınızı yazın..." required>
                            <button type="submit" class="bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-400 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center shrink-0 cursor-pointer">
                                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </form>
                        ` : `
                        <div class="text-center py-2 bg-neutral-950 border border-neutral-900 rounded text-[9px] text-neutral-600 italic">
                            ${gorev.durum === 'onay_bekliyor' 
                                ? 'Görev onay beklediği için yazışmaya kapalıdır.' 
                                : 'Görev tamamlandığı veya iptal edildiği için yazışmaya kapalıdır.'}
                        </div>
                        `}
                    </div>
                </div>

                <!-- İşlem Butonları -->
                <div class="mt-4 pt-3.5 border-t border-neutral-900 flex flex-wrap gap-2 justify-between items-center select-none">
                    <div class="flex flex-wrap gap-1.5">
                        ${aksiyonButonlari}
                    </div>
                    ${silButonu}
                </div>
            `;

            gorevList.appendChild(card);
        });

        // 1. Input değerlerini geri yükleme
        document.querySelectorAll('.msg-input').forEach(input => {
            const formEl = input.closest('.msg-send-form');
            if (formEl) {
                const taskId = formEl.getAttribute('data-id');
                if (activeInputValues[taskId]) {
                    input.value = activeInputValues[taskId];
                }
            }
        });

        // 2. Focusu koruma
        if (focusedTaskId) {
            const focusedForm = document.querySelector(`.msg-send-form[data-id="${focusedTaskId}"]`);
            if (focusedForm) {
                const input = focusedForm.querySelector('.msg-input');
                if (input) input.focus();
            }
        }

        // 3. Sohbet geçmişlerini en alta kaydırma
        document.querySelectorAll('.message-history').forEach(history => {
            history.scrollTop = history.scrollHeight;
        });
    });

    // Görev Listesi Etkileşim Dinleyicileri
    gorevList.addEventListener('click', async (e) => {
        // A. YÖNETİCİ DURUM DEĞİŞTİRME BUTONLARI (Aktivite günlükleri)
        const statusBtn = e.target.closest('.btn-status-change');
        if (statusBtn) {
            const id = statusBtn.getAttribute('data-id');
            const targetStatus = statusBtn.getAttribute('data-target');
            
            const originalContent = statusBtn.innerHTML;
            statusBtn.disabled = true;
            statusBtn.innerHTML = '...';

            try {
                let activityText = "";
                if (targetStatus === "tamamlandi") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} görevi tamamlandı olarak onayladı.`;
                } else if (targetStatus === "revize") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} görev için revize istedi.`;
                } else if (targetStatus === "iptal") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} görevi iptal etti.`;
                } else if (targetStatus === "yapiliyor") {
                    activityText = `Yönetici ${loggedInUser.adSoyad} görevi yeniden aktifleştirdi.`;
                }

                if (activityText) {
                    const msgListRef = ref(db, `gorevler/${id}/mesajlar`);
                    const newMsgRef = push(msgListRef);
                    await set(newMsgRef, {
                        isSystem: true,
                        text: activityText,
                        timestamp: new Date().toISOString()
                    });
                }

                const statusRef = ref(db, `gorevler/${id}`);
                await update(statusRef, { durum: targetStatus });
                window.showToast("Görev durumu güncellendi.", "success");

                // Bildirim Ayarlarını Sorgula
                const notifSettings = await window.getNotificationSettings();
                const task = tumGorevler[id];

                // FCM Bildirimi Gönder
                if (notifSettings.gorev_durum_fcm && task && window.sendNotificationToUser) {
                    let title = "Görev Güncellendi 🔔";
                    let body = `"${task.baslik}" başlıklı görevinizin durumu güncellendi.`;
                    
                    if (targetStatus === "tamamlandi") {
                        title = "Görev Onaylandı ✅";
                        body = `"${task.baslik}" başlıklı göreviniz tamamlandı olarak onaylandı.`;
                    } else if (targetStatus === "revize") {
                        title = "Görev Revize İstendi 🔄";
                        body = `"${task.baslik}" başlıklı göreviniz için revize istendi.`;
                    } else if (targetStatus === "iptal") {
                        title = "Görev İptal Edildi ❌";
                        body = `"${task.baslik}" başlıklı göreviniz iptal edildi.`;
                    } else if (targetStatus === "yapiliyor") {
                        title = "Görev Yeniden Aktif 🚀";
                        body = `"${task.baslik}" başlıklı göreviniz yeniden aktifleştirildi.`;
                    }
                    window.sendNotificationToUser(task.atananPersonelId, title, body);
                }

                // Telegram Bildirimi Gönder
                if (notifSettings.gorev_durum_telegram && task) {
                    if (window.sendTelegramNotification) {
                        let text = `🔔 <b>Görev Güncellendi</b>\n\n"${task.baslik}" başlıklı görevinizin durumu güncellendi.`;
                        if (targetStatus === "tamamlandi") {
                            text = `✅ <b>Görev Onaylandı</b>\n\n"${task.baslik}" başlıklı göreviniz tamamlandı olarak onaylandı.`;
                        } else if (targetStatus === "revize") {
                            text = `🔄 <b>Görev Revize İstendi</b>\n\n"${task.baslik}" başlıklı göreviniz için revize istendi.`;
                        } else if (targetStatus === "iptal") {
                            text = `❌ <b>Görev İptal Edildi</b>\n\n"${task.baslik}" başlıklı göreviniz iptal edildi.`;
                        } else if (targetStatus === "yapiliyor") {
                            text = `🚀 <b>Görev Yeniden Aktif</b>\n\n"${task.baslik}" başlıklı göreviniz yeniden aktifleştirildi.`;
                        }
                        window.sendTelegramNotification(task.atananPersonelId, text);
                    }
                }
            } catch (error) {
                console.error("Durum Güncelleme Hatası: ", error);
                window.showToast("Hata oluştu: " + error.message, "error");
            } finally {
                statusBtn.disabled = false;
                statusBtn.innerHTML = originalContent;
            }
            return;
        }

        // B. PERSONEL ÇALIŞMAYI TAMAMLA BUTONU (Kapanış raporu + sistem aktivite günlüğü)
        const completeBtn = e.target.closest('.btn-complete-task');
        if (completeBtn) {
            const id = completeBtn.getAttribute('data-id');
            const card = completeBtn.closest('.group');
            const input = card.querySelector('.msg-input');
            const text = input ? input.value.trim() : "";

            if (!text) {
                window.showToast("Lütfen görevi tamamlamadan önce yazışma alanına bir kapanış raporu yazın!", "warning");
                if (input) input.focus();
                return;
            }

            const confirmComplete = await window.showAlert("Onay Gerekiyor", "Çalışmayı tamamlayıp yönetici onayına sunmak istediğinizden emin misiniz? (Bu işlemden sonra yeni mesaj yazamazsınız)", true);
            if (confirmComplete) {
                const originalContent = completeBtn.innerHTML;
                completeBtn.disabled = true;
                completeBtn.innerHTML = 'Gönderiliyor...';

                if (input) input.value = '';

                try {
                    // 1. Kapanış yorum mesajını gönder
                    const messageData = {
                        senderId: loggedInUser.uid,
                        senderName: loggedInUser.adSoyad,
                        text: text,
                        timestamp: new Date().toISOString()
                    };
                    const msgListRef = ref(db, `gorevler/${id}/mesajlar`);
                    const newMsgRef = push(msgListRef);
                    await set(newMsgRef, messageData);

                    // 2. Sistem aktivite kaydı
                    const systemMsgRef = push(msgListRef);
                    await set(systemMsgRef, {
                        isSystem: true,
                        text: `Personel ${loggedInUser.adSoyad} çalışmayı tamamladı ve onayına sundu.`,
                        timestamp: new Date().toISOString()
                    });

                    // 3. Durumu onay_bekliyor yap
                    const statusRef = ref(db, `gorevler/${id}`);
                    await update(statusRef, { durum: 'onay_bekliyor' });

                    window.showToast("Çalışma tamamlandı ve onayına sunuldu.", "success");

                    // Bildirim Ayarlarını Sorgula
                    const notifSettings = await window.getNotificationSettings();
                    const task = tumGorevler[id];

                    // FCM Bildirimi Gönder
                    if (notifSettings.gorev_durum_fcm && task && window.sendNotificationToUser) {
                        window.sendNotificationToUser(
                            task.olusturanId,
                            "Görev Onay Bekliyor ⏳",
                            `${loggedInUser.adSoyad}, "${task.baslik}" başlıklı görevi tamamlayıp onayınıza sundu.`
                        );
                    }

                    // Telegram Bildirimi Gönder
                    if (notifSettings.gorev_durum_telegram && task) {
                        if (window.sendTelegramNotification) {
                            window.sendTelegramNotification(
                                task.olusturanId,
                                `⏳ <b>Görev Onay Bekliyor</b>\n\n${loggedInUser.adSoyad}, "${task.baslik}" başlıklı görevi tamamlayıp onayınıza sundu.`
                            );
                        }
                    }
                } catch (error) {
                    console.error("Görev Tamamlama Hatası: ", error);
                    window.showToast("Hata oluştu: " + error.message, "error");
                    if (input) input.value = text;
                } finally {
                    completeBtn.disabled = false;
                    completeBtn.completeBtn = originalContent;
                    completeBtn.innerHTML = originalContent;
                }
            }
            return;
        }

        // C. GÖREV SİLME AKSİYONU
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            const confirmDelete = await window.showAlert("Onay Gerekiyor", "Bu görevi kalıcı olarak silmek istediğinizden emin misiniz?", true);
            if (confirmDelete) {
                const originalContent = deleteBtn.innerHTML;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '...';

                try {
                    const task = tumGorevler[id];
                    const gorevRef = ref(db, `gorevler/${id}`);
                    await remove(gorevRef);
                    window.showToast("Görev başarıyla silindi.", "success");

                    // Bildirim Ayarlarını Sorgula
                    const notifSettings = await window.getNotificationSettings();

                    // FCM Bildirimi Gönder
                    if (notifSettings.gorev_durum_fcm && task && window.sendNotificationToUser) {
                        window.sendNotificationToUser(
                            task.atananPersonelId,
                            "Görev Silindi 🗑️",
                            `"${task.baslik}" başlıklı göreviniz yönetici tarafından silindi.`
                        );
                    }

                    // Telegram Bildirimi Gönder
                    if (notifSettings.gorev_durum_telegram && task && window.sendTelegramNotification) {
                        window.sendTelegramNotification(
                            task.atananPersonelId,
                            `🗑️ <b>Görev Silindi</b>\n\n"${task.baslik}" başlıklı göreviniz yönetici tarafından silindi.`
                        );
                    }
                } catch (error) {
                    console.error("Görev Silme Hatası: ", error);
                    window.showToast("Silme hatası: " + error.message, "error");
                } finally {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = originalContent;
                }
            }
            return;
        }

        // D. SOHBETİ GÖSTER/GİZLE AKSİYONU
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
    gorevList.addEventListener('submit', async (e) => {
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
                const msgListRef = ref(db, `gorevler/${id}/mesajlar`);
                const newMsgRef = push(msgListRef);
                await set(newMsgRef, messageData);

                // Bildirim Ayarlarını Sorgula
                const notifSettings = await window.getNotificationSettings();
                const task = tumGorevler[id];

                // FCM Bildirimi Gönder
                if (notifSettings.gorev_mesaj_fcm && task && window.sendNotificationToUser) {
                    const recipientUid = (loggedInUser.uid === task.olusturanId) 
                        ? task.atananPersonelId 
                        : task.olusturanId;
                    
                    window.sendNotificationToUser(
                        recipientUid,
                        "Görevde Yeni Mesaj 💬",
                        `${loggedInUser.adSoyad}: ${text}`
                    );
                }

                // Telegram Bildirimi Gönder
                if (notifSettings.gorev_mesaj_telegram && task && window.sendTelegramNotification) {
                    const recipientUid = (loggedInUser.uid === task.olusturanId) 
                        ? task.atananPersonelId 
                        : task.olusturanId;
                    
                    window.sendTelegramNotification(
                        recipientUid,
                        `💬 <b>Görev Sohbetinde Yeni Mesaj</b>\n\n<b>Konu:</b> ${task.baslik}\n<b>Gönderen:</b> ${loggedInUser.adSoyad}\n<b>Mesaj:</b> ${text}`
                    );
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
