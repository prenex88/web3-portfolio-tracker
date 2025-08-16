// =================================================================================
// CONFIGURATION & INITIAL DATA
// =================================================================================
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
// GLOBAL VARIABLES
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

// GITHUB SYNC VARIABLES
let githubToken = null;
let gistId = null;
let syncInProgress = false;
let autoSyncTimeout = null;
let lastSyncTime = null;
let syncStatus = 'offline';

// =================================================================================
// INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
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
    setupPromptModal();
    setupKeyboardShortcuts();
    setupTouchGestures();
    setupAutocomplete();
    setupQuickActions();
    updateCashflowTargets();
    checkConnectionOnStartup();
    registerServiceWorker();
});

// NEU: Funktion zur Erkennung von Mobilgeräten
function isMobileDevice() {
    // Prüft den User-Agent des Browsers auf typische mobile Schlüsselwörter
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// =================================================================================
// BIOMETRIC AUTHENTICATION
// =================================================================================
// AKTUELLES PROBLEM: App öffnet trotzdem
// LÖSUNG: Content blocking, nicht nur Overlay

async function checkBiometricAuth() {
    if (localStorage.getItem('biometricEnabled') !== 'true') {
        return; // Wenn Auth aus ist, passiert nichts und die Seite ist sichtbar.
    }

    const overlay = document.getElementById('biometricOverlay');
    const appContainer = document.getElementById('appContainer');

    // NEU: Inhalt sperren, BEVOR die Abfrage kommt
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
                // Bei Erfolg: Overlay ausblenden und Inhalt einblenden
                overlay.classList.remove('visible');
                appContainer.classList.remove('content-locked'); // NEU
                showNotification('Biometric Authentication erfolgreich! 🔐');
            }
        } else {
            // Wenn Biometrie nicht verfügbar ist, trotzdem entsperren
            overlay.classList.remove('visible');
            appContainer.classList.remove('content-locked'); // NEU
            showNotification('Biometric Auth nicht verfügbar - übersprungen', 'warning');
        }
    } catch (error) {
        // NEU: Bei Abbruch/Fehler den Overlay anzeigen lassen und Text ändern
        console.log('Biometric auth cancelled or failed:', error);
        document.querySelector('#biometricOverlay .biometric-text').textContent = 'Authentifizierung fehlgeschlagen';
        document.querySelector('#biometricOverlay .biometric-subtitle').textContent = 'Bitte laden Sie die Seite neu, um es erneut zu versuchen.';
        document.querySelector('#biometricOverlay .biometric-fallback').style.display = 'none'; // Bypass-Button ausblenden
    }
}

// Bessere Biometric Implementation
async function authenticateWithBiometric() {
    // Für Mobile: Web Authentication API
    if ('credentials' in navigator && window.PublicKeyCredential) {
        try {
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    timeout: 60000,
                    userVerification: "required",
                    rpId: window.location.hostname
                }
            });
            return !!credential;
        } catch(e) {
            return false;
        }
    }
    
    // Fallback für ältere Geräte
    return false;
}

function bypassBiometric() {
    document.getElementById('biometricOverlay').classList.remove('visible');
    showNotification('Ohne Authentifizierung fortgefahren', 'warning');
}

function toggleBiometric() {
    const enabled = localStorage.getItem('biometricEnabled') === 'true';
    localStorage.setItem('biometricEnabled', !enabled);
    document.getElementById('biometricToggle').checked = !enabled;
    showNotification(enabled ? 'Biometric Auth deaktiviert' : 'Biometric Auth aktiviert beim nächsten Start');
}

// =================================================================================
// AUTOCOMPLETE SYSTEM
// =================================================================================
function setupAutocomplete() {
    const searchInput = document.getElementById('platformSearch');
    const dropdown = document.getElementById('autocompleteDropdown');
    
    searchInput.addEventListener('blur', (e) => {
        // Delay hiding to allow click on dropdown items
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
// ENHANCED CONFIRMATION SYSTEM
// =================================================================================
function showEnhancedConfirmation(element, message, details, onConfirm) {
    // Remove any existing tooltips
    document.querySelectorAll('.confirmation-tooltip').forEach(t => t.remove());
    
    const tooltip = document.createElement('div');
    tooltip.className = 'confirmation-tooltip';
    tooltip.innerHTML = `
        <div>${message}</div>
        ${details ? `<div style="font-size: 11px; margin-top: 8px; opacity: 0.9;">${details}</div>` : ''}
        <div class="confirmation-actions">
            <button class="confirm-btn confirm-yes" onclick="confirmAction(true)">Ja</button>
            <button class="confirm-btn confirm-no" onclick="confirmAction(false)">Nein</button>
        </div>
    `;
    
    element.style.position = 'relative'; // Ensure the element can anchor the tooltip
    element.appendChild(tooltip);
    
    // Trigger animation
    setTimeout(() => tooltip.classList.add('visible'), 50);
    
    let resolved = false;
    window.confirmAction = (confirmed) => {
        if (resolved) return;
        resolved = true;
        tooltip.classList.remove('visible');
        setTimeout(() => tooltip.remove(), 300);
        if (confirmed) onConfirm();
        delete window.confirmAction;
    };
    
    // Auto-close after 10 seconds
    setTimeout(() => {
        if (!resolved) {
            window.confirmAction(false);
        }
    }, 10000);
}

function showDeleteConfirmation(element, identifier, type = 'platform') {
    let message, details, onConfirm;
    
    switch(type) {
        case 'platform':
            const platformEntries = entries.filter(e => e.protocol === identifier).length;
            message = `${identifier} löschen?`;
            details = `${platformEntries} Einträge werden ebenfalls entfernt`;
            onConfirm = () => deletePlatform(identifier);
            break;
        case 'entry':
            const entry = entries.find(e => e.id == identifier);
            message = `Eintrag löschen?`;
            details = entry ? `${entry.protocol} - ${entry.balance.toFixed(2)} vom ${formatDate(entry.date)}` : '';
            onConfirm = () => deleteEntry(identifier);
            break;
        case 'cashflow':
            const cf = cashflows.find(c => c.id == identifier);
            message = `Cashflow löschen?`;
            details = cf ? `${cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung'} - ${cf.amount.toFixed(2)}` : '';
            onConfirm = () => deleteCashflow(identifier);
            break;
    }
    
    showEnhancedConfirmation(element, message, details, onConfirm);
}

// =================================================================================
// QUICK ACTIONS SYSTEM
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
    if (currentTab === 'entry') {
        saveAllEntries();
    } else if (currentTab === 'cashflow') {
        saveCashflow();
    } else {
        showNotification('Nichts zu speichern auf dieser Seite', 'warning');
    }
}

function quickSync() {
    syncNow();
}

// PWA Service Worker Registration
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

function addEventListeners() {
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

    // Biometric toggle listener
    const biometricToggle = document.getElementById('biometricToggle');
    if (biometricToggle) {
        biometricToggle.checked = localStorage.getItem('biometricEnabled') === 'true';
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

        // Alt + B for biometric toggle
        if (e.altKey && e.key === 'b') {
            e.preventDefault();
            toggleBiometric();
        }
        
        // Alt + Q for quick actions
        if (e.altKey && e.key === 'q') {
            e.preventDefault();
            toggleQuickActions();
        }
        
        if (e.key === 'Escape') {
            closeGitHubModal();
            closeGistModal();
            if (promptResolve) {
                document.getElementById('promptModal').classList.remove('visible');
                promptResolve(null);
                promptResolve = null;
            }
        }
    });
}

// =================================================================================
// ENHANCED MOBILE & TOUCH FEATURES
// =================================================================================
function setupTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let pullDistance = 0;
    const pullToRefreshEl = document.getElementById('pullToRefresh');
    
    document.addEventListener('touchstart', (e) => {
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
                
                if (pullDistance > 80 && navigator.vibrate) {
                    navigator.vibrate(30);
                }
                
                if (pullDistance > 80) {
                    pullToRefreshEl.innerHTML = '↻';
                }
            }
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
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

    // Long press for quick actions (mobile)
    let longPressTimer;
    document.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(200);
            toggleQuickActions();
        }, 800);
    });
    
    document.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    document.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    });
}

function handleSwipeGesture(startX, endX, startY, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    const minSwipeDistance = 50;
    
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
    const tabNames = {
        'dashboard': '📊 Dashboard',
        'entry': '📝 Neuer Eintrag',
        'cashflow': '💸 Cashflow',
        'platforms': '💼 Plattformen',
        'history': '📜 Historie',
        'settings': '⚙️ Einstellungen',
    };
    
    swipeText.textContent = tabNames[tabName];
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 1500);
}

function toggleCompactMode() {
    isCompactMode = !isCompactMode;
    document.body.classList.toggle('compact-mode');
    localStorage.setItem('compactMode', isCompactMode);
    showNotification(isCompactMode ? 'Kompakte Ansicht aktiviert' : 'Normale Ansicht');
    
    if (portfolioChart) portfolioChart.resize();
    if(allocationChart) allocationChart.resize();
}

// =================================================================================
// GITHUB CONFIGURATION & SYNC
// =================================================================================
function loadGitHubConfig() {
    githubToken = localStorage.getItem('githubToken');
    gistId = localStorage.getItem('gistId');
    lastSyncTime = localStorage.getItem('lastSyncTime');
    const autoSync = localStorage.getItem('autoSync') === 'true';
    
    if (githubToken) document.getElementById('tokenDisplay').textContent = 'ghp_****' + githubToken.slice(-4);
    if (gistId) document.getElementById('gistDisplay').textContent = gistId.slice(0, 8) + '...';
    if (lastSyncTime) updateLastSyncDisplay();
    
    document.getElementById('autoSyncToggle').checked = autoSync;
    updateSyncStatus();
    updateSyncBarVisibility();
}

async function syncNow() {
    if (!githubToken || !gistId) {
        showNotification('Bitte zuerst GitHub konfigurieren', 'error');
        switchTab('settings');
        return;
    }
    if (syncInProgress) {
        showNotification('Sync läuft bereits...', 'error');
        return;
    }
    
    syncInProgress = true;
    updateSyncUI('syncing');
    
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
        localStorage.setItem('lastSyncTime', lastSyncTime);
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
    const localTime = new Date(localStorage.getItem('lastModified') || 0);
    const cloudTime = new Date(cloudData.lastSync);
    
    if (cloudTime > localTime) {
        showNotification("Neuere Daten aus der Cloud geladen.", "warning");
        return cloudData;
    }
    return localData;
}

function openCloudSettings() { switchTab('settings'); }
function setupGitHubToken() { document.getElementById('githubSetupModal').classList.add('visible'); document.getElementById('githubTokenInput').focus(); }
function setupGistId() { document.getElementById('gistSetupModal').classList.add('visible'); document.getElementById('gistIdInput').focus(); }
function closeGitHubModal() { document.getElementById('githubSetupModal').classList.remove('visible'); }
function closeGistModal() { document.getElementById('gistSetupModal').classList.remove('visible'); }

function saveGitHubToken() {
    const token = document.getElementById('githubTokenInput').value.trim();
    if (!token) return showNotification('Bitte Token eingeben', 'error');
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) return showNotification('Ungültiges Token Format', 'error');
    githubToken = token;
    localStorage.setItem('githubToken', token);
    document.getElementById('tokenDisplay').textContent = 'ghp_****' + token.slice(-4);
    document.getElementById('githubTokenInput').value = '';
    closeGitHubModal();
    showNotification('Token gespeichert!');
    updateSyncStatus();
    updateSyncBarVisibility();
    testConnection();
}

function clearGitHubToken() {
    if (confirm('Wirklich den GitHub Token löschen?')) {
        localStorage.removeItem('githubToken');
        githubToken = null;
        document.getElementById('tokenDisplay').textContent = 'Nicht konfiguriert';
        updateSyncStatus();
        updateSyncBarVisibility();
        showNotification('GitHub Token gelöscht');
    }
}

function clearGistId() {
    if (confirm('Wirklich die Gist ID löschen?')) {
        localStorage.removeItem('gistId');
        gistId = null;
        document.getElementById('gistDisplay').textContent = 'Nicht konfiguriert';
        updateSyncStatus();
        updateSyncBarVisibility();
        showNotification('Gist ID gelöscht');
    }
}

function saveGistId() {
    const id = document.getElementById('gistIdInput').value.trim();
    if (!id) return showNotification('Bitte Gist ID eingeben', 'error');
    gistId = id;
    localStorage.setItem('gistId', id);
    document.getElementById('gistDisplay').textContent = id.slice(0, 8) + '...';
    document.getElementById('gistIdInput').value = '';
    closeGistModal();
    showNotification('Gist ID gespeichert!');
    updateSyncStatus();
    updateSyncBarVisibility();
    testConnection();
}

async function createNewGist() {
    if (!githubToken) return setupGitHubToken();
    try {
        showNotification('Erstelle neuen Gist...');
        const response = await fetch(`${GITHUB_API}/gists`, {
            method: 'POST',
            headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: 'Web3 Portfolio Tracker Data',
                public: false,
                files: { 'portfolio-data.json': { content: JSON.stringify({ platforms, entries, cashflows, favorites, lastSync: new Date().toISOString() }, null, 2) } }
            })
        });
        if (!response.ok) throw new Error(`GitHub API Fehler: ${response.status}`);
        const newGist = await response.json();
        gistId = newGist.id;
        localStorage.setItem('gistId', gistId);
        document.getElementById('gistDisplay').textContent = gistId.slice(0, 8) + '...';
        showNotification('Neuer Gist erstellt! 🎉');
        updateSyncStatus();
        updateSyncBarVisibility();
        await syncNow();
    } catch (error) {
        showNotification('Fehler beim Erstellen des Gists', 'error');
    }
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
    localStorage.setItem('autoSync', enabled);
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
    localStorage.setItem('theme', currentTheme);
    updateChartTheme();
}

function loadTheme() {
    currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-toggle').textContent = '☀️';
    }
    
    isCompactMode = localStorage.getItem('compactMode') === 'true';
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
    const grid = document.getElementById('platformGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const lastDate = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.date;
    const platformsWithLastBalance = new Set(
        entries.filter(e => e.date === lastDate && e.balance > 0).map(e => e.protocol)
    );

    let filtered = platforms;
    
    if (activeCategory === 'favorites') {
        filtered = filtered.filter(p => favorites.includes(p.name));
    } else if (activeCategory !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.type && p.type.toLowerCase().includes(searchTerm)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    filtered.sort((a, b) => {
        const aFav = favorites.includes(a.name);
        const bFav = favorites.includes(b.name);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.name.localeCompare(b.name);
    });
    
    filtered.forEach((p, index) => {
        const tile = document.createElement('div');
        tile.className = 'platform-btn';
        tile.dataset.index = index;
        tile.dataset.platform = p.name;
        
        if (selectedPlatforms.includes(p.name)) tile.classList.add('selected');
        if (favorites.includes(p.name)) tile.classList.add('favorite');
        if (platformsWithLastBalance.has(p.name)) tile.classList.add('has-balance');
        
        // Enhanced click with haptic feedback
        tile.onclick = (e) => {
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            if (e.ctrlKey || e.metaKey) {
                togglePlatform(tile, p.name);
                multiSelectStartIndex = index;
            } else if (e.shiftKey && multiSelectStartIndex >= 0) {
                const allTiles = Array.from(grid.querySelectorAll('.platform-btn[data-platform]'));
                const currentTileIndex = allTiles.findIndex(t => t.dataset.platform === p.name);
                const startTileIndex = allTiles.findIndex(t => t.dataset.platform === allTiles[multiSelectStartIndex].dataset.platform);

                const start = Math.min(startTileIndex, currentTileIndex);
                const end = Math.max(startTileIndex, currentTileIndex);
                
                for (let i = start; i <= end; i++) {
                    const platformTile = allTiles[i];
                    if (platformTile && platformTile.dataset.platform) {
                        const platformName = platformTile.dataset.platform;
                        if (!selectedPlatforms.includes(platformName)) {
                            selectedPlatforms.push(platformName);
                            platformTile.classList.add('selected');
                            addPlatformInput(platformName);
                        }
                    }
                }
            } else {
                multiSelectStartIndex = index;
                togglePlatform(tile, p.name);
            }
        };
        
        tile.oncontextmenu = (e) => {
            e.preventDefault();
            toggleFavorite(p.name);
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
            <span class="favorite-star">⭐</span>
            <span class="has-balance-icon">💰</span>
            <div class="remove-tile" title="Plattform entfernen" onclick="event.stopPropagation(); showDeleteConfirmation(this, '${p.name}', 'platform')">×</div>
            <div class="icon">${p.icon}</div>
            <div class="name">${p.name}</div>
            <div class="type">${p.type}</div>
            ${tagsHtml}`;
        grid.appendChild(tile);
    });

    const addTile = document.createElement('div');
    addTile.className = 'platform-btn';
    addTile.onclick = addCustomPlatform;
    addTile.innerHTML = `<div class="icon">➕</div><div class="name">Andere</div><div class="type">Hinzufügen</div>`;
    grid.appendChild(addTile);
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

function toggleFavorite(platformName) {
    const index = favorites.indexOf(platformName);
    if (index > -1) {
        favorites.splice(index, 1);
        showNotification(`${platformName} aus Favoriten entfernt`);
    } else {
        favorites.push(platformName);
        showNotification(`${platformName} zu Favoriten hinzugefügt`);
    }
    saveData();
    renderPlatformButtons();
}

function filterCategory(element, category) {
    activeCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    renderPlatformButtons();
}

async function resetPlatforms() {
    const confirmation = await showCustomPrompt({ title: 'Plattformen zurücksetzen', text: 'Benutzerdefinierte Plattformliste wird gelöscht. "reset" eingeben.', showInput: true });
    if (confirmation && confirmation.toLowerCase() === 'reset') {
        platforms = [...DEFAULT_PLATFORMS];
        favorites = [];
        saveData();
        renderPlatformButtons();
        updateCashflowTargets();
        showNotification('Plattformen wurden zurückgesetzt!');
    }
}

async function deletePlatform(platformName) {
    platforms = platforms.filter(p => p.name !== platformName);
    favorites = favorites.filter(f => f !== platformName);
    saveData();
    if (selectedPlatforms.includes(platformName)) removePlatformInput(platformName);
    renderPlatformButtons();
    updateCashflowTargets();
    showNotification(`${platformName} gelöscht!`);
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
    const name = await showCustomPrompt({ title: 'Neue Plattform', text: 'Name der Plattform:', showInput: true });
    if (!name || !name.trim()) return;
    if (platforms.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) return showNotification('Plattform existiert bereits!', 'error');

    const type = await showCustomPrompt({ title: 'Plattform Typ', text: `Typ für "${name.trim()}"? (z.B. DEX, Lending)`, showInput: true });
    const category = await showCustomPrompt({ title: 'Kategorie', text: 'Exchange, DeFi, Lending, Wallet oder Custom?', showInput: true });
    const tagsInput = await showCustomPrompt({ title: 'Tags', text: 'Tags (kommagetrennt, z.B. high-risk, staking, defi):', showInput: true });
    
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
    const platformsFromLastDate = [...new Set(entries.filter(e => e.date === lastEntryDate).map(e => e.protocol))];
    
    document.getElementById('platformInputs').innerHTML = '';
    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];
    
    platformsFromLastDate.forEach(platformName => {
        const button = Array.from(document.querySelectorAll('.platform-btn[data-platform]')).find(btn => btn.dataset.platform === platformName);
        if (button) {
            togglePlatform(button, platformName);
        }
    });
    showNotification(`Plattformen vom ${formatDate(lastEntryDate)} geladen.`);
}

// =================================================================================
// DATA HANDLING & FILTERING
// =================================================================================
function loadData() {
    platforms = JSON.parse(localStorage.getItem('portfolioPlatforms_v10')) || [...DEFAULT_PLATFORMS];
    
    platforms = platforms.map(p => ({
        ...p,
        tags: p.tags || []
    }));
    
    entries = JSON.parse(localStorage.getItem('portfolioEntries_v10')) || [];
    cashflows = JSON.parse(localStorage.getItem('portfolioCashflows_v10')) || [];
    favorites = JSON.parse(localStorage.getItem('portfolioFavorites_v10')) || [];
    applyDateFilter();
}

function saveData(triggerSync = true) {
    localStorage.setItem('portfolioPlatforms_v10', JSON.stringify(platforms));
    localStorage.setItem('portfolioEntries_v10', JSON.stringify(entries));
    localStorage.setItem('portfolioCashflows_v10', JSON.stringify(cashflows));
    localStorage.setItem('portfolioFavorites_v10', JSON.stringify(favorites));
    localStorage.setItem('lastModified', new Date().toISOString());
    
    if (triggerSync && githubToken && gistId && localStorage.getItem('autoSync') === 'true') {
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

    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';

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
            showInput: false,
            listHtml: listHtml
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
        const balanceInput = document.getElementById(`balance_${platformName.replace(/\s+/g, '_')}`);
        const noteInput = document.getElementById(`note_${platformName.replace(/\s+/g, '_')}`);
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

async function deleteSelectedEntries() {
    if (selectedHistoryEntries.size === 0) {
        return showNotification('Keine Einträge ausgewählt', 'warning');
    }
    const confirmed = await showCustomPrompt({ title: 'Auswahl löschen', text: `${selectedHistoryEntries.size} Einträge wirklich löschen?`, showInput: false });
    if (confirmed) {
        entries = entries.filter(e => !selectedHistoryEntries.has(e.id));
        selectedHistoryEntries.clear();
        saveData();
        applyDateFilter();
        showNotification('Ausgewählte Einträge gelöscht');
    }
}

async function clearAllData() {
    const confirmation = await showCustomPrompt({ title: '⚠️ Alle Daten löschen', text: 'WARNUNG: Alle Einträge und Cashflows werden gelöscht! "DELETE ALL" eingeben.', showInput: true });
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

function updateStats() {
    const { totalBalance, netInvested, totalDeposits, totalWithdrawals } = calculateAdjustedBalances(filteredEntries, filteredCashflows);
    document.getElementById('totalValue').textContent = `$${totalBalance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const sortedDates = [...new Set(filteredEntries.map(e => e.date))].sort((a,b) => new Date(a) - new Date(b));
    if (sortedDates.length > 1) {
        const currentTotal = filteredEntries.filter(e => e.date === sortedDates[sortedDates.length-1]).reduce((sum, e) => sum + e.balance, 0);
        const previousTotal = filteredEntries.filter(e => e.date === sortedDates[0]).reduce((sum, e) => sum + e.balance, 0);
        const change = currentTotal - previousTotal;
        const changePercent = (previousTotal !== 0) ? (change / previousTotal * 100) : 0;
        const changeTextEl = document.getElementById('totalChangeText');
        changeTextEl.textContent = `${change >= 0 ? '+' : ''}${change.toLocaleString('de-DE', {minimumFractionDigits: 2})} (${changePercent.toFixed(2)}%)`;
        changeTextEl.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('weeklyGrowth').textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        document.getElementById('weeklyGrowthAmount').className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('weeklyChangeText').textContent = `${change >= 0 ? '+' : ''}${change.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    } else {
         document.getElementById('totalChangeText').textContent = 'Keine Daten';
         document.getElementById('weeklyGrowth').textContent = '-';
         document.getElementById('weeklyChangeText').textContent = '-';
    }
    
    document.getElementById('netInvested').textContent = `$${netInvested.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    document.getElementById('netInvestedChange').textContent = `Ein: $${totalDeposits.toLocaleString('de-DE', {minimumFractionDigits: 0})} | Aus: $${totalWithdrawals.toLocaleString('de-DE', {minimumFractionDigits: 0})}`;
    
    const profit = totalBalance - netInvested;
    const profitPercent = netInvested !== 0 ? (profit / netInvested * 100) : 0;
    document.getElementById('totalProfit').textContent = `$${profit.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    
    // NEU: Das Element in einer Variable speichern
    const profitPercentEl = document.getElementById('profitPercent');
    profitPercentEl.textContent = `${profitPercent.toFixed(2)}% ROI`;
    // NEU: Die CSS-Klasse basierend auf dem Gewinn setzen
    // .parentElement zielt auf das übergeordnete <div> mit der Klasse "stat-change"
    profitPercentEl.parentElement.className = `stat-change ${profit >= 0 ? 'positive' : 'negative'}`;
}

function calculateAdjustedBalances(currentEntries, currentCashflows) {
    const latestDate = currentEntries.reduce((max, e) => e.date > max ? e.date : max, '');
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
    if (entries.length === 0) return;

    const sortedEntries = [...entries].sort((a,b) => new Date(a.date) - new Date(b.date));
    const sortedCashflows = [...cashflows].sort((a,b) => new Date(a.date) - new Date(b.date));
    
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

function updateHistory() {
    const tbody = document.getElementById('historyTableBody');
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    let dataToDisplay = filteredEntries.filter(e => 
        e.protocol.toLowerCase().includes(searchTerm) || 
        e.date.toLowerCase().includes(searchTerm) ||
        (e.note && e.note.toLowerCase().includes(searchTerm))
    );

    dataToDisplay.sort((a, b) => {
        const aVal = a[historySort.key] || 0;
        const bVal = b[historySort.key] || 0;
        const order = historySort.order === 'asc' ? 1 : -1;
        if (historySort.key === 'date') return (new Date(bVal) - new Date(aVal)) * order;
        if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
        return (aVal - bVal) * order;
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
            <td>$${entry.balance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
            <td><button class="btn btn-danger btn-small" onclick="event.stopPropagation(); showDeleteConfirmation(this, ${entry.id}, 'entry')">Löschen</button></td>
        `;
        tbody.appendChild(row);
    });
    updateSelectAllCheckbox();
}

function handleHistoryRowClick(e, row, entryId, index) {
    if (e.target.type === 'checkbox') {
        toggleHistorySelection(entryId, row.querySelector('input[type="checkbox"]').checked);
        lastSelectedHistoryRow = index;
        return;
    }
    if (e.shiftKey && lastSelectedHistoryRow !== null) {
        const tableRows = Array.from(row.parentElement.children);
        const start = Math.min(index, lastSelectedHistoryRow);
        const end = Math.max(index, lastSelectedHistoryRow);
        for (let i = start; i <= end; i++) {
            const currentRow = tableRows[i];
            const id = parseFloat(currentRow.dataset.id);
            if (!selectedHistoryEntries.has(id)) {
               toggleHistorySelection(id, true);
            }
        }
    } else {
         toggleHistorySelection(entryId, !selectedHistoryEntries.has(entryId));
         lastSelectedHistoryRow = index;
    }
}

function toggleHistorySelection(entryId, isSelected) {
    const row = document.querySelector(`#historyTableBody tr[data-id='${entryId}']`);
    if (!row) return;

    const checkbox = row.querySelector('input[type="checkbox"]');
    if (isSelected) {
        selectedHistoryEntries.add(entryId);
        row.classList.add('multi-selected-row');
        checkbox.checked = true;
    } else {
        selectedHistoryEntries.delete(entryId);
        row.classList.remove('multi-selected-row');
        checkbox.checked = false;
    }
    updateSelectAllCheckbox();
}

function toggleSelectAllHistory(e) {
    const isChecked = e.target.checked;
    const rows = document.querySelectorAll('#historyTableBody tr');
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
            <td class="${cf.type === 'deposit' ? 'positive' : 'negative'}">$${cf.amount.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
            <td>${cf.platform || '-'}</td>
            <td class="editable" onclick="makeNoteEditable(this, ${cf.id}, 'cashflow')">${cf.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
            <td><button class="btn btn-danger btn-small" onclick="showDeleteConfirmation(this, ${cf.id}, 'cashflow')">Löschen</button></td>
        `;
        tbody.appendChild(row);
    });
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
            <td>$${data.avg.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
            <td class="${data.total >= 0 ? 'positive' : 'negative'}">$${data.total.toLocaleString('de-DE', {signDisplay: 'always', minimumFractionDigits: 2})}</td>
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
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: false, ticks: { color: textColor }, grid: { color: gridColor } },
            x: { ticks: { color: textColor }, grid: { color: gridColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
    };

    const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
    if (portfolioCtx) {
        portfolioChart = new Chart(portfolioCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Portfolio Wert', data: [], backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1', borderWidth: 3, tension: 0.4, fill: true }] },
            options: { ...chartOptions, plugins: { legend: { display: false } } }
        });
    }

    const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
    if (allocationCtx) {
        allocationChart = new Chart(allocationCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#34d399', '#6ee7b7', '#a7f3d0', '#fBBf24', '#fb923c', '#f87171', '#fb7185'] }] },
            options: { ...chartOptions, scales: {} }
        });
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

// =================================================================================
// DATA IMPORT / EXPORT
// =================================================================================
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

// =================================================================================
// UTILITY & HELPER FUNCTIONS
// =================================================================================
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

function setupPromptModal() {
    const modal = document.getElementById('promptModal');
    const cancelBtn = document.getElementById('promptModalCancel');
    const okBtn = document.getElementById('promptModalOk');
    const input = document.getElementById('promptModalInput');

    cancelBtn.onclick = () => {
        modal.classList.remove('visible');
        if (promptResolve) promptResolve(null);
    };
    okBtn.onclick = () => {
        modal.classList.remove('visible');
        if (promptResolve) promptResolve(input.style.display === 'none' ? true : input.value);
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') okBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    };
}

function showCustomPrompt({title, text, showInput = false, listHtml = ''}) {
    return new Promise(resolve => {
        promptResolve = resolve;
        document.getElementById('promptModalTitle').textContent = title;
        document.getElementById('promptModalText').textContent = text;
        const listContainer = document.getElementById('promptModalListContainer');
        listContainer.innerHTML = listHtml;
        
        const input = document.getElementById('promptModalInput');
        input.style.display = showInput ? 'block' : 'none';
        input.value = '';
        document.getElementById('promptModal').classList.add('visible');
        if (showInput) input.focus();
    });
}