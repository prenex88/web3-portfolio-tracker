// =================================================================================
// KONFIGURATION & INITIALE DATEN
// =================================================================================

// =================================================================================
// ERWEITERTE SUCHFUNKTIONALITÄT - KLASSEN UND UTILITIES
// =================================================================================

class SearchEngine {
    constructor() {
        this.searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        this.searchCache = new Map();
        this.debounceTimer = null;
        this.activeFilters = {
            dateRange: null,
            categories: [],
            platforms: [],
            tags: []
        };
        this.savedSearches = JSON.parse(localStorage.getItem('savedSearches') || '[]');
    }

    // Fuzzy Search Implementation
    fuzzyMatch(text, pattern, threshold = 0.6) {
        if (!text || !pattern) return 0;
        
        text = text.toLowerCase();
        pattern = pattern.toLowerCase();
        
        // Exact match gets highest score
        if (text.includes(pattern)) return 1;
        
        // Calculate Levenshtein distance
        const matrix = Array(pattern.length + 1).fill().map(() => Array(text.length + 1).fill(0));
        
        for (let i = 0; i <= pattern.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= text.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= pattern.length; i++) {
            for (let j = 1; j <= text.length; j++) {
                const cost = pattern[i-1] === text[j-1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost
                );
            }
        }
        
        const distance = matrix[pattern.length][text.length];
        const maxLength = Math.max(pattern.length, text.length);
        const similarity = (maxLength - distance) / maxLength;
        
        return similarity >= threshold ? similarity : 0;
    }

    // Debounced search function
    debounceSearch(callback, delay = 300) {
        return (...args) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => callback.apply(this, args), delay);
        };
    }

    // Highlight search terms in text
    highlightText(text, searchTerm) {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    // Calculate search result relevance score
    calculateRelevance(item, searchTerm) {
        let score = 0;
        const term = searchTerm.toLowerCase();
        
        // Title match (highest weight)
        if (item.title) {
            const titleMatch = this.fuzzyMatch(item.title, term);
            score += titleMatch * 10;
        }
        
        // Subtitle match (medium weight)
        if (item.subtitle) {
            const subtitleMatch = this.fuzzyMatch(item.subtitle, term);
            score += subtitleMatch * 5;
        }
        
        // Category match (low weight)
        if (item.category) {
            const categoryMatch = this.fuzzyMatch(item.category, term);
            score += categoryMatch * 2;
        }
        
        // Tags match (medium weight)
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
                const tagMatch = this.fuzzyMatch(tag, term);
                score += tagMatch * 3;
            });
        }
        
        return score;
    }

    // Add search to history
    addToHistory(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) return;
        
        const normalizedTerm = searchTerm.toLowerCase().trim();
        this.searchHistory = this.searchHistory.filter(term => term !== normalizedTerm);
        this.searchHistory.unshift(normalizedTerm);
        this.searchHistory = this.searchHistory.slice(0, 10); // Keep only last 10 searches
        
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    // Get search suggestions
    getSuggestions(currentTerm) {
        if (!currentTerm || currentTerm.length < 2) {
            return this.searchHistory.slice(0, 5);
        }
        
        return this.searchHistory
            .filter(term => term.includes(currentTerm.toLowerCase()))
            .slice(0, 3);
    }

    // Advanced search with filters
    applyFilters(results) {
        let filteredResults = [...results];

        // Apply date range filter
        if (this.activeFilters.dateRange) {
            const { start, end } = this.activeFilters.dateRange;
            filteredResults = filteredResults.filter(item => {
                if (item.date) {
                    const itemDate = new Date(item.date);
                    return itemDate >= start && itemDate <= end;
                }
                return true; // Keep items without dates
            });
        }

        // Apply category filters
        if (this.activeFilters.categories.length > 0) {
            filteredResults = filteredResults.filter(item =>
                this.activeFilters.categories.includes(item.category)
            );
        }

        // Apply platform filters
        if (this.activeFilters.platforms.length > 0) {
            filteredResults = filteredResults.filter(item =>
                this.activeFilters.platforms.includes(item.title) ||
                (item.protocol && this.activeFilters.platforms.includes(item.protocol))
            );
        }

        // Apply tag filters
        if (this.activeFilters.tags.length > 0) {
            filteredResults = filteredResults.filter(item => {
                if (item.tags && Array.isArray(item.tags)) {
                    return this.activeFilters.tags.some(tag =>
                        item.tags.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
                    );
                }
                return false;
            });
        }

        return filteredResults;
    }

    // Date range parsing
    parseDateRange(input) {
        const lowerInput = input.toLowerCase();
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // Relative dates
        if (lowerInput.includes('heute') || lowerInput.includes('today')) {
            return { start: today, end: tomorrow };
        }
        if (lowerInput.includes('gestern') || lowerInput.includes('yesterday')) {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return { start: yesterday, end: today };
        }
        if (lowerInput.includes('woche') || lowerInput.includes('week')) {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            return { start: weekAgo, end: tomorrow };
        }
        if (lowerInput.includes('monat') || lowerInput.includes('month')) {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            return { start: monthAgo, end: tomorrow };
        }

        // Specific date patterns
        const datePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
        const match = input.match(datePattern);
        if (match) {
            const [, day, month, year] = match;
            const date = new Date(year, month - 1, day);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            return { start: date, end: nextDay };
        }

        return null;
    }

    // Save search
    saveSearch(name, term, filters) {
        const search = {
            id: Date.now(),
            name,
            term,
            filters: { ...filters },
            createdAt: new Date().toISOString()
        };
        
        this.savedSearches.unshift(search);
        this.savedSearches = this.savedSearches.slice(0, 10); // Keep only 10 saved searches
        
        localStorage.setItem('savedSearches', JSON.stringify(this.savedSearches));
    }

    // Load saved search
    loadSavedSearch(searchId) {
        const search = this.savedSearches.find(s => s.id === searchId);
        if (search) {
            this.activeFilters = { ...search.filters };
            return search.term;
        }
        return '';
    }

    // Clear filters
    clearFilters() {
        this.activeFilters = {
            dateRange: null,
            categories: [],
            platforms: [],
            tags: []
        };
        this.searchCache.clear(); // Clear cache when filters change
    }
}

class SearchUI {
    constructor(searchEngine) {
        this.searchEngine = searchEngine;
        this.selectedIndex = -1;
        this.isNavigating = false;
    }

    // Initialize keyboard navigation
    initKeyboardNavigation(searchInput, resultsContainer) {
        searchInput.addEventListener('keydown', (e) => {
            const items = resultsContainer.querySelectorAll('.search-result-item');
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                    this.updateSelection(items);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                    this.updateSelection(items);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                        items[this.selectedIndex].click();
                    }
                    break;
                    
                case 'Escape':
                    searchInput.blur();
                    this.selectedIndex = -1;
                    this.updateSelection(items);
                    break;
            }
        });
    }

    // Update visual selection
    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Show search suggestions
    showSuggestions(searchInput, suggestions) {
        let suggestionsContainer = document.getElementById('searchSuggestions');
        
        if (!suggestionsContainer) {
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'searchSuggestions';
            suggestionsContainer.className = 'search-suggestions';
            searchInput.parentNode.appendChild(suggestionsContainer);
        }
        
        if (suggestions.length === 0 || searchInput.value.length >= 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        suggestionsContainer.innerHTML = suggestions
            .map(suggestion => `
                <div class="suggestion-item" onclick="applySuggestion('${suggestion}')">
                    <span class="suggestion-icon">🔍</span>
                    <span class="suggestion-text">${suggestion}</span>
                </div>
            `).join('');
        
        suggestionsContainer.style.display = 'block';
    }
    
    // Hide suggestions
    hideSuggestions() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }
}

// Global search engine instance
const globalSearchEngine = new SearchEngine();
const searchUI = new SearchUI(globalSearchEngine);

// *** HIER DEINE GIST-IDs EINTRAGEN ***
const GIST_ID_DEFAULT = '73f61002574be57ec1dacb473046ae48'; // Für die Hauptversion
const GIST_ID_FX = '753ec1f447c375c9a96c05feb66c05a6'; // Für die /fx Version

// Automatische Erkennung der Version
const isFxVersion = window.location.pathname.includes('/fx');
// *** GEÄNDERT: Neue Version für die Datenstruktur ***
const STORAGE_PREFIX = isFxVersion ? 'w3pt_fx_v11_' : 'w3pt_default_v11_';
const GIST_ID_CURRENT = isFxVersion ? GIST_ID_FX : GIST_ID_DEFAULT;
const DB_VERSION = 2; // Aktuelle Version für die IndexedDB

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
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CORS_PROXY = 'https://corsproxy.io/?';
const MIN_BENCHMARK_DATE = new Date('2024-02-14T00:00:00Z'); // KORRIGIERT: Fallback-Startdatum für Benchmark-Daten

// NEU: URLs für die veröffentlichten Google Sheets (bitte ersetzen)
const GOOGLE_SHEET_URLS = {
    '%5EGDAXI': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB-lwlbxmRqCLWdN3dR_I1WXjL9e_cxGF1c83TPU1FRyOLBCVQx5r5EQs4lXNMVpj0xvoHOFKw1m_p/pub?gid=0&single=true&output=csv', // DAX
    '%5EGSPC': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB-lwlbxmRqCLWdN3dR_I1WXjL9e_cxGF1c83TPU1FRyOLBCVQx5r5EQs4lXNMVpj0xvoHOFKw1m_p/pub?gid=2079448459&single=true&output=csv', // S&P 500
    'bitcoin': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB-lwlbxmRqCLWdN3dR_I1WXjL9e_cxGF1c83TPU1FRyOLBCVQx5r5EQs4lXNMVpj0xvoHOFKw1m_p/pub?gid=1446977156&single=true&output=csv', // Bitcoin
    'ethereum': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB-lwlbxmRqCLWdN3dR_I1WXjL9e_cxGF1c83TPU1FRyOLBCVQx5r5EQs4lXNMVpj0xvoHOFKw1m_p/pub?gid=1255194063&single=true&output=csv' // Ethereum
};

// Feste Benchmark-Daten als Fallback
const DEFAULT_BENCHMARK_DATA = {
    'DAX': [
        { date: '2024-02-14', value: 17046 },
        { date: '2024-03-15', value: 17936 },
        { date: '2024-04-15', value: 17737 },
        { date: '2024-05-15', value: 18738 },
        { date: '2024-06-14', value: 18265 },
        { date: '2024-07-15', value: 18530 },
        { date: '2024-08-23', value: 18130 }
    ],
    'SP500': [
        // Hier könntest du die echten Werte für den S&P 500 eintragen
        { date: '2024-02-14', value: 5029 },
        { date: '2024-03-15', value: 5117 },
        { date: '2024-04-15', value: 5061 },
        { date: '2024-05-15', value: 5308 },
        { date: '2024-06-14', value: 5431 },
        { date: '2024-07-15', value: 5574 },
        { date: '2024-08-23', value: 5460 }
    ]
};

// =================================================================================
// GLOBALE VARIABLEN
// =================================================================================
let platforms = [];
let entries = [];
let cashflows = [];
let dayStrategies = [];
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
let activeFilterPeriod = 'all'; // NEU: Globaler Status für den Filter
let isCompactMode = false;
let touchStartX = 0;
let touchStartY = 0;
let isPulling = false;
let autocompleteIndex = -1;
let autocompleteItems = [];
let db;
let cashflowViewMode = 'list';
let biometricEnabled = false;
let quickActionsVisible = false;
let historyViewMode = 'list';
let globalSearchIndex = -1;
let singleItemFilter = null;
let globalSearchResults = [];

// GITHUB SYNC VARIABLEN
let githubToken = null;
let gistId = GIST_ID_CURRENT;
let syncInProgress = false;
let autoSyncTimeout = null;
let lastSyncTime = null;
let syncStatus = 'offline';

// BENCHMARK VARIABLEN
let benchmarkData = JSON.parse(JSON.stringify(DEFAULT_BENCHMARK_DATA)); // Lokale Kopie der Fallback-Daten
const apiCache = new Map();
let showingCryptoBenchmarks = false;

// =================================================================================
// INITIALISIERUNG
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    Chart.register(ChartDataLabels);
    
    migrateV10toV11();

    if (isMobileDevice()) {
        checkBiometricAuth();
    }
    setupIndexedDB();
    loadGitHubConfig();
    loadData();
    loadTheme();
    setToToday(); // Setzt das Datum im Eingabe-Tab
    setDateFilter('all'); // Setzt den initialen Filter für die gesamte App
    renderPlatformButtons();
    initializeCharts();
    addEventListeners();
    setupBottomSheet();
    setupKeyboardShortcuts();
    setupTouchGestures();
    setupMobileTitle();
    setupAutocomplete();
    setupQuickActions();
    updateCashflowTargets();
    checkConnectionOnStartup();
    registerServiceWorker();
    initializeMobileNavigation();

    addMissingStyles();

    applyDashboardWidgetOrder();
    initializeDragAndDrop();
});

function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// =================================================================================
// LOKALES BACKUP (INDEXEDDB)
// =================================================================================
function setupIndexedDB() {
    // Die Version wird hier direkt angegeben. onupgradeneeded wird automatisch
    // aufgerufen, wenn die Browser-Version niedriger ist als DB_VERSION.
    const request = indexedDB.open('PortfolioDB', DB_VERSION);

    request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        const oldVersion = event.oldVersion;
        console.log(`Führe IndexedDB-Upgrade von Version ${oldVersion} auf ${DB_VERSION} durch.`);
        
        // Beispiel für zukünftige Migrationen:
        // if (oldVersion < 2) {
        //     // Code für Upgrade auf Version 2
        // }
        // if (oldVersion < 3) {
        //     // Code für Upgrade auf Version 3
        // }

        if (!dbInstance.objectStoreNames.contains('backups')) {
            dbInstance.createObjectStore('backups', { keyPath: 'id' });
            console.log("Object Store 'backups' erstellt.");
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log(`IndexedDB erfolgreich initialisiert mit Version: ${db.version}`);
    };

    request.onerror = (event) => {
        console.error('Fehler beim Initialisieren der IndexedDB:', event.target.error);
    };
}

function saveBackupToIndexedDB() {
    if (!db) return;
    const backupData = {
        id: 'latest_backup',
        platforms,
        entries,
        cashflows,
        dayStrategies,
        favorites,
        timestamp: new Date().toISOString()
    };
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    store.put(backupData);
}

function loadBackupFromIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(null);
        const transaction = db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        const request = store.get('latest_backup');
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// =================================================================================
// DATENMIGRATION VON V10 ZU V11
// =================================================================================
function migrateV10toV11() {
    const v11_FLAG = `${STORAGE_PREFIX}migration_v11_complete`;
    if (localStorage.getItem(v11_FLAG)) {
        return;
    }

    const OLD_STORAGE_PREFIX = isFxVersion ? 'w3pt_fx_v10_' : 'w3pt_default_v10_';
    
    const oldEntriesRaw = localStorage.getItem(`${OLD_STORAGE_PREFIX}portfolioEntries_v10`);
    if (!oldEntriesRaw) {
        localStorage.setItem(v11_FLAG, 'true');
        return;
    }

    try {
        console.log("Starte Migration von v10 zu v11...");
        const oldEntries = JSON.parse(oldEntriesRaw);
        
        const newDayStrategies = [];
        const strategyMap = new Map();

        const newEntries = oldEntries.map(entry => {
            if (entry.strategy) {
                const key = `${entry.date}`;
                if (!strategyMap.has(key)) {
                    strategyMap.set(key, entry.strategy);
                    newDayStrategies.push({ date: entry.date, strategy: entry.strategy });
                }
            }
            const { strategy, ...rest } = entry;
            return rest;
        });

        const oldPlatforms = JSON.parse(localStorage.getItem(`${OLD_STORAGE_PREFIX}portfolioPlatforms_v10`)) || DEFAULT_PLATFORMS;
        const oldCashflows = JSON.parse(localStorage.getItem(`${OLD_STORAGE_PREFIX}portfolioCashflows_v10`)) || [];
        const oldFavorites = JSON.parse(localStorage.getItem(`${OLD_STORAGE_PREFIX}portfolioFavorites_v10`)) || [];

        localStorage.setItem(`${STORAGE_PREFIX}portfolioPlatforms`, JSON.stringify(oldPlatforms));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioEntries`, JSON.stringify(newEntries));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioCashflows`, JSON.stringify(oldCashflows));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioFavorites`, JSON.stringify(oldFavorites));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioDayStrategies`, JSON.stringify(newDayStrategies));

        localStorage.setItem(v11_FLAG, 'true');

        console.log("Migration erfolgreich abgeschlossen!");
        showNotification("Daten erfolgreich auf das neue Format aktualisiert!", "success");

    } catch (error) {
        console.error("Fehler bei der Datenmigration:", error);
        showNotification("Fehler bei der Daten-Aktualisierung!", "error");
        localStorage.setItem(v11_FLAG, 'true');
    }
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

    switch (event.key) {
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
    document.getElementById('globalSearchBtn').addEventListener('click', openGlobalSearch);
    const globalSearchInput = document.getElementById('globalSearchInput');
    
    // Enhanced search with debouncing and suggestions
    const debouncedSearch = globalSearchEngine.debounceSearch((e) => {
        // Hide suggestions immediately when typing
        if (e.target.value.length >= 1) {
            searchUI.hideSuggestions();
        }
        handleGlobalSearch();
    }, 300);
    globalSearchInput.addEventListener('input', debouncedSearch);
    globalSearchInput.addEventListener('keydown', handleGlobalSearchKeydown);
    
    // Initialize keyboard navigation for search results
    const globalSearchResults = document.getElementById('globalSearchResults');
    searchUI.initKeyboardNavigation(globalSearchInput, globalSearchResults);
    
    // Show suggestions on focus (only if no search term)
    globalSearchInput.addEventListener('focus', () => {
        const currentValue = globalSearchInput.value;
        if (currentValue.length < 2) {
            const suggestions = globalSearchEngine.getSuggestions(currentValue);
            if (suggestions.length > 0) {
                searchUI.showSuggestions(globalSearchInput, suggestions);
            }
        }
    });
    
    // Hide suggestions on blur (with delay)
    globalSearchInput.addEventListener('blur', () => {
        setTimeout(() => {
            const suggestionsContainer = document.getElementById('searchSuggestions');
            if (suggestionsContainer) {
                suggestionsContainer.style.display = 'none';
            }
        }, 200);
    });
    document.getElementById('globalSearchOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'globalSearchOverlay') closeGlobalSearch();
    });
    
    document.getElementById('entryDate').addEventListener('change', (e) => {
        const date = e.target.value;
        const strategyEntry = dayStrategies.find(s => s.date === date);
        const strategyInput = document.getElementById('dailyStrategy');
        if (strategyInput) {
            strategyInput.value = strategyEntry ? strategyEntry.strategy : '';
        }
    });
    
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

    document.querySelectorAll('.chart-time-filter .filter-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const period = e.currentTarget.dataset.period;
            setChartDateFilter(period);
        });
    });
}

function setupMobileTitle() {
    // Change title on mobile devices
    function updateTitle() {
        const headerTitle = document.querySelector('.header-content h1');
        if (headerTitle && window.innerWidth <= 768) {
            headerTitle.innerHTML = '🚀 Web3 Portfolio';
        }
    }
    
    // Run on load and resize
    updateTitle();
    window.addEventListener('resize', updateTitle);
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
            const keyMap = { '1': 'dashboard', '2': 'entry', '3': 'cashflow', '4': 'history' };
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
            } else if (currentTab === 'history') {
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

        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openGlobalSearch();
        }

        if (e.key === 'Escape') {
            closeBottomSheet();
            closeGlobalSearch();
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

// =================================================================================
// QUICK ACTIONS & UI TOGGLES
// =================================================================================
function setupQuickActions() {
    if (window.innerWidth <= 768) {
        const quickActionsBar = document.getElementById('quickActionsBar');
        if (quickActionsBar) {
            setTimeout(() => {
                quickActionsBar.classList.add('visible');
                quickActionsVisible = true;
            }, 2000);
        }
    }
}

function toggleQuickActions() {
    const bar = document.getElementById('quickActionsBar');
    if (!bar) return;
    
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
    const toggle = document.getElementById('compactModeToggle');
    if (toggle) toggle.checked = isCompactMode;
    showNotification(isCompactMode ? 'Kompakte Ansicht aktiviert' : 'Normale Ansicht');
    if (portfolioChart) portfolioChart.resize();
    if (allocationChart) allocationChart.resize();
}

function togglePrivacyMode() {
    document.body.classList.toggle('privacy-mode');
    const isActive = document.body.classList.contains('privacy-mode');
    document.getElementById('privacyToggle').innerHTML = isActive ? '🙈' : '👁️';

    if (portfolioChart) portfolioChart.update();
    if (allocationChart) allocationChart.update();
    
    showNotification(isActive ? 'Privacy Mode aktiviert' : 'Privacy Mode deaktiviert');
}

// =================================================================================
// DATA HANDLING & FILTERING
// =================================================================================
async function loadData() {
    let platformsData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioPlatforms`));
    let entriesData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioEntries`));
    let cashflowsData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioCashflows`));
    let dayStrategiesData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioDayStrategies`));
    let favoritesData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioFavorites`));

    if (!entriesData || entriesData.length === 0) {
        console.log("LocalStorage ist leer, versuche Wiederherstellung aus IndexedDB-Backup...");
        try {
            const backup = await loadBackupFromIndexedDB();
            if (backup && backup.entries && backup.entries.length > 0) {
                platformsData = backup.platforms;
                entriesData = backup.entries;
                cashflowsData = backup.cashflows;
                dayStrategiesData = backup.dayStrategies;
                favoritesData = backup.favorites;
                showNotification("Daten aus dem letzten lokalen Backup wiederhergestellt!", "success");
            }
        } catch (error) {
            console.error("Fehler beim Laden des IndexedDB-Backups:", error);
        }
    }

    platforms = platformsData || [...DEFAULT_PLATFORMS];
    platforms = platforms.map(p => ({
        ...p,
        tags: p.tags || []
    }));
    entries = entriesData || [];
    cashflows = cashflowsData || [];
    dayStrategies = dayStrategiesData || [];
    favorites = favoritesData || [];
    applyDateFilter();
}

function saveData(triggerSync = true) {
    localStorage.setItem(`${STORAGE_PREFIX}portfolioPlatforms`, JSON.stringify(platforms));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioEntries`, JSON.stringify(entries));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioCashflows`, JSON.stringify(cashflows));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioDayStrategies`, JSON.stringify(dayStrategies));
    localStorage.setItem(`${STORAGE_PREFIX}portfolioFavorites`, JSON.stringify(favorites));
    localStorage.setItem(`${STORAGE_PREFIX}lastModified`, new Date().toISOString());
    saveBackupToIndexedDB();

    if (triggerSync && githubToken && gistId && localStorage.getItem(`${STORAGE_PREFIX}autoSync`) === 'true') {
        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(() => syncNow(), 2000);
    }
}

function applyDateFilter() {
    singleItemFilter = null;
    const startDateStr = document.getElementById('filterStartDate').value;
    const endDateStr = document.getElementById('filterEndDate').value;

    if (startDateStr || endDateStr) {
        filteredEntries = entries.filter(e => {
            const isAfterStart = startDateStr ? e.date >= startDateStr : true;
            const isBeforeEnd = endDateStr ? e.date <= endDateStr : true;
            return isAfterStart && isBeforeEnd;
        });

        filteredCashflows = cashflows.filter(c => {
            const isAfterStart = startDateStr ? c.date >= startDateStr : true;
            const isBeforeEnd = endDateStr ? c.date <= endDateStr : true;
            return isAfterStart && isBeforeEnd;
        });
    } else {
        filteredEntries = [...entries];
        filteredCashflows = [...cashflows];
    }
    updateDisplay();
}

function setDateFilter(period) {
    const chartFilterButton = document.querySelector(`.chart-controls .chart-timeframe-btn[onclick="setDateFilter('${period}')"]`);
    if (chartFilterButton) {
        document.querySelectorAll('.chart-controls .chart-timeframe-btn').forEach(b => b.classList.remove('active'));
        chartFilterButton.classList.add('active');
    }

    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case 'ytd': startDate = new Date(endDate.getFullYear(), 0, 1); break;
        case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
        case 'all':
            document.getElementById('filterStartDate').value = '';
            document.getElementById('filterEndDate').value = '';
            activeFilterPeriod = 'all';
            applyDateFilter();
            updateFilterBadge();
            return;
    }
    document.getElementById('filterStartDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = endDate.toISOString().split('T')[0];
    applyDateFilter();
}


function applyAndSetCustomDateFilter() {
    activeFilterPeriod = 'custom';
    applyDateFilter();
    updateFilterBadge();
}

function clearSingleItemFilter() {
    singleItemFilter = null;
    if (currentTab === 'cashflow') {
        updateCashflowDisplay();
    } else if (currentTab === 'history') {
        updateHistory();
    }
}

function resetDateFilter() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    setDateFilter('all');
}

function openDateFilterModal() {
    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">🗓️ Zeitraum filtern</h2></div>
        <div class="modal-body">
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Wähle einen vordefinierten Zeitraum oder lege einen eigenen fest.</p>
            <div class="filter-presets" style="margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button class="btn" onclick="setDateFilter('all'); closeBottomSheet();">Alles</button>
                <button class="btn" onclick="setDateFilter('7d'); closeBottomSheet();">7 Tage</button>
                <button class="btn" onclick="setDateFilter('30d'); closeBottomSheet();">30 Tage</button>
                <button class="btn" onclick="setDateFilter('90d'); closeBottomSheet();">90 Tage</button>
                <button class="btn" onclick="setDateFilter('ytd'); closeBottomSheet();">YTD</button>
                <button class="btn" onclick="setDateFilter('1y'); closeBottomSheet();">1 Jahr</button>
            </div>
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; border-top: 1px solid var(--border); padding-top: 16px;">Eigener Zeitraum</h3>
            <div class="custom-date-range" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="github-input-group" style="margin-bottom: 0;">
                    <label for="modalFilterStartDate">Von:</label>
                    <input type="date" id="modalFilterStartDate" class="date-input" style="width: 100%;" value="${document.getElementById('filterStartDate').value}">
                </div>
                <div class="github-input-group" style="margin-bottom: 0;">
                    <label for="modalFilterEndDate">Bis:</label>
                    <input type="date" id="modalFilterEndDate" class="date-input" style="width: 100%;" value="${document.getElementById('filterEndDate').value}">
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="resetDateFilter(); closeBottomSheet();">Zurücksetzen</button>
            <button class="btn btn-success" onclick="applyAndSetCustomDateFilterFromModal()">Anwenden</button>
        </div>
    `;
    openBottomSheet(contentHtml);
}

function applyAndSetCustomDateFilterFromModal() {
    const startDate = document.getElementById('modalFilterStartDate').value;
    const endDate = document.getElementById('modalFilterEndDate').value;
    document.getElementById('filterStartDate').value = startDate;
    document.getElementById('filterEndDate').value = endDate;
    
    applyAndSetCustomDateFilter();
    closeBottomSheet();
}

function updateFilterBadge() {
    const filterBtn = document.getElementById('dateFilterBtn');
    const badge = document.getElementById('activeFilterBadge'); // ID is kept for the badge in the dropdown
    const presets = { 'all': '', '7d': '7T', '30d': '30T', '90d': '90T', 'ytd': 'YTD', '1y': '1J', 'custom': '...' };
    const badgeText = presets[activeFilterPeriod] || '';
    if (badge) badge.textContent = badgeText;
    if (badge) badge.style.display = badgeText ? 'inline-block' : 'none';
}

function saveStrategyForDate(date, strategy) {
    const existingIndex = dayStrategies.findIndex(s => s.date === date);
    if (existingIndex >= 0) {
        if (strategy) {
            dayStrategies[existingIndex].strategy = strategy;
        } else {
            dayStrategies.splice(existingIndex, 1);
        }
    } else if (strategy) {
        dayStrategies.push({ date, strategy });
    }
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
    
    // Verhalten aus deiner Referenz-Datei übernehmen: Feld leeren und Platzhalter setzen
    inputElement.value = '';
    inputElement.placeholder = `Gespeichert: ${balance.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    showNotification(`${platformName} gespeichert!`);
    
    // Fokussiere das nächste Input-Feld
    setTimeout(() => {
        const currentInputId = inputElement.id;
        const allInputs = Array.from(document.querySelectorAll('.input-field[data-platform]'));
        const currentIndex = allInputs.findIndex(input => input.id === currentInputId);
        
        if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
            const nextInput = allInputs[currentIndex + 1];
            nextInput.focus();
            nextInput.select();
        } else if (allInputs.length > 0) {
            // Wenn es das letzte Feld war, gehe zum ersten zurück
            allInputs[0].focus();
            allInputs[0].select();
        }
    }, 100);
}

function saveStrategyOnly() {
    const date = document.getElementById('entryDate').value;
    const strategy = document.getElementById('dailyStrategy')?.value || '';
    
    if (!date) {
        showNotification('Bitte Datum wählen!', 'error');
        return;
    }
    
    if (!strategy.trim()) {
        showNotification('Bitte Strategie eingeben!', 'error');
        return;
    }
    
    saveStrategyForDate(date, strategy.trim());
    saveData();
    showNotification(`Strategie für ${formatDate(date)} gespeichert! ✅`);
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
        return false;
    }
    if (syncInProgress) {
        showNotification('Sync läuft bereits...', 'warning');
        return false;
    }

    syncInProgress = true;
    updateSyncUI('syncing');
    showSkeletons();

    try {
        const cloudData = await fetchGistData();
        const localData = { platforms, entries, cashflows, dayStrategies, favorites, lastSync: new Date().toISOString() };
        const mergedData = await mergeData(localData, cloudData);
        await saveToGist(mergedData);

        platforms = mergedData.platforms;
        entries = mergedData.entries;
        cashflows = mergedData.cashflows;
        dayStrategies = mergedData.dayStrategies || [];
        favorites = mergedData.favorites || [];
        saveData(false);

        lastSyncTime = new Date().toISOString();
        localStorage.setItem(`${STORAGE_PREFIX}lastSyncTime`, lastSyncTime);
        updateLastSyncDisplay();

        applyDateFilter();

        showNotification('Erfolgreich synchronisiert! ✨');
        updateSyncUI('connected');
        return true;
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Sync fehlgeschlagen: ' + error.message, 'error');
        updateSyncUI('error');
        return false;
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
    const content = gist.files['portfolio-data-v11.json']?.content;
    if (!content) return { platforms: [...DEFAULT_PLATFORMS], entries: [], cashflows: [], dayStrategies: [], favorites: [], lastSync: null };
    return JSON.parse(content);
}

async function saveToGist(data) {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { 'portfolio-data-v11.json': { content: JSON.stringify(data, null, 2) } } })
    });
    if (!response.ok) throw new Error(`GitHub API Fehler: ${response.status}`);
}

async function mergeData(localData, cloudData) {
    if (!cloudData || !cloudData.lastSync) {
        return localData;
    }
    
    const localTime = new Date(localStorage.getItem(`${STORAGE_PREFIX}lastModified`) || 0);
    const cloudTime = new Date(cloudData.lastSync);
    
    // Wenn Cloud-Daten neuer sind, frage den Benutzer
    if (cloudTime > localTime) {
        const result = await showCustomPrompt({
            title: 'Sync-Konflikt erkannt',
            text: `Die Daten in der Cloud sind neuer (${cloudTime.toLocaleString('de-DE')}). Sollen die lokalen Daten überschrieben werden?`,
            actions: [
                { text: 'Lokale behalten', value: 'local' },
                { text: 'Cloud laden', value: 'cloud', class: 'btn-primary' }
            ]
        });
        
        if (result === 'cloud') {
            showNotification("Neuere Daten aus der Cloud geladen.", "warning");
            return cloudData;
        }
        
        // Lokale Daten behalten (oder bei Abbruch des Prompts)
        showNotification("Lokale Daten werden beibehalten und beim nächsten Sync hochgeladen.", "info");
        localData.lastSync = new Date().toISOString();
        return localData;
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
        const success = await syncNow();
        if (success) {
            setTimeout(() => {
                const bar = document.getElementById('syncStatusBar');
                // Nur ausblenden, wenn der Benutzer sie nicht bereits manuell geschlossen hat.
                if (bar.classList.contains('visible')) toggleSyncBar();
            },3000);
        }
    }
}

function toggleAutoSync() {
    const enabled = document.getElementById('autoSyncToggle').checked;
    localStorage.setItem(`${STORAGE_PREFIX}autoSync`, enabled);
    showNotification(enabled ? 'Auto-Sync aktiviert' : 'Auto-Sync deaktiviert');
}

function updateSyncStatus() {
    const hasConfig = githubToken && gistId;
    const indicator = document.getElementById('cloudStatusIndicator');
    const icon = document.getElementById('cloudIcon');
    const text = document.getElementById('cloudText');
    
    if (hasConfig) {
        syncStatus = 'connected';
        if (indicator) indicator.className = 'status-indicator connected';
        if (icon) icon.textContent = '☁️';
        if (text) text.textContent = 'Cloud Sync';
    } else {
        syncStatus = 'offline';
        if (indicator) indicator.className = 'status-indicator disconnected';
        if (icon) icon.textContent = '🔌';
        if (text) text.textContent = 'Offline';
    }
}

function updateSyncUI(status) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    const syncBtn = document.getElementById('syncNowBtn');
    const syncBtnIcon = document.getElementById('syncBtnIcon');
    const syncBtnText = document.getElementById('syncBtnText');
    const dropdownIndicator = document.getElementById('cloudStatusIndicator');
    
    switch(status) {
        case 'syncing':
            indicator.className = 'sync-indicator pending';
            statusText.textContent = 'Synchronisiere...';
            syncBtnIcon.innerHTML = '<span class="spinner"></span>';
            syncBtnText.textContent = 'Syncing...';
            syncBtn.disabled = true;
            if (dropdownIndicator) dropdownIndicator.className = 'status-indicator syncing';
            if (document.getElementById('cloudText')) document.getElementById('cloudText').textContent = 'Syncing...';
            break;
        case 'connected':
            indicator.className = 'sync-indicator synced';
            statusText.textContent = 'Synchronisiert';
            syncBtnIcon.textContent = '✅';
            syncBtnText.textContent = 'Sync';
            syncBtn.disabled = false;
            if (dropdownIndicator) dropdownIndicator.className = 'status-indicator connected';
            if (document.getElementById('cloudText')) document.getElementById('cloudText').textContent = 'Synced';
            setTimeout(() => {
                if (document.getElementById('cloudText')) document.getElementById('cloudText').textContent = 'Cloud Sync';
            }, 3000);
            break;
        case 'error':
            indicator.className = 'sync-indicator error';
            statusText.textContent = 'Sync Fehler';
            syncBtnIcon.textContent = '⚠️';
            syncBtnText.textContent = 'Retry';
            syncBtn.disabled = false;
            if (dropdownIndicator) dropdownIndicator.className = 'status-indicator error';
            if (document.getElementById('cloudText')) document.getElementById('cloudText').textContent = 'Error';
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
function switchTab(tabName, options = {}) {
    if (currentTab !== tabName && !options.preserveFilter) {
        singleItemFilter = null;
    }

    // NEU: Tooltip beim Tab-Wechsel ausblenden
    const tooltipEl = document.querySelector('.chartjs-tooltip');
    if (tooltipEl) {
        tooltipEl.style.opacity = 0;
        tooltipEl.style.pointerEvents = 'none';
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const newTabContent = document.getElementById(tabName);
    if(newTabContent) newTabContent.classList.add('active');
    const tabBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    if (tabBtn) tabBtn.classList.add('active');
    currentTab = tabName;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Mobile Bottom Nav aktiven Tab aktualisieren
    if (window.innerWidth <= 768) {
        document.querySelectorAll('.mobile-nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Body-Klasse für Padding hinzufügen
        document.body.classList.add('has-mobile-nav');
    }

    // Badge-Update für Mobile Nav
    const mobileNavEntry = document.querySelector('.mobile-nav-item[data-tab="entry"]');
    if (mobileNavEntry) {
        const todayEntriesCount = entries.filter(e => e.date === new Date().toISOString().split('T')[0]).length;
        if (todayEntriesCount > 0) {
            mobileNavEntry.setAttribute('data-badge', todayEntriesCount);
        } else {
            mobileNavEntry.removeAttribute('data-badge');
        }
    }
    
    const quickActionsBar = document.getElementById('quickActionsBar');
    if (quickActionsBar && window.innerWidth <= 768) {
        if (['entry', 'cashflow'].includes(tabName)) {
            quickActionsBar.classList.add('visible');
            quickActionsVisible = true;
        } else {
            quickActionsBar.classList.remove('visible');
            quickActionsVisible = false;
        }
    }

    if (tabName === 'history') updateHistory();
    else if (tabName === 'cashflow') {
        updateCashflowDisplay();
        updateCashflowStats();
        document.getElementById('cashflowDate').value = new Date().toISOString().split('T')[0];
    } else if (tabName === 'history') {
        updateHistory();
    } else if (tabName === 'platforms') updatePlatformDetails();
}

// =================================================================================
// THEME MANAGEMENT
// =================================================================================
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark-mode');
    document.querySelector('.theme-toggle').innerHTML = currentTheme === 'light' ? '🌙' : '☀️';
    localStorage.setItem(`${STORAGE_PREFIX}theme`, currentTheme);
    updateChartTheme();
    showNotification(currentTheme === 'light' ? 'Light Mode' : 'Dark Mode');
}

function loadTheme() {
    currentTheme = localStorage.getItem(`${STORAGE_PREFIX}theme`) || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-toggle').innerHTML = '☀️';
    }
    
    isCompactMode = localStorage.getItem(`${STORAGE_PREFIX}compactMode`) === 'true';
    if (isCompactMode) {
        document.body.classList.add('compact-mode');
    }
    const toggle = document.getElementById('compactModeToggle');
    if (toggle) toggle.checked = isCompactMode;
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
    
    const sortedFavorites = favorites.map(favName => platforms.find(p => p.name === favName)).filter(Boolean);
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
        
        if (selectedPlatforms.includes(p.name)) tile.classList.add('selected'); // Keep this for state restoration
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
    
    // Strategie-Container anzeigen, wenn es der erste Input ist
    if (container.children.length === 0) {
        const strategyContainer = document.getElementById('dayStrategyContainer');
        if (strategyContainer) {
            strategyContainer.style.display = 'block';
            // Strategie für das aktuelle Datum laden
            const date = document.getElementById('entryDate').value;
            const strategyInput = document.getElementById('dailyStrategy');
            if (strategyInput) strategyInput.value = getStrategyForDate(date);
        }
    }

    const lastEntry = getLastEntryForPlatform(platformName);
    const lastValue = lastEntry ? lastEntry.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    const lastNote = lastEntry ? lastEntry.note : '';

    const div = document.createElement('div');
    div.id = `input_${inputId}`;
    div.className = 'input-card';
    div.innerHTML = `
        <div class="input-row">
            <div class="platform-name">${platformName}</div>
            <input type="text" inputmode="decimal" id="balance_${inputId}" class="input-field" 
                   placeholder="${lastValue ? 'Letzter: ' + lastValue : 'Balance in USD'}" data-platform="${platformName}">
            <input type="text" id="note_${inputId}" class="note-input" placeholder="Notiz..." data-platform="${platformName}" value="${lastNote}">
            ${lastValue ? `<div class="last-value">${lastValue}</div>` : '<div></div>'}
            <button class="remove-btn" onclick="removePlatformInput('${platformName}')">✕</button>
        </div>`;
    container.appendChild(div);
    setTimeout(() => document.getElementById(`balance_${inputId}`).focus(), 100);
}

function getStrategyForDate(date) {
    const strategy = dayStrategies.find(s => s.date === date);
    return strategy ? strategy.strategy : '';
}

function removePlatformInput(platformName) {
    const inputId = platformName.replace(/\s+/g, '_');
    const element = document.getElementById(`input_${inputId}`);
    if (element) element.remove();
    selectedPlatforms = selectedPlatforms.filter(p => p !== platformName);
    const button = Array.from(document.querySelectorAll('.platform-btn')).find(btn => btn.querySelector('.name')?.textContent === platformName);
    if (button) button.classList.remove('selected');
    updateAutoZeroHint();

    // Strategie-Container ausblenden, wenn keine Inputs mehr vorhanden sind
    const container = document.getElementById('platformInputs');
    if (container.children.length === 0) {
        const strategyContainer = document.getElementById('dayStrategyContainer');
        if (strategyContainer) strategyContainer.style.display = 'none';
    }
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

    const lastStrategy = getStrategyForDate(lastEntryDate);
    if (lastStrategy) {
        document.getElementById('dailyStrategy').value = lastStrategy;
    }

    showNotification(`${platformsToLoad.length} Plattformen vom ${formatDate(lastEntryDate)} geladen.`);
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
    let strategyChanged = false;

    const dayStrategy = document.getElementById('dailyStrategy')?.value || '';
    const oldStrategy = getStrategyForDate(date);
    if (dayStrategy.trim() !== oldStrategy.trim()) {
        saveStrategyForDate(date, dayStrategy.trim());
        strategyChanged = true;
    }
    
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

    if (newEntriesCount === 0 && zeroedCount === 0 && !strategyChanged) {
        return showNotification('Keine Änderungen zum Speichern!', 'error');
    }

    saveData();
    applyDateFilter();
    document.getElementById('platformInputs').innerHTML = '';
    
    // Strategie-Container nach dem Speichern ausblenden
    const strategyContainer = document.getElementById('dayStrategyContainer');
    if (strategyContainer) {
        strategyContainer.style.display = 'none';
    }
    
    document.getElementById('autoZeroHint').classList.remove('visible');
    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];

    let message = '';
    if (newEntriesCount > 0) message += `${newEntriesCount} Einträge gespeichert. `;
    if (zeroedCount > 0) message += `${zeroedCount} Plattformen auf 0 gesetzt. `;
    if (strategyChanged) message += `Tages-Strategie gespeichert.`;
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
        dayStrategies = [];
        saveData();
        applyDateFilter();
        showNotification('Alle Daten gelöscht!');
    }
}

async function makeDateEditable(cell, entryId, type) {
    const dataArray = type === 'entry' ? entries : cashflows;
    const entry = dataArray.find(e => e.id == entryId);
    if (!entry) return;

    const result = await showCustomPrompt({
        title: 'Datum ändern',
        text: `Wähle ein neues Datum für den Eintrag vom ${formatDate(entry.date)}.`,
        showDateInput: true,
        actions: [{text: 'Abbrechen'}, {text: 'Ändern', class: 'btn-primary', value: 'change'}]
    });

    if (result === 'change') {
        const dateValue = document.getElementById('bottomSheet_date_input').value;
        if (dateValue) {
            entry.date = dateValue;
            saveData();
            applyDateFilter();
            showNotification('Datum geändert.');
        }
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
        applyDateFilter(); // Re-render the entire view for consistency
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

function makeBalanceEditable(cell, entryId, type) {
    const dataArray = type === 'entry' ? entries : cashflows;
    const entry = dataArray.find(e => e.id == entryId);
    if (!entry || cell.querySelector('input')) return;
    
    const currentBalance = type === 'entry' ? entry.balance : entry.amount;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'input-field';
    input.value = currentBalance.toString();
    input.style.width = '100%';
    
    const originalContent = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    const save = () => {
        const newValue = parseFloat(input.value.replace(',', '.'));
        if (isNaN(newValue) || newValue < 0) {
            showNotification('Ungültiger Betrag eingegeben!', 'error');
            cell.innerHTML = originalContent;
            cell.onclick = () => makeBalanceEditable(cell, entryId, type);
            return;
        }
        
        if (type === 'entry') {
            entry.balance = newValue;
        } else {
            entry.amount = newValue;
        }
        
        saveData();
        applyDateFilter();
        
        cell.innerHTML = formatDollar(newValue);
        cell.classList.add('dollar-value', 'editable');
        cell.onclick = () => makeBalanceEditable(cell, entryId, type);
        showNotification('Betrag aktualisiert!');
    };
    
    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            cell.innerHTML = originalContent;
            cell.onclick = () => makeBalanceEditable(cell, entryId, type);
        }
    };
}

// =================================================================================
// DISPLAY UPDATES
// =================================================================================
function updateBottomNavBadges() {
    const entryTab = document.querySelector('.tab-btn[data-tab="entry"]');
    if (!entryTab) return;

    const today = new Date().toISOString().split('T')[0];
    const todayEntriesCount = entries.filter(e => e.date === today).length;

    if (todayEntriesCount > 0) {
        entryTab.setAttribute('data-badge', todayEntriesCount);
    } else {
        entryTab.removeAttribute('data-badge');
    }
}

function setCashflowView(mode) {
    cashflowViewMode = mode;
    document.querySelectorAll('.view-switcher .view-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.view-switcher .view-btn[onclick="setCashflowView('${mode}')"]`).classList.add('active');
    updateCashflowDisplay();
}

function updateDisplay() {
    updateStats();
    updateHistory();
    updateCharts();
    updateCashflowDisplay();
    updatePlatformDetails();
    updateKeyMetrics();
    updateBottomNavBadges();
}

function updateStats() {
    if (entries.length === 0) {
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
    const filterEndDateStr = document.getElementById('filterEndDate').value;
    const isFiltered = filterStartDateStr || filterEndDateStr;
    
    const allDates = [...new Set(entries.map(e => e.date))].sort((a,b) => new Date(a) - new Date(b));
    const latestDateOverall = allDates[allDates.length - 1];
    
    const currentPortfolioValue = entries
        .filter(e => e.date === latestDateOverall)
        .reduce((sum, e) => sum + e.balance, 0);

    let startBalance = 0;
    let endBalance = currentPortfolioValue;

    if (isFiltered) {
        const filteredDates = [...new Set(filteredEntries.map(e => e.date))].sort((a,b) => new Date(a) - new Date(b));
        if (filteredDates.length > 0) {
            const firstDateInFilter = filteredDates[0];
            const lastDateInFilter = filteredDates[filteredDates.length - 1];

            const dateBeforeFilter = allDates.filter(d => d < firstDateInFilter).pop();
            startBalance = dateBeforeFilter 
                ? entries.filter(e => e.date === dateBeforeFilter).reduce((s, e) => s + e.balance, 0)
                : 0;

            endBalance = entries.filter(e => e.date === lastDateInFilter).reduce((s, e) => s + e.balance, 0);
        } else {
            startBalance = 0;
            endBalance = 0;
        }
    } else {
        startBalance = 0;
        endBalance = currentPortfolioValue;
    }

    const relevantCashflows = (isFiltered ? filteredCashflows : cashflows);
    const depositsInPeriod = relevantCashflows.filter(c => c.type === 'deposit').reduce((s, c) => s + c.amount, 0);
    const withdrawalsInPeriod = relevantCashflows.filter(c => c.type === 'withdraw').reduce((s, c) => s + c.amount, 0);
    const netCashflowInPeriod = depositsInPeriod - withdrawalsInPeriod;

    // Berechne den Perioden-ROI korrekt
    const periodProfit = endBalance - startBalance - netCashflowInPeriod;
    const investedCapital = startBalance + netCashflowInPeriod;  // Startkapital + Netto-Cashflow in der Periode

    // ROI für die gewählte Periode
    const periodRoiPercent = investedCapital > 0 ? (periodProfit / investedCapital) * 100 : 0;

    // Für die Anzeige "Reale Performance" 
    const totalProfit = periodProfit;  // Verwende den Perioden-Profit

    document.getElementById('totalValue').textContent = formatDollar(currentPortfolioValue);
    
    const changeSign = periodProfit >= 0 ? '+' : '';
    document.getElementById('totalChangeValue').textContent = `${changeSign}${periodProfit.toLocaleString('de-DE', {minimumFractionDigits: 2})}`;
    document.getElementById('totalChangePercent').textContent = ` (${periodRoiPercent.toFixed(2)}%)`;
    document.getElementById('totalChange').className = `stat-change ${periodProfit >= 0 ? 'positive' : 'negative'}`;

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
    
    document.getElementById('netInvested').textContent = formatDollar(netCashflowInPeriod);
    document.getElementById('netInvestedChange').textContent = `Ein: $${depositsInPeriod.toLocaleString('de-DE', {minimumFractionDigits: 0})} | Aus: $${withdrawalsInPeriod.toLocaleString('de-DE', {minimumFractionDigits: 0})}`;
    
    document.getElementById('totalProfit').textContent = formatDollar(totalProfit);
    document.getElementById('profitPercent').textContent = `${periodRoiPercent.toFixed(2)}% ROI`;
    document.getElementById('profitPercent').parentElement.className = `stat-change ${periodProfit >= 0 ? 'positive' : 'negative'}`;

    // NEU: Chart-Header aktualisieren
    const chartHeaderValueEl = document.getElementById('chartHeaderValue');
    const chartHeaderChangeEl = document.getElementById('chartHeaderChange');

    if (chartHeaderValueEl) {
        chartHeaderValueEl.textContent = formatDollar(endBalance);
    }
    if (chartHeaderChangeEl) {
        chartHeaderChangeEl.innerHTML = `<span class="dollar-value">${periodProfit >= 0 ? '+' : ''}${periodProfit.toLocaleString('de-DE', {minimumFractionDigits: 2})}</span> <span>(${periodRoiPercent.toFixed(2)}%)</span>`;
        chartHeaderChangeEl.className = `chart-header-change ${periodProfit >= 0 ? 'positive' : 'negative'}`;
    }

    updateCashflowStats();
}

function updateCashflowStats() {
    const totalDeposits = cashflows.filter(c => c.type === 'deposit').reduce((sum, c) => sum + c.amount, 0);
    const totalWithdrawals = cashflows.filter(c => c.type === 'withdraw').reduce((sum, c) => sum + c.amount, 0);
    const netCashflow = totalDeposits - totalWithdrawals;
    
    const lastDateOverall = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a))[0];
    const currentValue = lastDateOverall ? entries.filter(e => e.date === lastDateOverall).reduce((sum, e) => sum + e.balance, 0) : 0;
    
    const totalProfit = currentValue - netCashflow;
    const roi = netCashflow > 0 ? (totalProfit / netCashflow) * 100 : 0;
    
    const totalDepositsEl = document.getElementById('totalDeposits');
    const totalWithdrawalsEl = document.getElementById('totalWithdrawals');
    const netCashflowEl = document.getElementById('netCashflow');
    const roiPercentEl = document.getElementById('roiPercent');
    
    if (totalDepositsEl) totalDepositsEl.textContent = formatDollar(totalDeposits);
    if (totalWithdrawalsEl) totalWithdrawalsEl.textContent = formatDollar(totalWithdrawals);
    if (netCashflowEl) netCashflowEl.textContent = formatDollar(netCashflow);
    if (roiPercentEl) roiPercentEl.textContent = `${roi.toFixed(2)}%`;
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
    document.getElementById('metricStartCapital').textContent = formatDollar(startCapital);

    const latestDate = sortedEntries[sortedEntries.length - 1].date;
    const currentPortfolioValue = sortedEntries.filter(e => e.date === latestDate).reduce((s, e) => s + e.balance, 0);
    const totalNetInvested = sortedCashflows.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
    const totalReturnSum = currentPortfolioValue - totalNetInvested;
    const totalReturnPercent = totalNetInvested > 0 ? (totalReturnSum / totalNetInvested) * 100 : 0;
    
    document.getElementById('metricTotalReturnSum').textContent = formatDollar(totalReturnSum);
    document.getElementById('metricTotalReturnPercent').textContent = `${totalReturnPercent.toFixed(2)}%`;

    const durationYears = durationDays / 365.25;
    
    const annualizedReturn = durationYears > 0 ? Math.pow(1 + (totalReturnPercent / 100), 1 / durationYears) - 1 : 0;
    document.getElementById('metricAnnualForecast').textContent = `${(annualizedReturn * 100).toFixed(2)}%`;
    
    const portfolioForecast = currentPortfolioValue * (1 + annualizedReturn);
    document.getElementById('metricPortfolioForecast').textContent = formatDollar(portfolioForecast);

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

function setHistoryView(mode) {
    historyViewMode = mode;
    document.querySelectorAll('#history .view-switcher .view-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#history .view-switcher .view-btn[onclick="setHistoryView('${mode}')"]`).classList.add('active');
    updateHistory();
}

function updateHistory() {
    const listView = document.getElementById('historyListView');
    const groupedView = document.getElementById('historyGroupedView');
    const mobileCards = document.getElementById('historyMobileCards');
    const searchInput = document.getElementById('historySearch');

    const tbody = document.getElementById('historyTableBody');
    const historySection = tbody.closest('.section');
    let clearBtnContainer = historySection.querySelector('.clear-filter-btn-container');
    if (clearBtnContainer) clearBtnContainer.remove();
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    let dataToDisplay;

    if (singleItemFilter && singleItemFilter.type === 'history') {
        dataToDisplay = entries.filter(singleItemFilter.filterFunction);
        const clearButtonHtml = `<div class="clear-filter-btn-container" style="margin-top: 16px; text-align: center;"><button class="btn btn-primary" onclick="clearSingleItemFilter()">Alle Einträge anzeigen</button></div>`;
        tbody.closest('.data-table-wrapper').insertAdjacentHTML('afterend', clearButtonHtml);
    } else {
        if (historyViewMode === 'grouped') {
            listView.style.display = 'none';
            mobileCards.style.display = 'none';
            groupedView.style.display = 'block';
            searchInput.style.visibility = 'visible';
            searchInput.placeholder = "Gruppe suchen...";
            renderGroupedHistory(searchTerm);
            return;
        }
        dataToDisplay = filteredEntries.filter(e => 
            e.protocol.toLowerCase().includes(searchTerm) || 
            e.date.toLowerCase().includes(searchTerm) ||
            (e.note && e.note.toLowerCase().includes(searchTerm))
        );
    }

    listView.style.display = 'block';
    groupedView.style.display = 'none';
    searchInput.placeholder = "In Liste suchen...";
    searchInput.style.visibility = 'visible'; // Sicherstellen, dass es sichtbar ist
    if (window.innerWidth <= 768) mobileCards.style.display = 'block';

    // Augment data with strategy for correct sorting
    const augmentedData = dataToDisplay.map(entry => ({
        ...entry,
        strategy: getStrategyForDate(entry.date) || ''
    }));

    augmentedData.sort((a, b) => {
        const aVal = a[historySort.key] || '';
        const bVal = b[historySort.key] || '';

        if (historySort.order === 'asc') {
            if (historySort.key === 'date') return new Date(aVal) - new Date(bVal);
            if (typeof aVal === 'string') return aVal.localeCompare(bVal);
            return aVal - bVal;
        } else {
            if (historySort.key === 'date') return new Date(bVal) - new Date(aVal);
            if (typeof aVal === 'string') return bVal.localeCompare(aVal);
            return bVal - aVal;
        }
    });

    tbody.innerHTML = '';
    if (augmentedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Keine Einträge gefunden</div></td></tr>`;
        return;
    }

    augmentedData.forEach((entry, index) => {
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
            <td class="dollar-value editable" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')">${formatDollar(entry.balance)}</td>
            <td>${entry.strategy || '-'}</td>
            <td class="editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
            <td><button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})">Löschen</button></td>
        `;
        tbody.appendChild(row);
    });
    
    // Render mobile cards
    renderHistoryMobileCards(augmentedData);
    
    updateSelectAllCheckbox();
    updateBulkActionsBar();
}

function renderGroupedHistory(searchTerm = '') {
    const container = document.getElementById('historyGroupedView');
    container.innerHTML = '';

    const groupedByPlatform = filteredEntries.reduce((acc, entry) => {
        if (!acc[entry.protocol]) {
            acc[entry.protocol] = [];
        }
        acc[entry.protocol].push(entry);
        return acc;
    }, {});

    let platformKeys = Object.keys(groupedByPlatform).sort();

    if (searchTerm) {
        platformKeys = platformKeys.filter(key => key.toLowerCase().includes(searchTerm));
    }

    if (platformKeys.length === 0) {
        const emptyMessage = searchTerm
            ? `Keine Gruppen für "${searchTerm}" gefunden.`
            : "Keine Einträge im ausgewählten Zeitraum.";
        container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }

    const isMobile = window.innerWidth <= 768;
    let html = '<div class="cashflow-groups">'; // Re-use cashflow group styling
    platformKeys.forEach(platformName => {
        const entries = groupedByPlatform[platformName].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestEntry = entries[0];
        const latestValue = latestEntry ? latestEntry.balance : 0;

        html += `
            <details class="cashflow-group">
                <summary class="cashflow-group-summary">
                    <div class="group-title">${platformName}</div>
                    <div class="group-stats">
                        <span>Einträge: ${entries.length}</span>
                        <span>Letzter Wert: <strong class="dollar-value">${formatDollar(latestValue)}</strong></span>
                    </div>
                </summary>
                <div class="cashflow-group-details">`;

        if (isMobile) {
            html += `<div class="mobile-cards" style="padding: 0; max-height: 300px; overflow-y: auto;">
                ${entries.map(entry => {
                    const strategy = getStrategyForDate(entry.date) || '';
                    return `
                    <div class="history-card" style="margin-bottom: 8px; padding: 12px;">
                        <div class="history-card-header" style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                            <div class="history-card-date editable" onclick="event.stopPropagation(); makeDateEditable(this, ${entry.id}, 'entry')">${formatDate(entry.date)}</div>
                            <div class="history-card-balance dollar-value editable" style="font-size: 1.1em;" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')">
                                ${formatDollar(entry.balance)}
                            </div>
                        </div>
                        ${strategy ? `<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;"><strong>Strategie:</strong> ${strategy}</div>` : ''}
                        <div class="history-card-details" style="border-top: none; padding-top: 0; margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                            <div class="history-card-note editable" style="flex-grow: 1;" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">
                                ${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}
                            </div>
                            <div class="history-card-actions">
                                <button class="btn btn-danger btn-small" style="padding: 6px;" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        } else {
            html += `<div class="data-table-wrapper" style="max-height: 400px;">
                        <table class="data-table" style="table-layout: auto;">
                            <thead><tr><th>Datum</th><th>Balance</th><th>Strategie</th><th>Notiz</th><th>Aktion</th></tr></thead>
                            <tbody>
                                ${entries.map(entry => `
                                    <tr>
                                        <td class="editable" onclick="event.stopPropagation(); makeDateEditable(this, ${entry.id}, 'entry')">${formatDate(entry.date)}</td>
                                        <td class="dollar-value editable" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')">${formatDollar(entry.balance)}</td>
                                        <td>${getStrategyForDate(entry.date) || '-'}</td>
                                        <td class="editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz...</span>'}</td>
                                        <td><button class="btn btn-danger btn-small" style="padding: 6px;" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})">🗑️</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`;
        }
        html += `</div>
            </details>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderHistoryMobileCards(entries) {
    const mobileCardsContainer = document.getElementById('historyMobileCards');
    if (!mobileCardsContainer) return;
    
    mobileCardsContainer.innerHTML = '';
    
    if (entries.length === 0) {
        mobileCardsContainer.innerHTML = `<div class="empty-state">Keine Einträge gefunden</div>`;
        return;
    }
    
    entries.forEach((entry, index) => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.dataset.id = entry.id;
        card.dataset.index = index;
        
        if (selectedHistoryEntries.has(entry.id)) {
            card.classList.add('multi-selected-row');
        }
        
        card.onclick = (e) => {
            if (e.target.type !== 'checkbox' && !e.target.closest('.history-card-actions')) {
                handleHistoryRowClick(e, card, entry.id, index);
            }
        };
        
        const balanceColor = entry.balance >= 0 ? 'var(--success)' : 'var(--danger)';
        
        card.innerHTML = `
            <input type="checkbox" class="history-card-checkbox" ${selectedHistoryEntries.has(entry.id) ? 'checked' : ''} 
                   onclick="event.stopPropagation(); toggleHistorySelection(${entry.id}, this.checked)">
            
            <div class="history-card-header">
                <div>
                    <div class="history-card-platform">${entry.protocol}</div>
                    <div class="history-card-date">${formatDate(entry.date)}</div>
                </div>
                <div class="history-card-balance" style="color: ${balanceColor}">
                    ${formatDollar(entry.balance)}
                </div>
            </div>
            
            ${entry.strategy ? `<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;"><strong>Strategie:</strong> ${entry.strategy}</div>` : ''}
            
            <div class="history-card-details">
                <div class="history-card-note" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')">
                    ${entry.note || '<span style="color: var(--text-secondary); cursor: pointer;">Notiz hinzufügen...</span>'}
                </div>
                <div class="history-card-actions">
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        
        mobileCardsContainer.appendChild(card);
    });
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

async function bulkChangeAmount() {
    if (selectedHistoryEntries.size === 0) {
        return showNotification('Keine Einträge ausgewählt', 'warning');
    }
    const selectionSize = selectedHistoryEntries.size;

    const result = await showCustomPrompt({
        title: 'Betrag für Auswahl ändern',
        text: `Gib einen neuen Betrag für die ${selectionSize} ausgewählten Einträge ein.`,
        showInput: true,
        actions: [{text: 'Abbrechen'}, {text: 'Ändern', class: 'btn-primary', value: 'change'}]
    });

    if (result === 'change') {
        const amountValue = document.getElementById('bottomSheet_input').value;
        const newAmount = parseFloat(amountValue.replace(',', '.'));

        if (isNaN(newAmount) || newAmount < 0) {
            return showNotification('Ungültiger Betrag eingegeben!', 'error');
        }

        entries.forEach(entry => {
            if (selectedHistoryEntries.has(entry.id)) {
                entry.balance = newAmount;
            }
        });

        selectedHistoryEntries.clear();
        saveData();
        applyDateFilter();
        showNotification(`Betrag für ${selectionSize} Einträge auf ${formatDollar(newAmount)} geändert.`);
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
    // Update table row
    const row = document.querySelector(`#historyTableBody tr[data-id='${entryId}']`);
    if (row) {
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
    }
    
    // Update mobile card
    const card = document.querySelector(`.history-card[data-id='${entryId}']`);
    if (card) {
        const cardCheckbox = card.querySelector('input[type="checkbox"]');
        if (shouldBeSelected) {
            selectedHistoryEntries.add(entryId);
            card.classList.add('multi-selected-row');
            cardCheckbox.checked = true;
        } else {
            selectedHistoryEntries.delete(entryId);
            card.classList.remove('multi-selected-row');
            cardCheckbox.checked = false;
        }
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
    if (!selectAllCheckbox) return;
    
    // Check both table rows and mobile cards
    const allVisibleRows = document.querySelectorAll('#historyTableBody tr[data-id]');
    const allVisibleCards = document.querySelectorAll('.history-card[data-id]');
    const totalVisibleItems = allVisibleRows.length + allVisibleCards.length;
    
    if (totalVisibleItems > 0) {
        const allSelected = [...allVisibleRows, ...allVisibleCards].every(item => 
            selectedHistoryEntries.has(parseFloat(item.dataset.id))
        );
        
        if (allSelected) {
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
}
// =================================================================================
// REST OF SCRIPT
// =================================================================================

function updateCashflowDisplay() {
    const container = document.getElementById('cashflowDisplayContainer');
    if (!container) return;

    if (singleItemFilter && singleItemFilter.type === 'cashflow') {
        const dataForDisplay = cashflows.filter(singleItemFilter.filterFunction);
        
        // Manuell auf Listenansicht umschalten, um Rekursion zu vermeiden
        cashflowViewMode = 'list';
        document.querySelectorAll('.view-switcher .view-btn').forEach(btn => btn.disabled = true); // Deaktiviert Umschalter
        document.querySelectorAll('.view-switcher .view-btn').forEach(btn => btn.classList.remove('active'));
        const listBtn = document.querySelector('.view-switcher .view-btn[onclick="setCashflowView(\'list\')"]');
        if (listBtn) listBtn.classList.add('active');

        renderCashflowTable(container, dataForDisplay);
        const clearButtonHtml = `<div style="margin-bottom: 16px; text-align: center;"><button class="btn btn-primary" onclick="clearSingleItemFilter()">Alle Cashflows anzeigen</button></div>`;
        container.insertAdjacentHTML('afterbegin', clearButtonHtml);
    } else {
        document.querySelectorAll('.view-switcher .view-btn').forEach(btn => btn.disabled = false);
        if (cashflowViewMode === 'list') {
            renderCashflowTable(container, filteredCashflows);
        } else {
            renderGroupedCashflow(container, cashflowViewMode, filteredCashflows);
        }
    }
}

function renderGroupedCashflow(container, groupBy, dataToDisplay) {
    const grouped = dataToDisplay.reduce((acc, cf) => {
        const date = new Date(cf.date);
        let key;
        if (groupBy === 'month') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else { // quarter
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            key = `${date.getFullYear()}-Q${quarter}`;
        }

        if (!acc[key]) {
            acc[key] = { deposits: 0, withdrawals: 0, transactions: [] };
        }

        if (cf.type === 'deposit') {
            acc[key].deposits += cf.amount;
        } else {
            acc[key].withdrawals += cf.amount;
        }
        acc[key].transactions.push(cf);
        return acc;
    }, {});

    const sortedKeys = Object.keys(grouped).sort().reverse();
    
    if (sortedKeys.length === 0) {
        container.innerHTML = `<div class="empty-state">Keine Cashflows im ausgewählten Zeitraum.</div>`;
        return;
    }

    let html = '<div class="cashflow-groups">';
    sortedKeys.forEach(key => {
        const group = grouped[key];
        const net = group.deposits - group.withdrawals;
        
        let title = '';
        if (groupBy === 'month') {
            const [year, month] = key.split('-');
            title = new Date(year, month - 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
        } else {
            title = key.replace('-Q', ' - Quartal ');
        }

        html += `
            <details class="cashflow-group">
                <summary class="cashflow-group-summary">
                    <div class="group-title">${title}</div>
                    <div class="group-stats">
                        <span class="positive">Ein: ${formatDollar(group.deposits)}</span>
                        <span class="negative">Aus: ${formatDollar(group.withdrawals)}</span>
                        <span class="${net >= 0 ? 'positive' : 'negative'}">Netto: ${formatDollar(net)}</span>
                    </div>
                </summary>
                <div class="cashflow-group-details">
                    ${group.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(cf => `
                        <div class="transaction-row" data-id="${cf.id}">
                            <div class="transaction-date">${formatDate(cf.date)}</div>
                            <div class="transaction-type type-${cf.type}">${cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung'}</div>
                            <div class="transaction-platform">${cf.platform || '-'}</div>
                            <div class="transaction-note">${cf.note || '...'}</div>
                            <div class="transaction-amount ${cf.type === 'deposit' ? 'positive' : 'negative'}">${formatDollar(cf.amount)}</div>
                            <button class="btn btn-danger btn-small" onclick="deleteCashflowWithConfirmation(${cf.id})">🗑️</button>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderCashflowTable(container, dataToDisplay) {
    container.innerHTML = `
        <div class="data-table-wrapper">
            <table class="data-table">
                <thead><tr><th class="sortable" data-sort="date">Datum <span class="sort-arrow"></span></th><th class="sortable" data-sort="type">Typ <span class="sort-arrow"></span></th><th class="sortable" data-sort="amount">Betrag <span class="sort-arrow"></span></th><th>Plattform</th><th>Notiz</th><th>Aktionen</th></tr></thead>
                <tbody id="cashflowTableBody"></tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('cashflowTableBody');
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
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Keine Cashflows gefunden</td></tr>`;
        return;
    }

    dataToDisplay.forEach(cf => {
        const row = document.createElement('tr');
        row.dataset.id = cf.id;
        row.innerHTML = `
            <td>${formatDate(cf.date)}</td>
            <td><span class="type-badge type-${cf.type}">${cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung'}</span></td>
            <td class="dollar-value ${cf.type === 'deposit' ? 'positive' : 'negative'}">${formatDollar(cf.amount)}</td>
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
            <td class="dollar-value">${formatDollar(data.avg)}</td>
            <td class="dollar-value ${data.total >= 0 ? 'positive' : 'negative'}">${data.total.toLocaleString('de-DE', {signDisplay: 'always', minimumFractionDigits: 2})}</td>
        `;
        tbody.appendChild(row);
    });
}

// =================================================================================
// CHARTS & EXPORT
// =================================================================================

const getOrCreateTooltip = (chart) => {
    let tooltipEl = document.querySelector('.chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'chartjs-tooltip';
        // HINWEIS: Wir setzen keine ID, da wir nach der Klasse suchen und sie nur einmal existieren sollte.
        document.body.appendChild(tooltipEl);
    }

    let contentEl = tooltipEl.querySelector('.chartjs-tooltip-content');
    if (!contentEl) {
        contentEl = document.createElement('div');
        contentEl.className = 'chartjs-tooltip-content';
        tooltipEl.innerHTML = '';
        tooltipEl.appendChild(contentEl);
    }

    return tooltipEl;
};

const externalTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const tooltipContainer = tooltipEl.querySelector('.chartjs-tooltip-content');
    if (!tooltipContainer || !tooltip.dataPoints.length) {
        return;
    }
        
    const dataIndex = tooltip.dataPoints[0].dataIndex;
    const date = chart.data.originalDates[dataIndex];
    if (!date) return;
    
    // --- (Der gesamte Code zum Befüllen des Tooltips bleibt identisch) ---
    const portfolioValueToday = chart.data.portfolioValues[dataIndex];
    const twrPercentage = chart.data.datasets[0].data[dataIndex] || 0;
    const depositsUpToDate = cashflows.filter(c => c.type === 'deposit' && c.date <= date).reduce((s, c) => s + c.amount, 0);
    const withdrawalsUpToDate = cashflows.filter(c => c.type === 'withdraw' && c.date <= date).reduce((s, c) => s + c.amount, 0);
    const netCashflowUpToDate = depositsUpToDate - withdrawalsUpToDate;
    const profit = portfolioValueToday - netCashflowUpToDate;
    const roiPercentage = netCashflowUpToDate > 0 ? (profit / netCashflowUpToDate) * 100 : 0;
    let dailyPerformance = 0;
    if (dataIndex > 0) {
        const previousTwrPercentage = chart.data.datasets[0].data[dataIndex - 1] || 0;
        dailyPerformance = twrPercentage - previousTwrPercentage;
    }
    const dayStrategy = dayStrategies.find(s => s.date === date)?.strategy || 'Keine Strategie für diesen Tag hinterlegt.';
    const activeProtocols = entries.filter(e => e.date === date && e.balance > 0).map(e => e.protocol).join(', ');
    tooltipContainer.innerHTML = ''; 
    const twrColor = twrPercentage >= 0 ? 'var(--success)' : 'var(--danger)';
    const roiColor = roiPercentage >= 0 ? 'var(--success)' : 'var(--danger)';
    const perfColorDaily = dailyPerformance >= 0 ? 'var(--success)' : 'var(--danger)';
    const headerEl = document.createElement('div');
    headerEl.style.borderBottom = '1px solid var(--border)';
    headerEl.style.paddingBottom = '8px';
    headerEl.style.marginBottom = '8px';
    headerEl.innerHTML = `<div style="font-size: 1.3em; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">${formatDollar(portfolioValueToday)}</div><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;"><div style="background: ${twrColor}15; border-radius: 6px; padding: 8px; border: 1px solid ${twrColor}20;"><div style="font-size: 0.65em; color: var(--text-secondary); margin-bottom: 2px; opacity: 0.8;">Performance</div><div style="color: ${twrColor}; font-weight: 700; font-size: 1.1em;">${twrPercentage >= 0 ? '+' : ''}${twrPercentage.toFixed(2)}%</div><div style="font-size: 0.65em; color: var(--text-secondary); margin-top: 2px; font-weight: 600;">TWR</div></div><div style="background: ${roiColor}15; border-radius: 6px; padding: 8px; border: 1px solid ${roiColor}20;"><div style="font-size: 0.65em; color: var(--text-secondary); margin-bottom: 2px; opacity: 0.8;">Gewinn</div><div style="color: ${roiColor}; font-weight: 700; font-size: 1.1em;">${roiPercentage >= 0 ? '+' : ''}${roiPercentage.toFixed(2)}%</div><div style="font-size: 0.65em; color: var(--text-secondary); margin-top: 2px; font-weight: 600;">ROI</div></div><div style="background: ${perfColorDaily}15; border-radius: 6px; padding: 8px; border: 1px solid ${perfColorDaily}20;"><div style="font-size: 0.65em; color: var(--text-secondary); margin-bottom: 2px; opacity: 0.8;">Änderung</div><div style="color: ${perfColorDaily}; font-weight: 700; font-size: 1.1em;">${dailyPerformance >= 0 ? '+' : ''}${dailyPerformance.toFixed(2)}%</div><div style="font-size: 0.65em; color: var(--text-secondary); margin-top: 2px; font-weight: 600;">Periode</div></div></div>`;
    tooltipContainer.appendChild(headerEl);
    const dateEl = document.createElement('div');
    dateEl.style.fontSize = '0.85em';dateEl.style.color = 'var(--text-secondary)';dateEl.style.marginBottom = '8px';dateEl.style.fontWeight = '500';
    dateEl.innerHTML = `📅 ${new Date(date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    tooltipContainer.appendChild(dateEl);
    if (dayStrategy !== 'Keine Strategie für diesen Tag hinterlegt.' || activeProtocols) {
        const infoSection = document.createElement('div');
        infoSection.style.marginTop = '8px';infoSection.style.paddingTop = '8px';infoSection.style.borderTop = '1px solid var(--border)';infoSection.style.fontSize = '0.8em';
        let infoHTML = '';
        if (dayStrategy !== 'Keine Strategie für diesen Tag hinterlegt.') {
            infoHTML += `<div style="margin-bottom: 6px;"><div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">🎯 Strategie</div><div style="color: var(--text-secondary); padding-left: 4px;">${dayStrategy}</div></div>`;
            if (activeProtocols) infoHTML += `<div style="border-bottom: 1px solid var(--border); margin: 8px 0;"></div>`;
        }
        if (activeProtocols) infoHTML += `<div style="margin-bottom: 6px;"><div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">💼 Plattformen</div><div style="color: var(--text-secondary); padding-left: 4px;">${activeProtocols}</div></div>`;
        infoSection.innerHTML = infoHTML;
        tooltipContainer.appendChild(infoSection);
    }

    const benchmarksEl = document.createElement('div');
    benchmarksEl.style.marginTop = '8px';benchmarksEl.style.paddingTop = '8px';benchmarksEl.style.borderTop = '1px solid var(--border)';benchmarksEl.style.fontSize = '0.8em';
    let benchmarkHTML = '<div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">📈 Benchmarks</div>';

    // S&P 500 (Index 1)
    if (chart.isDatasetVisible(1)) {
        const sp500Performance = chart.data.datasets[1]?.data[dataIndex];
        if (sp500Performance !== undefined && sp500Performance !== null) {
            const sp500Color = sp500Performance >= 0 ? 'var(--success)' : 'var(--danger)';
            benchmarkHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="color: var(--text-secondary);">S&P 500:</span><span style="color: ${sp500Color}; font-weight: 500;">${sp500Performance >= 0 ? '+' : ''}${sp500Performance.toFixed(2)}%</span></div>`;
        }
    }
    // DAX (Index 2)
    if (chart.isDatasetVisible(2)) {
        const daxPerformance = chart.data.datasets[2]?.data[dataIndex];
        if (daxPerformance !== undefined && daxPerformance !== null) {
            const daxColor = daxPerformance >= 0 ? 'var(--success)' : 'var(--danger)';
            benchmarkHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="color: var(--text-secondary);">DAX:</span><span style="color: ${daxColor}; font-weight: 500;">${daxPerformance >= 0 ? '+' : ''}${daxPerformance.toFixed(2)}%</span></div>`;
        }
    }
    // Bitcoin (Index 3)
    if (chart.isDatasetVisible(3)) {
        const btcPerformance = chart.data.datasets[3]?.data[dataIndex];
        if (btcPerformance !== undefined && btcPerformance !== null) {
            const btcColor = btcPerformance >= 0 ? 'var(--success)' : 'var(--danger)';
            benchmarkHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="color: var(--text-secondary);">Bitcoin:</span><span style="color: ${btcColor}; font-weight: 500;">${btcPerformance >= 0 ? '+' : ''}${btcPerformance.toFixed(2)}%</span></div>`;
        }
    }
    // Ethereum (Index 4)
    if (chart.isDatasetVisible(4)) {
        const ethPerformance = chart.data.datasets[4]?.data[dataIndex];
        if (ethPerformance !== undefined && ethPerformance !== null) {
            const ethColor = ethPerformance >= 0 ? 'var(--success)' : 'var(--danger)';
            benchmarkHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="color: var(--text-secondary);">Ethereum:</span><span style="color: ${ethColor}; font-weight: 500;">${ethPerformance >= 0 ? '+' : ''}${ethPerformance.toFixed(2)}%</span></div>`;
        }
    }
    // DeFi Pulse Index (Index 5)
    if (chart.isDatasetVisible(5)) {
        const dpiPerformance = chart.data.datasets[5]?.data[dataIndex];
        if (dpiPerformance !== undefined && dpiPerformance !== null) {
            const dpiColor = dpiPerformance >= 0 ? 'var(--success)' : 'var(--danger)';
            benchmarkHTML += `<div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">DeFi Pulse Index:</span><span style="color: ${dpiColor}; font-weight: 500;">${dpiPerformance >= 0 ? '+' : ''}${dpiPerformance.toFixed(2)}%</span></div>`;
        }
    }

    // Nur anzeigen, wenn es Benchmark-Daten gibt
    if (benchmarkHTML.includes('</span>')) {
        benchmarksEl.innerHTML = benchmarkHTML;
        tooltipContainer.appendChild(benchmarksEl);
    }

    // VERBESSERTE MOBILE POSITIONIERUNG
    tooltipEl.style.opacity = 1;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Auf Mobile: Tooltip zentriert am unteren Bildschirmrand
        tooltipEl.style.position = 'fixed';
        tooltipEl.style.left = '50%';
        tooltipEl.style.transform = 'translateX(-50%)';
        tooltipEl.style.bottom = '20px';
        tooltipEl.style.top = 'auto';
        tooltipEl.style.width = 'calc(100% - 40px)';
        tooltipEl.style.maxWidth = '400px';
    } else {
        // Desktop: Beibehaltung der stabilen Positionierung von der letzten Änderung
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transform = '';
        tooltipEl.style.bottom = 'auto';
        tooltipEl.style.width = 'auto';
        tooltipEl.style.maxWidth = '320px';

        const canvasRect = chart.canvas.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;
        const offset = 15;

        // Horizontale Positionierung
        let left;
        if (canvasRect.left + tooltip.caretX + tooltipRect.width + offset + margin < viewportWidth) {
            left = canvasRect.left + tooltip.caretX + offset;
        } else if (canvasRect.left + tooltip.caretX - tooltipRect.width - offset - margin > 0) {
            left = canvasRect.left + tooltip.caretX - tooltipRect.width - offset;
        } else {
            left = (viewportWidth - tooltipRect.width) / 2;
        }

        // Vertikale Positionierung: Fest an der Oberseite des Charts
        let top = canvasRect.top + offset;

        if (left < margin) left = margin;
        if (left + tooltipRect.width + margin > viewportWidth) left = viewportWidth - tooltipRect.width - margin;
        if (top < margin) top = margin;
        if (top + tooltipRect.height + margin > viewportHeight) top = viewportHeight - tooltipRect.height - margin;

        tooltipEl.style.left = left + window.scrollX + 'px';
        tooltipEl.style.top = top + window.scrollY + 'px';
    }
};

function initializeCharts() {
    const textColor = currentTheme === 'dark' ? '#f9fafb' : '#1f2937';
    const gridColor = currentTheme === 'dark' ? '#374151' : '#e5e7eb';

    const isMobile = isMobileDevice();

    // Auf Mobile die Benchmark-Auswahl ausblenden, da wir eine feste, vereinfachte Ansicht haben.
    const benchmarkToggleBtn = document.getElementById('benchmarkToggleBtn');
    if (benchmarkToggleBtn) {
        benchmarkToggleBtn.style.display = isMobile ? 'none' : 'inline-flex';
    }

    const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
    if (portfolioCtx) {
        portfolioChart = new Chart(portfolioCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Portfolio', data: [], borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 6, pointHitRadius: 20, pointBackgroundColor: '#4f46e5' },
                    { label: 'S&P 500', data: [], borderColor: '#e53e3e', borderWidth: 2, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 6, borderDash: [5, 5], hidden: false },
                    { label: 'DAX', data: [], borderColor: '#3b82f6', borderWidth: 2, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 6, borderDash: [5, 5], hidden: false },
                    { label: 'Bitcoin', data: [], borderColor: '#f59e0b', borderWidth: 2, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 6, borderDash: [5, 5], hidden: true },
                    { label: 'Ethereum', data: [], borderColor: '#8b5cf6', borderWidth: 2, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 6, borderDash: [5, 5], hidden: true },
                    { label: 'DeFi Pulse Index', data: [], borderColor: '#ec4899', borderWidth: 2, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 6, borderDash: [5, 5], hidden: true },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        ticks: {
                            color: textColor,
                            callback: (value) => `${value.toFixed(0)}%`
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        align: 'start',
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: isMobile ? 10 : 20,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: externalTooltipHandler
                    },
                    datalabels: {
                        display: false
                    }
                }
            }
        });

        // Auf Mobile nur Portfolio + 1 Benchmark (S&P 500) standardmäßig anzeigen.
        if (isMobile) {
            portfolioChart.data.datasets[2].hidden = true; // DAX
            portfolioChart.data.datasets[3].hidden = true; // Bitcoin
            portfolioChart.data.datasets[4].hidden = true; // Ethereum
            portfolioChart.data.datasets[5].hidden = true; // DeFi Pulse Index
        }

        // Verbessertes Touch-Verhalten für den Tooltip auf Mobilgeräten
        portfolioCtx.canvas.addEventListener('touchstart', (e) => {
            const tooltipEl = document.querySelector('.chartjs-tooltip');
            // Wenn der Tooltip sichtbar ist, wird er bei einem erneuten Touch auf den Chart geschlossen.
            if (tooltipEl && tooltipEl.style.opacity === '1') {
                tooltipEl.style.opacity = '0';
                // Verhindert, dass Chart.js sofort einen neuen Tooltip an der Touch-Position öffnet.
                e.preventDefault();
            }
        }, { passive: false }); // passive: false ist notwendig, damit preventDefault() funktioniert.
    }

    const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
    if (allocationCtx) {
        allocationChart = new Chart(allocationCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#34d399', '#6ee7b7', '#a7f3d0', '#fBBf24', '#fb923c', '#f87171', '#fb7185'] }] },
            options: { 
                responsive: true, maintainAspectRatio: false, onClick: handleChartClick,
                plugins: {
                    legend: { position: 'top', labels: { color: textColor } },
                    tooltip: { callbacks: { label: (c) => `${c.label}: ${formatDollar(c.parsed)}` } },
                    datalabels: {
                        formatter: (v, ctx) => (v * 100 / ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0)) > 3 ? `${(v * 100 / ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0)).toFixed(1)}%` : '',
                        color: '#fff', font: { weight: 'bold', size: 14 }, textStrokeColor: 'rgba(0,0,0,0.5)', textStrokeWidth: 2
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
    updateChartWithBenchmarks();
    
    const dateGroups = filteredEntries.reduce((acc, e) => { acc[e.date] = (acc[e.date] || 0) + e.balance; return acc; }, {});
    const sortedDates = Object.keys(dateGroups).sort((a,b) => new Date(a) - new Date(b));

    if (allocationChart && sortedDates.length > 0) {
        const latestDate = sortedDates[sortedDates.length - 1];
        const latestEntries = filteredEntries.filter(e => e.date === latestDate && e.balance > 0);
        allocationChart.data.labels = latestEntries.map(e => e.protocol);
        allocationChart.data.datasets[0].data = latestEntries.map(e => e.balance);
        allocationChart.update();
    }
}

function clearOldestCacheEntry() {
    let oldestTimestamp = Date.now();
    let oldestKey = null;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item && item.timestamp && item.timestamp < oldestTimestamp) {
                    oldestTimestamp = item.timestamp;
                    oldestKey = key;
                }
            } catch (e) {
                // Ignore if item is not valid JSON
            }
        }
    }

    if (oldestKey) {
        console.warn(`LocalStorage is full. Evicting oldest cache entry: ${oldestKey}`);
        localStorage.removeItem(oldestKey);
        showNotification('Cache-Speicher optimiert', 'info');
        return true; // Indicate that an item was removed
    }
    return false; // Indicate nothing was removed
}

async function fetchAndCache(cacheKey, url, options, dataProcessor, cacheDurationMinutes = 1440, responseType = 'json') {
    // Use localStorage for persistence across sessions
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
        try {
            const { timestamp, data } = JSON.parse(cachedItem);
            // Cache is valid for 24 hours (1440 minutes)
            if (Date.now() - timestamp < cacheDurationMinutes * 60 * 1000) {
                console.log(`Using cached data for ${cacheKey}`);
                return data;
            }
        } catch (e) {
            console.warn(`Could not parse cached data for ${cacheKey}, fetching new data.`);
            localStorage.removeItem(cacheKey);
        }
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = new Error(`API call failed with status ${response.status}`);
            error.status = response.status;
            throw error;
        }

        let rawData;
        if (responseType === 'text') {
            rawData = await response.text();
        } else {
            rawData = await response.json();
        }
        const processedData = dataProcessor(rawData);
        
        if (processedData && processedData.length > 0) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: processedData }));
                return processedData;
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.warn(`QuotaExceededError: Could not cache data for ${cacheKey}. Data will not be persisted.`);
                    showNotification('Cache-Speicher voll. Daten nicht zwischengespeichert.', 'warning');
                    // Return the processed data, but don't cache it.
                    return processedData;
                }
                // Re-throw other types of errors from the initial setItem attempt
                throw e;
            }
        } else {
            throw new Error('No valid data returned from API after processing.');
        }
    } catch (error) {
        // Don't log expected API limit/permission errors as "errors".
        if (error.status !== 429 && error.status !== 403) {
            console.error(`Error fetching or processing data for ${cacheKey}:`, error);
        }
        throw error; // Re-throw to be handled by the caller
    }
}

// Interpolation für fehlende Tage
function interpolateBenchmarkData(benchmarkKey, dates) {
    const benchmarkPoints = benchmarkData[benchmarkKey] || [];
    if (!benchmarkPoints || benchmarkPoints.length < 2) return [];

    const firstBenchmarkDate = new Date(benchmarkPoints[0].date);
    const lastBenchmarkDate = new Date(benchmarkPoints[benchmarkPoints.length - 1].date);
    
    const result = [];
    
    for (const date of dates) {
        const dateObj = new Date(date);

        if (dateObj < firstBenchmarkDate || dateObj > lastBenchmarkDate) {
            result.push([dateObj.getTime(), null]);
            continue;
        }
        
        // Finde die zwei nächsten Stützpunkte
        let before = null;
        let after = null;
        
        for (let i = 0; i < benchmarkPoints.length; i++) {
            const pointDate = new Date(benchmarkPoints[i].date);
            
            if (pointDate <= dateObj) {
                before = benchmarkPoints[i];
            }
            if (pointDate >= dateObj && !after) {
                after = benchmarkPoints[i];
            }
        }
        
        let value;
        if (before && after && before !== after) {
            // Linear interpolieren zwischen zwei Punkten
            const beforeDate = new Date(before.date);
            const afterDate = new Date(after.date);
            const totalDays = (afterDate - beforeDate) / (1000 * 60 * 60 * 24);
            const daysPassed = (dateObj - beforeDate) / (1000 * 60 * 60 * 24);
            const ratio = totalDays > 0 ? (daysPassed / totalDays) : 0;
            value = before.value + (after.value - before.value) * ratio;
        } else if (before) {
            value = before.value;
        } else if (after) {
            value = after.value;
        } else {
            value = null; // Kein Wert, wenn außerhalb des Bereichs
        }
        
        result.push([dateObj.getTime(), value]);
    }
    
    return result;
}

async function fetchCoinGeckoData(id, from, to) {
    const url = `${CORS_PROXY}${COINGECKO_API}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status; // Attach status to error object
            throw error;
        }
        const data = await response.json();
        return data.prices || [];
    } catch (error) {
        if (error.status === 429) {
            console.warn(`CoinGecko API rate limit hit for ${id}. Consider waiting before refreshing. Using fallback.`);
        } else {
            console.error(`Failed to fetch ${id} data, using fallback:`, error);
        }
        return []; // Return empty array as a fallback
    }
}

function calculateTWR(dates, values, cashflowsToConsider) {
    if (dates.length < 2) return new Array(dates.length).fill(0);

    let cumulativeReturn = 1;
    const percentages = [0];
    const MIN_VALUE_FOR_RETURN_CALC = 0.01; // Verhindert Division durch sehr kleine Zahlen

    for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        const startValue = values[i - 1];
        const endValue = values[i];

        const cashflowBetween = cashflowsToConsider
            .filter(c => c.date > prevDate && c.date <= currDate)
            .reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);

        const periodReturn = startValue > MIN_VALUE_FOR_RETURN_CALC
            ? (endValue - startValue - cashflowBetween) / startValue
            : 0;
        
        cumulativeReturn *= (1 + periodReturn);
        percentages.push((cumulativeReturn - 1) * 100);
    }

    return percentages;
}

async function updateChartWithBenchmarks() {
    const dateGroups = filteredEntries.reduce((acc, e) => { acc[e.date] = (acc[e.date] || 0) + e.balance; return acc; }, {});
    const sortedDates = Object.keys(dateGroups).sort((a,b) => new Date(a) - new Date(b));

    if (!portfolioChart) return;
    
    // Fall 1: Keine oder zu wenige Daten -> Diagramm leeren und beenden.
    if (sortedDates.length < 2) {
        portfolioChart.data.labels = [];
        portfolioChart.data.datasets.forEach(ds => ds.data = []);
        portfolioChart.update();
        return;
    }

    // Portfolio-Daten vorbereiten
    const portfolioValues = sortedDates.map(d => dateGroups[d]);
    portfolioChart.data.originalDates = sortedDates; 
    portfolioChart.data.portfolioValues = portfolioValues;

    const maxLabels = window.innerWidth < 768 ? 4 : 8; 
    // Sicherstellen, dass stepSize mindestens 1 ist, um Division durch Null zu vermeiden
    const stepSize = Math.max(1, Math.ceil(sortedDates.length / maxLabels));

    portfolioChart.data.labels = sortedDates.map((d, i) => (i % stepSize === 0) ? new Date(d).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }) : '');
    
    // Eigene Portfolio-Linie berechnen und setzen
    portfolioChart.data.datasets[0].data = calculateTWR(sortedDates, portfolioValues, filteredCashflows);
    
    // WICHTIG: Benchmark-Linien vor dem ersten Zeichnen leeren
    for (let i = 1; i < portfolioChart.data.datasets.length; i++) {
        portfolioChart.data.datasets[i].data = [];
    }

    // *** SCHRITT 1: SOFORT ZEICHNEN ***
    // Das Diagramm wird jetzt sofort mit der eigenen Portfolio-Linie angezeigt.
    portfolioChart.update();

    // *** SCHRITT 2: BENCHMARKS IM HINTERGRUND LADEN UND HINZUFÜGEN ***
    try {
        // Startdatum für Benchmark-Daten: Entweder frühestes Portfolio-Datum oder MIN_BENCHMARK_DATE, je nachdem, was später ist.
        const portfolioStartDate = new Date(sortedDates[0] + 'T00:00:00Z');
        const actualFromDate = portfolioStartDate > MIN_BENCHMARK_DATE ? portfolioStartDate : MIN_BENCHMARK_DATE;
        const fromTs = Math.floor(actualFromDate.getTime() / 1000);
        const toTs = Math.floor(new Date(sortedDates[sortedDates.length - 1]).getTime() / 1000) + 86400;

        // Korrigierte Funktion zur Berechnung der Benchmark-Performance
        const calculateBenchmarkChange = (benchmarkPrices, portfolioDates) => {
            if (!benchmarkPrices || benchmarkPrices.length < 1 || !portfolioDates || portfolioDates.length < 1) {
                return new Array(portfolioDates.length).fill(null);
            }

            // 1. Finde den Startwert (Baseline) für den Beginn des Portfolio-Zeitraums.
            const portfolioStartTs = new Date(portfolioDates[0] + 'T00:00:00Z').getTime();
            let baselinePrice = null;

            // Finde den letzten verfügbaren Kurs am oder vor dem Startdatum des Portfolios.
            let baselineCandidate = null;
            for (const [ts, price] of benchmarkPrices) {
                if (ts <= portfolioStartTs) {
                    if (price !== null) baselineCandidate = price;
                } else {
                    // Da benchmarkPrices sortiert ist, können wir frühzeitig abbrechen.
                    break;
                }
            }
            
            // Wenn kein Kurs vor dem Startdatum gefunden wurde, nimm den allerersten verfügbaren Kurs.
            if (baselineCandidate !== null) {
                baselinePrice = baselineCandidate;
            } else if (benchmarkPrices.length > 0 && benchmarkPrices[0][1] !== null) {
                baselinePrice = benchmarkPrices[0][1];
            }

            if (baselinePrice === null || baselinePrice === 0) {
                console.warn(`Konnte keinen validen Startwert für die Benchmark-Berechnung finden für den Zeitraum beginnend am ${portfolioDates[0]}.`);
                return new Array(portfolioDates.length).fill(null);
            }

            // 2. Berechne die prozentuale Veränderung für jeden Portfoliotag.
            const results = [];
            let benchmarkIndex = 0;

            for (const dateStr of portfolioDates) {
                const currentTs = new Date(dateStr + 'T00:00:00Z').getTime();

                // Finde den letzten bekannten Benchmark-Kurs für das aktuelle Datum.
                while (benchmarkIndex + 1 < benchmarkPrices.length && benchmarkPrices[benchmarkIndex + 1][0] <= currentTs) {
                    benchmarkIndex++;
                }

                const currentPrice = benchmarkPrices[benchmarkIndex][1];
                if (currentPrice !== null) {
                    const change = ((currentPrice - baselinePrice) / baselinePrice) * 100;
                    results.push(change);
                } else {
                    // Wenn kein Kurs gefunden wird, den letzten gültigen Wert weitertragen oder 0, wenn es der erste ist.
                    results.push(results.length > 0 ? results[results.length - 1] : 0);
                }
            }
            return results;
        };

        // Daten parallel laden
        // Lade nicht-krypto Daten parallel
        const [sp500Prices, daxPrices] = await Promise.all([
            fetchMarketData('%5EGSPC', fromTs, toTs),
            fetchMarketData('%5EGDAXI', fromTs, toTs),
        ]);
        
        // Lade Krypto-Daten sequenziell mit einer kleinen Verzögerung, um CoinGecko Rate-Limits (429 Fehler) zu vermeiden.
        const btcPrices = await fetchMarketData('bitcoin', fromTs, toTs);
        await new Promise(resolve => setTimeout(resolve, 350)); // Kurze Pause
        const ethPrices = await fetchMarketData('ethereum', fromTs, toTs);
        await new Promise(resolve => setTimeout(resolve, 350)); // Kurze Pause
        const dpiPrices = await fetchCoinGeckoData('defipulse-index', fromTs, toTs);

        // Benchmark-Daten zur Chart-Konfiguration hinzufügen
        portfolioChart.data.datasets[1].data = calculateBenchmarkChange(sp500Prices, sortedDates);
        portfolioChart.data.datasets[2].data = calculateBenchmarkChange(daxPrices, sortedDates);
        portfolioChart.data.datasets[3].data = calculateBenchmarkChange(btcPrices, sortedDates);
        portfolioChart.data.datasets[4].data = calculateBenchmarkChange(ethPrices, sortedDates);
        portfolioChart.data.datasets[5].data = calculateBenchmarkChange(dpiPrices, sortedDates);

        // Das Diagramm ein zweites Mal aktualisieren, um die neuen Benchmark-Linien zu zeichnen
        portfolioChart.update();

    } catch (error) {
        console.error("Benchmarks konnten nicht geladen werden, Portfolio wird trotzdem angezeigt:", error);
    }
}

function useStaticFallback(ticker) {
    const benchmarkMap = { '%5EGDAXI': 'DAX', '%5EGSPC': 'SP500' };
    const benchmarkKey = benchmarkMap[ticker];
    if (benchmarkKey) {
        const portfolioDates = portfolioChart.data.originalDates || [];
        console.log(`Using static fallback data for ${benchmarkKey}.`);
        if (portfolioDates.length > 0) {
            return interpolateBenchmarkData(benchmarkKey, portfolioDates);
        }
    }
    return [];
}

async function fetchMarketData(ticker, from, to) {
    const decodedTicker = decodeURIComponent(ticker);

    // Direkte Weiterleitung zu CoinGecko für Kryptowährungen, da dies zuverlässiger als Google Docs ist.
    if (['bitcoin', 'ethereum'].includes(decodedTicker)) {
        return fetchCoinGeckoData(decodedTicker, from, to);
    }

    const sheetUrl = GOOGLE_SHEET_URLS[ticker];
    if (!sheetUrl || sheetUrl.includes('YOUR_')) {
        console.warn(`Google Sheet URL für ${decodedTicker} ist nicht konfiguriert.`);
        showNotification(`Sheet für ${decodedTicker} nicht konfiguriert. Fallback wird genutzt.`, 'warning');
        return useStaticFallback(ticker);
    }
    const url = CORS_PROXY + sheetUrl; // Verwende den CORS-Proxy

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const csvText = await response.text();

        // NEU: Explizite Prüfung auf den Ladezustand von Google Sheets.
        const csvTextLower = csvText.trim().toLowerCase();
        if (csvTextLower.startsWith('wird geladen...') || csvTextLower.startsWith('loading...')) {
            console.warn(`Google Sheet für ${decodeURIComponent(ticker)} lädt noch. Fallback wird genutzt.`);
            showNotification(`Sheet für ${decodedTicker} lädt noch. Fallback wird genutzt.`, 'info');
            return useStaticFallback(ticker);
        }


        const lines = csvText.split(/\r\n|\n/);
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        
        // Flexiblere Spaltenerkennung, die auf Schlüsselwörtern basiert
        const dateColIndex = headers.findIndex(h => h.includes('date') || h.includes('datum'));
        const closeColIndex = headers.findIndex(h => h.includes('close') || h.includes('schluss'));

        if (dateColIndex === -1 || closeColIndex === -1) {
            console.warn(`Konnte Header "Date/Datum" und "Close/Schluss" im CSV für ${ticker} nicht finden. Gefundene Header:`, headers);
            showNotification(`Fehler im CSV-Format für ${decodedTicker}. Fallback wird genutzt.`, 'warning');
            return useStaticFallback(ticker);
        }

        const prices = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const fields = line.split(',').map(f => f.replace(/"/g, '').trim());
            const dateStr = fields[dateColIndex];
            const priceStr = fields[closeColIndex];
            if (dateStr && priceStr) {
                const datePart = dateStr.split(' ')[0]; // Handle "DD.MM.YYYY HH:MM:SS"
                const [day, month, year] = datePart.split('.');
                
                // Verbesserte, robustere Preis-Umwandlung, die deutsche und amerikanische Formate handhaben kann.
                const lastComma = priceStr.lastIndexOf(',');
                const lastDot = priceStr.lastIndexOf('.');
                let cleanedPriceStr;

                if (lastComma > lastDot) {
                    // Annahme: Deutsches Format (z.B. "1.234,56")
                    cleanedPriceStr = priceStr.replace(/\./g, '').replace(',', '.');
                } else {
                    // Annahme: US/ISO Format (z.B. "1,234.56" oder "1234.56")
                    cleanedPriceStr = priceStr.replace(/,/g, '');
                }

                if (month && day && year) { // Ensure date components are valid
                    const date = new Date(Date.UTC(year, month - 1, day)); // Month is 0-indexed
                    const price = parseFloat(cleanedPriceStr);
                    if (!isNaN(date.getTime()) && !isNaN(price) && price > 0) { // Ensure valid date and positive price
                        prices.push([date.getTime(), price]);
                    }
                }
            }
        }
        if (prices.length > 0) {
            console.log(`%cErfolgreich ${prices.length} Datenpunkte für ${decodedTicker} aus Google Sheet geladen.`, 'color: green; font-weight: bold;');
        }
        return prices;
    } catch (error) {
        console.error(`Fehler beim Laden oder Verarbeiten des Google Sheets für ${decodeURIComponent(ticker)}:`, error);
        showNotification(`Fehler beim Laden der Daten für ${decodedTicker}. Fallback wird genutzt.`, 'error');
        return useStaticFallback(ticker);
    }
}

function toggleBenchmarkView() {
    if (!portfolioChart) return;
    showingCryptoBenchmarks = !showingCryptoBenchmarks;
    const btn = document.getElementById('benchmarkToggleBtn');
    if (btn) btn.textContent = showingCryptoBenchmarks ? '- Crypto' : '+ Crypto';
    
    portfolioChart.setDatasetVisibility(1, !showingCryptoBenchmarks);
    portfolioChart.setDatasetVisibility(2, !showingCryptoBenchmarks);
    portfolioChart.setDatasetVisibility(3, showingCryptoBenchmarks);
    portfolioChart.setDatasetVisibility(4, showingCryptoBenchmarks);
    portfolioChart.setDatasetVisibility(5, showingCryptoBenchmarks);
    portfolioChart.update();
}

function refreshBenchmarkData() {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('yahoo_') || key.startsWith('coingecko_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    showNotification('Marktdaten werden aktualisiert...', 'info');
    updateChartWithBenchmarks();
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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ platforms, entries, cashflows, dayStrategies, favorites }));
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

    const header = ["Typ", "Datum", "Plattform/Strategie", "Betrag", "Notiz"];
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

    dayStrategies.forEach(ds => {
        rows.push([
            "Tages-Strategie",
            ds.date,
            sanitize(ds.strategy),
            "",
            ""
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

async function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showNotification('Lese CSV-Datei...', 'info');
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/);
            const newEntries = [];
            const newCashflows = [];
            const newDayStrategies = [];
            let skippedLines = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) continue;

                const fields = parseCsvLine(line);
                if (fields.length < 2) {
                    skippedLines++;
                    continue;
                }
                
                const [type, date, protocolOrStrategy, amountStr, note] = fields;
                const amount = parseFloat(String(amountStr || '0').replace(',', '.'));

                if (type && date) {
                    const lowerType = type.toLowerCase();
                    if (lowerType === 'balance' && protocolOrStrategy && !isNaN(amount)) {
                        newEntries.push({ id: Date.now() + Math.random(), date, protocol: protocolOrStrategy, balance: amount, note: note || '' });
                    } else if ((lowerType === 'einzahlung' || lowerType === 'auszahlung') && !isNaN(amount)) {
                        newCashflows.push({ id: Date.now() + Math.random(), date, type: lowerType === 'einzahlung' ? 'deposit' : 'withdraw', amount: amount, platform: protocolOrStrategy, note: note || '' });
                    } else if (lowerType === 'tages-strategie' && protocolOrStrategy) {
                        newDayStrategies.push({ date, strategy: protocolOrStrategy });
                    } else {
                        skippedLines++;
                    }
                } else {
                    skippedLines++;
                }
            }

            if (newEntries.length === 0 && newCashflows.length === 0 && newDayStrategies.length === 0) {
                return showNotification(`Keine gültigen Daten im CSV gefunden. ${skippedLines > 0 ? `${skippedLines} Zeilen übersprungen.` : ''}`, 'error');
            }

            const confirmationText = `${newEntries.length} Balance-Einträge, ${newCashflows.length} Cashflows und ${newDayStrategies.length} Strategien gefunden.${skippedLines > 0 ? `<br><br><strong>⚠️ ${skippedLines} Zeilen wurden übersprungen.</strong>` : ''}<br><br>Sollen diese Daten importiert werden?`;
            const confirmed = await showCustomPrompt({ title: 'CSV-Import bestätigen', text: confirmationText, actions: [{ text: 'Abbrechen', class: 'btn-danger' }, { text: 'Importieren', class: 'btn-success', value: true }] });

            if (confirmed) {
                entries.push(...newEntries);
                cashflows.push(...newCashflows);
                dayStrategies.push(...newDayStrategies);
                saveData();
                applyDateFilter();
                showNotification('Daten erfolgreich importiert!', 'success');
            } else {
                showNotification('CSV-Import abgebrochen.', 'warning');
            }
        } catch (error) {
            console.error("Fehler beim CSV-Import:", error);
            showNotification('Fehler beim Verarbeiten der CSV-Datei.', 'error');
        }
    };

    reader.onerror = () => {
        showNotification('Fehler beim Lesen der Datei.', 'error');
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
            if (data && data.platforms && data.entries && data.cashflows) {
                const confirmed = await showCustomPrompt({
                    title: 'JSON Import bestätigen',
                    text: `Dies wird alle aktuellen Daten überschreiben. Fortfahren? Geben Sie "IMPORT" ein, um zu bestätigen.` ,
                    showInput: true
                });
                if (confirmed && confirmed.toUpperCase() === 'IMPORT') {
                    platforms = data.platforms;
                    entries = data.entries;
                    cashflows = data.cashflows;
                    favorites = data.favorites || [];
                    dayStrategies = data.dayStrategies || [];
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
    const date = new Date(dateStr);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return localDate.toLocaleDateString('de-DE', options);
}

const formatDollar = (value) => {
    if (typeof value !== 'number') return '$0.00';
    if (document.body.classList.contains('privacy-mode')) return '$******';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};


function setToToday() { 
    const dateInput = document.getElementById('entryDate');
    dateInput.valueAsDate = new Date();
    dateInput.dispatchEvent(new Event('change'));
}
function setToYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const dateInput = document.getElementById('entryDate');
    dateInput.valueAsDate = d;
    dateInput.dispatchEvent(new Event('change'));
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

async function restoreFromLocalBackup() {
    const confirmed = await showCustomPrompt({
        title: 'Aus lokalem Backup wiederherstellen',
        text: 'Dies überschreibt deine aktuellen Daten mit dem letzten automatischen Backup. Bist du sicher? Gib "RESTORE" ein, um fortzufahren.',
        showInput: true,
        actions: [
            { text: 'Abbrechen' },
            { text: 'Wiederherstellen', class: 'btn-warning', value: 'RESTORE' }
        ]
    });

    if (confirmed && confirmed.toUpperCase() === 'RESTORE') {
        try {
            const backup = await loadBackupFromIndexedDB();
            if (backup) {
                platforms = backup.platforms;
                entries = backup.entries;
                cashflows = backup.cashflows;
                dayStrategies = backup.dayStrategies;
                favorites = backup.favorites;
                
                saveData(); // Speichert die wiederhergestellten Daten in localStorage und aktualisiert das Backup
                applyDateFilter();
                showNotification('Daten erfolgreich aus lokalem Backup wiederhergestellt!', 'success');
            } else {
                showNotification('Kein lokales Backup gefunden.', 'error');
            }
        } catch (error) {
            showNotification('Fehler bei der Wiederherstellung.', 'error');
            console.error("Fehler beim Wiederherstellen aus Backup:", error);
        }
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Service Worker benötigen einen sicheren Kontext (HTTPS oder localhost).
        // Diese Prüfung verhindert den Fehler, wenn die Datei lokal geöffnet wird.
        if (!window.isSecureContext) {
            console.warn('Service Worker-Registrierung übersprungen: Die App wird nicht über HTTPS oder localhost bereitgestellt.');
            return;
        }

        // Service Worker müssen von einer Datei geladen werden, nicht von einem Blob.
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            console.log('PWA Service Worker registriert, Scope:', registration.scope);
        }).catch(err => {
            console.error('SW-Registrierung fehlgeschlagen:', err);
        });
    }
}

function setChartDateFilter(period) {
    setDateFilter(period);
}

function addMissingStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        .day-strategy-container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .strategy-input-row { display: flex; flex-direction: column; gap: 8px; }
        .strategy-label { font-weight: 600; color: var(--text-primary); font-size: 14px; }
        .strategy-input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--background); color: var(--text); font-size: 14px; }
        .strategy-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
        .chartjs-tooltip {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            min-width: 280px;
            max-width: 320px;
            opacity: 0;
            position: absolute;
            pointer-events: none;
            transition: all 0.2s ease;
            z-index: 10000;
            font-size: 0.9em;
        }
        .chartjs-tooltip-content {
             padding: 12px;
        }
        .dark-mode .chartjs-tooltip {
            background: #1f2937;
            border-color: #374151;
            color: #f9fafb;
        }

        /* Mobile Tooltip Optimierungen */
        @media (max-width: 768px) {
            .chartjs-tooltip {
                font-size: 0.85em !important;
                max-height: 50vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                min-width: 0;
            }
            
            .chartjs-tooltip-content {
                padding: 10px !important;
            }
            
            .chartjs-tooltip-content > div {
                margin-bottom: 6px !important;
            }
        }

        /* Smooth scrolling für Tooltip */
        .chartjs-tooltip::-webkit-scrollbar {
            width: 4px;
        }

        .chartjs-tooltip::-webkit-scrollbar-track {
            background: transparent;
        }

        .chartjs-tooltip::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.2);
            border-radius: 2px;
        }

        /* Badge für Navigation */
        .tab-btn[data-badge] {
            position: relative;
            overflow: visible;
        }
        .tab-btn[data-badge]::after {
            content: attr(data-badge);
            position: absolute;
            top: 2px;
            right: 5px;
            background-color: var(--danger);
            color: white;
            font-size: 10px;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            padding: 0 4px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid var(--background);
        }

        /* Collapsible Section in Settings */
        details {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--card-bg);
            overflow: hidden; /* Prevents content from spilling out during animation */
        }
        .section-header-summary {
            list-style: none;
            cursor: pointer;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-header-summary::-webkit-details-marker {
            display: none;
        }
        .details-content {
            padding: 0 16px 16px;
        }
        details[open] > .section-header-summary {
            border-bottom: 1px solid var(--border);
        }
        .summary-arrow {
            transition: transform 0.2s ease-in-out;
            font-size: 1.2em;
        }
        details[open] .summary-arrow {
            transform: rotate(180deg);
        }

        /* Mobile Header Menu */
        .desktop-header-actions { display: inline-flex; gap: 8px; }
        .mobile-header-actions { display: none; }

        @media (max-width: 768px) {
            /* Single horizontal line mobile header layout */
            .header {
                padding: 8px 16px;
                min-height: auto;
            }
            
            .header .container,
            .header > div {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                gap: 12px !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .header-content {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: flex-start !important;
                flex: 1 !important;
                gap: 8px !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .header-content h1 { 
                font-size: 1em;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1.2;
                flex-shrink: 0;
                white-space: nowrap;
            }
            
            /* Mobile title styling */
            .header-content h1 {
                font-size: 1em !important;
                font-weight: 600 !important;
                color: var(--text-primary) !important;
            }
            
            .header-content .subtitle { display: none !important; }
            
            .desktop-header-actions { display: none !important; }
            
            .mobile-header-actions { 
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                position: relative;
                flex-shrink: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .more-actions-btn { 
                padding: 4px 8px !important;
                min-width: auto !important;
                font-size: 0.9em;
            }
            .header-actions-dropdown {
                display: none;
                position: absolute;
                top: calc(100% + 5px);
                right: 0;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 100;
                flex-direction: column;
                align-items: stretch;
                padding: 8px;
                gap: 8px;
                width: 180px;
            }
            .header-actions-dropdown.visible { display: flex; }
            .header-actions-dropdown .btn { justify-content: flex-start; text-align: left; width: 100%; }
        }

        .view-switcher {
            display: flex;
            gap: 4px;
            background-color: var(--background-alt);
            padding: 4px;
            border-radius: 12px;
            border: 1px solid var(--border-light);
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 16px;
            width: fit-content;
        }
        .view-switcher .view-btn {
            border: none;
            background: transparent;
            color: var(--text-secondary);
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9em;
            transition: all 0.2s ease;
            white-space: nowrap;
            min-width: 70px;
            text-align: center;
        }
        .view-switcher .view-btn:hover:not(.active) {
            color: var(--primary);
            background-color: rgba(59, 130, 246, 0.1);
        }
        .view-switcher .view-btn.active {
            background-color: var(--card-bg);
            color: var(--primary);
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            transform: translateY(-1px);
        }
        .cashflow-groups { display: flex; flex-direction: column; gap: 16px; }
        .cashflow-group { 
            border: 1px solid var(--border); 
            border-radius: 12px; 
            background-color: var(--card-bg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            overflow: hidden;
            transition: all 0.2s ease;
        }
        .cashflow-group:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .cashflow-group-summary { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px 20px; 
            cursor: pointer; 
            list-style: none;
            background-color: transparent;
            transition: background-color 0.2s ease;
            position: relative;
        }
        .cashflow-group-summary::after {
            content: '▼';
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%) rotate(0deg);
            transition: transform 0.2s ease;
            color: var(--text-secondary);
            font-size: 0.8em;
        }
        .cashflow-group[open] .cashflow-group-summary::after {
            transform: translateY(-50%) rotate(180deg);
        }
        .cashflow-group-summary:hover {
            background-color: var(--background-alt);
        }
        .cashflow-group-summary::-webkit-details-marker { display: none; }
        .group-title { font-weight: 600; font-size: 1.15em; color: var(--text-primary); }
        .group-stats { display: flex; gap: 20px; font-size: 0.9em; margin-right: 30px; }
        .cashflow-group-details { 
            padding: 0 20px 20px; 
            border-top: 1px solid var(--border-light);
            background-color: var(--background);
        }
        .transaction-row { 
            display: grid; 
            grid-template-columns: 100px 100px 1fr 1fr auto auto; 
            align-items: center; 
            gap: 16px; 
            padding: 12px 0; 
            border-bottom: 1px solid var(--border-light); 
            font-size: 14px;
            transition: background-color 0.2s ease;
            border-radius: 8px;
            margin: 0 -8px;
            padding-left: 8px;
            padding-right: 8px;
        }
        .transaction-row:hover {
            background-color: var(--background-alt);
        }
        .transaction-row:last-child { border-bottom: none; }
        .transaction-note { color: var(--text-secondary); font-style: italic; }
        .transaction-platform { font-weight: 500; }
        .transaction-date { font-weight: 500; color: var(--text-secondary); }
        .transaction-type { 
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.85em;
            font-weight: 500;
            text-align: center;
        }
        .transaction-type.type-deposit {
            background-color: rgba(34, 197, 94, 0.1);
            color: #059669;
        }
        .transaction-type.type-withdrawal {
            background-color: rgba(239, 68, 68, 0.1);
            color: #dc2626;
        }
        @media (max-width: 768px) {
            .view-switcher {
                width: 100%;
                justify-content: center;
            }
            .view-switcher .view-btn {
                flex: 1;
                min-width: auto;
            }
            .cashflow-group-summary { 
                flex-direction: column; 
                align-items: flex-start; 
                gap: 12px;
                padding: 16px;
            }
            .cashflow-group-summary::after {
                right: 16px;
            }
            .group-stats { 
                flex-wrap: wrap;
                gap: 12px;
                margin-right: 20px;
            }
            .cashflow-group-details {
                padding: 0 16px 16px;
            }
            .transaction-row { 
                grid-template-columns: 1fr auto;
                gap: 8px;
                padding: 12px 8px;
                margin: 0;
            }
            .transaction-date {
                grid-column: 1;
                font-size: 0.9em;
            }
            .transaction-type {
                grid-column: 2;
                grid-row: 1;
            }
            .transaction-platform {
                grid-column: 1;
                font-size: 0.9em;
                margin-top: 4px;
            }
            .transaction-note {
                grid-column: 1;
                font-size: 0.85em;
                margin-top: 2px;
            }
            .transaction-amount { 
                grid-column: 1;
                font-size: 1.1em; 
                font-weight: 600;
                margin-top: 8px;
            }
            .transaction-row button { 
                grid-column: 2;
                grid-row: 2 / span 3;
                align-self: center;
                justify-self: end;
            }
            
            /* Mobile Platform Grid Styling */
            #favoritesGrid, #platformGrid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                padding: 4px;
            }
            
            .platform-btn {
                padding: 12px 8px;
                min-height: 90px;
                border-radius: 8px;
            }
            
            .platform-btn .icon {
                font-size: 1.8em;
                margin-bottom: 6px;
            }
            
            .platform-btn .name {
                font-size: 0.85em;
                margin-bottom: 2px;
            }
            
            .platform-btn .type {
                font-size: 0.7em;
            }
            
            .platform-btn .tags {
                margin-top: 6px;
                gap: 3px;
            }
            
            .platform-btn .tag {
                font-size: 0.6em;
                padding: 1px 4px;
            }
            
            /* Mobile History Card Styling */
            .history-card {
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 8px;
            }
            
            .history-card-header {
                margin-bottom: 8px;
            }
            
            .history-card-platform {
                font-size: 1em;
            }
            
            .history-card-date {
                font-size: 0.85em;
            }
            
            .history-card-balance {
                font-size: 1.1em;
            }
            
            .history-card-note {
                font-size: 0.85em;
                margin-top: 6px;
                padding-top: 6px;
            }
            
            /* Hide settings and platforms tabs on mobile */
            .tab-btn[onclick="switchTab('settings')"],
            .tab-btn[data-tab="settings"],
            .tab-btn[onclick="switchTab('platforms')"],
            .tab-btn[data-tab="platforms"] {
                display: none !important;
            }
        }
        
        /* Hide platforms tab content completely */
        #platforms,
        .tab-content#platforms,
        [data-tab="platforms"],
        .tab-btn[onclick*="platforms"] {
            display: none !important;
        }
        
        /* Platform Grid Styling */
        #favoritesGrid, #platformGrid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            padding: 8px;
        }
        
        .platform-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 12px;
            background: var(--card-bg);
            border: 2px solid var(--border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            min-height: 100px;
            position: relative;
            overflow: hidden;
        }
        
        .platform-btn:hover {
            border-color: var(--primary);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        
        .platform-btn.selected {
            border-color: var(--primary);
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
            box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
        }
        
        .platform-btn.has-balance {
            border-color: #10b981;
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
        }
        
        .platform-btn.has-balance.selected {
            border-color: var(--primary);
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.1));
        }
        
        .platform-btn .icon {
            font-size: 2em;
            margin-bottom: 8px;
            display: block;
        }
        
        .platform-btn .name {
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 4px;
            font-size: 0.9em;
            line-height: 1.2;
        }
        
        .platform-btn .type {
            color: var(--text-secondary);
            font-size: 0.75em;
            opacity: 0.8;
        }
        
        .platform-btn .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 8px;
            justify-content: center;
        }
        
        .platform-btn .tag {
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.65em;
            font-weight: 500;
        }
        
        /* History Card Styling */
        .history-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .history-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border-color: var(--primary);
        }
        
        .history-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }
        
        .history-card-platform {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 1.1em;
        }
        
        .history-card-date {
            color: var(--text-secondary);
            font-size: 0.9em;
            margin-top: 2px;
        }
        
        .history-card-balance {
            font-size: 1.2em;
            font-weight: 700;
            text-align: right;
        }
        
        .history-card-note {
            color: var(--text-secondary);
            font-style: italic;
            font-size: 0.9em;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--border-light);
        }

    `;
    document.head.appendChild(styleSheet);
}
 
// Header Dropdown Toggle
function toggleHeaderMenu() {
    const dropdown = document.getElementById('headerDropdown');
    dropdown.classList.toggle('show');
    
    // Schließe Dropdown wenn außerhalb geklickt wird
    if (dropdown.classList.contains('show')) {
        setTimeout(() => {
            document.addEventListener('click', closeHeaderMenuOnOutsideClick);
        }, 0);
    }
}

function closeHeaderMenuOnOutsideClick(e) {
    const dropdown = document.getElementById('headerDropdown');
    const menuButton = e.target.closest('.header-menu-dropdown');
    
    if (!menuButton && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeHeaderMenuOnOutsideClick);
    }
}

// =================================================================================
// GLOBALE SUCHE (COMMAND PALETTE)
// =================================================================================
function openGlobalSearch() {
    document.getElementById('globalSearchOverlay').classList.add('visible');
    // Ein kurzes Timeout ist der zuverlässigste Weg, um sicherzustellen, dass das Element fokussierbar ist.
    setTimeout(() => {
        document.getElementById('globalSearchInput').focus();
    }, 50);
    handleGlobalSearch(); // Initial render
}

function closeGlobalSearch() {
    document.getElementById('globalSearchOverlay').classList.remove('visible');
    document.getElementById('globalSearchInput').value = '';
    globalSearchResults = [];
    globalSearchIndex = -1;
}

function handleGlobalSearch() {
    const term = document.getElementById('globalSearchInput').value;
    
    // Hide suggestions when actively searching
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer && term.length >= 1) {
        suggestionsContainer.style.display = 'none';
    }
    
    performGlobalSearch(term);
}

// Enhanced search function with fuzzy matching and relevance scoring
function performGlobalSearch(term) {
    const lowerTerm = term.toLowerCase();

    // Add to search history
    if (term.length >= 2) {
        globalSearchEngine.addToHistory(term);
    }

    // Check cache first
    const cacheKey = `search_${lowerTerm}`;
    if (globalSearchEngine.searchCache.has(cacheKey)) {
        globalSearchResults = globalSearchEngine.searchCache.get(cacheKey);
        renderGlobalSearchResults();
        return;
    }

    if (lowerTerm.length < 1) {
        globalSearchResults = [
            { title: 'Dashboard anzeigen', icon: '📊', category: 'Navigation', type: 'action', action: () => switchTab('dashboard') },
            { title: 'Neuer Eintrag', icon: '📝', category: 'Navigation', type: 'action', action: () => switchTab('entry') },
            { title: 'Cloud Sync starten', icon: '☁️', category: 'Aktion', type: 'action', action: () => syncNow() },
            { title: 'Theme wechseln', icon: '🎨', category: 'Aktion', type: 'action', action: () => toggleTheme() },
        ];
        renderGlobalSearchResults();
        return;
    }

    const results = [];
    const addedIds = new Set();

    // 1. Enhanced Actions search with fuzzy matching
    const actions = [
        { title: 'Theme wechseln', icon: '🎨', category: 'Aktion', type: 'action', action: () => toggleTheme(), tags: ['theme', 'design', 'aussehen'] },
        { title: 'Cloud Sync starten', icon: '☁️', category: 'Aktion', type: 'action', action: () => syncNow(), tags: ['sync', 'cloud', 'backup'] },
        { title: 'JSON exportieren', icon: '💾', category: 'Aktion', type: 'action', action: () => exportJSON(), tags: ['export', 'download', 'backup'] },
        { title: 'Dashboard', icon: '📊', category: 'Navigation', type: 'action', action: () => switchTab('dashboard'), tags: ['overview', 'start', 'home'] },
        { title: 'Neuer Eintrag', icon: '📝', category: 'Navigation', type: 'action', action: () => switchTab('entry'), tags: ['new', 'add', 'create'] },
        { title: 'Cashflow', icon: '💸', category: 'Navigation', type: 'action', action: () => switchTab('cashflow'), tags: ['money', 'transactions', 'flow'] },
        { title: 'Historie', icon: '📜', category: 'Navigation', type: 'action', action: () => switchTab('history'), tags: ['history', 'past', 'records'] },
        { title: 'Einstellungen', icon: '⚙️', category: 'Navigation', type: 'action', action: () => switchTab('settings'), tags: ['settings', 'config', 'options'] },
    ];

    actions.forEach(action => {
        const relevance = globalSearchEngine.calculateRelevance(action, term);
        if (relevance > 0) {
            results.push({ ...action, relevance });
        }
    });

    // 2. Enhanced Platforms search with fuzzy matching
    platforms.forEach(p => {
        const relevance = globalSearchEngine.calculateRelevance(p, term);
        if (relevance > 0) {
            const id = `platform-${p.name}`;
            if (!addedIds.has(id)) {
                results.push({
                    title: p.name, 
                    subtitle: p.type, 
                    icon: p.icon, 
                    category: 'Plattform', 
                    type: 'platform',
                    relevance,
                    tags: p.tags,
                    action: () => { 
                        switchTab('entry'); 
                        setTimeout(() => { 
                            document.getElementById('platformSearch').value = p.name; 
                            filterPlatforms(); 
                            const platformBtn = Array.from(document.querySelectorAll('.platform-btn')).find(btn => btn.dataset.platform === p.name);
                            if (platformBtn && !platformBtn.classList.contains('selected')) {
                                togglePlatform(platformBtn, p.name);
                            }
                            highlightElement(`#input_${p.name.replace(/\s+/g, '_')}`);
                        }, 100); 
                    }
                });
                addedIds.add(id);
            }
        }
    });

    // NEU: "Alle anzeigen" für passende Protokolle in der Historie hinzufügen
    const matchingProtocolsInHistory = [...new Set(
        entries.filter(e => e.protocol && e.protocol.toLowerCase().includes(lowerTerm)).map(e => e.protocol)
    )];

    matchingProtocolsInHistory.forEach(protocolName => {
        const count = entries.filter(e => e.protocol === protocolName).length;
        const id = `history-all-${protocolName}`;
        if (!addedIds.has(id)) {
            results.push({
                title: `Alle Einträge für "${protocolName}" anzeigen`,
                subtitle: `${count} Eintrag/Einträge gefunden`,
                icon: '📂',
                category: 'Historie',
                type: 'action',
                action: () => {
                    singleItemFilter = { type: 'history', filterFunction: e => e.protocol === protocolName };
                    switchTab('history', { preserveFilter: true });
                }
            });
            addedIds.add(id);
        }
    });

    // 3. Eintrags-Historie durchsuchen (nach Protokoll oder Notiz)
    entries.forEach(e => {
        const protocolMatch = e.protocol && e.protocol.toLowerCase().includes(lowerTerm);
        const noteMatch = e.note && e.note.toLowerCase().includes(lowerTerm);

        if (protocolMatch || noteMatch) {
            if (!addedIds.has(e.id)) {
                let subtitle = `Eintrag vom ${formatDate(e.date)}`;
                if (noteMatch) {
                    subtitle = `Notiz: ${e.note}`;
                }

                results.push({
                    title: `${e.protocol}: ${formatDollar(e.balance)}`,
                    subtitle: subtitle,
                    icon: '📜',
                    category: 'Historie',
                    type: 'history',
                    action: () => {
                        singleItemFilter = { type: 'history', filterFunction: entry => entry.id === e.id };
                        switchTab('history', { preserveFilter: true });
                        highlightElement(`#historyTableBody tr[data-id='${e.id}']`);
                    }
                });
                addedIds.add(e.id);
            }
        }
    });

    // 4. Cashflows durchsuchen (nach Notiz)
    cashflows.forEach(c => {
        if (c.note && c.note.toLowerCase().includes(lowerTerm)) {
            if (!addedIds.has(c.id)) {
                const typeText = c.type === 'deposit' ? 'Einzahlung' : 'Auszahlung';
                results.push({
                    title: `${typeText}: ${formatDollar(c.amount)}`,
                    subtitle: `Notiz: ${c.note}`,
                    icon: '💸',
                    category: 'Cashflow',
                    type: 'cashflow',
                    action: () => { 
                        singleItemFilter = { type: 'cashflow', filterFunction: (cf) => cf.id === c.id };
                        switchTab('cashflow', { preserveFilter: true }); 
                        highlightElement(`.transaction-row[data-id='${c.id}'], #cashflowTableBody tr[data-id='${c.id}']`); 
                    }
                });
                addedIds.add(c.id);
            }
        }
    });

    // 5. Cashflows nach Typ durchsuchen
    if ('einzahlung'.includes(lowerTerm)) {
        const count = cashflows.filter(c => c.type === 'deposit').length;
        if (count > 0) {
            results.push({
                title: 'Alle Einzahlungen anzeigen',
                subtitle: `${count} Transaktion(en) gefunden`,
                icon: '➕',
                category: 'Aktion',
                type: 'action',
                action: () => {
                    singleItemFilter = { type: 'cashflow', filterFunction: cf => cf.type === 'deposit' };
                    switchTab('cashflow', { preserveFilter: true });
                }
            });
        }
    }
    if ('auszahlung'.includes(lowerTerm)) {
        const count = cashflows.filter(c => c.type === 'withdraw').length;
        if (count > 0) {
            results.push({
                title: 'Alle Auszahlungen anzeigen',
                subtitle: `${count} Transaktion(en) gefunden`,
                icon: '➖',
                category: 'Aktion',
                type: 'action',
                action: () => {
                    singleItemFilter = { type: 'cashflow', filterFunction: cf => cf.type === 'withdraw' };
                    switchTab('cashflow', { preserveFilter: true });
                }
            });
        }
    }

    // 6. Nach Datum suchen (Format DD.MM.YYYY oder YYYY-MM-DD)
    let searchDate = null;
    const dateMatch = lowerTerm.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dateMatch) {
        const [, day, month, year] = dateMatch;
        searchDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (lowerTerm.match(/^\d{4}-\d{2}-\d{2}$/)) {
        searchDate = lowerTerm;
    }

    if (searchDate) {
        const entriesOnDate = entries.filter(e => e.date === searchDate);
        if (entriesOnDate.length > 0) {
            results.push({
                title: `Alle Einträge vom ${formatDate(searchDate)} anzeigen`,
                subtitle: `${entriesOnDate.length} Eintrag/Einträge gefunden`,
                icon: '📜', category: 'Historie', type: 'action',
                action: () => {
                    singleItemFilter = { type: 'history', filterFunction: e => e.date === searchDate };
                    switchTab('history', { preserveFilter: true });
                }
            });
        }
        const cashflowsOnDate = cashflows.filter(c => c.date === searchDate);
        if (cashflowsOnDate.length > 0) {
            results.push({
                title: `Alle Cashflows vom ${formatDate(searchDate)} anzeigen`,
                subtitle: `${cashflowsOnDate.length} Transaktion(en) gefunden`,
                icon: '💸', category: 'Cashflow', type: 'action',
                action: () => {
                    singleItemFilter = { type: 'cashflow', filterFunction: cf => cf.date === searchDate };
                    switchTab('cashflow', { preserveFilter: true });
                }
            });
        }
    }

    // 7. Tages-Strategien durchsuchen (gruppiert)
    const matchingStrategyTexts = [...new Set(
        dayStrategies
            .filter(ds => ds.strategy && ds.strategy.toLowerCase().includes(lowerTerm))
            .map(ds => ds.strategy)
    )];

    matchingStrategyTexts.forEach(strategyText => {
        const matchingDates = dayStrategies.filter(ds => ds.strategy === strategyText).map(ds => ds.date);
        const count = matchingDates.length;
        const id = `strategy-group-${strategyText.replace(/\s/g, '_')}`;

        if (!addedIds.has(id)) {
            results.push({
                title: `Strategie: "${strategyText.substring(0, 30)}${strategyText.length > 30 ? '...' : ''}"`,
                subtitle: `An ${count} Tag(en) verwendet`,
                icon: '📂',
                category: 'Strategie',
                type: 'action',
                action: () => {
                    singleItemFilter = { type: 'history', filterFunction: e => matchingDates.includes(e.date) };
                    switchTab('history', { preserveFilter: true });
                }
            });
            addedIds.add(id);
        }
    });

    // Apply advanced filters
    const filteredResults = globalSearchEngine.applyFilters(results);
    
    // Sort results by relevance score (highest first)
    filteredResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    
    globalSearchResults = filteredResults.slice(0, 20);
    
    // Cache results for performance (limit cache size)
    if (lowerTerm.length >= 2) {
        if (globalSearchEngine.searchCache.size > 50) {
            // Clear oldest entries when cache gets too large
            const firstKey = globalSearchEngine.searchCache.keys().next().value;
            globalSearchEngine.searchCache.delete(firstKey);
        }
        globalSearchEngine.searchCache.set(cacheKey, globalSearchResults);
    }
    
    renderGlobalSearchResults();
}

function renderGlobalSearchResults() {
    const resultsContainer = document.getElementById('globalSearchResults');
    resultsContainer.innerHTML = '';
    globalSearchIndex = -1;

    if (globalSearchResults.length === 0) {
        resultsContainer.innerHTML = `<div class="search-result-item"><div class="search-result-text"><div class="title">Keine Ergebnisse</div></div></div>`;
        return;
    }

    const searchTerm = document.getElementById('globalSearchInput').value;

    globalSearchResults.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'search-result-item';
        el.onclick = () => executeSearchResult(item);
        
        // Highlight search terms in title and subtitle
        const highlightedTitle = globalSearchEngine.highlightText(item.title, searchTerm);
        const highlightedSubtitle = item.subtitle ? globalSearchEngine.highlightText(item.subtitle, searchTerm) : '';
        
        el.innerHTML = `
            <div class="search-result-icon">${item.icon}</div>
            <div class="search-result-text">
                <div class="title">${highlightedTitle}</div>
                ${highlightedSubtitle ? `<div class="subtitle">${highlightedSubtitle}</div>` : ''}
                ${item.relevance ? `<div class="relevance-score" style="font-size: 0.7em; opacity: 0.6;">Score: ${item.relevance.toFixed(2)}</div>` : ''}
            </div>
            <div class="search-result-category">${item.category}</div>
        `;
        resultsContainer.appendChild(el);
    });
}

function handleGlobalSearchKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
            globalSearchIndex = Math.min(globalSearchIndex + 1, globalSearchResults.length - 1);
        } else if (e.key === 'ArrowUp') {
            globalSearchIndex = Math.max(globalSearchIndex - 1, 0);
        } else if (e.key === 'Enter' && globalSearchIndex > -1) {
            executeSearchResult(globalSearchResults[globalSearchIndex]);
        }
        
        const items = document.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === globalSearchIndex);
        });
    }
}

// Apply search suggestion
function applySuggestion(suggestion) {
    const globalSearchInput = document.getElementById('globalSearchInput');
    globalSearchInput.value = suggestion;
    handleGlobalSearch();
    
    // Hide suggestions
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    
    globalSearchInput.focus();
}

// Advanced search filter functions
function toggleSearchFilter(type, value) {
    const filters = globalSearchEngine.activeFilters;
    
    switch(type) {
        case 'category':
            const categoryIndex = filters.categories.indexOf(value);
            if (categoryIndex > -1) {
                filters.categories.splice(categoryIndex, 1);
            } else {
                filters.categories.push(value);
            }
            break;
            
        case 'platform':
            const platformIndex = filters.platforms.indexOf(value);
            if (platformIndex > -1) {
                filters.platforms.splice(platformIndex, 1);
            } else {
                filters.platforms.push(value);
            }
            break;
            
        case 'tag':
            const tagIndex = filters.tags.indexOf(value);
            if (tagIndex > -1) {
                filters.tags.splice(tagIndex, 1);
            } else {
                filters.tags.push(value);
            }
            break;
    }
    
    // Clear cache and re-search
    globalSearchEngine.searchCache.clear();
    const currentTerm = document.getElementById('globalSearchInput').value;
    if (currentTerm) {
        performGlobalSearch(currentTerm);
    }
    
    updateFilterDisplay();
}

function setDateRangeFilter(range) {
    if (range === 'clear') {
        globalSearchEngine.activeFilters.dateRange = null;
    } else {
        const dateRange = globalSearchEngine.parseDateRange(range);
        if (dateRange) {
            globalSearchEngine.activeFilters.dateRange = dateRange;
        }
    }
    
    // Clear cache and re-search
    globalSearchEngine.searchCache.clear();
    const currentTerm = document.getElementById('globalSearchInput').value;
    if (currentTerm) {
        performGlobalSearch(currentTerm);
    }
    
    updateFilterDisplay();
}

function clearAllSearchFilters() {
    globalSearchEngine.clearFilters();
    const currentTerm = document.getElementById('globalSearchInput').value;
    if (currentTerm) {
        performGlobalSearch(currentTerm);
    }
    updateFilterDisplay();
}

function updateFilterDisplay() {
    const filtersContainer = document.getElementById('searchFilters');
    if (!filtersContainer) return;
    
    const filters = globalSearchEngine.activeFilters;
    let filterHtml = '';
    
    // Date range filter
    if (filters.dateRange) {
        const startStr = filters.dateRange.start.toLocaleDateString('de-DE');
        const endStr = filters.dateRange.end.toLocaleDateString('de-DE');
        filterHtml += `<span class="search-filter-tag active" onclick="setDateRangeFilter('clear')">📅 ${startStr} - ${endStr} ✕</span>`;
    }
    
    // Category filters
    filters.categories.forEach(category => {
        filterHtml += `<span class="search-filter-tag active" onclick="toggleSearchFilter('category', '${category}')">${category} ✕</span>`;
    });
    
    // Platform filters
    filters.platforms.forEach(platform => {
        filterHtml += `<span class="search-filter-tag active" onclick="toggleSearchFilter('platform', '${platform}')">${platform} ✕</span>`;
    });
    
    // Tag filters
    filters.tags.forEach(tag => {
        filterHtml += `<span class="search-filter-tag active" onclick="toggleSearchFilter('tag', '${tag}')">#${tag} ✕</span>`;
    });
    
    // Clear all button
    if (filterHtml) {
        filterHtml += `<span class="search-filter-tag" onclick="clearAllSearchFilters()" style="background: var(--danger);">Alle löschen</span>`;
    }
    
    filtersContainer.innerHTML = filterHtml;
    filtersContainer.style.display = filterHtml ? 'flex' : 'none';
}

// Export search results
function exportSearchResults() {
    if (globalSearchResults.length === 0) {
        showNotification('Keine Suchergebnisse zum Exportieren vorhanden.', 'warning');
        return;
    }
    
    const searchTerm = document.getElementById('globalSearchInput').value;
    const timestamp = new Date().toISOString();
    
    const exportData = {
        searchTerm,
        timestamp,
        filters: globalSearchEngine.activeFilters,
        results: globalSearchResults.map(result => ({
            title: result.title,
            subtitle: result.subtitle,
            category: result.category,
            relevance: result.relevance,
            type: result.type
        }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${searchTerm || 'all'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Suchergebnisse exportiert!', 'success');
}

function executeSearchResult(item) {
    if (item && typeof item.action === 'function') {
        try {
            item.action();
        } catch (e) {
            console.error("Error executing search action:", e);
        } finally {
            closeGlobalSearch();
        }
    }
}
// Initialize Mobile Navigation
function initializeMobileNavigation() {
    if (window.innerWidth <= 768) {
        document.body.classList.add("has-mobile-nav");
        
        // Sync mobile nav with current active tab
        const activeTab = document.querySelector(".tab-btn.active");
        if (activeTab && activeTab.dataset.tab) {
            const mobileNavItem = document.querySelector(`.mobile-nav-item[data-tab="${activeTab.dataset.tab}"]`);
            if (mobileNavItem) {
                document.querySelectorAll(".mobile-nav-item").forEach(btn => btn.classList.remove("active"));
                mobileNavItem.classList.add("active");
            }
        }
        
        // Update badges
        updateMobileNavBadges();
    }
}

// Update Mobile Navigation Badges
function updateMobileNavBadges() {
    const mobileNavEntry = document.querySelector(".mobile-nav-item[data-tab=\"entry\"]");
    if (mobileNavEntry) {
        const todayEntriesCount = entries.filter(e => e.date === new Date().toISOString().split("T")[0]).length;
        if (todayEntriesCount > 0) {
            mobileNavEntry.setAttribute("data-badge", todayEntriesCount);
        } else {
            mobileNavEntry.removeAttribute("data-badge");
        }
    }
}
