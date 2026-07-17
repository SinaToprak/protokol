import { db } from "../db/firebase.js";
import { ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Giriş kontrolü
const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    window.location.href = "./index.html";
}

// Elemanları Seçme
const isTanimContainer = document.getElementById('is-tanim-container');
const yoneticiIslerContainer = document.getElementById('yonetici-isler-container');
const personelChecklistContainer = document.getElementById('personel-checklist-container');
const raporlarContainer = document.getElementById('raporlar-container');

const isForm = document.getElementById('kontrol-is-form');
const editIdInput = document.getElementById('edit-id');
const isBaslikInput = document.getElementById('is-baslik');
const isAciklamaInput = document.getElementById('is-aciklama');
const btnSubmitIsText = document.getElementById('btn-submit-is-text');

const islerListesi = document.getElementById('kontrol-isleri-listesi');
const checklistQuestionsList = document.getElementById('checklist-questions-list');
const checklistSubmitForm = document.getElementById('checklist-submit-form');

const filterPersonel = document.getElementById('filter-personel');
const filterTarih = document.getElementById('filter-tarih');
const btnResetFilters = document.getElementById('btn-reset-filters');
const raporList = document.getElementById('rapor-list');
const raporCount = document.getElementById('rapor-count');

// Yerel durumlar
let allChecklistItems = {};
let allResponses = {};
let allPersoneller = {};
let activeLeaves = {};
let allShifts = {};
const currentAnswers = {}; // Personel cevaplarını tutacak geçici nesne { soruId: "evet" | "hayir" }

// --- AKTİF VARDİYA & NÖBETÇİ KONTROLLERİ VE HESAPLAMALAR ---
function getCurrentShiftInfo() {
    const formatter = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const partVal = (type) => parts.find(p => p.type === type).value;

    const year = partVal('year');
    const month = partVal('month');
    const day = partVal('day');
    const hour = parseInt(partVal('hour'), 10);

    let shiftDateStr = `${year}-${month}-${day}`;
    let shiftType = 'gunduz';

    if (hour >= 8 && hour < 19) {
        shiftType = 'gunduz';
    } else {
        shiftType = 'gece';
        if (hour < 8) {
            const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
            dateObj.setDate(dateObj.getDate() - 1);
            const yYesterday = dateObj.getFullYear();
            const mYesterday = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dYesterday = String(dateObj.getDate()).padStart(2, '0');
            shiftDateStr = `${yYesterday}-${mYesterday}-${dYesterday}`;
        }
    }
    return { shiftDateStr, shiftType };
}

function getRecentShiftsList() {
    const list = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dayStr}`;

        list.push({ shiftDateStr: dateStr, shiftType: 'gunduz' });
        list.push({ shiftDateStr: dateStr, shiftType: 'gece' });
    }

    const current = getCurrentShiftInfo();
    return list.filter(s => {
        if (s.shiftDateStr > current.shiftDateStr) return false;
        if (s.shiftDateStr === current.shiftDateStr) {
            if (current.shiftType === 'gunduz' && s.shiftType === 'gece') return false;
            if (s.shiftType === current.shiftType) return false;
        }
        return true;
    });
}

function checkDutyStatus() {
    const { shiftDateStr, shiftType } = getCurrentShiftInfo();
    const [year, month, dayStr] = shiftDateStr.split('-');
    const monthKey = `${year}-${month}`;
    const dayIndex = parseInt(dayStr, 10);

    const shiftData = allShifts[monthKey];
    const dayData = shiftData && shiftData.gunler ? shiftData.gunler[dayIndex] : null;

    let scheduledUid = null;
    let scheduledName = null;

    if (dayData) {
        if (shiftType === 'gunduz') {
            scheduledUid = dayData.gunduzUid;
            scheduledName = dayData.gunduzIsim;
        } else {
            scheduledUid = dayData.geceUid;
            scheduledName = dayData.geceIsim;
        }
    }

    let activeWorkerUid = scheduledUid;
    let activeWorkerName = scheduledName;
    let isProxyUsed = false;
    let leaveReason = "";

    if (scheduledUid) {
        for (const key of Object.keys(activeLeaves)) {
            const leave = activeLeaves[key];
            if (leave.izinliUid === scheduledUid) {
                if (shiftDateStr >= leave.baslangic && shiftDateStr <= leave.bitis) {
                    activeWorkerUid = leave.vekilUid;
                    activeWorkerName = leave.vekilIsim;
                    isProxyUsed = true;
                    leaveReason = leave.neden;
                    break;
                }
            }
        }
    }

    const formattedShiftType = shiftType === 'gunduz' ? 'GÜNDÜZ VARDİYASI (08.00 - 19.00)' : 'GECE VARDİYASI (19.00 - 08.00)';
    const dateObj = new Date(year, month - 1, dayIndex);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = dateObj.toLocaleDateString('tr-TR', options);

    const durumVardiyaAdi = document.getElementById('durum-vardiya-adi');
    const durumTarihAraligi = document.getElementById('durum-tarih-araligi');
    const durumNobetciIsim = document.getElementById('durum-nobetci-isim');

    if (durumVardiyaAdi) durumVardiyaAdi.textContent = formattedShiftType;
    if (durumTarihAraligi) durumTarihAraligi.textContent = dateFormatted;

    let nobetciDisplay = "Belirlenmedi (Nöbet Çizelgesi Yok)";
    if (activeWorkerName) {
        const workerUser = allPersoneller[activeWorkerUid];
        const sicil = workerUser ? workerUser.sicilNo : '';
        nobetciDisplay = sicil ? `${activeWorkerName} (${sicil})` : activeWorkerName;
        if (isProxyUsed) {
            const originalUser = allPersoneller[scheduledUid];
            const originalSicil = originalUser ? originalUser.sicilNo : '';
            const originalDisplay = originalSicil ? `${scheduledName} (${originalSicil})` : scheduledName;
            nobetciDisplay += ` [${originalDisplay} yerine Vekaleten - ${leaveReason}]`;
        }
    }
    if (durumNobetciIsim) durumNobetciIsim.textContent = nobetciDisplay;

    if (loggedInUser.rol === 'personel') {
        const yetkiUyariPaneli = document.getElementById('yetki-uyari-paneli');
        if (activeWorkerUid && activeWorkerUid === loggedInUser.uid) {
            if (checklistSubmitForm) checklistSubmitForm.classList.remove('hidden');
            if (yetkiUyariPaneli) yetkiUyariPaneli.classList.add('hidden');
        } else {
            if (checklistSubmitForm) checklistSubmitForm.classList.add('hidden');
            if (yetkiUyariPaneli) yetkiUyariPaneli.classList.remove('hidden');
        }
    }
}

async function autoSubmitMissingPastChecklists() {
    if (Object.keys(allShifts).length === 0 || Object.keys(allChecklistItems).length === 0 || loggedInUser.rol !== 'personel') return;

    const recentShifts = getRecentShiftsList();

    for (const shift of recentShifts) {
        const { shiftDateStr, shiftType } = shift;
        const key = `${shiftDateStr}_${shiftType}`;

        if (allResponses[key]) continue;

        const [year, month, dayStr] = shiftDateStr.split('-');
        const monthKey = `${year}-${month}`;
        const dayIndex = parseInt(dayStr, 10);

        const shiftData = allShifts[monthKey];
        const dayData = shiftData && shiftData.gunler ? shiftData.gunler[dayIndex] : null;

        let scheduledUid = null;
        let scheduledName = null;

        if (dayData) {
            if (shiftType === 'gunduz') {
                scheduledUid = dayData.gunduzUid;
                scheduledName = dayData.gunduzIsim;
            } else {
                scheduledUid = dayData.geceUid;
                scheduledName = dayData.geceIsim;
            }
        }

        let activeWorkerUid = scheduledUid || "sistem";
        let activeWorkerName = scheduledName || "Sistem (Otomatik)";

        if (scheduledUid) {
            for (const leaveKey of Object.keys(activeLeaves)) {
                const leave = activeLeaves[leaveKey];
                if (leave.izinliUid === scheduledUid) {
                    if (shiftDateStr >= leave.baslangic && shiftDateStr <= leave.bitis) {
                        activeWorkerUid = leave.vekilUid;
                        activeWorkerName = leave.vekilIsim;
                        break;
                    }
                }
            }
        }

        const packageAnswers = {};
        Object.keys(allChecklistItems).forEach(qId => {
            const q = allChecklistItems[qId];
            if (q.aktif) {
                packageAnswers[qId] = {
                    baslik: q.baslik,
                    deger: "hayir"
                };
            }
        });

        if (Object.keys(packageAnswers).length === 0) continue;

        const dateIsoStr = new Date(shiftDateStr + (shiftType === 'gunduz' ? 'T19:00:00.000Z' : 'T08:00:00.000Z')).toISOString();
        try {
            await set(ref(db, `kontrol_cevaplari/${key}`), {
                personelId: activeWorkerUid,
                personelIsim: activeWorkerName,
                tarih: dateIsoStr,
                shiftDate: shiftDateStr,
                shiftType: shiftType,
                otomatik: true,
                cevaplar: packageAnswers
            });
            console.log(`Otomatik doldurma başarıyla gerçekleşti: ${key}`);
        } catch (err) {
            console.error(`Otomatik doldurma hatası (${key}):`, err);
        }
    }
}

// Global Veri Listeners
onValue(ref(db, 'personeller'), (snapshot) => {
    allPersoneller = snapshot.val() || {};
    
    // Yöneticinin filtre listesini besleyelim
    if (loggedInUser.rol === 'yonetici' && filterPersonel) {
        filterPersonel.innerHTML = '<option value="">Tüm Personeller</option>';
        Object.keys(allPersoneller).forEach(uid => {
            const p = allPersoneller[uid];
            if (p.sicilNo.toLowerCase() !== 'admin') {
                const opt = document.createElement('option');
                opt.value = uid;
                opt.textContent = p.adSoyad;
                opt.className = "bg-neutral-950 text-white";
                filterPersonel.appendChild(opt);
            }
        });
    }
    
    checkDutyStatus();
});

onValue(ref(db, 'nobet_izinleri'), (snapshot) => {
    activeLeaves = snapshot.val() || {};
    checkDutyStatus();
});

onValue(ref(db, 'nobet_listeleri'), (snapshot) => {
    allShifts = snapshot.val() || {};
    checkDutyStatus();
    autoSubmitMissingPastChecklists();
});

onValue(ref(db, 'kontrol_isleri'), (snapshot) => {
    allChecklistItems = snapshot.val() || {};
    renderChecklistQuestions();
    renderManagerChecklistItems();
    renderReports();
    checkDutyStatus();
    autoSubmitMissingPastChecklists();
});

onValue(ref(db, 'kontrol_cevaplari'), (snapshot) => {
    allResponses = snapshot.val() || {};
    renderReports();
    autoSubmitMissingPastChecklists();
});

// 1. ROL BAZLI PANEL GÖSTERİMİ
if (loggedInUser.rol === 'yonetici') {
    if (isTanimContainer) isTanimContainer.classList.remove('hidden');
    if (yoneticiIslerContainer) yoneticiIslerContainer.classList.remove('hidden');
    if (raporlarContainer) raporlarContainer.classList.remove('hidden');
    if (personelChecklistContainer) personelChecklistContainer.remove();
} else {
    if (personelChecklistContainer) personelChecklistContainer.classList.remove('hidden');
    if (isTanimContainer) isTanimContainer.remove();
    if (yoneticiIslerContainer) yoneticiIslerContainer.remove();
    if (raporlarContainer) raporlarContainer.remove();
}

// ==========================================
// YÖNETİCİ BÖLÜMÜ: İŞ TANIMLAMA, DÜZENLEME VE SİLME MANTIKLARI
// ==========================================
if (loggedInUser.rol === 'yonetici') {
    if (isForm) {
        isForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const baslik = isBaslikInput.value.trim();
            const aciklama = isAciklamaInput.value.trim();
            const editId = editIdInput.value;

            const isBtn = document.getElementById('btn-submit-is');
            isBtn.disabled = true;

            try {
                if (editId) {
                    const itemRef = ref(db, `kontrol_isleri/${editId}`);
                    await update(itemRef, { baslik, aciklama });
                    window.showToast("İş başarıyla güncellendi.", "success");
                    exitEditMode();
                } else {
                    const newRef = push(ref(db, 'kontrol_isleri'));
                    await set(newRef, {
                        baslik,
                        aciklama,
                        aktif: true,
                        olusturmaTarihi: new Date().toISOString()
                    });
                    window.showToast("İş başarıyla eklendi.", "success");
                }
                isForm.reset();
            } catch (error) {
                console.error("İş Kayıt Hatası: ", error);
                window.showToast("İş kaydedilemedi: " + error.message, "error");
            } finally {
                isBtn.disabled = false;
            }
        });
    }

    if (islerListesi) {
        islerListesi.addEventListener('click', async (e) => {
            // A. AKTİF/PASİF DURUM DEĞİŞİKLİĞİ
            const toggleActiveBtn = e.target.closest('.btn-toggle-active-is');
            if (toggleActiveBtn) {
                const id = toggleActiveBtn.getAttribute('data-id');
                const item = allChecklistItems[id];
                if (item) {
                    const currentStatus = item.aktif !== false;
                    try {
                        await update(ref(db, `kontrol_isleri/${id}`), { aktif: !currentStatus });
                        window.showToast(`Madde ${!currentStatus ? 'aktif' : 'pasif'} hale getirildi.`, "success");
                    } catch (error) {
                        window.showToast("Durum güncelleme hatası: " + error.message, "error");
                    }
                }
                return;
            }

            // B. DÜZENLEME İŞLEMİ
            const editBtn = e.target.closest('.btn-edit-is');
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                const item = allChecklistItems[id];
                if (item) {
                    editIdInput.value = id;
                    isBaslikInput.value = item.baslik;
                    isAciklamaInput.value = item.aciklama || '';
                    btnSubmitIsText.textContent = "Güncelle";
                    
                    const formTitle = document.getElementById('form-title');
                    const formDesc = document.getElementById('form-desc');
                    if (formTitle) formTitle.textContent = "İşi Güncelle";
                    if (formDesc) formDesc.textContent = "Seçilen kontrol maddesinin bilgilerini güncelleyin.";
                    isBaslikInput.focus();
                }
                return;
            }

            // C. SİLME İŞLEMİ
            const deleteBtn = e.target.closest('.btn-delete-is');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                const confirmDelete = await window.showAlert("Onay Gerekiyor", "Bu kontrol maddesini silmek istediğinizden emin misiniz? (Geçmiş cevapları etkilemeyecektir)", true);
                if (confirmDelete) {
                    try {
                        await remove(ref(db, `kontrol_isleri/${id}`));
                        window.showToast("İş listeden silindi.", "success");
                        if (editIdInput.value === id) exitEditMode();
                    } catch (error) {
                        window.showToast("Silme hatası: " + error.message, "error");
                    }
                }
            }
        });
    }

    // Filtre Değişim Dinleyicileri
    if (filterPersonel) filterPersonel.addEventListener('change', renderReports);
    if (filterTarih) filterTarih.addEventListener('change', renderReports);
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            filterPersonel.value = "";
            filterTarih.value = "";
            renderReports();
        });
    }

    // Yazdırma Butonu Dinleyicisi
    const btnPrintReports = document.getElementById("btn-print-reports");
    if (btnPrintReports) {
        btnPrintReports.addEventListener("click", () => {
            window.print();
        });
    }
}

// Düzenleme modundan çıkış
function exitEditMode() {
    editIdInput.value = "";
    btnSubmitIsText.textContent = "Ekle";
    const formTitle = document.getElementById('form-title');
    const formDesc = document.getElementById('form-desc');
    if (formTitle) formTitle.textContent = "Yeni Kontrol İşi Tanımla";
    if (formDesc) formDesc.textContent = "Lütfen listeye eklenecek yeni kontrol maddesini girin.";
}

// ==========================================
// RENDER FONKSİYONLARI (MODÜLER VE TEMİZ)
// ==========================================

// 1. Personel Kontrol Listesi Sorularını Çizdir
function renderChecklistQuestions() {
    if (loggedInUser.rol !== 'personel' || !checklistQuestionsList) return;

    checklistQuestionsList.innerHTML = '';
    const keys = Object.keys(allChecklistItems).filter(id => allChecklistItems[id].aktif !== false);

    if (keys.length === 0) {
        checklistQuestionsList.innerHTML = `
            <div class="py-12 text-center text-neutral-500 italic text-xs bg-neutral-950 border border-neutral-900 rounded-lg">
                Şu anda doldurulması gereken aktif bir kontrol listesi işi bulunmuyor.
            </div>
        `;
        const submitBtn = checklistSubmitForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.classList.add('hidden');
        return;
    }

    const submitBtn = checklistSubmitForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.classList.remove('hidden');

    keys.forEach(id => {
        const item = allChecklistItems[id];
        
        if (currentAnswers[id] === undefined) {
            currentAnswers[id] = "";
        }

        const questionRow = document.createElement('div');
        questionRow.className = "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-neutral-950 border border-neutral-900 rounded-lg p-4 transition-colors hover:border-neutral-850";
        questionRow.innerHTML = `
            <div class="min-w-0">
                <h4 class="text-sm font-bold text-white break-words">${item.baslik}</h4>
                <p class="text-xs text-neutral-500 mt-1 break-words">${item.aciklama || 'Detay belirtilmemiş.'}</p>
            </div>
            
            <div class="flex gap-2 select-none shrink-0">
                <button type="button" class="btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-600 hover:text-white animate-transition" data-id="${id}" data-value="evet">
                    Evet
                </button>
                <button type="button" class="btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-600 hover:text-white animate-transition" data-id="${id}" data-value="hayir">
                    Hayır
                </button>
            </div>
        `;

        const evetBtn = questionRow.querySelector('button[data-value="evet"]');
        const hayirBtn = questionRow.querySelector('button[data-value="hayir"]');
        
        if (currentAnswers[id] === 'evet') {
            evetBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-emerald-950/20 border-emerald-800 text-emerald-450";
        } else if (currentAnswers[id] === 'hayir') {
            hayirBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-red-950/20 border-red-850 text-red-400";
        }

        checklistQuestionsList.appendChild(questionRow);
    });
}

// 2. Yönetici Kontrol Listesi Maddeleri Tablosunu Çizdir
function renderManagerChecklistItems() {
    if (loggedInUser.rol !== 'yonetici' || !islerListesi) return;

    islerListesi.innerHTML = '';
    const keys = Object.keys(allChecklistItems);

    if (keys.length === 0) {
        islerListesi.innerHTML = `
            <div class="col-span-full py-8 text-center text-neutral-600 italic text-xs">
                Tanımlanmış kontrol maddesi bulunmuyor.
            </div>
        `;
        return;
    }

    keys.forEach(id => {
        const item = allChecklistItems[id];
        const card = document.createElement('div');
        card.className = "bg-neutral-955 border border-neutral-900 rounded-lg p-4 flex flex-col justify-between hover:border-neutral-850 transition-colors";
        
        const isAktif = item.aktif !== false;
        const aktifRozet = isAktif 
            ? `<span class="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-900/30 text-emerald-450 bg-neutral-950">Aktif</span>`
            : `<span class="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-500 bg-neutral-950">Pasif</span>`;
        
        const aktifButonText = isAktif ? "Pasifleştir" : "Aktifleştir";

        card.innerHTML = `
            <div class="min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="text-xs font-bold text-white truncate flex-1">${item.baslik}</h4>
                    ${aktifRozet}
                </div>
                <p class="text-[10px] text-neutral-555 mt-1.5 line-clamp-2">${item.aciklama || 'Açıklama belirtilmemiş.'}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-neutral-900 flex justify-end space-x-1.5 select-none">
                <button class="btn-toggle-active-is px-2 py-1 bg-black hover:bg-neutral-900 border border-neutral-900 text-[10px] font-bold text-neutral-400 hover:text-white rounded transition-colors cursor-pointer" data-id="${id}">
                    ${aktifButonText}
                </button>
                <button class="btn-edit-is px-2 py-1 bg-black hover:bg-neutral-900 border border-neutral-900 hover:border-brandYellow text-[10px] font-bold text-neutral-400 hover:text-white rounded transition-colors cursor-pointer" data-id="${id}">
                    Düzenle
                </button>
                <button class="btn-delete-is px-2 py-1 bg-black hover:bg-red-955/10 border border-neutral-900 text-[10px] font-bold text-red-500 rounded transition-colors cursor-pointer" data-id="${id}">
                    Sil
                </button>
            </div>
        `;
        islerListesi.appendChild(card);
    });
}

// 3. Yanıt Raporlarını Çizdir (Yönetici Rapor Paneli)
function renderReports() {
    if (loggedInUser.rol !== 'yonetici' || !raporList) return;

    raporList.innerHTML = '';
    const keys = Object.keys(allResponses);

    let filtered = keys.map(key => ({
        id: key,
        ...allResponses[key]
    }));

    const selectedUid = filterPersonel ? filterPersonel.value : '';
    if (selectedUid) {
        filtered = filtered.filter(r => r.personelId === selectedUid);
    }

    const selectedDate = filterTarih ? filterTarih.value : '';
    if (selectedDate) {
        filtered = filtered.filter(r => {
            const reportDateStr = r.tarih.split('T')[0];
            return reportDateStr === selectedDate;
        });
    }

    if (raporCount) {
        raporCount.classList.remove('hidden');
        raporCount.textContent = `${filtered.length} Rapor`;
    }

    if (filtered.length === 0) {
        raporList.innerHTML = `
            <div class="col-span-full py-12 text-center text-neutral-650 bg-black border border-neutral-900 rounded-xl select-none">
                <span>Filtreye uygun kontrol raporu bulunamadı.</span>
            </div>
        `;
        return;
    }

    // Tarihe göre yeniden eskiye sıralama
    filtered.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

    filtered.forEach(report => {
        const reportDate = new Date(report.tarih);
        const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(reportDate);
        const timeStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(reportDate);
        const dateTimeStr = `${dateStr} ${timeStr}`;

        const card = document.createElement('div');
        card.className = "bg-black border border-neutral-900 rounded-lg p-5 transition-all duration-300 hover:border-neutral-800 relative flex flex-col justify-between";

        let answersListHtml = '';
        const answersKeys = Object.keys(report.cevaplar || {});

        if (answersKeys.length === 0) {
            answersListHtml = `<div class="text-[10px] text-neutral-650 italic">Hiçbir kontrol işi yanıtlanmamış.</div>`;
        } else {
            answersKeys.forEach(questionId => {
                const itemData = report.cevaplar[questionId];
                
                let qTitle = '';
                let ans = '';

                if (typeof itemData === 'object' && itemData !== null) {
                    qTitle = itemData.baslik || `Silinmiş İş (ID: ${questionId})`;
                    ans = itemData.deger;
                } else {
                    qTitle = allChecklistItems[questionId] ? allChecklistItems[questionId].baslik : `Silinmiş İş (ID: ${questionId})`;
                    ans = itemData;
                }
                
                let ansBadge = '';
                if (ans === 'evet') {
                    ansBadge = `<span class="bg-neutral-950 border border-emerald-900/30 text-emerald-450 font-bold px-2 py-0.5 rounded text-[10px]">EVET</span>`;
                } else {
                    ansBadge = `<span class="bg-neutral-950 border border-red-955/30 text-red-400 font-bold px-2 py-0.5 rounded text-[10px]">HAYIR</span>`;
                }

                answersListHtml += `
                    <div class="flex items-center justify-between py-1.5 border-b border-neutral-900/50">
                        <span class="text-xs text-neutral-450 pr-4 break-words truncate max-w-[70%]">${qTitle}</span>
                        ${ansBadge}
                    </div>
                `;
            });
        }

        const isAuto = report.otomatik === true;
        let badgeHtml = '';
        if (isAuto) {
            badgeHtml = `<span class="bg-neutral-950 border border-amber-900/40 text-amber-500 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase select-none tracking-wider">Otomatik</span>`;
        } else {
            badgeHtml = `<span class="bg-neutral-950 border border-brandOrange/25 text-brandOrange font-bold px-1.5 py-0.5 rounded text-[8px] uppercase select-none tracking-wider">Personel</span>`;
        }

        let shiftLabel = '';
        if (report.shiftDate && report.shiftType) {
            const [y, m, d] = report.shiftDate.split('-');
            const sDate = `${d}.${m}.${y}`;
            const sType = report.shiftType === 'gunduz' ? 'Gündüz' : 'Gece';
            shiftLabel = `${sDate} - ${sType}`;
        } else {
            shiftLabel = `${dateStr}`;
        }

        card.innerHTML = `
            <div class="flex items-start justify-between pb-3 border-b border-neutral-900 select-none">
                <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-bold text-white truncate">${report.personelIsim}</h4>
                    <div class="flex items-center space-x-2 mt-1">
                        ${badgeHtml}
                        <span class="text-[10px] text-neutral-600 font-semibold">${shiftLabel}</span>
                    </div>
                </div>
                <span class="text-[10px] font-mono text-neutral-500 shrink-0 ml-2">${dateTimeStr}</span>
            </div>
            
            <div class="mt-3.5 space-y-1">
                ${answersListHtml}
            </div>
        `;
        raporList.appendChild(card);
    });
}

// ==========================================
// PERSONEL BÖLÜMÜ CEVAPLAMA DİNLEYİCİLERİ
// ==========================================
if (loggedInUser.rol === 'personel' && checklistQuestionsList) {
    // Evet/Hayır Buton Tıklama Dinleyicisi
    checklistQuestionsList.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-answer');
        if (toggleBtn) {
            const id = toggleBtn.getAttribute('data-id');
            const value = toggleBtn.getAttribute('data-value');

            // Seçimi güncelle
            currentAnswers[id] = value;

            const parentRow = toggleBtn.closest('.flex');
            const evetBtn = parentRow.querySelector('button[data-value="evet"]');
            const hayirBtn = parentRow.querySelector('button[data-value="hayir"]');

            if (value === 'evet') {
                evetBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-emerald-950/20 border-emerald-800 text-emerald-450";
                hayirBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-600 hover:text-white";
            } else {
                hayirBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-red-950/20 border-red-850 text-red-400";
                evetBtn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-600 hover:text-white";
            }
        }
    });

    // Form Gönderim İşlemi (Cevapları Gönder)
    if (checklistSubmitForm) {
        checklistSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const activeKeys = Object.keys(allChecklistItems).filter(id => allChecklistItems[id].aktif !== false);
            const unanswered = activeKeys.filter(id => !currentAnswers[id] || currentAnswers[id] === "");

            if (unanswered.length > 0) {
                window.showToast("Lütfen tüm kontrol maddelerini işaretleyin!", "warning");
                return;
            }

            const submitBtn = checklistSubmitForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Gönderiliyor...</span>`;

            const packageAnswers = {};
            activeKeys.forEach(id => {
                packageAnswers[id] = {
                    baslik: allChecklistItems[id].baslik,
                    deger: currentAnswers[id]
                };
            });

            try {
                const { shiftDateStr, shiftType } = getCurrentShiftInfo();
                const responseRef = ref(db, `kontrol_cevaplari/${shiftDateStr}_${shiftType}`);
                await set(responseRef, {
                    personelId: loggedInUser.uid,
                    personelIsim: loggedInUser.adSoyad,
                    tarih: new Date().toISOString(),
                    shiftDate: shiftDateStr,
                    shiftType: shiftType,
                    otomatik: false,
                    cevaplar: packageAnswers
                });

                window.showToast("Cevaplarınız başarıyla yöneticiye iletildi.", "success");
                
                // Seçimleri temizle
                activeKeys.forEach(id => {
                    currentAnswers[id] = "";
                });
                
                // Butonları eski haline getir
                const buttons = checklistQuestionsList.querySelectorAll('.btn-toggle-answer');
                buttons.forEach(btn => {
                    btn.className = "btn-toggle-answer px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-600 hover:text-white";
                });

            } catch (error) {
                console.error("Cevap Gönderme Hatası: ", error);
                window.showToast("Gönderim hatası: " + error.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cevapları Gönder</span>
                `;
            }
        });
    }
}
