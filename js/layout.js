document.addEventListener("DOMContentLoaded", () => {
    // Global minimalist kaydırma çubuğu (scrollbar) stillerini enjekte et
    const scrollStyle = document.createElement("style");
    scrollStyle.textContent = `
        /* Webkit Tarayıcılar (Chrome, Safari, Edge) */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #262626;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #404040;
        }
        /* Firefox */
        * {
            scrollbar-width: thin;
            scrollbar-color: #262626 transparent;
        }
    `;
    document.head.appendChild(scrollStyle);

    const main = document.querySelector("main");
    if (!main) return;

    // Aktif sayfayı belirleme (sol menüde aktif sınıfı vermek için)
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 1. Oturum Kontrolü
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    // Giriş sayfasında (index.html) eğer giriş yapılmamışsa ortak layout'u yükleme
    if ((currentPage === "index.html" || currentPage === "") && !loggedInUser) {
        return;
    }

    // Eğer giriş yapılmamışsa ve başka sayfadaysak giriş sayfasına yönlendir
    if (currentPage !== "index.html" && currentPage !== "" && !loggedInUser) {
        window.location.href = "./index.html";
        return;
    }

    // Yetki Kontrolü: Normal personel "personeller.html" sayfasına erişemez!
    if (currentPage === "personeller.html" && loggedInUser?.rol !== "yonetici") {
        window.location.href = "./index.html";
        return;
    }

    // 2. Ana sarmalayıcıyı (wrapper) oluştur
    const wrapper = document.createElement("div");
    wrapper.className = "w-full min-w-[320px] max-w-[1440px] min-h-screen flex relative bg-neutral-950 overflow-hidden";

    // 3. Mobil menü arkalığını (overlay) oluştur
    const overlay = document.createElement("div");
    overlay.id = "sidebar-overlay";
    overlay.className = "fixed inset-0 bg-black/60 z-40 hidden md:hidden transition-opacity duration-300";
    wrapper.appendChild(overlay);

    // 4. Sol menüyü (sidebar) oluştur
    const sidebar = document.createElement("aside");
    sidebar.id = "sidebar";
    sidebar.className = "fixed md:relative inset-y-0 left-0 z-50 w-64 bg-black border-r border-neutral-900 flex flex-col transition-all duration-300 ease-in-out transform -translate-x-full md:translate-x-0";

    // Sol menü başlığı
    const sidebarHeader = document.createElement("div");
    sidebarHeader.className = "h-14 flex items-center justify-between px-6 border-b border-neutral-900";
    sidebarHeader.innerHTML = `
        <span class="text-xl font-bold tracking-wider text-white">PROTOKOL</span>
        <button id="sidebar-close" class="md:hidden text-neutral-400 hover:text-white focus:outline-none transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    sidebar.appendChild(sidebarHeader);

    // Sol menü navigasyon alanı
    const nav = document.createElement("nav");
    nav.className = "flex-1 px-4 py-6 space-y-2 overflow-y-auto";

    const menuItems = [
        {
            name: "Ana Sayfa",
            path: "index.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>`
        },
        {
            name: "Görevler",
            path: "gorevler.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>`
        },
        {
            name: "Sorunlar",
            path: "sorunlar.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>`
        }
    ];

    // Personeller menüsünü sadece Yöneticiler görebilir
    if (loggedInUser && loggedInUser.rol === 'yonetici') {
        menuItems.push({
            name: "Personeller",
            path: "personeller.html",
            icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>`
        });
    }

    menuItems.forEach(item => {
        const link = document.createElement("a");
        link.href = `./${item.path}`;
        
        const isActive = currentPage === item.path || (currentPage === "" && item.path === "index.html");
        
        if (isActive) {
            link.className = "flex items-center space-x-3 px-4 py-2.5 rounded-md bg-neutral-900 text-white font-medium transition-all";
            link.innerHTML = `
                <div class="text-white">${item.icon}</div>
                <span>${item.name}</span>
            `;
        } else {
            link.className = "flex items-center space-x-3 px-4 py-2.5 rounded-md text-neutral-500 font-medium transition-all hover:bg-neutral-900/40 hover:text-neutral-300";
            link.innerHTML = `
                <div class="text-neutral-600">${item.icon}</div>
                <span>${item.name}</span>
            `;
        }
        nav.appendChild(link);
    });
    sidebar.appendChild(nav);

    // Sol menü alt bilgi (Çıkış Butonu dahil)
    const sidebarFooter = document.createElement("div");
    sidebarFooter.className = "p-4 border-t border-neutral-900 flex items-center justify-between";
    sidebarFooter.innerHTML = `
        <span class="text-xs text-neutral-500">v1.0.0</span>
        <button id="logout-btn" class="flex items-center space-x-1.5 text-xs text-red-500 hover:text-red-400 font-semibold transition-colors cursor-pointer focus:outline-none">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Çıkış</span>
        </button>
    `;
    sidebar.appendChild(sidebarFooter);

    wrapper.appendChild(sidebar);

    // 5. Sağ taraftaki içerik alanını (content area) oluştur
    const contentArea = document.createElement("div");
    contentArea.className = "flex-1 flex flex-col min-h-screen";

    // Üst Navbar (Header)
    const header = document.createElement("header");
    header.className = "h-14 border-b border-neutral-900 bg-black flex items-center px-4 md:px-6 justify-between";
    header.innerHTML = `
        <button id="sidebar-toggle" class="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 focus:outline-none transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
        <div class="flex items-center space-x-2">
            <span class="text-sm font-semibold text-brandYellow">Protokol Arayüzü</span>
        </div>
    `;
    contentArea.appendChild(header);

    // 6. Orijinal <main> içeriğini yeni içerik alanının altına taşı
    contentArea.appendChild(main);
    wrapper.appendChild(contentArea);

    // 7. Hazırlanan tüm yapıyı body içerisine yerleştir
    document.body.innerHTML = "";
    document.body.appendChild(wrapper);

    // 8. Olay Dinleyicileri (Sidebar Toggle & Logout)
    initializeSidebarToggle();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.href = './index.html';
        });
    }
});

function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (window.innerWidth >= 768) {
            sidebar.classList.toggle('md:-ml-64');
        } else {
            sidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
        }
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    });
}

// --- Küresel Toast ve Alert Arayüzleri ---

// 1. Toast Bildirim Fonksiyonu
window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = "fixed bottom-5 right-5 z-[200] flex flex-col space-y-3 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = "flex items-center space-x-3 bg-black border border-neutral-800 rounded-xl px-4 py-3 shadow-2xl text-xs md:text-sm text-white transform translate-y-10 opacity-0 transition-all duration-300 max-w-sm pointer-events-auto select-none";

    let borderClass = 'border-l-4 border-l-brandOrange';
    let iconColor = 'text-brandOrange';
    let svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`; // Onay işareti

    if (type === 'error') {
        borderClass = 'border-l-4 border-l-red-600';
        iconColor = 'text-red-500';
        svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />`; // Hata işareti
    } else if (type === 'warning') {
        borderClass = 'border-l-4 border-l-brandYellow';
        iconColor = 'text-brandYellow';
        svgPath = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`; // Uyarı işareti
    }

    toast.className += ` ${borderClass}`;
    toast.innerHTML = `
        <svg class="h-5 w-5 ${iconColor} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            ${svgPath}
        </svg>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    // Animasyonla içeri kaydır
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 50);

    // 4 saniye sonra otomatik temizle
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
};

// 2. Özel Alert/Confirm Modal Fonksiyonu (Promise tabanlı)
window.showAlert = (title, message, isConfirm = false) => {
    return new Promise((resolve) => {
        // Arkalık katmanı
        const backdrop = document.createElement('div');
        backdrop.className = "fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 transition-opacity duration-300 opacity-0";
        
        // Modal kartı
        const modal = document.createElement('div');
        modal.className = "w-full max-w-sm bg-black border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center transform scale-95 transition-all duration-300 opacity-0 select-none";
        
        modal.innerHTML = `
            <h3 class="text-lg font-bold text-white mb-2">${title}</h3>
            <p class="text-xs md:text-sm text-neutral-400 mb-6 leading-relaxed">${message}</p>
            <div class="flex justify-center space-x-3">
                ${isConfirm ? `
                    <button id="alert-cancel" class="px-5 py-2.5 border border-neutral-800 hover:bg-neutral-900 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer">İptal</button>
                ` : ''}
                <button id="alert-ok" class="px-6 py-2.5 bg-brandOrange hover:bg-orange-600 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer">Tamam</button>
            </div>
        `;
        
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        
        // Giriş animasyonları
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
        }, 50);
        
        // Kapatma fonksiyonu
        const closeModal = (result) => {
            backdrop.classList.add('opacity-0');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 300);
        };
        
        modal.querySelector('#alert-ok').addEventListener('click', () => closeModal(true));
        if (isConfirm) {
            modal.querySelector('#alert-cancel').addEventListener('click', () => closeModal(false));
        }
    });
};
