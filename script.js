// =================================================================================
// KONFIGURATION & INITIALE DATEN
// =================================================================================

// *** HIER DEINE GIST-IDs EINTRAGEN ***
const GIST_ID_DEFAULT = '73f61002574be57ec1dacb473046ae48'; // Für die Hauptversion
const GIST_ID_FX = '753ec1f447c375c9a96c05feb66c05a6'; // Für die /fx Version

// Automatische Erkennung der Version
const isFxVersion = window.location.pathname.includes('/fx');
const STORAGE_PREFIX = isFxVersion ? 'w3pt_fx_' : 'w3pt_default_';
const GIST_ID_CURRENT = isFxVersion ? GIST_ID_FX : GIST_ID_DEFAULT;

const DEFAULT_PLATFORMS = [
    { name: 'Binance', icon: '🛏️', type: 'Exchange', category: 'Exchange', tags: ['high-volume', 'spot'] },
    { name: 'Coinbase', icon: '🪙', type: 'Exchange', category: 'Exchange', tags: ['regulated', 'beginner'] },
    { name: 'Kraken', icon: '🦑', type: 'Exchange', category: 'Exchange', tags: ['secure', 'staking'] },
    { name: 'Bybit', icon: '🅱️', type: 'Exchange', category: 'Exchange', tags: ['derivatives', 'high-risk'] },
    { name: 'OKX', icon: '⭕', type: 'Exchange', category: 'Exchange', tags: ['web3', 'defi'] },
    { name: 'Gate.io', icon: '🚪', type: 'Exchange', category: 'Exchange', tags: ['altcoins'] },
    { name: 'KuCoin', icon: '🪙', type: 'Exchange', category: 'Exchange', tags: ['altcoins', 'bots'] },
    { name: 'Bitget', icon: '🎯', type: 'Exchange', category: 'Exchange', tags: ['copy-trading'] },
    { name: 'Debank', icon: '📊', type: 'Portfolio', category: 'DeFi', tags: ['tracking', 'defi'] },
    { name: 'Uniswap', icon: '🦄', type: 'DEX', category: 'DeFi', tags: ['defi', 'ethereum'] },
    { name: 'PancakeSwap', icon: '🥞', type: 'DEX', category: 'DeFi', tags: ['defi', 'bsc'] },
    { name: 'SushiSwap', icon: '🍣', type: 'DEX', category: 'DeFi', tags: ['defi', 'multichain'] },
    { name: 'Curve', icon: '〰️', type: 'DEX', category: 'DeFi', tags: ['defi', 'stable'] },
    { name: 'Aave', icon: '👻', type: 'Lending', category: 'Lending', tags: ['lending', 'defi'] },
    { name: 'Compound', icon: '💸', type: 'Lending', category: 'Lending', tags: ['lending', 'defi'] },
    { name: 'MakerDAO', icon: '🔷', type: 'Lending', category: 'Lending', tags: ['lending', 'stable'] },
    { name: 'Hyperliquid', icon: '💧', type: 'Perps', category: 'DeFi', tags: ['high-risk', 'derivatives'] },
    { name: 'GMX', icon: '🎮', type: 'Perps', category: 'DeFi', tags: ['high-risk', 'derivatives'] },
    { name: 'dYdX', icon: '🔺', type: 'Perps', category: 'DeFi', tags: ['derivatives', 'layer2'] },
    { name: 'Lido', icon: '🌊', type: 'Staking', category: 'Staking', tags: ['staking', 'ethereum'] },
    { name: 'Rocket Pool', icon: '🚀', type: 'Staking', category: 'Staking', tags: ['staking', 'decentralized'] },
    { name: 'Arbitrum', icon: '🔵', type: 'Layer 2', category: 'Layer2', tags: ['layer2', 'ethereum'] },
    { name: 'Optimism', icon: '🔴', type: 'Layer 2', category: 'Layer2', tags: ['layer2', 'ethereum'] },
    { name: 'Polygon', icon: '🟣', type: 'Layer 2', category: 'Layer2', tags: ['layer2', 'sidechain'] },
    { name: 'MetaMask', icon: '🦊', type: 'Wallet', category: 'Wallet', tags: ['wallet', 'hot-wallet'] },
    { name: 'Trust Wallet', icon: '🛡️', type: 'Wallet', category: 'Wallet', tags: ['wallet', 'mobile'] },
    { name: 'Ledger', icon: '🔒', type: 'Hardware', category: 'Wallet', tags: ['wallet', 'cold-storage'] },
];
const GITHUB_API = 'https://api.github.com';

// =================================================================================
// GLOBALE VARIABLEN
// =================================================================================
let platforms = [];
let entries = [];
let cashflows = [];
let filteredEntries = [];
let filteredCashflows = [];
let selectedPlatforms = [];
let multiSelectStartIndex = -1;
let selectedHistoryEntries = new Set();
let lastSelectedHistoryRow = null;
let favorites = [];
let portfolioChart, allocationChart;
let historySort = { key: 'date', order: 'desc' };
let cashflowSort = { key: 'date', order: 'desc' };
let platformDetailsSort = { key: 'platform', order: 'asc' };
let promptResolve = null;
let currentTheme = 'light';
let activeCategory = 'all';
let currentTab = 'dashboard';
let searchTerm = '';
let isCompactMode = false;
let touchStartX = 0;
let touchStartY = 0;
let isPulling = false;
let autocompleteIndex = -1;
let autocompleteItems = [];
let biometricEnabled = false;
let quickActionsVisible = false;

// GITHUB SYNC VARIABLEN
let githubToken = null;
let gistId = GIST_ID_CURRENT; 
let syncInProgress = false;
let autoSyncTimeout = null;
let lastSyncTime = null;
let syncStatus = 'offline';

// =================================================================================
// INITIALISIERUNG
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    Chart.register(ChartDataLabels);

    if (isMobileDevice()) {
        checkBiometricAuth();
    }
    loadGitHubConfig();
    loadData();
    loadTheme();
    setToToday();
    setDateFilter('all'); 
    document.getElementById('dateFilterBar').classList.add('collapsed');
    renderPlatformButtons();
    initializeCharts();
    addEventListeners();
    setupBottomSheet();
    setupKeyboardShortcuts();
    setupTouchGestures();
    setupAutocomplete();
    setupQuickActions();
    updateCashflowTargets();
    checkConnectionOnStartup();
    registerServiceWorker();
    
    applyDashboardWidgetOrder();
    initializeDragAndDrop();
});

function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// =================================================================================
// DRAG & DROP FUNKTIONEN
// =================================================================================
function initializeDragAndDrop() {
    const sortableOptions = {
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 200,
        delayOnTouchOnly: true,
        touchStartThreshold: 10, 
    };

    const dashboardEl = document.getElementById('dashboardContent');
    if (dashboardEl) {
        new Sortable(dashboardEl, {
            ...sortableOptions,
            onEnd: (evt) => {
                const newOrder = [...dashboardEl.children].map(el => el.id);
                localStorage.setItem(`${STORAGE_PREFIX}dashboardWidgetOrder`, JSON.stringify(newOrder));
            }
        });
    }

    const favoritesGridEl = document.getElementById('favoritesGrid');
    const platformGridEl = document.getElementById('platformGrid');

    if (favoritesGridEl && platformGridEl) {
        new Sortable(favoritesGridEl, {
            ...sortableOptions,
            group: 'platforms',
            onAdd: (evt) => {
                const platformName = evt.item.dataset.platform;
                if (!favorites.includes(platformName)) {
                    favorites.push(platformName);
                    saveData();
                    renderPlatformButtons();
                }
            },
            onEnd: (evt) => {
                const newFavoritesOrder = [...favoritesGridEl.children].map(el => el.dataset.platform);
                favorites = newFavoritesOrder;
                saveData();
            }
        });

        new Sortable(platformGridEl, {
            ...sortableOptions,
            group: 'platforms',
            onAdd: (evt) => {
                const platformName = evt.item.dataset.platform;
                favorites = favorites.filter(f => f !== platformName);
                saveData();
                renderPlatformButtons();
            },
            onEnd: (evt) => {
                const newPlatformOrder = [...platformGridEl.children].map(el => el.dataset.platform).filter(p => p);
                
                const favoritePlatforms = platforms.filter(p => favorites.includes(p.name));
                const nonFavoritePlatforms = platforms.filter(p => !favorites.includes(p.name));

                nonFavoritePlatforms.sort((a, b) => {
                    return newPlatformOrder.indexOf(a.name) - newPlatformOrder.indexOf(b.name);
                });

                platforms = [...favoritePlatforms, ...nonFavoritePlatforms];
                saveData();
            }
        });
    }
}

function applyDashboardWidgetOrder() {
    const dashboardEl = document.getElementById('dashboardContent');
    const savedOrder = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}dashboardWidgetOrder`));
    
    if (savedOrder && dashboardEl) {
        savedOrder.forEach(widgetId => {
            const widget = document.getElementById(widgetId);
            if (widget) {
                dashboardEl.appendChild(widget);
            }
        });
    }
}


// =================================================================================
// BIOMETRISCHE AUTHENTIFIZIERUNG
// =================================================================================
async function checkBiometricAuth() {
    if (localStorage.getItem(`${STORAGE_PREFIX}biometricEnabled`) !== 'true') {
        return;
    }

    const overlay = document.getElementById('biometricOverlay');
    const appContainer = document.getElementById('appContainer');

    appContainer.classList.add('content-locked');
    overlay.classList.add('visible');

    try {
        if ('credentials' in navigator && 'create' in navigator.credentials) {
            const isAvailable = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: { name: "Portfolio Tracker" },
                    user: { id: new Uint8Array(16), name: "user@portfolio.app", displayName: "Portfolio User" },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                    timeout: 60000,
                    attestation: "direct"
                }
            });
            
            if (isAvailable) {
                overlay.classList.remove('visible');
                appContainer.classList.remove('content-locked');
                showNotification('Biometrische Authentifizierung erfolgreich! 🔐');
            }
        } else {
            overlay.classList.remove('visible');
            appContainer.classList.remove('content-locked');
            showNotification('Biometrische Authentifizierung nicht verfügbar - übersprungen', 'warning');
        }
    } catch (error) {
        console.log('Biometric auth cancelled or failed:', error);
        document.querySelector('#biometricOverlay .biometric-text').textContent = 'Authentifizierung fehlgeschlagen';
        document.querySelector('#biometricOverlay .biometric-subtitle').textContent = 'Bitte laden Sie die Seite neu, um es erneut zu versuchen.';
        document.querySelector('#biometricOverlay .biometric-fallback').style.display = 'none';
    }
}

function bypassBiometric() {
    document.getElementById('biometricOverlay').classList.remove('visible');
    document.getElementById('appContainer').classList.remove('content-locked');
    showNotification('Ohne Authentifizierung fortgefahren', 'warning');
}

function toggleBiometric() {
    const enabled = localStorage.getItem(`${STORAGE_PREFIX}biometricEnabled`) === 'true';
    localStorage.setItem(`${STORAGE_PREFIX}biometricEnabled`, !enabled);
    document.getElementById('biometricToggle').checked = !enabled;
    showNotification(enabled ? 'Biometrische Authentifizierung deaktiviert' : 'Biometrische Authentifizierung beim nächsten Start aktiviert');
}

// =================================================================================
// AUTOCOMPLETE-SYSTEM
// =================================================================================
function setupAutocomplete() {
    const searchInput = document.getElementById('platformSearch');
    const dropdown = document.getElementById('autocompleteDropdown');
    
    searchInput.addEventListener('blur', (e) => {
        setTimeout(() => {
            dropdown.style.display = 'none';
            autocompleteIndex = -1;
        }, 200);
    });
}

function filterPlatforms() {
    searchTerm = document.getElementById('platformSearch').value.toLowerCase();
    updateAutocomplete();
    renderPlatformButtons();
}

function updateAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    const searchValue = document.getElementById('platformSearch').value.toLowerCase();
    
    if (searchValue.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    autocompleteItems = platforms.filter(p => 
        p.name.toLowerCase().includes(searchValue) ||
        (p.type && p.type.toLowerCase().includes(searchValue)) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchValue)))
    ).slice(0, 8);

    if (autocompleteItems.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    dropdown.innerHTML = '';
    autocompleteItems.forEach((platform, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        if (index === autocompleteIndex) item.classList.add('selected');
        
        item.innerHTML = `
            <span style="font-size: 18px;">${platform.icon}</span>
            <div>
                <div style="font-weight: 600;">${platform.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${platform.type}</div>
            </div>
        `;
        
        item.onclick = () => selectAutocompleteItem(platform);
        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function handleSearchKeydown(event) {
    const dropdown = document.getElementById('autocompleteDropdown');
    
    if (dropdown.style.display === 'none') return;

    switch(event.key) {
        case 'ArrowDown':
            event.preventDefault();
            autocompleteIndex = Math.min(autocompleteIndex + 1, autocompleteItems.length - 1);
            updateAutocompleteSelection();
            break;
        case 'ArrowUp':
            event.preventDefault();
            autocompleteIndex = Math.max(autocompleteIndex - 1, -1);
            updateAutocompleteSelection();
            break;
        case 'Enter':
            event.preventDefault();
            if (autocompleteIndex >= 0) {
                selectAutocompleteItem(autocompleteItems[autocompleteIndex]);
            }
            break;
        case 'Escape':
            dropdown.style.display = 'none';
            autocompleteIndex = -1;
            break;
    }
}

function updateAutocompleteSelection() {
    const items = document.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === autocompleteIndex);
    });
}

function selectAutocompleteItem(platform) {
    const searchInput = document.getElementById('platformSearch');
    searchInput.value = platform.name;
    document.getElementById('autocompleteDropdown').style.display = 'none';
    
    const platformBtn = Array.from(document.querySelectorAll('.platform-btn')).find(btn => 
        btn.dataset.platform === platform.name
    );
    if (platformBtn && !platformBtn.classList.contains('selected')) {
        togglePlatform(platformBtn, platform.name);
    }
    
    searchInput.blur();
    showNotification(`${platform.name} ausgewählt!`);
}

// =================================================================================
// EVENT LISTENERS & SHORTCUTS
// =================================================================================
function addEventListeners() {
    document.getElementById('privacyToggle').addEventListener('click', togglePrivacyMode);
    const inputsContainer = document.getElementById('platformInputs');
    if (inputsContainer) {
        inputsContainer.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('input-field') || e.target.classList.contains('note-input')) {
                inputsContainer.classList.add('is-focused');
                document.querySelectorAll('.input-card.card-focused').forEach(card => {
                    card.classList.remove('card-focused');
                });
                const parentCard = e.target.closest('.input-card');
                if (parentCard) {
                    parentCard.classList.add('card-focused');
                }
            }
        });
        
        inputsContainer.addEventListener('focusout', (e) => {
            const parentCard = e.target.closest('.input-card');
            if (parentCard && !parentCard.contains(e.relatedTarget)) {
                parentCard.classList.remove('card-focused');
                inputsContainer.classList.remove('is-focused');
            }
        });
    }
    document.getElementById('platformInputs').addEventListener('keydown', (e) => {
        if (e.target.classList.contains('input-field') && e.key === 'Enter') {
            e.preventDefault();
            saveSingleEntry(e.target);
        }
    });

    document.querySelectorAll('.data-table th.sortable').forEach(th => th.addEventListener('click', handleSort));
    document.getElementById('csvFileInput').addEventListener('change', handleCsvImport);
    document.getElementById('jsonFileInput').addEventListener('change', handleJsonImport);
    document.getElementById('historySearch').addEventListener('input', (e) => updateHistory());
    document.querySelectorAll('input[name="cashflowType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('cashflowTargetDiv').style.display = e.target.value === 'deposit' ? 'block' : 'none';
        });
    });
    document.getElementById('selectAllHistory').addEventListener('change', toggleSelectAllHistory);

    const biometricToggle = document.getElementById('biometricToggle');
    if (biometricToggle) {
        biometricToggle.checked = localStorage.getItem(`${STORAGE_PREFIX}biometricEnabled`) === 'true';
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentTab === 'entry') saveAllEntries();
            else if (currentTab === 'cashflow') saveCashflow();
            else syncNow();
        }
        
        if (e.altKey && e.key >= '1' && e.key <= '6') { 
            e.preventDefault();
            const keyMap = { '1': 'dashboard', '2': 'entry', '3': 'cashflow', '4': 'platforms', '5': 'history', '6': 'settings' };
            if (keyMap[e.key]) switchTab(keyMap[e.key]);
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            toggleTheme();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            if (currentTab === 'entry') {
                document.getElementById('platformSearch')?.focus();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            if (currentTab === 'dashboard') {
                exportChart('portfolioChartContainer');
            } else if (currentTab === 'platforms') {
                exportCSV();
            } else {
                exportPDF();
            }
        }

        if (e.altKey && e.key === 'b') {
            e.preventDefault();
            toggleBiometric();
        }
        
        if (e.altKey && e.key === 'q') {
            e.preventDefault();
            toggleQuickActions();
        }
        
        if (e.key === 'Escape') {
            closeBottomSheet();
        }
    });
}

// =================================================================================
// MOBILE & TOUCH FEATURES
// =================================================================================
function setupTouchGestures() {
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0, pullDistance = 0;
    const pullToRefreshEl = document.getElementById('pullToRefresh');
    
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.data-table-wrapper, .bottom-sheet-body, button, a, .sortable-ghost')) {
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        
        if (window.scrollY === 0 && githubToken && gistId) {
            isPulling = true;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (isPulling && window.scrollY === 0) {
            pullDistance = e.changedTouches[0].screenY - touchStartY;
            if (pullDistance > 0 && pullDistance < 150) {
                pullToRefreshEl.style.top = `${Math.min(pullDistance - 60, 20)}px`;
                pullToRefreshEl.classList.add('pulling');
                if (pullDistance > 80 && navigator.vibrate) navigator.vibrate(30);
                if (pullDistance > 80) pullToRefreshEl.innerHTML = '↻';
            }
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        if (e.target.closest('.data-table-wrapper, .bottom-sheet-body, button, a, .sortable-ghost')) {
            return;
        }
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        
        if (isPulling && pullDistance > 80) {
            pullToRefreshEl.classList.add('refreshing');
            pullToRefreshEl.classList.remove('pulling');
            if (navigator.vibrate) navigator.vibrate(100);
            syncNow().then(() => {
                setTimeout(() => {
                    pullToRefreshEl.classList.remove('refreshing');
                    pullToRefreshEl.style.top = '-60px';
                }, 500);
            });
        } else if (isPulling) {
            pullToRefreshEl.classList.remove('pulling');
            pullToRefreshEl.style.top = '-60px';
        }
        isPulling = false;
        pullDistance = 0;
        
        handleSwipeGesture(touchStartX, touchEndX, touchStartY, touchEndY);
    }, { passive: true });

    let longPressTimer;
    document.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(200);
            toggleQuickActions();
        }, 800);
    });
    
    document.addEventListener('touchend', () => clearTimeout(longPressTimer));
    document.addEventListener('touchmove', () => clearTimeout(longPressTimer));
}

function handleSwipeGesture(startX, endX, startY, endY) {
    const diffX = endX - startX, diffY = endY - startY, minSwipeDistance = 50;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
        const tabs = ['dashboard', 'entry', 'cashflow', 'platforms', 'history', 'settings'];
        const currentIndex = tabs.indexOf(currentTab);
        if (navigator.vibrate) navigator.vibrate(30);
        
        if (diffX > 0 && currentIndex > 0) {
            const newTab = tabs[currentIndex - 1];
            switchTab(newTab);
            showSwipeIndicator(newTab);
        } else if (diffX < 0 && currentIndex < tabs.length - 1) {
            const newTab = tabs[currentIndex + 1];
            switchTab(newTab);
            showSwipeIndicator(newTab);
        }
    }
}

function showSwipeIndicator(tabName) {
    const indicator = document.getElementById('swipeIndicator');
    const swipeText = document.getElementById('swipeText');
    const tabNames = {'dashboard': '📊 Dashboard','entry': '📝 Neuer Eintrag','cashflow': '💸 Cashflow','platforms': '💼 Plattformen','history': '📜 Historie','settings': '⚙️ Einstellungen'};
    
    swipeText.textContent = tabNames[tabName];
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 1500);
}

// =================================================================================
// QUICK ACTIONS & UI TOGGLES
// =================================================================================
function setupQuickActions() {
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            document.getElementById('quickActionsBar').classList.add('visible');
            quickActionsVisible = true;
        }, 2000);
    }
}

function toggleQuickActions() {
    const bar = document.getElementById('quickActionsBar');
    quickActionsVisible = !quickActionsVisible;
    bar.classList.toggle('visible', quickActionsVisible);
}

function quickSave() {
    if (currentTab === 'entry') saveAllEntries();
    else if (currentTab === 'cashflow') saveCashflow();
    else showNotification('Nichts zu speichern auf dieser Seite', 'warning');
}

function quickSync() { syncNow(); }

function toggleCompactMode() {
    isCompactMode = !isCompactMode;
    document.body.classList.toggle('compact-mode');
    localStorage.setItem(`${STORAGE_PREFIX}compactMode`, isCompactMode);
    showNotification(isCompactMode ? 'Kompakte Ansicht aktiviert' : 'Normale Ansicht');
    if (portfolioChart) portfolioChart.resize();
    if (allocationChart) allocationChart.resize();
}

function togglePrivacyMode() {
    document.body.classList.toggle('privacy-mode');
    
    if (portfolioChart) portfolioChart.update();
    if (allocationChart) allocationChart.update();
}

// =================================================================================
// GITHUB SYNC & SKELETONS
// =================================================================================
function showSkeletons() {
    document.getElementById('dashboardContent').classList.add('is-loading');
}

function hideSkeletons() {
    document.getElementById('dashboardContent').classList.remove('is-loading');
}

function loadGitHubConfig() {
    githubToken = localStorage.getItem(`${STORAGE_PREFIX}githubToken`);
    lastSyncTime = localStorage.getItem(`${STORAGE_PREFIX}lastSyncTime`);
    const autoSync = localStorage.getItem(`${STORAGE_PREFIX}autoSync`) === 'true';
    
    document.getElementById('gistDisplay').textContent = gistId.slice(0, 8) + '...';
    document.getElementById('gistDisplay').closest('.setting-item').style.display = 'none';

    if (githubToken) document.getElementById('tokenDisplay').textContent = 'ghp_****' + githubToken.slice(-4);
    if (lastSyncTime) updateLastSyncDisplay();
    
    document.getElementById('autoSyncToggle').checked = autoSync;
    updateSyncStatus();
    updateSyncBarVisibility();
}

async function syncNow() {
    if (!githubToken || !gistId) {
        showCustomPrompt({
            title: 'GitHub Sync nicht konfiguriert',
            text: 'Bitte konfiguriere zuerst deinen GitHub Token in den Einstellungen, um die Cloud-Synchronisierung zu nutzen.',
            actions: [
                { text: 'Abbrechen', class: 'btn-danger' },
                { text: 'Zu den Einstellungen', class: 'btn-primary', value: 'settings' }
            ]
        }).then(result => {
            if (result === 'settings') {
                switchTab('settings');
            }
        });
        return;
    }
    if (syncInProgress) {
        showNotification('Sync läuft bereits...', 'warning');
        return;
    }
    
    syncInProgress = true;
    updateSyncUI('syncing');
    showSkeletons();
    
    try {
        const cloudData = await fetchGistData();
        const localData = { platforms, entries, cashflows, favorites, lastSync: new Date().toISOString() };
        const mergedData = mergeData(localData, cloudData);
        await saveToGist(mergedData);
        
        platforms = mergedData.platforms;
        entries = mergedData.entries;
        cashflows = mergedData.cashflows;
        favorites = mergedData.favorites || [];
        saveData(false); 
        
        lastSyncTime = new Date().toISOString();
        localStorage.setItem(`${STORAGE_PREFIX}lastSyncTime`, lastSyncTime);
        updateLastSyncDisplay();
        
        applyDateFilter(); 
        
        showNotification('Erfolgreich synchronisiert! ✨');
        updateSyncUI('connected');
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Sync fehlgeschlagen: ' + error.message, 'error');
        updateSyncUI('error');
    } finally {
        syncInProgress = false;
        setTimeout(hideSkeletons, 300);
    }
}

async function fetchGistData() {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!response.ok) throw new Error(`GitHub API Fehler: ${response.status}`);
    const gist = await response.json();
    const content = gist.files['portfolio-data.json']?.content;
    if (!content) return { platforms: [...DEFAULT_PLATFORMS], entries: [], cashflows: [], favorites: [], lastSync: null };
    return JSON.parse(content);
}

async function saveToGist(data) {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { 'portfolio-data.json': { content: JSON.stringify(data, null, 2) } } })
    });
    if (!response.ok) throw new Error(`GitHub API Fehler: ${response.status}`);
}

function mergeData(localData, cloudData) {
    if (!cloudData || !cloudData.lastSync) return localData;
    const localTime = new Date(localStorage.getItem(`${STORAGE_PREFIX}lastModified`) || 0);
    const cloudTime = new Date(cloudData.lastSync);
    
    if (cloudTime > localTime) {
        showNotification("Neuere Daten aus der Cloud geladen.", "warning");
        return cloudData;
    }
    return localData;
}

function openCloudSettings() { switchTab('settings'); }

function setupGitHubToken() {
    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">📝 GitHub Token Setup</h2></div>
        <div class="modal-body">
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Gib dein Personal Access Token ein, um Cloud Sync zu aktivieren.</p>
            <div class="github-input-group">
                <label>Personal Access Token</label>
                <input type="password" id="githubTokenInput" class="input-field" placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
                <div class="github-input-help">
                    <a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" style="color: var(--primary);">→ Token auf GitHub erstellen (mit 'gist' Berechtigung)</a>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="closeBottomSheet()">Abbrechen</button>
            <button class="btn btn-success" onclick="saveGitHubToken()">Speichern</button>
        </div>
    `;
    openBottomSheet(contentHtml);
    setTimeout(() => document.getElementById('githubTokenInput').focus(), 200);
}

function saveGitHubToken() {
    const tokenInput = document.getElementById('githubTokenInput');
    if (!tokenInput) return;
    const token = tokenInput.value.trim();
    if (!token) return showNotification('Bitte Token eingeben', 'error');
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) return showNotification('Ungültiges Token Format', 'error');
    githubToken = token;
    localStorage.setItem(`${STORAGE_PREFIX}githubToken`, token);
    document.getElementById('tokenDisplay').textContent = 'ghp_****' + token.slice(-4);
    closeBottomSheet();
    showNotification('Token gespeichert!');
    updateSyncStatus();
    updateSyncBarVisibility();
    testConnection();
}

function clearGitHubToken() {
    showCustomPrompt({
        title: 'GitHub Token löschen',
        text: 'Möchtest du den GitHub Token wirklich löschen?',
        actions: [
            { text: 'Abbrechen', class: 'btn-primary' },
            { text: 'Löschen', class: 'btn-danger', value: 'delete' }
        ]
    }).then(result => {
        if (result === 'delete') {
            localStorage.removeItem(`${STORAGE_PREFIX}githubToken`);
            githubToken = null;
            document.getElementById('tokenDisplay').textContent = 'Nicht konfiguriert';
            updateSyncStatus();
            updateSyncBarVisibility();
            showNotification('GitHub Token gelöscht');
        }
    });
}

async function testConnection() {
    if (!githubToken || !gistId) return showNotification('Bitte Token und Gist ID konfigurieren', 'error');
    const statusEl = document.getElementById('connectionStatus');
    try {
        showNotification('Teste Verbindung...');
        await fetchGistData();
        statusEl.className = 'connection-status connected';
        statusEl.innerHTML = `<span>✅</span><span>Erfolgreich verbunden mit GitHub!</span>`;
        showNotification('Verbindung erfolgreich! ✅');
        updateSyncStatus();
    } catch (error) {
        statusEl.className = 'connection-status disconnected';
        statusEl.innerHTML = `<span>❌</span><span>Verbindungsfehler: ${error.message}</span>`;
        showNotification('Verbindung fehlgeschlagen', 'error');
    }
}

async function checkConnectionOnStartup() {
    if (githubToken && gistId) {
        await syncNow();
    }
}

function toggleAutoSync() {
    const enabled = document.getElementById('autoSyncToggle').checked;
    localStorage.setItem(`${STORAGE_PREFIX}autoSync`, enabled);
    showNotification(enabled ? 'Auto-Sync aktiviert' : 'Auto-Sync deaktiviert');
}

function updateSyncStatus() {
    const hasConfig = githubToken && gistId;
    const badge = document.getElementById('cloudStatusBadge');
    const icon = document.getElementById('cloudIcon');
    const text = document.getElementById('cloudText');
    
    if (hasConfig) {
        syncStatus = 'connected';
        badge.className = 'cloud-status-badge';
        icon.textContent = '☁️';
        text.textContent = 'Cloud Sync';
    } else {
        syncStatus = 'offline';
        badge.className = 'cloud-status-badge disconnected';
        icon.textContent = '🔌';
        text.textContent = 'Offline';
    }
}

function updateSyncUI(status) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    const syncBtn = document.getElementById('syncNowBtn');
    const syncBtnIcon = document.getElementById('syncBtnIcon');
    const syncBtnText = document.getElementById('syncBtnText');
    const cloudBadge = document.getElementById('cloudStatusBadge');
    
    switch(status) {
        case 'syncing':
            indicator.className = 'sync-indicator pending';
            statusText.textContent = 'Synchronisiere...';
            syncBtnIcon.innerHTML = '<span class="spinner"></span>';
            syncBtnText.textContent = 'Syncing...';
            syncBtn.disabled = true;
            cloudBadge.className = 'cloud-status-badge syncing';
            document.getElementById('cloudText').textContent = 'Syncing...';
            break;
        case 'connected':
            indicator.className = 'sync-indicator synced';
            statusText.textContent = 'Synchronisiert';
            syncBtnIcon.textContent = '✅';
            syncBtnText.textContent = 'Sync';
            syncBtn.disabled = false;
            cloudBadge.className = 'cloud-status-badge';
            document.getElementById('cloudText').textContent = 'Synced';
            setTimeout(() => {
                document.getElementById('cloudText').textContent = 'Cloud Sync';
            }, 3000);
            break;
        case 'error':
            indicator.className = 'sync-indicator error';
            statusText.textContent = 'Sync Fehler';
            syncBtnIcon.textContent = '⚠️';
            syncBtnText.textContent = 'Retry';
            syncBtn.disabled = false;
            cloudBadge.className = 'cloud-status-badge error';
            document.getElementById('cloudText').textContent = 'Error';
            break;
        default:
            indicator.className = 'sync-indicator offline';
            statusText.textContent = 'Offline Modus';
            syncBtnIcon.textContent = '☁️';
            syncBtnText.textContent = 'Sync';
            syncBtn.disabled = !githubToken || !gistId;
    }
}

function updateSyncBarVisibility() {
    const bar = document.getElementById('syncStatusBar');
    if (githubToken && gistId) {
        document.body.classList.add('has-sync-bar');
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
        document.body.classList.remove('has-sync-bar');
    }
}

function toggleSyncBar() { 
    const bar = document.getElementById('syncStatusBar');
    bar.classList.toggle('visible');
    document.body.classList.toggle('has-sync-bar', bar.classList.contains('visible'));
}

function updateLastSyncDisplay() {
    if (!lastSyncTime) return;
    const lastSync = new Date(lastSyncTime);
    const diffMins = Math.floor((new Date() - lastSync) / 60000);
    let timeText = diffMins < 1 ? 'Gerade eben' : `Vor ${diffMins} min`;
    document.getElementById('lastSyncDisplay').textContent = timeText;
    document.getElementById('lastSyncTime').textContent = timeText;
}
setInterval(updateLastSyncDisplay, 60000);

// =================================================================================
// TAB MANAGEMENT
// =================================================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const newTabContent = document.getElementById(tabName);
    if(newTabContent) newTabContent.classList.add('active');
    const tabBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    if (tabBtn) tabBtn.classList.add('active');
    currentTab = tabName;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const quickActionsBar = document.getElementById('quickActionsBar');
    if (window.innerWidth <= 768) {
        if (['entry', 'cashflow'].includes(tabName)) {
            quickActionsBar.classList.add('visible');
            quickActionsVisible = true;
        }
    }
    
    if (tabName === 'platforms') updatePlatformDetails();
    else if (tabName === 'cashflow') {
        updateCashflowDisplay();
        document.getElementById('cashflowDate').value = new Date().toISOString().split('T')[0];
    }
}

// =================================================================================
// THEME MANAGEMENT
// =================================================================================
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark-mode');
    document.querySelector('.theme-toggle').textContent = currentTheme === 'light' ? '🌙' : '☀️';
    localStorage.setItem(`${STORAGE_PREFIX}theme`, currentTheme);
    updateChartTheme();
}

function loadTheme() {
    currentTheme = localStorage.getItem(`${STORAGE_PREFIX}theme`) || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-toggle').textContent = '☀️';
    }
    
    isCompactMode = localStorage.getItem(`${STORAGE_PREFIX}compactMode`) === 'true';
    if (isCompactMode) {
        document.body.classList.add('compact-mode');
    }
}

function updateChartTheme() {
    const textColor = currentTheme === 'dark' ? '#f9fafb' : '#1f2937';
    const gridColor = currentTheme === 'dark' ? '#374151' : '#e5e7eb';
    [portfolioChart, allocationChart].forEach(chart => {
        if (chart) {
            if (chart.options.scales?.y) {
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            }
            if (chart.options.scales?.x) {
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.x.grid.color = gridColor;
            }
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            chart.update();
        }
    });
}

// =================================================================================
// PLATFORM MANAGEMENT
// =================================================================================
function renderPlatformButtons() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    const platformGrid = document.getElementById('platformGrid');
    if (!platformGrid || !favoritesGrid) return;
    
    favoritesGrid.innerHTML = '';
    platformGrid.innerHTML = '';

    const lastDate = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.date;
    const platformsWithLastBalance = new Set(
        entries.filter(e => e.date === lastDate && e.balance > 0).map(e => e.protocol)
    );
    
    platforms.sort((a, b) => a.name.localeCompare(b.name));
    
    const sortedFavorites = [...favorites].map(favName => platforms.find(p => p.name === favName)).filter(p => p);
    let nonFavoritePlatforms = platforms.filter(p => !favorites.includes(p.name));
    
    if (activeCategory !== 'all') {
        nonFavoritePlatforms = nonFavoritePlatforms.filter(p => p.category === activeCategory);
    }
    if (searchTerm) {
        nonFavoritePlatforms = nonFavoritePlatforms.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.type && p.type.toLowerCase().includes(searchTerm)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }

    const createTile = (p) => {
        const tile = document.createElement('div');
        tile.className = 'platform-btn';
        tile.dataset.platform = p.name;
        
        if (selectedPlatforms.includes(p.name)) tile.classList.add('selected');
        if (favorites.includes(p.name)) tile.classList.add('favorite');
        if (platformsWithLastBalance.has(p.name)) tile.classList.add('has-balance');
        
        tile.onclick = (e) => {
            if (navigator.vibrate) navigator.vibrate(50);
            togglePlatform(tile, p.name);
        };
        
        let tagsHtml = '';
        if (p.tags && p.tags.length > 0) {
            tagsHtml = '<div class="platform-tags">';
            p.tags.slice(0, 3).forEach(tag => {
                const tagClass = getTagClass(tag);
                tagsHtml += `<span class="tag-badge ${tagClass}" onclick="event.stopPropagation(); filterByTag('${tag}')">${tag}</span>`;
            });
            tagsHtml += '</div>';
        }
        
        tile.innerHTML = `
            <span class="has-balance-icon">💰</span>
            <div class="tile-actions">
                <span class="tile-action-btn edit" title="Plattform bearbeiten" onclick="event.stopPropagation(); openEditPlatformModal('${p.name}')">✎</span>
                <span class="tile-action-btn remove" title="Plattform löschen" onclick="event.stopPropagation(); deletePlatformWithConfirmation('${p.name}')">×</span>
            </div>
            <div class="icon">${p.icon}</div>
            <div class="name">${p.name}</div>
            <div class="type">${p.type}</div>
            ${tagsHtml}`;
        return tile;
    };

    sortedFavorites.forEach(p => favoritesGrid.appendChild(createTile(p)));
    nonFavoritePlatforms.forEach(p => platformGrid.appendChild(createTile(p)));

    const addTile = document.createElement('div');
    addTile.className = 'platform-btn';
    addTile.onclick = addCustomPlatform;
    addTile.innerHTML = `<div class="icon">➕</div><div class="name">Andere</div><div class="type">Hinzufügen</div>`;
    platformGrid.appendChild(addTile);
}


function getTagClass(tag) {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes('high-risk') || tagLower.includes('derivatives')) return 'tag-high-risk';
    if (tagLower.includes('stak')) return 'tag-staking';
    if (tagLower.includes('defi')) return 'tag-defi';
    if (tagLower.includes('stable')) return 'tag-stable';
    if (tagLower.includes('layer2')) return 'tag-layer2';
    return '';
}

function filterByTag(tag) {
    document.getElementById('platformSearch').value = tag;
    filterPlatforms();
}

function filterCategory(element, category) {
    activeCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    renderPlatformButtons();
}

async function resetPlatforms() {
    const result = await showCustomPrompt({
        title: 'Plattformen zurücksetzen',
        text: 'Benutzerdefinierte Plattformliste wird gelöscht. "reset" eingeben.',
        showInput: true,
        actions: [
            { text: 'Abbrechen', class: 'btn-primary' },
            { text: 'Zurücksetzen', class: 'btn-danger', value: 'reset' }
        ]
    });
    if (result && result.toLowerCase() === 'reset') {
        platforms = [...DEFAULT_PLATFORMS];
        favorites = [];
        saveData();
        renderPlatformButtons();
        updateCashflowTargets();
        showNotification('Plattformen wurden zurückgesetzt!');
    }
}

function togglePlatform(element, platformName) {
    element.classList.toggle('selected');
    if (element.classList.contains('selected')) {
        if (!selectedPlatforms.includes(platformName)) {
            selectedPlatforms.push(platformName);
            addPlatformInput(platformName);
        }
    } else {
        selectedPlatforms = selectedPlatforms.filter(p => p !== platformName);
        removePlatformInput(platformName);
    }
    updateAutoZeroHint();
}

async function addCustomPlatform() {
    const name = await showCustomPrompt({ title: 'Neue Plattform', text: 'Name der Plattform:', showInput: true, actions: [{text: 'Abbrechen'}, {text: 'Weiter', value: 'next', class: 'btn-primary'}] });
    if (!name || !name.trim()) return;
    if (platforms.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) return showNotification('Plattform existiert bereits!', 'error');

    const type = await showCustomPrompt({ title: 'Plattform Typ', text: `Typ für "${name.trim()}"? (z.B. DEX, Lending)`, showInput: true, actions: [{text: 'Abbrechen'}, {text: 'Weiter', value: 'next', class: 'btn-primary'}] });
    const category = await showCustomPrompt({ title: 'Kategorie', text: 'Exchange, DeFi, Lending, Wallet oder Custom?', showInput: true, actions: [{text: 'Abbrechen'}, {text: 'Weiter', value: 'next', class: 'btn-primary'}] });
    const tagsInput = await showCustomPrompt({ title: 'Tags', text: 'Tags (kommagetrennt, z.B. high-risk, staking, defi):', showInput: true, actions: [{text: 'Abbrechen'}, {text: 'Speichern', value: 'save', class: 'btn-success'}] });
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];

    platforms.push({ 
        name: name.trim(), 
        type: type ? type.trim() : 'Custom',
        category: category ? category.trim() : 'Custom',
        icon: '💎',
        tags: tags
    });
    saveData();
    renderPlatformButtons();
    updateCashflowTargets();
    showNotification(`${name.trim()} hinzugefügt!`);
}

function addPlatformInput(platformName) {
    const container = document.getElementById('platformInputs');
    const inputId = platformName.replace(/\s+/g, '_');
    if (document.getElementById(`input_${inputId}`)) return;
    
    const lastEntry = getLastEntryForPlatform(platformName);
    const lastValue = lastEntry ? lastEntry.balance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
    
    const div = document.createElement('div');
    div.id = `input_${inputId}`;
    div.className = 'input-card';
    div.innerHTML = `
        <div class="input-row">
            <div class="platform-name">${platformName}</div>
            <input type="text" inputmode="decimal" id="balance_${inputId}" class="input-field" 
                   placeholder="${lastValue ? 'Letzter: ' + lastValue : 'Balance in USD'}" data-platform="${platformName}">
            <input type="text" id="note_${inputId}" class="note-input" placeholder="Notiz..." data-platform="${platformName}">
            ${lastValue ? `<div class="last-value">${lastValue}</div>` : '<div></div>'}
            <button class="remove-btn" onclick="removePlatformInput('${platformName}')">✕</button>
        </div>`;
    container.appendChild(div);
    setTimeout(() => document.getElementById(`balance_${inputId}`).focus(), 100);
}

function removePlatformInput(platformName) {
    const inputId = platformName.replace(/\s+/g, '_');
    const element = document.getElementById(`input_${inputId}`);
    if (element) element.remove();
    selectedPlatforms = selectedPlatforms.filter(p => p !== platformName);
    const button = Array.from(document.querySelectorAll('.platform-btn')).find(btn => btn.querySelector('.name')?.textContent === platformName);
    if (button) button.classList.remove('selected');
    updateAutoZeroHint();
}

function loadLastEntries() {
    const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a));
    if (sortedDates.length === 0) {
        showNotification('Keine früheren Einträge gefunden.', 'error');
        return;
    }
    const lastEntryDate = sortedDates[0];
    const entriesFromLastDate = entries.filter(e => e.date === lastEntryDate && e.balance > 0);
    const platformsToLoad = [...new Set(entriesFromLastDate.map(e => e.protocol))];

    if (platformsToLoad.length === 0) {
        showNotification(`Keine Plattformen mit Saldo > 0 am ${formatDate(lastEntryDate)} gefunden.`, 'warning');
        return;
    }
    
    document.getElementById('platformInputs').innerHTML = '';
    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];
    
    platformsToLoad.forEach(platformName => {
        const button = Array.from(document.querySelectorAll('.platform-btn[data-platform]')).find(btn => btn.dataset.platform === platformName);
        if (button) {
            togglePlatform(button, platformName);
        }
    });

    showNotification(`${platformsToLoad.length} Plattformen vom ${formatDate(lastEntryDate)} geladen.`);
}

// =================================================================================
// DATA HANDLING & FILTERING
// =================================================================================
function loadData() {
    platforms = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioPlatforms_v10`)) || [...DEFAULT_PLATFORMS];
    
    platforms = platforms.map(p => ({
        ...p,
        tags: p.tags || []
    }));
    
    entries = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioEntries_v10`)) || [];
    cashflows = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioCashflows_v10`)) || [];
    favorites = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioFavorites_v10`)) || [];
    applyDateFilter();
}

function saveData(triggerSync = true) {
    localStorage.setItem(`${STORAGE_PREFIX}portfolioPlatforms_v10`, JSON.stringify(platforms));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioEntries_v10`, JSON.stringify(entries));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioCashflows_v10`, JSON.stringify(cashflows));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioFavorites_v10`, JSON.stringify(favorites));
    localStorage.setItem(`${STORAGE_PREFIX}lastModified`, new Date().toISOString());
    
    if (triggerSync && githubToken && gistId && localStorage.getItem(`${STORAGE_PREFIX}autoSync`) === 'true') {
        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(() => syncNow(), 2000);
    }
}

function applyDateFilter() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        filteredEntries = entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate >= start && entryDate <= end;
        });
        filteredCashflows = cashflows.filter(c => {
            const cashflowDate = new Date(c.date);
            return cashflowDate >= start && cashflowDate <= end;
        });
    } else {
        filteredEntries = [...entries];
        filteredCashflows = [...cashflows];
    }
    updateDisplay();
}

function toggleFilter() {
    document.getElementById('dateFilterBar').classList.toggle('collapsed');
}

function setDateFilter(period) {
    document.querySelectorAll('.filter-presets .filter-btn').forEach(b => b.classList.remove('active'));
    const clickedButton = document.querySelector(`.filter-btn[onclick="setDateFilter('${period}')"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
        document.getElementById('activeFilterDisplay').textContent = clickedButton.textContent;
    }

    const endDate = new Date();
    let startDate = new Date();

    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterStartDate').value = '';

    switch(period) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case 'ytd': startDate = new Date(endDate.getFullYear(), 0, 1); break;
        case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
        case 'all':
            applyDateFilter();
            return;
    }
    document.getElementById('filterStartDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = endDate.toISOString().split('T')[0];
    applyDateFilter();
}

function applyAndSetCustomDateFilter() {
    document.querySelectorAll('.filter-presets .filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('activeFilterDisplay').textContent = 'Custom';
    applyDateFilter();
}

function resetDateFilter() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('activeFilterDisplay').textContent = 'Alles';
    setDateFilter('all');
}

function saveSingleEntry(inputElement) {
    const date = document.getElementById('entryDate').value;
    if (!date) return showNotification('Bitte Datum wählen!', 'error');
    
    const platformName = inputElement.dataset.platform;
    const balance = parseFloat(inputElement.value.replace(',', '.'));
    const note = document.getElementById(`note_${platformName.replace(/\s+/g, '_')}`)?.value || '';
    
    if (!inputElement.value || isNaN(balance)) return;
    
    entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
    entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance, note });
    saveData();
    applyDateFilter();
    
    inputElement.value = '';
    inputElement.placeholder = `Gespeichert: ${balance.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    showNotification(`${platformName} gespeichert!`);

    const allInputs = Array.from(document.querySelectorAll('#platformInputs .input-field[data-platform]'));
    const currentIndex = allInputs.indexOf(inputElement);

    if (currentIndex > -1 && currentIndex < allInputs.length - 1) {
        allInputs[currentIndex + 1].focus();
    }
}

// =================================================================================
// AUTO-ZERO LOGIK
// =================================================================================
function updateAutoZeroHint() {
    const hint = document.getElementById('autoZeroHint');
    const platformsToZero = getPlatformsToAutoZero();
    
    if (platformsToZero.length > 0 && selectedPlatforms.length > 0) {
        hint.classList.add('visible');
    } else {
        hint.classList.remove('visible');
    }
}

function getPlatformsToAutoZero() {
    const date = document.getElementById('entryDate').value;
    if (!date || entries.length === 0) return [];
    
    const previousDates = [...new Set(entries.map(e => e.date))].filter(d => d < date);
    if (previousDates.length === 0) return [];

    const lastEntryDate = previousDates.sort((a,b) => new Date(b) - new Date(a))[0];
    
    const platformsOnLastDate = new Set(
        entries.filter(e => e.date === lastEntryDate && e.balance > 0).map(e => e.protocol)
    );
    
    return [...platformsOnLastDate].filter(p => !selectedPlatforms.includes(p));
}

async function saveAllEntries() {
    const date = document.getElementById('entryDate').value;
    if (!date) return showNotification('Bitte Datum wählen!', 'error');
    
    let newEntriesCount = 0;
    let zeroedCount = 0;
    
    const platformsToZero = getPlatformsToAutoZero();
    if (platformsToZero.length > 0) {
         const listHtml = `<ul>${platformsToZero.map(p => `<li>${p}</li>`).join('')}</ul>`;
         const confirmed = await showCustomPrompt({
            title: 'Auto-Zero Bestätigung',
            text: 'Sollen die folgenden Plattformen, die nicht ausgewählt wurden, für dieses Datum auf 0 gesetzt werden?',
            listHtml: listHtml,
            actions: [
                { text: 'Nein' },
                { text: 'Ja, auf 0 setzen', class: 'btn-success', value: true }
            ]
        });
        
        if (confirmed) {
            platformsToZero.forEach(platformName => {
                entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
                entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance: 0, note: 'Auto-Zero (Kapital verschoben)' });
                zeroedCount++;
            });
        }
    }

    selectedPlatforms.forEach(platformName => {
        const inputId = platformName.replace(/\s+/g, '_');
        const balanceInput = document.getElementById(`balance_${inputId}`);
        const noteInput = document.getElementById(`note_${inputId}`);
        if (balanceInput && balanceInput.value) {
            const balance = parseFloat(balanceInput.value.replace(',', '.'));
            if (isNaN(balance)) return;
            entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
            entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance, note: noteInput?.value || '' });
            newEntriesCount++;
        }
    });
    
    if (newEntriesCount === 0 && zeroedCount === 0) return showNotification('Keine Daten zum Speichern!', 'error');
    
    saveData();
    applyDateFilter();
    document.getElementById('platformInputs').innerHTML = '';
    document.getElementById('autoZeroHint').classList.remove('visible');
    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];
    
    let message = '';
    if (newEntriesCount > 0) message += `${newEntriesCount} Einträge gespeichert. `;
    if (zeroedCount > 0) message += `${zeroedCount} Plattformen auf 0 gesetzt.`;
    showNotification(message.trim());
}

function saveCashflow() {
    const type = document.querySelector('input[name="cashflowType"]:checked')?.value;
    const amount = parseFloat(document.getElementById('cashflowAmount').value.replace(',', '.'));
    const date = document.getElementById('cashflowDate').value;
    const target = document.getElementById('cashflowTarget').value;
    const note = document.getElementById('cashflowNote').value;

    if (!type || !amount || isNaN(amount) || !date) return showNotification('Bitte alle Pflichtfelder ausfüllen!', 'error');

    cashflows.push({ id: Date.now() + Math.random(), type, amount, date, platform: type === 'deposit' ? (target || 'Portfolio') : 'Portfolio', note });
    saveData();
    applyDateFilter();
    
    document.getElementById('cashflowAmount').value = '';
    document.getElementById('cashflowNote').value = '';
    showNotification(`${type === 'deposit' ? 'Einzahlung' : 'Auszahlung'} gespeichert!`);
}

async function deleteEntry(entryId) {
    entries = entries.filter(e => e.id != entryId);
    saveData();
    applyDateFilter();
    showNotification('Eintrag gelöscht!');
}

async function deleteCashflow(cashflowId) {
    cashflows = cashflows.filter(c => c.id != cashflowId);
    saveData();
    applyDateFilter();
    showNotification('Cashflow gelöscht!');
}

async function deletePlatform(platformName) {
    const confirmed = await showCustomPrompt({
        title: 'Plattform löschen',
        text: `Sind Sie sicher, dass Sie die Plattform '${platformName}' löschen möchten? Alle zugehörigen Einträge werden ebenfalls entfernt.`,
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed) {
        platforms = platforms.filter(p => p.name !== platformName);
        favorites = favorites.filter(f => f !== platformName);
        entries = entries.filter(e => e.protocol !== platformName);
        
        if (selectedPlatforms.includes(platformName)) {
            removePlatformInput(platformName);
        }
        
        saveData();
        applyDateFilter();
        renderPlatformButtons();
        updateCashflowTargets();
        showNotification(`Plattform '${platformName}' und alle Einträge gelöscht!`);
    }
}

async function clearAllData() {
    const confirmation = await showCustomPrompt({
        title: '⚠️ Alle Daten löschen',
        text: 'WARNUNG: Alle Einträge und Cashflows werden gelöscht! "DELETE ALL" eingeben.',
        showInput: true,
        actions: [{text: 'Abbrechen'}, {text: 'Alles löschen', class: 'btn-danger', value: 'DELETE ALL'}]
    });

    if (confirmation === 'DELETE ALL') {
        entries = [];
        cashflows = [];
        saveData();
        applyDateFilter();
        showNotification('Alle Daten gelöscht!');
    }
}

function makeNoteEditable(cell, entryId, type) {
    const dataArray = type === 'entry' ? entries : cashflows;
    const entry = dataArray.find(e => e.id == entryId);
    if (!entry || cell.querySelector('input')) return;
    
    const currentNote = entry.note || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-field';
    input.value = currentNote;
    input.style.width = '100%';
    
    const originalContent = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    const save = () => {
        entry.note = input.value;
        saveData();
        cell.innerHTML = entry.note || `<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>`;
        cell.onclick = () => makeNoteEditable(cell, entryId, type);
        showNotification('Notiz aktualisiert!');
    };
    
    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            cell.innerHTML = originalContent;
            cell.onclick = () => makeNoteEditable(cell, entryId, type);
        }
    };
}

// =================================================================================
// DISPLAY UPDATES
// =================================================================================
function updateDisplay() {
    updateStats();
    updateHistory();
    updateCharts();
    updateCashflowDisplay();
    updatePlatformDetails();
    updateKeyMetrics();
}

/**
 * BERECHNET UND AKTUALISIERT ALLE STATISTIK-KARTEN IM DASHBOARD
 */
function updateStats() {
    const sortedDates = [...new Set(filteredEntries.map(e => e.date))].sort((a,b) => new Date(a) - new Date(b));

    if (sortedDates.length === 0) {
        document.getElementById('totalValue').textContent = '$0.00';
        ['totalChangeValue', 'totalChangePercent', 'dailyChangePercent', 'dailyChangeValue', 'netInvested', 'netInvestedChange', 'totalProfit', 'profitPercent'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
        ['totalChange', 'dailyChangeAmount'].forEach(id => {
             const el = document.getElementById(id);
             if(el) el.className = 'stat-change';
        });
        return;
    }

    const filterStartDateStr = document.getElementById('filterStartDate').value;
    const isAllTime = !filterStartDateStr || document.querySelector('.filter-btn.active').textContent === 'Alles';

    let startBalance = 0;
    if (!isAllTime) {
        const priorEntryDates = [...new Set(entries.map(e => e.date))]
            .filter(d => d < filterStartDateStr)
            .sort((a, b) => new Date(b) - new Date(a));

        if (priorEntryDates.length > 0) {
            const lastDateBeforePeriod = priorEntryDates[0];
            startBalance = entries
                .filter(e => e.date === lastDateBeforePeriod)
                .reduce((sum, e) => sum + e.balance, 0);
        }
    }

    const endDate = sortedDates[sortedDates.length - 1];
    const endBalance = filteredEntries.filter(e => e.date === endDate).reduce((sum, e) => sum + e.balance, 0);

    const netCashflowInPeriod = filteredCashflows.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
    const depositsInPeriod = filteredCashflows.filter(c => c.type === 'deposit').reduce((sum, c) => sum + c.amount, 0);
    
    const periodProfit = endBalance - startBalance - netCashflowInPeriod;
    
    const roiBase = startBalance + depositsInPeriod;
    const periodRoiPercent = roiBase !== 0 ? (periodProfit / roiBase) * 100 : 0;
    
    // 1. Karte: "Portfolio Gesamtwert"
    document.getElementById('totalValue').textContent = `$${endBalance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('totalChangeValue').textContent = `${periodProfit >= 0 ? '+' : ''}${periodProfit.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    document.getElementById('totalChangePercent').textContent = ` (${periodRoiPercent.toFixed(2)}%)`;
    document.getElementById('totalChange').className = `stat-change ${periodProfit >= 0 ? 'positive' : 'negative'}`;
    
    // 2. Karte: "Letzte Veränderung"
    const allUniqueDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a));
    if (allUniqueDates.length >= 2) {
        const latestDate = allUniqueDates[0];
        const previousDate = allUniqueDates[1];
        const latestTotal = entries.filter(e => e.date === latestDate).reduce((sum, e) => sum + e.balance, 0);
        const previousTotal = entries.filter(e => e.date === previousDate).reduce((sum, e) => sum + e.balance, 0);
        const cashflowBetween = cashflows
            .filter(c => c.date > previousDate && c.date <= latestDate)
            .reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);

        const absChange = latestTotal - previousTotal - cashflowBetween;
        const pctChange = previousTotal !== 0 ? (absChange / previousTotal) * 100 : 0;

        document.getElementById('dailyChangePercent').textContent = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;
        document.getElementById('dailyChangeValue').textContent = `${absChange >= 0 ? '+' : ''}${absChange.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
        document.getElementById('dailyChangeAmount').className = `stat-change ${absChange >= 0 ? 'positive' : 'negative'}`;
    } else {
        document.getElementById('dailyChangePercent').textContent = '-';
        document.getElementById('dailyChangeValue').textContent = '-';
        document.getElementById('dailyChangeAmount').className = 'stat-change';
    }
    
    // 3. Karte: "Netto Investiert (Zeitraum)"
    document.getElementById('netInvested').textContent = `$${netCashflowInPeriod.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    const totalDeposits = filteredCashflows.filter(c => c.type === 'deposit').reduce((sum, c) => sum + c.amount, 0);
    const totalWithdrawals = filteredCashflows.filter(c => c.type === 'withdraw').reduce((sum, c) => sum + c.amount, 0);
    document.getElementById('netInvestedChange').textContent = `Ein: $${totalDeposits.toLocaleString('de-DE', {minimumFractionDigits: 0})} | Aus: $${totalWithdrawals.toLocaleString('de-DE', {minimumFractionDigits: 0})}`;
    
    // 4. Karte: "Reale Performance (Zeitraum)"
    document.getElementById('totalProfit').textContent = `$${periodProfit.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    document.getElementById('profitPercent').textContent = `${periodRoiPercent.toFixed(2)}% ROI`;
    document.getElementById('profitPercent').parentElement.className = `stat-change ${periodProfit >= 0 ? 'positive' : 'negative'}`;
}

function calculateAdjustedBalances(currentEntries, currentCashflows) {
    const sortedDates = [...new Set(currentEntries.map(e => e.date))].sort((a,b) => new Date(a) - new Date(b));
    if (sortedDates.length === 0) {
        const lastCashflowDate = [...currentCashflows].sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.date;
        if (!lastCashflowDate) return { totalBalance: 0, netInvested: 0, totalDeposits: 0, totalWithdrawals: 0 };
        
        const lastEntryBeforeCashflow = entries
            .filter(e => e.date <= lastCashflowDate)
            .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        
        const totalBalance = lastEntryBeforeCashflow ? lastEntryBeforeCashflow.balance : 0;
        const totalDeposits = currentCashflows.filter(c => c.type === 'deposit').reduce((sum, c) => sum + c.amount, 0);
        const totalWithdrawals = currentCashflows.filter(c => c.type === 'withdraw').reduce((sum, c) => sum + c.amount, 0);
        const netInvested = totalDeposits - totalWithdrawals;
        return { totalBalance, totalDeposits, totalWithdrawals, netInvested };
    }
    const latestDate = sortedDates[sortedDates.length - 1];
    const totalBalance = currentEntries.filter(e => e.date === latestDate).reduce((sum, e) => sum + e.balance, 0);
    const totalDeposits = currentCashflows.filter(c => c.type === 'deposit').reduce((sum, c) => sum + c.amount, 0);
    const totalWithdrawals = currentCashflows.filter(c => c.type === 'withdraw').reduce((sum, c) => sum + c.amount, 0);
    const netInvested = totalDeposits - totalWithdrawals;
    return { totalBalance, totalDeposits, totalWithdrawals, netInvested };
}

// =================================================================================
// KEY METRICS CALCULATION
// =================================================================================
function updateKeyMetrics() {
    if (entries.length === 0) {
        document.getElementById('welcomeCard').style.display = 'block';
        document.getElementById('dashboardContent').style.display = 'none';
        return;
    }
    document.getElementById('welcomeCard').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';

    const sortedEntries = [...entries].sort((a,b) => new Date(a.date) - new Date(b.date));
    const sortedCashflows = [...cashflows].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if (sortedEntries.length === 0) return;

    const startDate = new Date(sortedEntries[0].date);
    document.getElementById('metricStartDate').textContent = formatDate(startDate);
    const durationMs = new Date() - startDate;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    document.getElementById('metricDuration').textContent = `${durationDays} Tage`;

    const startCapital = sortedCashflows
        .filter(c => new Date(c.date) <= startDate && c.type === 'deposit')
        .reduce((sum, c) => sum + c.amount, 0);
    document.getElementById('metricStartCapital').textContent = `$${startCapital.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;

    const { totalBalance: currentPortfolioValue } = calculateAdjustedBalances(entries, cashflows);
    const totalNetInvested = sortedCashflows.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
    const totalReturnSum = currentPortfolioValue - totalNetInvested;
    const totalReturnPercent = totalNetInvested > 0 ? (totalReturnSum / totalNetInvested) * 100 : 0;
    
    document.getElementById('metricTotalReturnSum').textContent = `$${totalReturnSum.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
     document.getElementById('metricTotalReturnPercent').textContent = `${totalReturnPercent.toFixed(2)}%`;

    const durationYears = durationDays / 365.25;
    const durationMonths = durationDays / 30.44;
    
    const annualizedReturn = durationYears > 0 ? Math.pow(1 + (totalReturnPercent / 100), 1 / durationYears) - 1 : 0;
    document.getElementById('metricAnnualForecast').textContent = `${(annualizedReturn * 100).toFixed(2)}%`;
    
    const monthlyReturn = durationMonths > 1 && startCapital > 0 ? Math.pow(currentPortfolioValue / startCapital, 1 / durationMonths) - 1 : 0;
     document.getElementById('metricAvgMonthlyReturn').textContent = `${(monthlyReturn * 100).toFixed(2)}%`;

    const portfolioForecast = currentPortfolioValue * (1 + annualizedReturn);
    document.getElementById('metricPortfolioForecast').textContent = `$${portfolioForecast.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;

    let peak = 0;
    let maxDrawdown = 0;
    const portfolioHistory = [...new Set(sortedEntries.map(e => e.date))]
        .sort((a,b) => new Date(a) - new Date(b))
        .map(date => {
            return sortedEntries.filter(e => e.date === date).reduce((sum, e) => sum + e.balance, 0);
        });

    portfolioHistory.forEach(value => {
        if (value > peak) peak = value;
        const drawdown = peak > 0 ? (value - peak) / peak : 0;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    });
    document.getElementById('metricMaxDrawdown').textContent = `${(maxDrawdown * 100).toFixed(2)}%`;
}

// =================================================================================
// HISTORY TAB - BULK ACTIONS & DISPLAY
// =================================================================================
function updateHistory() {
    const tbody = document.getElementById('historyTableBody');
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    let dataToDisplay = filteredEntries.filter(e => 
        e.protocol.toLowerCase().includes(searchTerm) || 
        e.date.toLowerCase().includes(searchTerm) ||
        (e.note && e.note.toLowerCase().includes(searchTerm))
    );

    dataToDisplay.sort((a, b) => {
        const aVal = a[historySort.key];
        const bVal = b[historySort.key];

        if (historySort.order === 'asc') {
            if (historySort.key === 'date') return new Date(aVal) - new Date(bVal);
            if (typeof aVal === 'string') return aVal.localeCompare(bVal);
            return aVal - bVal;
        } else { // desc
            if (historySort.key === 'date') return new Date(bVal) - new Date(aVal);
            if (typeof aVal === 'string') return bVal.localeCompare(aVal);
            return bVal - aVal;
        }
    });

    tbody.innerHTML = '';
    if (dataToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Keine Einträge gefunden</div></td></tr>`;
        return;
    }

    dataToDisplay.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.dataset.id = entry.id;
        row.dataset.index = index;
        if (selectedHistoryEntries.has(entry.id)) {
            row.classList.add('multi-selected-row');
        }
        
        row.onclick = (e) => handleHistoryRowClick(e, row, entry.id, index);

        row.innerHTML = `
            <td><input type="checkbox" ${selectedHistoryEntries.has(entry.id) ? 'checked' : ''}></td>
            <td>${formatDate(entry.date)}</td>
            <td style="font-weight: 600;">${entry.protocol}</td>
            <td class="dollar-value">$${entry.balance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
            <td><button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})">Löschen</button></td>
        `;
        tbody.appendChild(row);
    });
    updateSelectAllCheckbox();
    updateBulkActionsBar();
}

async function deleteSingleEntryWithConfirmation(entryId) {
    const confirmed = await showCustomPrompt({
        title: 'Löschen bestätigen',
        text: 'Sind Sie sicher, dass Sie diesen Eintrag endgültig löschen möchten?',
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed) {
        deleteEntry(entryId);
    }
}

function updateBulkActionsBar() {
    const bar = document.getElementById('historyBulkActions');
    const countEl = document.getElementById('bulkSelectedCount');
    if (selectedHistoryEntries.size > 0) {
        bar.classList.add('visible');
        countEl.textContent = `${selectedHistoryEntries.size} Eintrag${selectedHistoryEntries.size > 1 ? 'e' : ''} ausgewählt`;
    } else {
        bar.classList.remove('visible');
    }
}

async function bulkChangeDate() {
    if (selectedHistoryEntries.size === 0) return;
    const result = await showCustomPrompt({
        title: 'Datum für Auswahl ändern',
        text: `Wähle ein neues Datum für die ${selectedHistoryEntries.size} ausgewählten Einträge.`,
        showDateInput: true,
        actions: [{text: 'Abbrechen'}, {text: 'Ändern', class: 'btn-primary', value: 'change'}]
    });
    if (result === 'change') {
        const dateValue = document.getElementById('bottomSheet_date_input').value;
        if (dateValue) {
            entries.forEach(entry => {
                if (selectedHistoryEntries.has(entry.id)) {
                    entry.date = dateValue;
                }
            });
            selectedHistoryEntries.clear();
            saveData();
            applyDateFilter();
            showNotification('Datum für ausgewählte Einträge geändert.');
        }
    }
}

async function deleteSelectedEntries() {
    if (selectedHistoryEntries.size === 0) {
        return showNotification('Keine Einträge ausgewählt', 'warning');
    }
    const confirmed = await showCustomPrompt({
        title: 'Auswahl löschen',
        text: `${selectedHistoryEntries.size} Einträge wirklich löschen?`,
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed) {
        entries = entries.filter(e => !selectedHistoryEntries.has(e.id));
        selectedHistoryEntries.clear();
        saveData();
        applyDateFilter();
        showNotification('Ausgewählte Einträge gelöscht');
    }
}

function handleHistoryRowClick(e, row, entryId, index) {
    if (e.target.type === 'checkbox' || e.target.tagName === 'TD') {
        toggleHistorySelection(entryId, !selectedHistoryEntries.has(entryId));
        if (e.shiftKey && lastSelectedHistoryRow !== null) {
            const tableRows = Array.from(row.parentElement.children);
            const start = Math.min(index, lastSelectedHistoryRow);
            const end = Math.max(index, lastSelectedHistoryRow);
            for (let i = start; i <= end; i++) {
                const currentRow = tableRows[i];
                const id = parseFloat(currentRow.dataset.id);
                if (isSelected(id) !== isSelected(entryId)) { 
                   toggleHistorySelection(id, !selectedHistoryEntries.has(id));
                }
            }
        }
        lastSelectedHistoryRow = index;
    }
}

function isSelected(entryId) {
    return selectedHistoryEntries.has(entryId);
}

function toggleHistorySelection(entryId, shouldBeSelected) {
    const row = document.querySelector(`#historyTableBody tr[data-id='${entryId}']`);
    if (!row) return;

    const checkbox = row.querySelector('input[type="checkbox"]');
    if (shouldBeSelected) {
        selectedHistoryEntries.add(entryId);
        row.classList.add('multi-selected-row');
        checkbox.checked = true;
    } else {
        selectedHistoryEntries.delete(entryId);
        row.classList.remove('multi-selected-row');
        checkbox.checked = false;
    }
    updateSelectAllCheckbox();
    updateBulkActionsBar();
}

function toggleSelectAllHistory(e) {
    const isChecked = e.target.checked;
    const rows = document.querySelectorAll('#historyTableBody tr[data-id]');
    rows.forEach(row => {
        const entryId = parseFloat(row.dataset.id);
        if (entryId) {
            toggleHistorySelection(entryId, isChecked);
        }
    });
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllHistory');
    const allVisibleRows = document.querySelectorAll('#historyTableBody tr[data-id]');
    if (allVisibleRows.length > 0 && Array.from(allVisibleRows).every(row => selectedHistoryEntries.has(parseFloat(row.dataset.id)))) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedHistoryEntries.size > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}
// =================================================================================
// REST OF SCRIPT
// =================================================================================

function updateCashflowDisplay() {
    const tbody = document.getElementById('cashflowTableBody');
    
    let dataToDisplay = [...filteredCashflows];
    dataToDisplay.sort((a, b) => {
        const aVal = a[cashflowSort.key] || 0;
        const bVal = b[cashflowSort.key] || 0;
        const order = cashflowSort.order === 'asc' ? 1 : -1;
        if (cashflowSort.key === 'date') return (new Date(bVal) - new Date(aVal)) * order;
        if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
        return (aVal - bVal) * order;
    });

    tbody.innerHTML = '';
    if (dataToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Keine Cashflows gefunden</div></td></tr>`;
        return;
    }

    dataToDisplay.forEach(cf => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(cf.date)}</td>
            <td><span class="type-badge type-${cf.type}">${cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung'}</span></td>
            <td class="dollar-value ${cf.type === 'deposit' ? 'positive' : 'negative'}">$${cf.amount.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
            <td>${cf.platform || '-'}</td>
            <td class="editable" onclick="makeNoteEditable(this, ${cf.id}, 'cashflow')">${cf.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
            <td><button class="btn btn-danger btn-small" onclick="deleteCashflowWithConfirmation(${cf.id})">Löschen</button></td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteCashflowWithConfirmation(cashflowId) {
    const confirmed = await showCustomPrompt({
        title: 'Löschen bestätigen',
        text: 'Sind Sie sicher, dass Sie diesen Cashflow-Eintrag endgültig löschen möchten?',
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed) {
        deleteCashflow(cashflowId);
    }
}

async function deletePlatformWithConfirmation(platformName) {
    const confirmed = await showCustomPrompt({
        title: 'Plattform löschen',
        text: `Sind Sie sicher, dass Sie die Plattform '${platformName}' löschen möchten? Alle zugehörigen Einträge werden ebenfalls entfernt.`,
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed) {
        deletePlatform(platformName);
    }
}

function updatePlatformDetails() {
    const tbody = document.getElementById('platformDetailsBody');
    const platformStats = {};
    entries.forEach(entry => {
        if (!platformStats[entry.protocol]) {
            platformStats[entry.protocol] = { entries: [], totalBalance: 0 };
        }
        platformStats[entry.protocol].entries.push(entry);
        platformStats[entry.protocol].totalBalance += entry.balance;
    });

    let dataToDisplay = Object.keys(platformStats).map(platform => {
        const pEntries = platformStats[platform].entries.sort((a,b) => new Date(a.date) - new Date(b.date));
        const firstEntry = pEntries[0];
        const lastEntry = pEntries[pEntries.length - 1];
        return {
            platform,
            entries: pEntries.length,
            first: firstEntry.date,
            last: lastEntry.date,
            avg: platformStats[platform].totalBalance / pEntries.length,
            total: lastEntry.balance - firstEntry.balance
        };
    });

    dataToDisplay.sort((a, b) => {
        const aVal = a[platformDetailsSort.key] || 0;
        const bVal = b[platformDetailsSort.key] || 0;
        const order = platformDetailsSort.order === 'asc' ? 1 : -1;
        if (['first', 'last'].includes(platformDetailsSort.key)) return (new Date(bVal) - new Date(aVal)) * order;
        if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
        return (aVal - bVal) * order;
    });

    tbody.innerHTML = '';
    dataToDisplay.forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${data.platform}</td>
            <td>${data.entries}</td>
            <td>${formatDate(data.first)}</td>
            <td>${formatDate(data.last)}</td>
            <td class="dollar-value">$${data.avg.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
            <td class="dollar-value ${data.total >= 0 ? 'positive' : 'negative'}">$${data.total.toLocaleString('de-DE', {signDisplay: 'always', minimumFractionDigits: 2})}</td>
        `;
        tbody.appendChild(row);
    });
}

// =================================================================================
// CHARTS & EXPORT
// =================================================================================
function initializeCharts() {
    const textColor = currentTheme === 'dark' ? '#f9fafb' : '#1f2937';
    const gridColor = currentTheme === 'dark' ? '#374151' : '#e5e7eb';

    const formatDollar = (value) => {
        if (document.body.classList.contains('privacy-mode')) {
            return '$***';
        }
        return '$' + value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: false, 
                ticks: { 
                    color: textColor,
                    callback: (value) => formatDollar(value)
                }, 
                grid: { color: gridColor } 
            },
            x: { ticks: { color: textColor }, grid: { color: gridColor } }
        },
        plugins: { 
            legend: { labels: { color: textColor } },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatDollar(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };

    const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
    if (portfolioCtx) {
        portfolioChart = new Chart(portfolioCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Portfolio Wert', data: [], backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1', borderWidth: 3, tension: 0.4, fill: true }] },
            options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false }, datalabels: { display: false } } }
        });
    }

    const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
    if (allocationCtx) {
        allocationChart = new Chart(allocationCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#34d399', '#6ee7b7', '#a7f3d0', '#fBBf24', '#fb923c', '#f87171', '#fb7185'] }] },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                onClick: handleChartClick,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: textColor }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += formatDollar(context.parsed);
                                }
                                return label;
                            }
                        }
                    },
                    datalabels: {
                        formatter: (value, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = (value * 100 / sum);
                            if (percentage < 3) return '';
                            return percentage.toFixed(1) + '%';
                        },
                        color: '#fff',
                        font: { weight: 'bold', size: 14, },
                        textStrokeColor: 'rgba(0,0,0,0.5)',
                        textStrokeWidth: 2
                    }
                }
            }
        });
    }
}


function handleChartClick(event, elements) {
    if (elements.length > 0) {
        const clickedElementIndex = elements[0].index;
        const platformName = allocationChart.data.labels[clickedElementIndex];
        
        if (platformName) {
            document.getElementById('historySearch').value = platformName;
            switchTab('history');
            updateHistory();
            showNotification(`Historie gefiltert für: ${platformName}`);
        }
    }
}

function updateCharts() {
    const dateGroups = filteredEntries.reduce((acc, e) => {
        acc[e.date] = (acc[e.date] || 0) + e.balance;
        return acc;
    }, {});
    const sortedDates = Object.keys(dateGroups).sort((a,b) => new Date(a) - new Date(b));
    if (portfolioChart) {
        portfolioChart.data.labels = sortedDates.map(d => formatDate(d));
        portfolioChart.data.datasets[0].data = sortedDates.map(d => dateGroups[d]);
        portfolioChart.update();
    }

    if (allocationChart && sortedDates.length > 0) {
        const latestDate = sortedDates[sortedDates.length - 1];
        const latestEntries = filteredEntries.filter(e => e.date === latestDate && e.balance > 0);
        allocationChart.data.labels = latestEntries.map(e => e.protocol);
        allocationChart.data.datasets[0].data = latestEntries.map(e => e.balance);
        allocationChart.update();
    }
}

function exportChart(containerId) {
    const chartContainer = document.getElementById(containerId);
    if (!chartContainer) return;
    showNotification('Exportiere Chart...', 'warning');
    html2canvas(chartContainer, {
        backgroundColor: currentTheme === 'dark' ? '#111827' : '#ffffff',
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${containerId}_export_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showNotification('Chart exportiert!', 'success');
    }).catch(err => {
        showNotification('Chart-Export fehlgeschlagen!', 'error');
        console.error(err);
    });
}

async function exportPDF() {
    showNotification('PDF-Export wird vorbereitet...', 'warning');
    
    const portfolioChartImg = portfolioChart.canvas.toDataURL('image/png');
    let metricsHtml = '';
    document.querySelectorAll('#keyMetrics .metric-item').forEach(item => {
        const label = item.querySelector('.metric-label').innerText;
        const value = item.querySelector('.metric-value').innerText;
        metricsHtml += `<div class="summary-item"><span class="summary-label">${label}:</span> ${value}</div>`;
    });

    const printHtml = `
        <html>
        <head>
            <title>Portfolio Report</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; }
                h1, h2 { color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
                p { margin-bottom: 10px; }
                .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .summary-item { font-size: 16px; padding: 8px; border-bottom: 1px solid #eee; }
                .summary-label { font-weight: 600; }
                .chart-container { text-align: center; margin-top: 30px; }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <h1>Web3 Portfolio Report</h1>
            <p>Datum: ${formatDate(new Date().toISOString())}</p>
            
            <h2>Portfolio Übersicht</h2>
            <div class="summary-grid">
                ${metricsHtml}
            </div>

            <div class="chart-container">
                <h3>Portfolio Entwicklung</h3>
                <img src="${portfolioChartImg}" alt="Portfolio Entwicklung Chart">
            </div>
        </body>
        </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.write(printHtml);
    iframe.contentDocument.close();
    
    iframe.onload = function() {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
            showNotification('PDF-Export bereitgestellt!', 'success');
        }, 500);
    };
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ platforms, entries, cashflows, favorites }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Daten als JSON exportiert!');
}

function exportCSV() {
    if (entries.length === 0 && cashflows.length === 0) {
        return showNotification('Keine Daten zum Exportieren', 'warning');
    }

    const sanitize = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.search(/("|,|\n)/g) >= 0) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const header = ["Typ", "Datum", "Plattform", "Betrag", "Notiz"];
    const rows = [];

    entries.forEach(entry => {
        rows.push([
            "Balance",
            entry.date,
            sanitize(entry.protocol),
            entry.balance,
            sanitize(entry.note)
        ].join(","));
    });

    cashflows.forEach(cf => {
        rows.push([
            cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung',
            cf.date,
            sanitize(cf.platform),
            cf.amount,
            sanitize(cf.note)
        ].join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + [header.join(","), ...rows].join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `portfolio_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('CSV-Datei exportiert!', 'success');
}

function parseCsvLine(line) {
    const regex = /(?:"([^"]*(?:""[^"]*)*)"|([^,]*))(?:,|$)/g;
    const fields = [];
    let match;
    while ((match = regex.exec(line)) && match[0] !== '') {
        if (match[1] !== undefined) {
            fields.push(match[1].replace(/""/g, '"'));
        } else {
            fields.push(match[2]);
        }
    }
    return fields;
}

function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        const newEntries = [];
        const newCashflows = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            
            const [type, date, protocol, amountStr, note] = parseCsvLine(line);
            const amount = parseFloat(amountStr);

            if (type && date && protocol && !isNaN(amount)) {
                if (type.toLowerCase() === 'balance') {
                    newEntries.push({ id: Date.now() + Math.random(), date, protocol, balance: amount, note: note || '' });
                } else if (type.toLowerCase() === 'einzahlung' || type.toLowerCase() === 'auszahlung') {
                    newCashflows.push({ id: Date.now() + Math.random(), date, type: type.toLowerCase() === 'einzahlung' ? 'deposit' : 'withdraw', amount: amount, platform: protocol, note: note || '' });
                }
            }
        }
        const confirmed = await showCustomPrompt({title: 'Import bestätigen', text: `${newEntries.length} Einträge und ${newCashflows.length} Cashflows gefunden. Importieren?`});
        if (confirmed) {
            entries.push(...newEntries);
            cashflows.push(...newCashflows);
            saveData();
            applyDateFilter();
            showNotification('Daten importiert!');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function handleJsonImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.platforms && data.entries && data.cashflows && data.favorites) {
                const confirmed = await showCustomPrompt({
                    title: 'JSON Import bestätigen',
                    text: `Dies wird alle aktuellen Daten überschreiben. Fortfahren? Geben Sie "IMPORT" ein, um zu bestätigen.` ,
                    showInput: true
                });
                if (confirmed && confirmed.toUpperCase() === 'IMPORT') {
                    platforms = data.platforms;
                    entries = data.entries;
                    cashflows = data.cashflows;
                    favorites = data.favorites;
                    saveData();
                    applyDateFilter();
                    showNotification('Daten erfolgreich aus JSON importiert!', 'success');
                } else {
                    showNotification('Import abgebrochen.', 'warning');
                }
            } else {
                showNotification('Ungültige JSON-Datei. Erforderliche Felder fehlen.', 'error');
            }
        } catch (err) {
            showNotification('Fehler beim Parsen der JSON-Datei.', 'error');
            console.error("JSON Import Error:", err);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateStr).toLocaleDateString('de-DE', options);
}

function setToToday() { document.getElementById('entryDate').valueAsDate = new Date(); }
function setToYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    document.getElementById('entryDate').valueAsDate = d;
}
function setToLastSunday() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    document.getElementById('entryDate').valueAsDate = d;
}

function getLastEntryForPlatform(platformName) {
    return entries.filter(e => e.protocol === platformName).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
}

function updateCashflowTargets() {
    const select = document.getElementById('cashflowTarget');
    select.innerHTML = '<option value="">Portfolio (Allgemein)</option>';
    platforms.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
        select.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });
}

function handleSort(e) {
    const th = e.currentTarget;
    const key = th.dataset.sort;
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    let sortState;
    let updateFunction;

    switch(tbody.id) {
        case 'historyTableBody':
            sortState = historySort;
            updateFunction = updateHistory;
            break;
        case 'cashflowTableBody':
            sortState = cashflowSort;
            updateFunction = updateCashflowDisplay;
            break;
        case 'platformDetailsBody':
            sortState = platformDetailsSort;
            updateFunction = updatePlatformDetails;
            break;
        default:
            return;
    }
    
    if (sortState.key === key) {
        sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.key = key;
        sortState.order = 'desc'; 
    }
    
    table.querySelectorAll('.sort-arrow').forEach(arrow => arrow.textContent = '');
    th.querySelector('.sort-arrow').textContent = sortState.order === 'asc' ? '▲' : '▼';
    
    updateFunction();
}

function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notificationIcon');
    const textEl = document.getElementById('notificationText');
    notification.className = 'notification';
    
    if (type === 'error' || type === 'warning') {
        notification.classList.add(type);
    }

    icon.textContent = type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : '✅');
    textEl.textContent = text;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// =================================================================================
// BOTTOM SHEET MODAL
// =================================================================================
function setupBottomSheet() {
    const sheet = document.getElementById('bottomSheet');
    const sheetContent = sheet.querySelector('.bottom-sheet-content');
    let startY, startHeight;

    const onTouchStart = (e) => {
        startY = e.touches[0].pageY;
        startHeight = sheetContent.clientHeight;
        sheetContent.style.transition = 'none';
    };

    const onTouchMove = (e) => {
        const deltaY = e.touches[0].pageY - startY;
        if (deltaY > 0) { 
            sheetContent.style.transform = `translateY(${deltaY}px)`;
        }
    };

    const onTouchEnd = (e) => {
        const deltaY = e.changedTouches[0].pageY - startY;
        sheetContent.style.transition = 'transform 0.3s ease';
        if (deltaY > startHeight / 4) {
            closeBottomSheet();
        } else {
            sheetContent.style.transform = 'translateY(0)';
        }
    };

    sheet.addEventListener('click', (e) => {
        if (e.target === sheet) {
            closeBottomSheet();
        }
    });
    
    const header = sheet.querySelector('.bottom-sheet-header');
    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('touchmove', onTouchMove, { passive: true });
    header.addEventListener('touchend', onTouchEnd, { passive: true });
}

function openBottomSheet(contentHtml) {
    const sheet = document.getElementById('bottomSheet');
    const sheetBody = document.getElementById('bottomSheetBody');
    sheetBody.innerHTML = contentHtml;
    sheet.classList.add('visible');
}

function closeBottomSheet(value = null) {
    const sheet = document.getElementById('bottomSheet');
    sheet.classList.remove('visible');
    if (promptResolve) {
        promptResolve(value);
        promptResolve = null;
    }
}

function showCustomPrompt({ title, text, showInput = false, showDateInput = false, listHtml = '', actions = [] }) {
    return new Promise(resolve => {
        promptResolve = resolve;

        let actionsHtml = actions.map(action => 
            `<button class="btn ${action.class || 'btn-primary'}" onclick="closeBottomSheet('${action.value || action.text}')">${action.text}</button>`
        ).join('');
        if (actions.length === 0) {
            actionsHtml = `
                <button class="btn btn-danger" onclick="closeBottomSheet(null)">Abbrechen</button>
                <button class="btn btn-success" onclick="closeBottomSheet(document.getElementById('bottomSheet_input')?.value || document.getElementById('bottomSheet_date_input')?.value || true)">OK</button>
            `;
        }

        const contentHtml = `
            <div class="modal-header"><h2 class="modal-title">${title}</h2></div>
            <div class="modal-body">
                <p>${text}</p>
                ${listHtml || ''}
                ${showInput ? '<input type="text" id="bottomSheet_input" class="input-field" style="width: 100%; margin-top: 15px;">' : ''}
                ${showDateInput ? '<input type="date" id="bottomSheet_date_input" class="date-input" style="width: 100%; margin-top: 15px;">' : ''}
            </div>
            <div class="modal-footer">${actionsHtml}</div>
        `;
        openBottomSheet(contentHtml);
        
        const input = document.getElementById('bottomSheet_input');
        const dateInput = document.getElementById('bottomSheet_date_input');
        if (input) {
            input.focus();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    closeBottomSheet(input.value);
                }
            };
        }
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.focus();
        }
    });
}

function openEditPlatformModal(platformName) {
    const platform = platforms.find(p => p.name === platformName);
    if (!platform) return;

    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">Plattform bearbeiten</h2></div>
        <div class="modal-body">
            <input type="hidden" id="editPlatformOldName" value="${platform.name}">
            <div class="github-input-group">
                <label>Name</label>
                <input type="text" id="editPlatformName" class="input-field" value="${platform.name}">
            </div>
            <div class="github-input-group">
                <label>Typ (z.B. Exchange, DEX)</label>
                <input type="text" id="editPlatformType" class="input-field" value="${platform.type || ''}">
            </div>
             <div class="github-input-group">
                <label>Kategorie (z.B. Exchange, DeFi)</label>
                <input type="text" id="editPlatformCategory" class="input-field" value="${platform.category || ''}">
            </div>
             <div class="github-input-group">
                <label>Tags (kommagetrennt)</label>
                <input type="text" id="editPlatformTags" class="input-field" value="${(platform.tags || []).join(', ')}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="closeBottomSheet()">Abbrechen</button>
            <button class="btn btn-success" onclick="savePlatformEdit()">Speichern</button>
        </div>
    `;
    openBottomSheet(contentHtml);
}

function savePlatformEdit() {
    const oldName = document.getElementById('editPlatformOldName').value;
    const newName = document.getElementById('editPlatformName').value.trim();
    const type = document.getElementById('editPlatformType').value.trim();
    const category = document.getElementById('editPlatformCategory').value.trim();
    const tags = document.getElementById('editPlatformTags').value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    
    if (!newName) return showNotification('Name darf nicht leer sein', 'error');

    const platform = platforms.find(p => p.name === oldName);
    if (platform) {
        platform.name = newName;
        platform.type = type;
        platform.category = category;
        platform.tags = tags;
        
        entries.forEach(e => { if (e.protocol === oldName) e.protocol = newName; });
        cashflows.forEach(c => { if (c.platform === oldName) c.platform = newName; });
        if (favorites.includes(oldName)) {
            favorites = favorites.map(f => f === oldName ? newName : f);
        }

        saveData();
        applyDateFilter();
        renderPlatformButtons();
        updateCashflowTargets();
        showNotification('Plattform aktualisiert!');
        closeBottomSheet();
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const swCode = `
            self.addEventListener('install', e => {
                self.skipWaiting();
            });
            self.addEventListener('activate', e => {
                e.waitUntil(clients.claim());
            });
            self.addEventListener('fetch', e => {
                if (e.request.url.includes('api.github.com')) {
                    return; 
                }
                e.respondWith(fetch(e.request));
            });
        `;
        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        navigator.serviceWorker.register(swUrl).then(() => {
            console.log('PWA Service Worker registered');
        }).catch(err => console.log('SW registration failed:', err));
    }
}