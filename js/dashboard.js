import { db } from "../db/firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Oturum kontrolü
const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
if (!loggedInUser) {
    // Giriş yapılmadıysa dashboard'u yükleme, login-view görüntülensin
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.classList.remove('hidden');
} else {
    // Giriş yapıldıysa login-view'ı gizle ve body layout'u ayarla
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.remove();

    document.body.className = "bg-neutral-950 text-white min-h-screen flex justify-center font-sans";

    // Main alanını oluştur ve body'e ekle
    const main = document.createElement("main");
    main.className = "flex-1 p-6 md:p-8 overflow-y-auto bg-neutral-900 flex flex-col gap-6 w-full max-w-full";
    document.body.appendChild(main);

    // Global veri setleri
    let allPersoneller = {};
    let allGorevler = {};
    let allSorunlar = {};
    let allShifts = {};
    let activeLeaves = {};
    let allResponses = {};

    // Türkiye Zaman Diliminde Aktif Vardiya Çözümlemesi
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

    // Aktif Nöbetçi Çözümleme
    function getActiveOnDutyWorker(shiftDateStr, shiftType) {
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

        if (scheduledUid) {
            for (const key of Object.keys(activeLeaves)) {
                const leave = activeLeaves[key];
                if (leave.izinliUid === scheduledUid) {
                    if (shiftDateStr >= leave.baslangic && shiftDateStr <= leave.bitis) {
                        activeWorkerUid = leave.vekilUid;
                        activeWorkerName = leave.vekilIsim;
                        break;
                    }
                }
            }
        }
        return { uid: activeWorkerUid, name: activeWorkerName };
    }

    // Personelin bir sonraki nöbet tarihini bulma
    function getNextShiftForUser(userUid) {
        const { shiftDateStr, shiftType } = getCurrentShiftInfo();
        let checkedDate = new Date(shiftDateStr);
        
        // Önümüzdeki 30 günü tara
        for (let i = 0; i < 30; i++) {
            const y = checkedDate.getFullYear();
            const m = String(checkedDate.getMonth() + 1).padStart(2, '0');
            const d = String(checkedDate.getDate()).padStart(2, '0');
            const dateKey = `${y}-${m}-${d}`;
            const monthKey = `${y}-${m}`;
            const dayIdx = checkedDate.getDate();

            // Nöbet var mı kontrol et
            const mShifts = allShifts[monthKey];
            if (mShifts && mShifts.gunler && mShifts.gunler[dayIdx]) {
                const dayData = mShifts.gunler[dayIdx];
                
                // Gündüz nöbetçisi mi?
                let isGunduz = dayData.gunduzUid === userUid;
                let isGece = dayData.geceUid === userUid;

                // İzinliyse vekalet durumlarını hesaba kat
                for (const lKey of Object.keys(activeLeaves)) {
                    const leave = activeLeaves[lKey];
                    if (leave.izinliUid === userUid && dateKey >= leave.baslangic && dateKey <= leave.bitis) {
                        // İzinli, bu gün nöbet tutamaz
                        isGunduz = false;
                        isGece = false;
                    }
                    if (leave.vekilUid === userUid && dateKey >= leave.baslangic && dateKey <= leave.bitis) {
                        // Vekaleten nöbetçi!
                        if (dayData.gunduzUid === leave.izinliUid) isGunduz = true;
                        if (dayData.geceUid === leave.izinliUid) isGece = true;
                    }
                }

                // Eşleşti mi?
                if (dateKey === shiftDateStr) {
                    // Bugün ise ve o vardiya geçtiyse atla
                    if (isGunduz && shiftType === 'gece') isGunduz = false; 
                }

                if (isGunduz) {
                    return `${d}.${m}.${y} - Gündüz`;
                }
                if (isGece) {
                    return `${d}.${m}.${y} - Gece`;
                }
            }
            checkedDate.setDate(checkedDate.getDate() + 1);
        }
        return "Planlanmış Nöbet Yok";
    }

    // Dashboard Render Arayüzü
    function renderDashboard() {
        main.innerHTML = "";

        // Hoş Geldiniz Banner
        const welcomeBanner = document.createElement("div");
        welcomeBanner.className = "w-full bg-black border border-neutral-900 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 select-none shadow-sm";
        welcomeBanner.innerHTML = `
            <div class="absolute -top-20 -left-20 w-46 h-46 bg-brandOrange/5 rounded-full blur-3xl pointer-events-none"></div>
            <div>
                <h1 class="text-2xl font-black text-white">
                    Kalibrasyon Protokolüne Hoş Geldiniz, <span class="text-brandOrange">${loggedInUser.adSoyad}</span>
                </h1>
                <p class="text-xs text-neutral-500 mt-1">Sistem başarıyla doğrulandı. Sol panel üzerinden tüm modüllere erişebilirsiniz.</p>
            </div>
            <div class="shrink-0 flex items-center space-x-2">
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${loggedInUser.rol === 'yonetici' ? 'bg-neutral-950 border-brandOrange/20 text-brandOrange' : 'bg-neutral-950 border-neutral-900 text-neutral-500'}">
                    ${loggedInUser.rol === 'yonetici' ? 'Yönetici Modu' : 'Personel Modu'}
                </span>
            </div>
        `;
        main.appendChild(welcomeBanner);

        if (loggedInUser.rol === 'yonetici') {
            renderYoneticiDashboard();
        } else {
            renderPersonelDashboard();
        }
    }

    // ==========================================
    // YÖNETİCİ DASHBOARD GÖRÜNÜMÜ
    // ==========================================
    function renderYoneticiDashboard() {
        const { shiftDateStr, shiftType } = getCurrentShiftInfo();
        const activeOnDuty = getActiveOnDutyWorker(shiftDateStr, shiftType);

        // 1. Canlı Metrik Hesaplamaları
        const activeTasksCount = Object.keys(allGorevler).filter(k => allGorevler[k].durum === 'beklemede' || allGorevler[k].durum === 'yapiliyor').length;
        const activeIssuesCount = Object.keys(allSorunlar).filter(k => allSorunlar[k].durum === 'beklemede' || allSorunlar[k].durum === 'yapiliyor').length;
        
        // Son checklist raporu durumu
        const todayChecklistKey = `${shiftDateStr}_${shiftType}`;
        const todayReport = allResponses[todayChecklistKey];
        let checklistStatus = "Gönderilmedi";
        let checklistBadgeClass = "border-neutral-850 text-neutral-550";
        if (todayReport) {
            if (todayReport.otomatik) {
                checklistStatus = "Otomatik Dolduruldu";
                checklistBadgeClass = "border-amber-900/40 text-amber-500 bg-amber-950/5";
            } else {
                checklistStatus = "Personel Gönderdi";
                checklistBadgeClass = "border-emerald-900/30 text-emerald-450 bg-emerald-950/5";
            }
        }

        // İstatistik Grid
        const statGrid = document.createElement("div");
        statGrid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full select-none";
        statGrid.innerHTML = `
            <!-- Aktif Görevler -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Aktif Görevler</div>
                <div class="text-3xl font-black text-white mt-1.5">${activeTasksCount}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium">Tamamlanmayı bekleyen işler</div>
            </div>
            
            <!-- Bekleyen Sorunlar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Açık Arızalar</div>
                <div class="text-3xl font-black text-red-500 mt-1.5">${activeIssuesCount}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium">Çözüm aşamasındaki bildirimler</div>
            </div>

            <!-- Aktif Vardiya Nöbetçisi -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Aktif Nöbetçi</div>
                <div class="text-sm font-bold text-brandYellow mt-2.5 truncate">${activeOnDuty.name || 'Belirlenmedi'}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium uppercase truncate">${shiftType === 'gunduz' ? 'Gündüz Vardiyası' : 'Gece Vardiyası'}</div>
            </div>

            <!-- Kontrol Raporu Durumu -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Vardiya Raporu</div>
                <div class="mt-2.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${checklistBadgeClass}">
                        ${checklistStatus}
                    </span>
                </div>
                <div class="text-[9.5px] text-neutral-600 font-medium truncate">Son kontrol listesi verisi</div>
            </div>
        `;
        main.appendChild(statGrid);

        // Grafik Paneli
        const chartsRow = document.createElement("div");
        chartsRow.className = "grid grid-cols-1 lg:grid-cols-2 gap-6 w-full no-print";
        chartsRow.innerHTML = `
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Görev Durum Dağılımı</h3>
                <div class="relative h-[220px] flex items-center justify-center">
                    <canvas id="taskStatusChart"></canvas>
                </div>
            </div>
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Açık / Çözülen Arızalar</h3>
                <div class="relative h-[220px] flex items-center justify-center">
                    <canvas id="issueStatusChart"></canvas>
                </div>
            </div>
        `;
        main.appendChild(chartsRow);

        // İki Sütunlu Detay Alanı
        const detailGrid = document.createElement("div");
        detailGrid.className = "grid grid-cols-1 lg:grid-cols-2 gap-6 w-full";

        // Sütun 1: Son Görevler & Sorunlar
        const leftCol = document.createElement("div");
        leftCol.className = "space-y-4";
        
        let gorevlerHtml = '';
        const recentTasks = Object.keys(allGorevler)
            .map(k => ({ id: k, ...allGorevler[k] }))
            .sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi))
            .slice(0, 3);

        if (recentTasks.length === 0) {
            gorevlerHtml = `<div class="py-4 text-center text-xs text-neutral-650 italic">Kayıtlı görev bulunmuyor.</div>`;
        } else {
            recentTasks.forEach(task => {
                let badgeClass = "border-neutral-900 text-neutral-500 bg-neutral-950";
                let statusLabel = "Beklemede";
                if (task.durum === 'yapiliyor') {
                    badgeClass = "border-brandYellow/15 text-brandYellow bg-neutral-950";
                    statusLabel = "Yapılıyor";
                } else if (task.durum === 'onayda') {
                    badgeClass = "border-brandOrange/15 text-brandOrange bg-neutral-950";
                    statusLabel = "Onay Bekliyor";
                } else if (task.durum === 'tamamlandi') {
                    badgeClass = "border-emerald-900/20 text-emerald-450 bg-neutral-950";
                    statusLabel = "Çözüldü";
                }

                gorevlerHtml += `
                    <div class="flex items-center justify-between py-2 border-b border-neutral-900/60 gap-4">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs font-bold text-white truncate">${task.baslik}</h4>
                            <p class="text-[10px] text-neutral-650 mt-0.5">Atanan: ${task.atananPersonelIsim}</p>
                        </div>
                        <span class="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${badgeClass}">${statusLabel}</span>
                    </div>
                `;
            });
        }

        let sorunlarHtml = '';
        const recentIssues = Object.keys(allSorunlar)
            .map(k => ({ id: k, ...allSorunlar[k] }))
            .sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi))
            .slice(0, 3);

        if (recentIssues.length === 0) {
            sorunlarHtml = `<div class="py-4 text-center text-xs text-neutral-650 italic">Bildirilmiş aktif sorun bulunmuyor.</div>`;
        } else {
            recentIssues.forEach(issue => {
                let statusColor = "text-neutral-550";
                let statusText = "Beklemede";
                if (issue.durum === 'yapiliyor') {
                    statusColor = "text-brandYellow";
                    statusText = "Çalışılıyor";
                } else if (issue.durum === 'tamamlandi') {
                    statusColor = "text-emerald-450";
                    statusText = "Çözüldü";
                } else if (issue.durum === 'iptal') {
                    statusColor = "text-red-500 line-through";
                    statusText = "İptal Edildi";
                }

                sorunlarHtml += `
                    <div class="flex items-center justify-between py-2 border-b border-neutral-900/60 gap-4">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs font-bold text-white truncate">${issue.baslik}</h4>
                            <p class="text-[10px] text-neutral-650 mt-0.5">Bildiren: ${issue.olusturanIsim}</p>
                        </div>
                        <span class="text-[9px] font-bold ${statusColor} shrink-0">${statusText}</span>
                    </div>
                `;
            });
        }

        leftCol.innerHTML = `
            <!-- Son Görevler -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Son Görevler</h3>
                <div class="divide-y divide-neutral-900/40">
                    ${gorevlerHtml}
                </div>
            </div>

            <!-- Son Arızalar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Son Arıza Bildirimleri</h3>
                <div class="divide-y divide-neutral-900/40">
                    ${sorunlarHtml}
                </div>
            </div>
        `;
        detailGrid.appendChild(leftCol);

        // Sütun 2: Son Kontrol Raporları & Hızlı Kısayollar
        const rightCol = document.createElement("div");
        rightCol.className = "space-y-4";

        let raporlarHtml = '';
        const recentReports = Object.keys(allResponses)
            .map(k => ({ id: k, ...allResponses[k] }))
            .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
            .slice(0, 3);

        if (recentReports.length === 0) {
            raporlarHtml = `<div class="py-8 text-center text-xs text-neutral-650 italic select-none">Gönderilmiş kontrol raporu bulunmuyor.</div>`;
        } else {
            recentReports.forEach(rep => {
                const repDate = new Date(rep.tarih);
                const timeStr = repDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                
                const isAuto = rep.otomatik === true;
                const badge = isAuto 
                    ? `<span class="bg-neutral-950 border border-amber-900/40 text-amber-500 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase shrink-0">Otomatik</span>`
                    : `<span class="bg-neutral-950 border border-brandOrange/25 text-brandOrange font-bold px-1.5 py-0.5 rounded text-[8px] uppercase shrink-0">Personel</span>`;

                let shiftLabel = '';
                if (rep.shiftDate && rep.shiftType) {
                    const [y, m, d] = rep.shiftDate.split('-');
                    const sType = rep.shiftType === 'gunduz' ? 'Gündüz' : 'Gece';
                    shiftLabel = `${d}.${m}.${y} - ${sType}`;
                } else {
                    shiftLabel = repDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }

                // Evet/Hayır oranları
                const answers = Object.keys(rep.cevaplar || {}).map(k => rep.cevaplar[k].deger || rep.cevaplar[k]);
                const evetCount = answers.filter(a => a === 'evet').length;
                const hayirCount = answers.filter(a => a === 'hayir').length;

                raporlarHtml += `
                    <div class="flex items-center justify-between py-2.5 border-b border-neutral-900/60 gap-4">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs font-bold text-white truncate">${rep.personelIsim}</h4>
                            <div class="flex items-center space-x-2 mt-1">
                                ${badge}
                                <span class="text-[10px] text-neutral-600 font-semibold">${shiftLabel}</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-[10px] font-mono text-neutral-450">${timeStr}</div>
                            <div class="text-[9px] text-neutral-600 font-bold mt-0.5">E: ${evetCount} / H: ${hayirCount}</div>
                        </div>
                    </div>
                `;
            });
        }

        rightCol.innerHTML = `
            <!-- Son Raporlar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Son Kontrol Raporları</h3>
                <div class="divide-y divide-neutral-900/40">
                    ${raporlarHtml}
                </div>
            </div>

            <!-- Hızlı Kısayollar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3 select-none">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 pb-2 border-b border-neutral-900">Hızlı İşlemler</h3>
                <div class="grid grid-cols-2 gap-3 pt-1">
                    <a href="./gorevler.html" class="flex items-center space-x-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 p-3 rounded-lg transition-colors cursor-pointer">
                        <div class="p-1.5 rounded bg-brandOrange/10 text-brandOrange shrink-0">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <span class="text-xs font-bold text-neutral-300">Yeni Görev</span>
                    </a>

                    <a href="./nobet-listesi.html" class="flex items-center space-x-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 p-3 rounded-lg transition-colors cursor-pointer">
                        <div class="p-1.5 rounded bg-brandYellow/10 text-brandYellow shrink-0">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span class="text-xs font-bold text-neutral-300">Nöbet Yönet</span>
                    </a>

                    <a href="./personeller.html" class="flex items-center space-x-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 p-3 rounded-lg transition-colors cursor-pointer col-span-2">
                        <div class="p-1.5 rounded bg-blue-500/10 text-blue-400 shrink-0">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <span class="text-xs font-bold text-neutral-300">Personeller & Siciller</span>
                    </a>
                </div>
            </div>
        `;
        detailGrid.appendChild(rightCol);
        main.appendChild(detailGrid);
        loadAndRenderCharts(true);
    }

    // ==========================================
    // PERSONEL DASHBOARD GÖRÜNÜMÜ
    // ==========================================
    function renderPersonelDashboard() {
        const { shiftDateStr, shiftType } = getCurrentShiftInfo();
        const activeOnDuty = getActiveOnDutyWorker(shiftDateStr, shiftType);

        // Kişisel Metrik Hesaplamaları
        const myTasks = Object.keys(allGorevler)
            .map(k => ({ id: k, ...allGorevler[k] }))
            .filter(t => t.atananPersonelId === loggedInUser.uid);
        const myActiveTasksCount = myTasks.filter(t => t.durum === 'beklemede' || t.durum === 'yapiliyor' || t.durum === 'onayda').length;

        const myIssues = Object.keys(allSorunlar)
            .map(k => ({ id: k, ...allSorunlar[k] }))
            .filter(i => i.olusturanId === loggedInUser.uid);
        const myActiveIssuesCount = myIssues.filter(i => i.durum === 'beklemede' || i.durum === 'yapiliyor').length;

        // Bir sonraki nöbet
        const myNextShift = getNextShiftForUser(loggedInUser.uid);

        // İstatistik Grid
        const statGrid = document.createElement("div");
        statGrid.className = "grid grid-cols-1 sm:grid-cols-3 gap-4 w-full select-none";
        statGrid.innerHTML = `
            <!-- Kişisel Görevler -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Aktif Görevlerim</div>
                <div class="text-3xl font-black text-white mt-1.5">${myActiveTasksCount}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium">Bana atanan aktif sorumluluklar</div>
            </div>

            <!-- Kişisel Arızalar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Kendi Bildirimlerim</div>
                <div class="text-3xl font-black text-brandOrange mt-1.5">${myActiveIssuesCount}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium">Bildirdiğim açık sorunlarım</div>
            </div>

            <!-- Sonraki Nöbetim -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition-colors flex flex-col justify-between h-28 relative overflow-hidden group">
                <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Sıradaki Nöbetim</div>
                <div class="text-sm font-bold text-brandYellow mt-2.5 truncate">${myNextShift}</div>
                <div class="text-[9.5px] text-neutral-600 font-medium">Takvimdeki planlı sıram</div>
            </div>
        `;
        main.appendChild(statGrid);

        // Kişisel Grafik Paneli
        const chartsRow = document.createElement("div");
        chartsRow.className = "w-full bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3 no-print";
        chartsRow.innerHTML = `
            <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Kişisel Görev Durum Dağılımı</h3>
            <div class="relative h-[220px] flex items-center justify-center">
                <canvas id="personalTaskChart"></canvas>
            </div>
        `;
        main.appendChild(chartsRow);

        // İki Sütunlu Detay Alanı
        const detailGrid = document.createElement("div");
        detailGrid.className = "grid grid-cols-1 lg:grid-cols-2 gap-6 w-full";

        // Sütun 1: Benim Görevlerim
        const myTasksCol = document.createElement("div");
        myTasksCol.className = "space-y-4";

        let myTasksHtml = '';
        const myRecentTasks = myTasks
            .sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi))
            .slice(0, 4);

        if (myRecentTasks.length === 0) {
            myTasksHtml = `<div class="py-6 text-center text-xs text-neutral-650 italic">Size atanmış aktif görev bulunmuyor.</div>`;
        } else {
            myRecentTasks.forEach(task => {
                let badgeClass = "border-neutral-900 text-neutral-500 bg-neutral-950";
                let statusLabel = "Beklemede";
                if (task.durum === 'yapiliyor') {
                    badgeClass = "border-brandYellow/15 text-brandYellow bg-neutral-950";
                    statusLabel = "Yapılıyor";
                } else if (task.durum === 'onayda') {
                    badgeClass = "border-brandOrange/15 text-brandOrange bg-neutral-950";
                    statusLabel = "Onay Bekliyor";
                } else if (task.durum === 'tamamlandi') {
                    badgeClass = "border-emerald-900/20 text-emerald-450 bg-neutral-950";
                    statusLabel = "Çözüldü";
                }

                myTasksHtml += `
                    <div class="flex items-center justify-between py-2 border-b border-neutral-900/60 gap-4">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs font-bold text-white truncate">${task.baslik}</h4>
                            <p class="text-[10px] text-neutral-650 mt-0.5">${task.aciklama || 'Detay belirtilmemiş.'}</p>
                        </div>
                        <span class="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${badgeClass}">${statusLabel}</span>
                    </div>
                `;
            });
        }

        myTasksCol.innerHTML = `
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Bana Atanan Görevler</h3>
                <div class="divide-y divide-neutral-900/40">
                    ${myTasksHtml}
                </div>
            </div>
        `;
        detailGrid.appendChild(myTasksCol);

        // Sütun 2: Son Bildirdiğim Sorunlar & Hızlı Erişim
        const myIssuesCol = document.createElement("div");
        myIssuesCol.className = "space-y-4";

        let myIssuesHtml = '';
        const myRecentIssues = myIssues
            .sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi))
            .slice(0, 3);

        if (myRecentIssues.length === 0) {
            myIssuesHtml = `<div class="py-6 text-center text-xs text-neutral-650 italic">Bildirdiğiniz herhangi bir sorun bulunmuyor.</div>`;
        } else {
            myRecentIssues.forEach(issue => {
                let statusColor = "text-neutral-555";
                let statusText = "Beklemede";
                if (issue.durum === 'yapiliyor') {
                    statusColor = "text-brandYellow";
                    statusText = "Çalışılıyor";
                } else if (issue.durum === 'tamamlandi') {
                    statusColor = "text-emerald-450";
                    statusText = "Çözüldü";
                } else if (issue.durum === 'iptal') {
                    statusColor = "text-red-500 line-through";
                    statusText = "İptal";
                }

                myIssuesHtml += `
                    <div class="flex items-center justify-between py-2 border-b border-neutral-900/60 gap-4">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs font-bold text-white truncate">${issue.baslik}</h4>
                            <p class="text-[10px] text-neutral-650 mt-0.5">Öncelik: <span class="uppercase font-semibold text-neutral-500">${issue.oncelik}</span></p>
                        </div>
                        <span class="text-[9px] font-bold ${statusColor} shrink-0">${statusText}</span>
                    </div>
                `;
            });
        }

        myIssuesCol.innerHTML = `
            <!-- Son Bildirilen Sorunlar -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 select-none pb-2 border-b border-neutral-900">Bildirdiğim Sorunlar</h3>
                <div class="divide-y divide-neutral-900/40">
                    ${myIssuesHtml}
                </div>
            </div>

            <!-- Hızlı Erişim Kısayolları -->
            <div class="bg-black border border-neutral-900 rounded-xl p-5 shadow-sm space-y-3 select-none">
                <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 pb-2 border-b border-neutral-900">Hızlı İşlemler</h3>
                <div class="grid grid-cols-2 gap-3 pt-1">
                    <a href="./kontrol-listesi.html" class="flex items-center space-x-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 p-3 rounded-lg transition-colors cursor-pointer">
                        <div class="p-1.5 rounded bg-brandOrange/10 text-brandOrange shrink-0">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span class="text-xs font-bold text-neutral-300">Kontrol Listesi</span>
                    </a>

                    <a href="./sorunlar.html" class="flex items-center space-x-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 p-3 rounded-lg transition-colors cursor-pointer">
                        <div class="p-1.5 rounded bg-red-500/10 text-red-400 shrink-0">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <span class="text-xs font-bold text-neutral-300">Sorun Bildir</span>
                    </a>
                </div>
            </div>
        `;
        detailGrid.appendChild(myIssuesCol);
        main.appendChild(detailGrid);
        loadAndRenderCharts(false);
    }

    // Chart.js CDN kütüphanesini dinamik olarak yükle ve grafikleri çizdir
    function loadAndRenderCharts(isYonetici) {
        if (typeof Chart === "undefined") {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/chart.js";
            script.onload = () => {
                if (isYonetici) drawYoneticiCharts();
                else drawPersonelCharts();
            };
            document.head.appendChild(script);
        } else {
            if (isYonetici) drawYoneticiCharts();
            else drawPersonelCharts();
        }
    }

    function drawYoneticiCharts() {
        let beklemedeTasks = 0;
        let yapiliyorTasks = 0;
        let onaydaTasks = 0;
        let tamamlandiTasks = 0;
        Object.values(allGorevler).forEach(t => {
            if (t.durum === 'beklemede') beklemedeTasks++;
            else if (t.durum === 'yapiliyor') yapiliyorTasks++;
            else if (t.durum === 'onayda') onaydaTasks++;
            else if (t.durum === 'tamamlandi') tamamlandiTasks++;
        });

        let beklemedeIssues = 0;
        let yapiliyorIssues = 0;
        let tamamlandiIssues = 0;
        Object.values(allSorunlar).forEach(i => {
            if (i.durum === 'beklemede') beklemedeIssues++;
            else if (i.durum === 'yapiliyor') yapiliyorIssues++;
            else if (i.durum === 'tamamlandi') tamamlandiIssues++;
        });

        const ctx1 = document.getElementById('taskStatusChart');
        if (ctx1) {
            new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['Beklemede', 'Yapılıyor', 'Onay Bekliyor', 'Tamamlandı'],
                    datasets: [{
                        data: [beklemedeTasks, yapiliyorTasks, onaydaTasks, tamamlandiTasks],
                        backgroundColor: ['#4b5563', '#FFD600', '#FF6B00', '#10b981'],
                        borderColor: '#000000',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#a3a3a3',
                                font: { size: 10, weight: 'bold' }
                            }
                        }
                    }
                }
            });
        }

        const ctx2 = document.getElementById('issueStatusChart');
        if (ctx2) {
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['Beklemede', 'Çalışılıyor', 'Çözüldü'],
                    datasets: [{
                        label: 'Arıza Sayısı',
                        data: [beklemedeIssues, yapiliyorIssues, tamamlandiIssues],
                        backgroundColor: ['#ef4444', '#FFD600', '#10b981'],
                        borderColor: '#000000',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#a3a3a3', font: { size: 9, weight: 'bold' } }
                        },
                        y: {
                            grid: { color: '#1e1e1e' },
                            ticks: { color: '#a3a3a3', font: { size: 9 }, stepSize: 1 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }

    function drawPersonelCharts() {
        let beklemedeTasks = 0;
        let yapiliyorTasks = 0;
        let onaydaTasks = 0;
        let tamamlandiTasks = 0;

        const myTasks = Object.values(allGorevler).filter(t => t.atananPersonelId === loggedInUser.uid);
        myTasks.forEach(t => {
            if (t.durum === 'beklemede') beklemedeTasks++;
            else if (t.durum === 'yapiliyor') yapiliyorTasks++;
            else if (t.durum === 'onayda') onaydaTasks++;
            else if (t.durum === 'tamamlandi') tamamlandiTasks++;
        });

        const ctx = document.getElementById('personalTaskChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Beklemede', 'Yapılıyor', 'Onay Bekliyor', 'Tamamlandı'],
                    datasets: [{
                        data: [beklemedeTasks, yapiliyorTasks, onaydaTasks, tamamlandiTasks],
                        backgroundColor: ['#4b5563', '#FFD600', '#FF6B00', '#10b981'],
                        borderColor: '#000000',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#a3a3a3',
                                font: { size: 10, weight: 'bold' }
                            }
                        }
                    }
                }
            });
        }
    }

    // Realtime Database Listeners
    onValue(ref(db, 'personeller'), (snapshot) => {
        allPersoneller = snapshot.val() || {};
        renderDashboard();
    });

    onValue(ref(db, 'gorevler'), (snapshot) => {
        allGorevler = snapshot.val() || {};
        renderDashboard();
    });

    onValue(ref(db, 'sorunlar'), (snapshot) => {
        allSorunlar = snapshot.val() || {};
        renderDashboard();
    });

    onValue(ref(db, 'nobet_listeleri'), (snapshot) => {
        allShifts = snapshot.val() || {};
        renderDashboard();
    });

    onValue(ref(db, 'nobet_izinleri'), (snapshot) => {
        activeLeaves = snapshot.val() || {};
        renderDashboard();
    });

    onValue(ref(db, 'kontrol_cevaplari'), (snapshot) => {
        allResponses = snapshot.val() || {};
        renderDashboard();
    });
}
