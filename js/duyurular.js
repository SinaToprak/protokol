import { db } from "../db/firebase.js";
import { ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    window.location.href = "./index.html";
}

const formContainer = document.getElementById('duyuru-form-container');
const form = document.getElementById('duyuru-form');
const listContainer = document.getElementById('duyuru-list');
const countBadge = document.getElementById('duyuru-count');

let allPersoneller = {};

// 1. Yetki ve Form Gösterimi
if (loggedInUser.rol === 'yonetici') {
    if (formContainer) formContainer.classList.remove('hidden');
    
    // Personelleri yükle (Okunma raporlarında isimleri göstermek için)
    onValue(ref(db, 'personeller'), (snapshot) => {
        allPersoneller = snapshot.val() || {};
    });
}

// 2. Yeni Duyuru Gönderme (Yönetici)
if (form && loggedInUser.rol === 'yonetici') {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;

        const baslikInput = document.getElementById('duyuru-baslik').value.trim();
        const icerikInput = document.getElementById('duyuru-icerik').value.trim();
        const tipInput = document.getElementById('duyuru-tip').value;

        const announcementData = {
            baslik: baslikInput,
            icerik: icerikInput,
            tip: tipInput,
            tarih: new Date().toISOString(),
            olusturanId: loggedInUser.uid,
            olusturanIsim: loggedInUser.adSoyad
        };

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Yayınlanıyor...</span>`;

        try {
            const newDuyuruRef = push(ref(db, 'duyurular'));
            await set(newDuyuruRef, announcementData);
            window.showToast("Duyuru başarıyla yayınlandı.", "success");

            // Telegram Bildirimi Gönder
            if (window.sendTelegramGroupNotification) {
                let emoji = "📢";
                if (tipInput === "uyari") emoji = "⚠️";
                else if (tipInput === "acil") emoji = "🚨";

                const telegramMessage = `${emoji} <b>YENİ DUYURU</b>\n\n📌 <b>Başlık:</b> ${baslikInput}\n📖 <b>Detay:</b> ${icerikInput}\n👤 <b>Yayınlayan:</b> ${loggedInUser.adSoyad}`;
                await window.sendTelegramGroupNotification(telegramMessage);
            }

            form.reset();
        } catch (error) {
            console.error("Duyuru Yayınlama Hatası:", error);
            window.showToast("Duyuru yayınlanırken hata oluştu: " + error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });
}

// 3. Duyuruları Listeleme
if (listContainer) {
    const duyurularRef = ref(db, 'duyurular');

    let loadingTimeout = setTimeout(() => {
        if (listContainer.innerHTML === '') {
            listContainer.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-500 bg-black border border-neutral-900 rounded-xl">
                    <svg class="animate-spin h-8 w-8 text-brandOrange mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Duyuru verileri yükleniyor...</span>
                </div>
            `;
        }
    }, 300);

    onValue(duyurularRef, (snapshot) => {
        clearTimeout(loadingTimeout);
        const data = snapshot.val() || {};
        const keys = Object.keys(data);

        if (countBadge) {
            countBadge.classList.remove('hidden');
            countBadge.textContent = `${keys.length} Duyuru`;
        }

        if (keys.length === 0) {
            listContainer.innerHTML = `
                <div class="col-span-full py-16 text-center text-neutral-650 bg-black border border-neutral-900 rounded-xl select-none">
                    <svg class="h-8 w-8 text-neutral-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15" />
                    </svg>
                    <span>Şu anda aktif veya yayınlanmış duyuru bulunmuyor.</span>
                </div>
            `;
            return;
        }

        // Duyuruları tarihe göre yeniden eskiye sıralayalım
        const duyurularList = keys.map(key => ({
            id: key,
            ...data[key]
        }));
        duyurularList.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        listContainer.innerHTML = '';

        duyurularList.forEach(duyuru => {
            const card = document.createElement('div');
            
            // Duyuru tipine göre kenarlık ve arka plan tasarımı
            let tipClass = 'border-neutral-900 text-neutral-400 bg-neutral-950/20';
            let tipLabel = 'Bilgi';
            let tipIcon = 'ℹ️';
            
            if (duyuru.tip === 'uyari') {
                tipClass = 'border-brandYellow/15 text-brandYellow bg-brandYellow/5';
                tipLabel = 'Uyarı';
                tipIcon = '⚠️';
            } else if (duyuru.tip === 'acil') {
                tipClass = 'border-brandOrange/15 text-brandOrange bg-brandOrange/5';
                tipLabel = 'Acil';
                tipIcon = '🚨';
            }

            // Personel için "Okudum" durumu kontrolü
            const okuyanlar = duyuru.okuyanlar || {};
            const isRead = okuyanlar[loggedInUser.uid] === true;

            // Okuyanların İsim Listesi (Yöneticiler için)
            let readReportHtml = '';
            if (loggedInUser.rol === 'yonetici') {
                const readUids = Object.keys(okuyanlar);
                const readNames = readUids.map(uid => {
                    const staff = allPersoneller[uid];
                    return staff ? `${staff.adSoyad} (${staff.sicilNo})` : 'Bilinmeyen Personel';
                });

                readReportHtml = `
                    <div class="mt-4 pt-3 border-t border-neutral-900/60 text-[10px] text-neutral-500">
                        <div class="flex items-center justify-between font-bold text-neutral-400 cursor-pointer select-none" onclick="document.getElementById('readers-${duyuru.id}').classList.toggle('hidden')">
                            <span>Okuma Takibi (${readNames.length} Okuma)</span>
                            <span class="text-xs">▼</span>
                        </div>
                        <div id="readers-${duyuru.id}" class="hidden mt-2 space-y-1 bg-neutral-950 p-2 rounded border border-neutral-900">
                            ${readNames.length > 0 ? readNames.map(name => `<div class="flex items-center text-emerald-400">✅ <span class="ml-1.5 text-neutral-300 font-medium">${name}</span></div>`).join('') : '<div class="text-neutral-650 italic">Henüz kimse okumadı.</div>'}
                        </div>
                    </div>
                `;
            }

            card.className = `border rounded-xl p-5 shadow-sm transition-all duration-300 flex flex-col justify-between ${tipClass}`;
            
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between select-none">
                        <span class="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border border-current">
                            ${tipIcon} ${tipLabel}
                        </span>
                        <span class="text-[10px] text-neutral-500 font-mono">
                            ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(duyuru.tarih))} ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(duyuru.tarih))}
                        </span>
                    </div>

                    <h3 class="text-base font-bold text-white mt-3.5 tracking-tight">${duyuru.baslik}</h3>
                    <p class="text-xs text-neutral-300 mt-2 leading-relaxed bg-black/35 p-3 rounded-lg border border-neutral-900/60 whitespace-pre-line">${duyuru.icerik}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-neutral-900/60 flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Yayınlayan: <strong class="text-neutral-300">${duyuru.olusturanIsim}</strong></span>
                    
                    ${loggedInUser.rol === 'yonetici' ? `
                        <button class="btn-delete-duyuru text-red-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-[10px]" data-id="${duyuru.id}">
                            Sil
                        </button>
                    ` : `
                        ${isRead ? `
                            <span class="text-emerald-400 font-bold flex items-center select-none text-[10px]">
                                Okundu ✅
                            </span>
                        ` : `
                            <button class="btn-read px-3 py-1 bg-brandOrange hover:bg-orange-600 text-white text-[10px] font-bold rounded transition-colors cursor-pointer uppercase tracking-wider" data-id="${duyuru.id}">
                                Okudum / Anladım
                            </button>
                        `}
                    `}
                </div>
                
                ${readReportHtml}
            `;
            
            listContainer.appendChild(card);
        });
    });
}

// 4. Okundu Butonu Olay Dinleyicisi (Personel & Silme - Yönetici)
if (listContainer) {
    listContainer.addEventListener('click', async (e) => {
        const readBtn = e.target.closest('.btn-read');
        if (readBtn) {
            const id = readBtn.getAttribute('data-id');
            const originalContent = readBtn.innerHTML;
            readBtn.disabled = true;
            readBtn.innerHTML = '...';

            try {
                const readRef = ref(db, `duyurular/${id}/okuyanlar/${loggedInUser.uid}`);
                await set(readRef, true);
                window.showToast("Duyuru okundu olarak onaylandı.", "success");
            } catch (error) {
                console.error("Duyuru Onaylama Hatası:", error);
                window.showToast("Onaylanırken hata oluştu: " + error.message, "error");
                readBtn.disabled = false;
                readBtn.innerHTML = originalContent;
            }
        }

        // Duyuru Silme (Yönetici)
        const deleteBtn = e.target.closest('.btn-delete-duyuru');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            const confirmDelete = await window.showAlert("Onay Gerekiyor", "Bu duyuruyu kalıcı olarak silmek istediğinizden emin misiniz?", true);
            if (confirmDelete) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '...';
                try {
                    await remove(ref(db, `duyurular/${id}`));
                    window.showToast("Duyuru silindi.", "success");
                } catch (error) {
                    console.error("Duyuru Silme Hatası:", error);
                    window.showToast("Silinirken hata oluştu: " + error.message, "error");
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = 'Sil';
                }
            }
        }
    });
}
