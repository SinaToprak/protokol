import { db } from "../db/firebase.js";
import { ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Giriş kontrolü
const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    window.location.href = "./index.html";
}

// ==========================================
// ELEMANLARI SEÇME
// ==========================================
const nobetFormContainer = document.getElementById('nobet-form-container');
const nobetOlusturForm = document.getElementById('nobet-olustur-form');
const taslakContainer = document.getElementById('taslak-container');
const taslakTabloBody = document.getElementById('taslak-tablo-body');
const btnKaydetCizelge = document.getElementById('btn-kaydet-cizelge');

const cizelgeViewContainer = document.getElementById('cizelge-view-container');
const viewAy = document.getElementById('view-ay');
const btnSilCizelge = document.getElementById('btn-sil-cizelge');
const nobetTabloContainer = document.getElementById('nobet-tablo-container');

const personelA = document.getElementById('personel-a');
const personelB = document.getElementById('personel-b');
const personelC = document.getElementById('personel-c');

// Sekme Butonları & Panelleri
const tabCizelge = document.getElementById('tab-cizelge');
const tabIzinler = document.getElementById('tab-izinler');
const panelCizelge = document.getElementById('panel-cizelge');
const panelIzinler = document.getElementById('panel-izinler');

// İzin Formu Elemanları
const izinFormContainer = document.getElementById('izin-form-container');
const izinOlusturForm = document.getElementById('izin-olustur-form');
const izinPersonel = document.getElementById('izin-personel');
const vekilPersonel = document.getElementById('vekil-personel');
const izinlerTabloContainer = document.getElementById('izinler-tablo-container');

// ==========================================
// DURUM DEĞİŞKENLERİ
// ==========================================
let allPersoneller = {};
let generatedDaysRecord = {}; // Kaydetmeye hazır taslak verisi
let selectedDonem = ""; // Seçilen oluşturma dönemi (YYYY-MM)
let activeLeaves = {}; // Gerçek zamanlı izin listesi (Firebase'den)

// ==========================================
// 1. SEKMELİ ARAYÜZ (TABBED UI) GEÇİŞLERİ
// ==========================================
if (tabCizelge && tabIzinler) {
    tabCizelge.addEventListener('click', () => {
        panelCizelge.classList.remove('hidden');
        panelIzinler.classList.add('hidden');

        tabCizelge.className = "py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 border-brandOrange text-white transition-all focus:outline-none cursor-pointer";
        tabIzinler.className = "py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-neutral-500 hover:text-neutral-350 transition-all focus:outline-none cursor-pointer";
    });

    tabIzinler.addEventListener('click', () => {
        panelIzinler.classList.remove('hidden');
        panelCizelge.classList.add('hidden');

        tabIzinler.className = "py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 border-brandOrange text-white transition-all focus:outline-none cursor-pointer";
        tabCizelge.className = "py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-neutral-500 hover:text-neutral-350 transition-all focus:outline-none cursor-pointer";
    });
}

// ==========================================
// 2. ROL BAZLI PANEL DÜZENLEMELERİ
// ==========================================
if (loggedInUser.rol === 'yonetici') {
    if (nobetFormContainer) nobetFormContainer.classList.remove('hidden');
    if (btnSilCizelge) btnSilCizelge.classList.remove('hidden');
    if (izinFormContainer) izinFormContainer.classList.remove('hidden');
} else {
    if (nobetFormContainer) nobetFormContainer.remove();
    if (taslakContainer) taslakContainer.remove();
    if (btnSilCizelge) btnSilCizelge.remove();
    if (izinFormContainer) izinFormContainer.remove();
}

// ==========================================
// 3. SEÇİM KUTULARINI DOLDURMA (Yönetici)
// ==========================================
const personellerRef = ref(db, 'personeller');
onValue(personellerRef, (snapshot) => {
    const data = snapshot.val() || {};
    allPersoneller = data;

    if (loggedInUser.rol === 'yonetici') {
        const populateSelect = (selectEl) => {
            if (!selectEl) return;
            selectEl.innerHTML = '<option value="">Seçin...</option>';
            Object.keys(data).forEach(uid => {
                const p = data[uid];
                if (p.sicilNo.toLowerCase() !== 'admin') {
                    const opt = document.createElement('option');
                    opt.value = uid;
                    opt.textContent = p.adSoyad;
                    opt.className = "bg-neutral-950 text-white";
                    selectEl.appendChild(opt);
                }
            });
        };

        populateSelect(personelA);
        populateSelect(personelB);
        populateSelect(personelC);
        populateSelect(izinPersonel);
        populateSelect(vekilPersonel);
    }
});

// ==========================================
// 4. İZİNLERİN GERÇEK ZAMANLI DİNLENMESİ & EŞLENMESİ
// ==========================================
const izinlerRef = ref(db, 'nobet_izinleri');
onValue(izinlerRef, (snapshot) => {
    activeLeaves = snapshot.val() || {};
    renderIzinlerTablosu();
    
    // Ekranda aktif bir çizelge varsa, izinler değiştiğinde tabloyu dinamik olarak güncelle
    if (viewAy && viewAy.value) {
        loadActiveCalendar();
    }
});

// İzin & Vekalet durumunu kontrol edip vekil ismi türeten fonksiyon
function getRoleNameWithProxy(uid, defaultName, dateString) {
    const p = allPersoneller[uid];
    const pName = p ? p.adSoyad : defaultName;
    const pSicil = p ? p.sicilNo : '';
    const displayNameAndSicil = pSicil ? `${pName} (${pSicil})` : pName;

    for (const key of Object.keys(activeLeaves)) {
        const leave = activeLeaves[key];
        if (leave.izinliUid === uid) {
            // Tarih aralığında mı?
            if (dateString >= leave.baslangic && dateString <= leave.bitis) {
                const vekilUser = allPersoneller[leave.vekilUid];
                const vekilName = vekilUser ? vekilUser.adSoyad : leave.vekilIsim;
                const vekilSicil = vekilUser ? vekilUser.sicilNo : '';
                const vekilDisplay = vekilSicil ? `${vekilName} (${vekilSicil}) (V.)` : `${vekilName} (V.)`;

                const izinliUser = allPersoneller[leave.izinliUid];
                const izinliName = izinliUser ? izinliUser.adSoyad : leave.izinliIsim;
                const izinliSicil = izinliUser ? izinliUser.sicilNo : '';
                const izinliDisplay = izinliSicil ? `${izinliName} (${izinliSicil}) (${leave.neden})` : `${izinliName} (${leave.neden})`;

                return {
                    isProxy: true,
                    vekilDisplay: vekilDisplay,
                    izinliDisplay: izinliDisplay
                };
            }
        }
    }
    return {
        isProxy: false,
        display: displayNameAndSicil
    };
}

// Kayıtlı İzinler Listesini Tabloya Render Etme
function renderIzinlerTablosu() {
    if (!izinlerTabloContainer) return;

    const keys = Object.keys(activeLeaves);
    if (keys.length === 0) {
        izinlerTabloContainer.innerHTML = `
            <div class="py-10 text-center text-neutral-500 italic text-xs select-none">
                Sistemde henüz kayıtlı izin & vekalet bulunmamaktadır.
            </div>
        `;
        return;
    }

    // Tarihe göre yeniden eskiye sıralama (Baslangıc Tarihine Göre Descending)
    keys.sort((a, b) => activeLeaves[b].baslangic.localeCompare(activeLeaves[a].baslangic));

    const formatYYYYMMDDtoDDMMYYYY = (val) => {
        if (!val) return '';
        const parts = val.split('-');
        if (parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return val;
    };

    let rowsHtml = '';
    keys.forEach(key => {
        const leave = activeLeaves[key];
        const dateRangeStr = `${formatYYYYMMDDtoDDMMYYYY(leave.baslangic)} / ${formatYYYYMMDDtoDDMMYYYY(leave.bitis)}`;
        const actionsHtml = loggedInUser.rol === 'yonetici' ? `
            <td class="py-3 px-4 text-right">
                <button data-id="${key}" class="btn-sil-izin bg-neutral-950 hover:bg-red-955/10 border border-neutral-850 hover:border-red-900 text-red-500 font-bold py-1.5 px-3 rounded text-[10px] uppercase cursor-pointer transition-colors">
                    Sil
                </button>
            </td>
        ` : '';

        rowsHtml += `
            <tr class="border-b border-neutral-900/40 hover:bg-neutral-950/40 transition-colors">
                <td class="py-3 px-4 font-bold text-white">${leave.izinliIsim}</td>
                <td class="py-3 px-4 font-semibold text-brandOrange">${leave.vekilIsim}</td>
                <td class="py-3 px-4 text-neutral-400 font-medium font-mono">${dateRangeStr}</td>
                <td class="py-3 px-4">
                    <span class="bg-neutral-900 border border-neutral-850 text-neutral-350 text-[10px] font-semibold px-2 py-0.5 rounded">
                        ${leave.neden}
                    </span>
                </td>
                ${actionsHtml}
            </tr>
        `;
    });

    const actionHeaderHtml = loggedInUser.rol === 'yonetici' ? `<th class="py-3 px-4 text-right w-24">Eylem</th>` : '';

    izinlerTabloContainer.innerHTML = `
        <table class="w-full text-left text-xs border-collapse">
            <thead>
                <tr class="border-b border-neutral-900 bg-neutral-950 text-neutral-450 uppercase font-bold text-[10px] tracking-wider select-none">
                    <th class="py-3 px-4 w-1/4">İzinli Personel</th>
                    <th class="py-3 px-4 w-1/4">Vekalet Eden</th>
                    <th class="py-3 px-4 w-1/4">Tarih Aralığı</th>
                    <th class="py-3 px-4 w-1/4">İzin Nedeni</th>
                    ${actionHeaderHtml}
                </tr>
            </thead>
            <tbody class="divide-y divide-neutral-900/60">
                ${rowsHtml}
            </tbody>
        </table>
    `;

    // Silme Butonlarına Olay Dinleyicisi Bağla
    if (loggedInUser.rol === 'yonetici') {
        const deleteButtons = izinlerTabloContainer.querySelectorAll('.btn-sil-izin');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const leave = activeLeaves[id];
                const confirmDelete = await window.showAlert("Onay Gerekiyor", `${leave.izinliIsim} personeline ait izin kaydını kalıcı olarak silmek istediğinizden emin misiniz?`, true);
                if (confirmDelete) {
                    try {
                        await remove(ref(db, `nobet_izinleri/${id}`));
                        window.showToast("İzin kaydı başarıyla silindi.", "success");
                    } catch (err) {
                        window.showToast("Silme hatası: " + err.message, "error");
                    }
                }
            });
        });
    }
}

// ==========================================
// 5. İZİN EKLEME FORMU (Yönetici)
// ==========================================
if (loggedInUser.rol === 'yonetici' && izinOlusturForm) {
    izinOlusturForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const uidIzinli = izinPersonel.value;
        const uidVekil = vekilPersonel.value;
        const baslangic = document.getElementById('izin-baslangic').value;
        const bitis = document.getElementById('izin-bitis').value;
        const neden = document.getElementById('izin-neden').value;

        // Validasyonlar
        if (uidIzinli === uidVekil) {
            window.showToast("İzne ayrılacak personel ile vekalet edecek personel aynı kişi olamaz!", "warning");
            return;
        }

        if (baslangic > bitis) {
            window.showToast("Başlangıç tarihi bitiş tarihinden sonra olamaz!", "warning");
            return;
        }

        const btnSubmit = document.getElementById('btn-izin-ekle');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Ekleniyor...</span>`;

        try {
            const newIzinRef = push(ref(db, 'nobet_izinleri'));
            await set(newIzinRef, {
                izinliUid: uidIzinli,
                izinliIsim: allPersoneller[uidIzinli].adSoyad,
                vekilUid: uidVekil,
                vekilIsim: allPersoneller[uidVekil].adSoyad,
                baslangic: baslangic,
                bitis: bitis,
                neden: neden,
                olusturmaTarihi: new Date().toISOString()
            });

            window.showToast("İzin ve vekalet başarıyla eklendi.", "success");
            izinOlusturForm.reset();
        } catch (err) {
            window.showToast("İzin kaydedilemedi: " + err.message, "error");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>İzin Ekle</span>
            `;
        }
    });
}

// ==========================================
// 6. NÖBET HESAPLAMA ALGORİTMASI (Yönetici)
// ==========================================
if (loggedInUser.rol === 'yonetici' && nobetOlusturForm) {
    nobetOlusturForm.addEventListener('submit', (e) => {
        e.preventDefault();

        selectedDonem = document.getElementById('nobet-donem').value; // Örn: "2026-07"
        const uidA = personelA.value;
        const uidB = personelB.value;
        const uidC = personelC.value;
        const gunduzGunu = parseInt(document.getElementById('gunduz-gunu').value, 10);

        // A. Güvenlik Kontrolleri
        if (uidA === uidB || uidA === uidC || uidB === uidC) {
            window.showToast("Lütfen 3 farklı personel seçin!", "warning");
            return;
        }

        // Personel Eşleştirmeleri
        const pMap = {
            "A": { uid: uidA, name: allPersoneller[uidA].adSoyad },
            "B": { uid: uidB, name: allPersoneller[uidB].adSoyad },
            "C": { uid: uidC, name: allPersoneller[uidC].adSoyad }
        };

        // B. Dönem Gün Sayısını Hesaplama
        const [year, month] = selectedDonem.split('-').map(Number);
        const totalDays = new Date(year, month, 0).getDate();

        // C. Döngüyü Gün Gün İşletme
        generatedDaysRecord = {};
        taslakTabloBody.innerHTML = '';

        let currentGunduz = pMap["A"];
        let currentGece = pMap["B"];
        let currentIstirahat = pMap["C"];
        let currentGunduzDay = gunduzGunu;

        for (let day = 1; day <= totalDays; day++) {
            if (day > 1) {
                // Günlük geçiş mantığı
                if (currentGunduzDay < 5) {
                    currentGunduzDay++;
                    const temp = currentGece;
                    currentGece = currentIstirahat;
                    currentIstirahat = temp;
                } else if (currentGunduzDay === 5) {
                    const oldGunduz = currentGunduz;
                    const oldGece = currentGece;
                    const oldIstirahat = currentIstirahat;

                    currentGunduz = oldIstirahat;
                    currentGece = oldGunduz;
                    currentIstirahat = oldGece;
                    currentGunduzDay = 1;
                }
            }

            // Günü kaydet
            const dateObj = new Date(year, month - 1, day);
            const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            generatedDaysRecord[day] = {
                tarih: dateString,
                gunduzUid: currentGunduz.uid,
                gunduzIsim: currentGunduz.name,
                gunduzSira: currentGunduzDay,
                geceUid: currentGece.uid,
                geceIsim: currentGece.name,
                istirahatUid: currentIstirahat.uid,
                istirahatIsim: currentIstirahat.name
            };

            // İzin & Vekalet Durum Kontrolü
            const gunduzResolved = getRoleNameWithProxy(currentGunduz.uid, currentGunduz.name, dateString);
            const geceResolved = getRoleNameWithProxy(currentGece.uid, currentGece.name, dateString);
            const istirahatResolved = getRoleNameWithProxy(currentIstirahat.uid, currentIstirahat.name, dateString);

            // Tablo Hücrelerini Hazırla
            let gunduzHtml = '';
            if (gunduzResolved.isProxy) {
                gunduzHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-bold text-brandOrange">${gunduzResolved.vekilDisplay}</span>
                        <span class="text-[10px] text-neutral-500 font-medium">${gunduzResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                gunduzHtml = `<span class="font-bold text-brandOrange">${gunduzResolved.display}</span>`;
            }

            let geceHtml = '';
            if (geceResolved.isProxy) {
                geceHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-semibold text-blue-400">${geceResolved.vekilDisplay}</span>
                        <span class="text-[10px] text-neutral-550 font-medium">${geceResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                geceHtml = `<span class="font-semibold text-blue-400">${geceResolved.display}</span>`;
            }

            let istirahatHtml = '';
            if (istirahatResolved.isProxy) {
                istirahatHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-semibold text-neutral-500">${istirahatResolved.vekilDisplay}</span>
                        <span class="text-[10px] text-neutral-600 font-medium">${istirahatResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                istirahatHtml = `<span class="font-semibold text-neutral-550">${istirahatResolved.display}</span>`;
            }

            // Taslak Tablo Satırını Çizdir
            const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateObj);
            const weekdayStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long' }).format(dateObj);
            const localizedDateStr = `${dateStr} - ${weekdayStr}`;

            const row = document.createElement('tr');
            row.className = "border-b border-neutral-900/40 hover:bg-neutral-950/40 transition-colors";
            row.innerHTML = `
                <td class="py-3 px-4 text-neutral-400 font-semibold select-none">${localizedDateStr}</td>
                <td class="py-3 px-4">${gunduzHtml}</td>
                <td class="py-3 px-4">${geceHtml}</td>
                <td class="py-3 px-4">${istirahatHtml}</td>
            `;
            taslakTabloBody.appendChild(row);
        }

        // Taslak Alanını Göster
        taslakContainer.classList.remove('hidden');
        taslakContainer.scrollIntoView({ behavior: 'smooth' });
    });
}

// ==========================================
// 7. YÖNETİCİ: TASLAĞI FİREBASE'E KAYDETME
// ==========================================
if (loggedInUser.rol === 'yonetici' && btnKaydetCizelge) {
    btnKaydetCizelge.addEventListener('click', async () => {
        if (!selectedDonem || Object.keys(generatedDaysRecord).length === 0) return;

        btnKaydetCizelge.disabled = true;
        btnKaydetCizelge.innerHTML = `<span>Kaydediliyor...</span>`;

        try {
            const nobetRef = ref(db, `nobet_listeleri/${selectedDonem}`);
            await set(nobetRef, {
                olusturanId: loggedInUser.uid,
                olusturanIsim: loggedInUser.adSoyad,
                olusturmaTarihi: new Date().toISOString(),
                gunler: generatedDaysRecord
            });

            window.showToast(`${selectedDonem} dönemi nöbet çizelgesi başarıyla kaydedildi.`, "success");
            
            if (viewAy) {
                viewAy.value = selectedDonem;
                viewAy.dispatchEvent(new Event('change'));
            }

            taslakContainer.classList.add('hidden');
            taslakTabloBody.innerHTML = '';
            generatedDaysRecord = {};
        } catch (error) {
            console.error("Nöbet Kayıt Hatası: ", error);
            window.showToast("Nöbet listesi kaydedilemedi: " + error.message, "error");
        } finally {
            btnKaydetCizelge.disabled = false;
            btnKaydetCizelge.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Çizelgeyi Kaydet</span>
            `;
        }
    });
}

// ==========================================
// 8. ORTAK ALAN: NÖBET SORGULAMA VE LİSTELEME
// ==========================================
if (viewAy) {
    const now = new Date();
    const currentYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    viewAy.value = currentYYYYMM;
    viewAy.addEventListener('change', loadActiveCalendar);
    loadActiveCalendar();
}

// Kayıtlı Nöbet Listesini Yükleme Fonksiyonu
function loadActiveCalendar() {
    const targetAy = viewAy.value;
    if (!targetAy) {
        nobetTabloContainer.innerHTML = `<div class="py-8 text-center text-neutral-500 italic text-xs">Lütfen sorgulamak istediğiniz dönemi seçin.</div>`;
        if (btnSilCizelge) btnSilCizelge.classList.add('hidden');
        return;
    }

    const cizelgeRef = ref(db, `nobet_listeleri/${targetAy}`);

    let loadingTimeout = setTimeout(() => {
        nobetTabloContainer.innerHTML = `
            <div class="py-16 text-center text-neutral-500">
                <svg class="animate-spin h-8 w-8 text-brandOrange mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Nöbet çizelgesi yükleniyor...</span>
            </div>
        `;
    }, 300);

    onValue(cizelgeRef, (snapshot) => {
        clearTimeout(loadingTimeout);
        const data = snapshot.val();

        if (!data || !data.gunler) {
            nobetTabloContainer.innerHTML = `
                <div class="py-12 text-center text-neutral-600 italic text-xs">
                    Bu döneme (${targetAy}) ait kayıtlı nöbet çizelgesi bulunmamaktadır.
                </div>
            `;
            if (btnSilCizelge && loggedInUser.rol === 'yonetici') {
                btnSilCizelge.classList.add('hidden');
            }
            return;
        }

        if (btnSilCizelge && loggedInUser.rol === 'yonetici') {
            btnSilCizelge.classList.remove('hidden');
        }

        // Tabloyu Çiz (Masaüstü için tablo, mobil için dikey kartlar)
        let rowsHtml = '';
        let cardsHtml = '';
        const gunlerKeys = Object.keys(data.gunler).sort((a, b) => Number(a) - Number(b));
        gunlerKeys.forEach(gunNum => {
            const gun = data.gunler[gunNum];
            const dateObj = new Date(gun.tarih);
            const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateObj);
            const weekdayStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long' }).format(dateObj);
            const localizedDateStr = `${dateStr} - ${weekdayStr}`;

            const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

            // İzin & Vekalet Durum Kontrolü
            const gunduzResolved = getRoleNameWithProxy(gun.gunduzUid, gun.gunduzIsim, gun.tarih);
            const geceResolved = getRoleNameWithProxy(gun.geceUid, gun.geceIsim, gun.tarih);
            const istirahatResolved = getRoleNameWithProxy(gun.istirahatUid, gun.istirahatIsim, gun.tarih);

            // Gündüz
            let gunduzHtml = '';
            if (gunduzResolved.isProxy) {
                gunduzHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-bold text-brandOrange">${gunduzResolved.vekilDisplay}</span>
                        <span class="text-[9px] text-neutral-500 font-medium leading-tight">${gunduzResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                gunduzHtml = `<span class="font-bold text-brandOrange">${gunduzResolved.display}</span>`;
            }

            // Gece
            let geceHtml = '';
            if (geceResolved.isProxy) {
                geceHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-semibold text-blue-400">${geceResolved.vekilDisplay}</span>
                        <span class="text-[9px] text-neutral-550 font-medium leading-tight">${geceResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                geceHtml = `<span class="font-semibold text-blue-400">${geceResolved.display}</span>`;
            }

            // İstirahat
            let istirahatHtml = '';
            if (istirahatResolved.isProxy) {
                istirahatHtml = `
                    <div class="flex flex-col space-y-0.5 select-none">
                        <span class="font-semibold text-neutral-500">${istirahatResolved.vekilDisplay}</span>
                        <span class="text-[9px] text-neutral-600 font-medium leading-tight">${istirahatResolved.izinliDisplay}</span>
                    </div>
                `;
            } else {
                istirahatHtml = `<span class="font-semibold text-neutral-550">${istirahatResolved.display}</span>`;
            }

            // Masaüstü Tablo Satırı
            rowsHtml += `
                <tr class="border-b border-neutral-900/40 hover:bg-neutral-950/40 transition-colors ${isWeekend ? 'weekend-row bg-amber-955/5 font-semibold' : ''}">
                    <td class="py-3 px-4 text-neutral-400 font-semibold select-none">${localizedDateStr}</td>
                    <td class="py-3 px-4">${gunduzHtml}</td>
                    <td class="py-3 px-4">${geceHtml}</td>
                    <td class="py-3 px-4">${istirahatHtml}</td>
                </tr>
            `;

            // Mobil Kart Görünümü
            cardsHtml += `
                <div class="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 space-y-3 shadow-sm select-none ${isWeekend ? 'border-brandOrange/40 bg-neutral-900/80' : ''}">
                    <div class="flex justify-between items-center border-b border-neutral-900 pb-2.5">
                        <span class="text-[11px] font-bold text-white uppercase tracking-wider">${weekdayStr}</span>
                        <span class="text-xs font-semibold text-neutral-450 font-mono">${dateStr}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2.5 text-center">
                        <div class="bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 flex flex-col justify-between min-h-[64px]">
                            <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Gündüz</span>
                            <div class="flex-1 flex items-center justify-center">${gunduzHtml}</div>
                        </div>
                        <div class="bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 flex flex-col justify-between min-h-[64px]">
                            <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Gece</span>
                            <div class="flex-1 flex items-center justify-center">${geceHtml}</div>
                        </div>
                        <div class="bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 flex flex-col justify-between min-h-[64px]">
                            <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">İstirahat</span>
                            <div class="flex-1 flex items-center justify-center">${istirahatHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        const [year, month] = targetAy.split('-');
        const monthNames = [
            "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ];
        const monthName = monthNames[parseInt(month, 10) - 1] || "";

        nobetTabloContainer.innerHTML = `
            <!-- Yazıcı Başlığı (Sadece Baskıda Görünür) -->
            <div class="hidden print-header-title text-center mb-4 select-none">
                <h1 class="text-base font-extrabold uppercase tracking-wider text-black border-b-2 border-black pb-1.5">
                    ${year} YILI ${monthName.toUpperCase()} AYINA AİT NÖBET ÇİZELGESİ
                </h1>
            </div>

            <!-- Masaüstü Görünüm (Tablo) -->
            <div class="hidden md:block overflow-x-auto w-full">
                <table class="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr class="border-b border-neutral-900 bg-neutral-950 text-neutral-450 uppercase font-bold text-[10px] tracking-wider select-none">
                            <th class="py-3 px-4 w-1/4">Tarih</th>
                            <th class="py-3 px-4 w-1/4">Gündüz Vardiyası</th>
                            <th class="py-3 px-4 w-1/4">Gece Vardiyası</th>
                            <th class="py-3 px-4 w-1/4">İstirahat</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-neutral-900/60">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            <div class="grid grid-cols-1 gap-3 md:hidden">
                ${cardsHtml}
            </div>
        `;
    }, (error) => {
        clearTimeout(loadingTimeout);
        console.error("Nöbet Yükleme Hatası: ", error);
        nobetTabloContainer.innerHTML = `
            <div class="py-12 text-center text-red-500 italic text-xs bg-neutral-950 border border-neutral-900 rounded-lg">
                Nöbet listesi yüklenirken yetkilendirme hatası oluştu. Lütfen veritabanı kurallarını kontrol edin.
            </div>
        `;
    });
}

// ==========================================
// 9. YÖNETİCİ: ÇİZELGE SİLME AKSİYONU
// ==========================================
if (loggedInUser.rol === 'yonetici' && btnSilCizelge) {
    btnSilCizelge.addEventListener('click', async () => {
        const targetAy = viewAy.value;
        if (!targetAy) return;

        const confirmDelete = await window.showAlert("Onay Gerekiyor", `${targetAy} dönemine ait nöbet çizelgesini kalıcı olarak silmek istediğinizden emin misiniz?`, true);
        if (confirmDelete) {
            btnSilCizelge.disabled = true;
            btnSilCizelge.innerHTML = 'Siliniyor...';

            try {
                await remove(ref(db, `nobet_listeleri/${targetAy}`));
                window.showToast(`${targetAy} dönemi nöbet çizelgesi silindi.`, "success");
            } catch (error) {
                console.error("Nöbet Silme Hatası: ", error);
                window.showToast("Silme hatası: " + error.message, "error");
            } finally {
                btnSilCizelge.disabled = false;
                btnSilCizelge.innerHTML = 'Sil';
            }
        }
    });
}

// ==========================================
// 10. ORTAK: ÇİZELGE YAZDIRMA / PDF AKSİYONU
// ==========================================
const btnPrintShifts = document.getElementById("btn-print-shifts");
if (btnPrintShifts) {
    btnPrintShifts.addEventListener("click", () => {
        window.print();
    });
}
