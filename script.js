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
const LAST_ACTIVE_TAB_KEY = `${STORAGE_PREFIX}lastActiveTab`;
const NOTE_DRAFT_KEY = `${STORAGE_PREFIX}noteDraft`;
const NOTE_AUTOSAVE_DELAY = 600;
const NOTE_DRAFT_MESSAGE_DURATION = 4000;

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
        { date: '2024-08-23', value: 18130 },
        { date: '2025-02-13', value: 19000 },
        { date: '2025-02-14', value: 19050 } // NEU: Wert für den Test-Tag hinzugefügt
    ],
    'SP500': [
        // Hier könntest du die echten Werte für den S&P 500 eintragen
        { date: '2024-02-14', value: 5029 },
        { date: '2024-03-15', value: 5117 },
        { date: '2024-04-15', value: 5061 },
        { date: '2024-05-15', value: 5308 },
        { date: '2024-06-14', value: 5431 },
        { date: '2024-07-15', value: 5574 },
        { date: '2024-08-23', value: 5460 },
        { date: '2025-02-13', value: 5600 },
        { date: '2025-02-14', value: 5650 } // NEU: Wert für den Test-Tag hinzugefügt
    ]
};

// =================================================================================
// GLOBALE VARIABLEN
// =================================================================================
let platforms = [];
let entries = [];
let cashflows = [];
let dayStrategies = [];
let notes = [];
let filteredEntries = [];
let filteredCashflows = [];
let selectedPlatforms = [];
let multiSelectStartIndex = -1;
let selectedHistoryEntries = new Set();
let lastSelectedHistoryRow = null;
let favorites = [];
let portfolioChart, allocationChart, forecastChart;
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

// Notes workspace state
let editingNoteId = null;
let noteEditorAttachments = [];
let noteSearchTerm = '';
let noteEditorTags = [];
let noteSortMode = 'updated-desc';
let noteFilterState = { tags: [], pinnedOnly: false };
let noteDraftTimer = null;
let noteDraftStatusTimeout = null;
let noteSearchMetadata = new Map();
let noteGalleryState = { noteId: null, attachments: [], index: 0 };
const noteAttachmentCache = new Map();
let notePreviewEnabled = true;
let noteGallerySwipeStartX = null;
let noteEditorSelectionRange = null;

const ALLOWED_NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'A', 'P', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'DIV', 'CODE', 'PRE', 'FONT']);
const ALLOWED_NOTE_ATTRS = {
    A: ['href', 'target', 'rel'],
    SPAN: ['style'],
    DIV: ['style'],
    P: ['style'],
    CODE: ['class'],
    PRE: [],
    FONT: ['color']
};

function stripHtml(html) {
    if (!html) return '';
    const template = document.createElement('template');
    template.innerHTML = html;
    return (template.content.textContent || '').trim();
}

function sanitizeNoteHtml(html) {
    if (!html) return '';
    const template = document.createElement('template');
    template.innerHTML = html;

    const sanitizeNode = (root) => {
        Array.from(root.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (!ALLOWED_NOTE_TAGS.has(child.tagName)) {
                    if (child.childNodes.length) {
                        while (child.firstChild) {
                            root.insertBefore(child.firstChild, child);
                        }
                    }
                    root.removeChild(child);
                    return;
                }
                sanitizeAttributes(child);
                sanitizeNode(child);
            } else if (child.nodeType === Node.COMMENT_NODE) {
                root.removeChild(child);
            }
        });
    };

    const sanitizeAttributes = (el) => {
        const allowed = ALLOWED_NOTE_ATTRS[el.tagName] || [];
        Array.from(el.attributes).forEach(attr => {
            if (!allowed.includes(attr.name)) {
                el.removeAttribute(attr.name);
                return;
            }
            if (attr.name === 'href') {
                const href = attr.value.trim();
                if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:')) {
                    el.removeAttribute('href');
                    el.removeAttribute('target');
                    el.removeAttribute('rel');
                } else {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
            if (attr.name === 'style') {
                const sanitized = sanitizeStyle(attr.value);
                if (sanitized) {
                    el.setAttribute('style', sanitized);
                } else {
                    el.removeAttribute('style');
                }
            }
        });
    };

    const sanitizeStyle = (value) => {
        if (!value) return '';
        const declarations = value.split(';');
        const allowed = [];
        declarations.forEach(pair => {
            const [rawProp, rawValue] = pair.split(':');
            if (!rawProp || !rawValue) return;
            const prop = rawProp.trim().toLowerCase();
            const val = rawValue.trim();
            if (!val) return;
            if (prop === 'color' || prop === 'background-color') {
                allowed.push(`${prop}: ${val}`);
            }
        });
        return allowed.join('; ');
    };

    sanitizeNode(template.content);
    return template.innerHTML;
}

function getNoteEditorElement() {
    return document.getElementById('noteContentEditor');
}

function convertTextToHtml(text) {
    if (!text) return '';
    const parts = text.split(/\r?\n\r?\n/);
    const html = parts.map(part => {
        const escaped = escapeHtmlForHighlight(part).replace(/\r?\n/g, '<br>');
        return `<p>${escaped}</p>`;
    }).join('');
    return html;
}

function setNoteEditorHtml(html) {
    const editor = getNoteEditorElement();
    if (!editor) return;
    editor.innerHTML = sanitizeNoteHtml(html || '');
    syncNoteEditorHiddenInput();
    saveNoteEditorSelection();
}

function getNoteEditorHtml() {
    const editor = getNoteEditorElement();
    if (!editor) return '';
    return sanitizeNoteHtml(editor.innerHTML);
}

function syncNoteEditorHiddenInput() {
    const hidden = document.getElementById('noteContentInput');
    if (!hidden) return;
    hidden.value = stripHtml(getNoteEditorElement()?.innerHTML || '');
}

function saveNoteEditorSelection() {
    const editor = getNoteEditorElement();
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
        return;
    }
    noteEditorSelectionRange = range.cloneRange();
}

function restoreNoteEditorSelection() {
    const editor = getNoteEditorElement();
    if (!editor || !noteEditorSelectionRange) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(noteEditorSelectionRange);
}

function handleNoteToolbarClick(event) {
    const button = event.target.closest('.note-tool');
    if (!button) return;
    const command = button.dataset.command;
    if (!command) return;
    event.preventDefault();
    const editor = getNoteEditorElement();
    if (!editor) return;
    editor.focus({ preventScroll: true });
    restoreNoteEditorSelection();
    if (command === 'removeFormat') {
        document.execCommand('removeFormat');
        document.execCommand('unlink');
    } else if (command === 'createLink') {
        const url = prompt('Link URL eingeben:');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    } else {
        document.execCommand(command, false, null);
    }
    syncNoteEditorHiddenInput();
    scheduleNoteDraftSave();
    renderNotePreview();
    saveNoteEditorSelection();
}

function handleNoteColorChange(event) {
    const color = event.target.value;
    const editor = getNoteEditorElement();
    if (!editor) return;
    editor.focus({ preventScroll: true });
    restoreNoteEditorSelection();
    document.execCommand('foreColor', false, color);
    syncNoteEditorHiddenInput();
    scheduleNoteDraftSave();
    renderNotePreview();
    saveNoteEditorSelection();
}
let currentForecastPeriod = 5;
let showForecastScenarios = true;
// GITHUB SYNC VARIABLEN
let githubToken = null;
let gistId = GIST_ID_CURRENT;
let syncInProgress = false;
const GITHUB_IMAGES_REPO = 'prenex88/portfolio-images'; // Repo für Bilder
let autoSyncTimeout = null;
let lastSyncTime = null;
let syncStatus = 'offline';
let deviceId = null;

// BENCHMARK VARIABLEN
let benchmarkData = JSON.parse(JSON.stringify(DEFAULT_BENCHMARK_DATA)); // Lokale Kopie der Fallback-Daten
const apiCache = new Map();
let showingCryptoBenchmarks = false;

// =================================================================================
// UTILITY FUNCTIONS
// =================================================================================
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// UNDO SYSTEM
let undoStack = [];
const MAX_UNDO_STACK = 20;

function getVisibleHistoryIds() {
    const selectors = [
        '#historyTableBody tr[data-id]',
        '#historyListView .history-card[data-id]',
        '#historyMobileCards .history-card[data-id]',
        '#historyGroupedView .history-card[data-id]',
        '#historyByDateView .history-card[data-id]'
    ];

    const ids = new Set();
    document.querySelectorAll(selectors.join(', ')).forEach(el => {
        const entryId = Number(el.dataset.id);
        if (!Number.isNaN(entryId)) {
            ids.add(entryId);
        }
    });
    return ids;
}

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
    setEntryStatus('Noch keine Auswahl aktiv.', 'info');
    updateEntrySummary();
    initializeCharts();
    addEventListeners();
    
    // Warte kurz, bis alle DOM-Elemente geladen sind
    await new Promise(resolve => setTimeout(resolve, 100));
    setupBottomSheet();
    
    setupKeyboardShortcuts();
    // setupTouchGestures(); // Deaktiviert, um versehentliches Swipen zu verhindern
    setupMobileTitle();
    setupAutocomplete();
    setupQuickActions();
    updateCashflowTargets();
    checkConnectionOnStartup();
    registerServiceWorker(); 
    warmUpBenchmarkApis(); // NEU: Proaktives Aufwärmen der Google Sheets
    initializeMobileNavigation();

    addMissingStyles();

    applyDashboardWidgetOrder();
    initializeDragAndDrop();

    // UX Improvements
    // setupSwipeNavigation(); // Deaktiviert, um nur Button-Navigation zu erlauben
    addTooltips();
    addAriaLabels();
    enableBatchSelection();
    updateBreadcrumbs();
    convertTablesToMobile();

    setTimeout(restoreLastActiveTab, 150);

    window.addEventListener('resize', convertTablesToMobile);
    window.addEventListener('resize', initializeMobileNavigation);
});

// NEU: Listener für Nachrichten vom Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.status === 'apiCacheCleared') {
            showNotification('API Cache erfolgreich geleert!', 'success');
        }
    });
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
        notes,
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
// UNDO SYSTEM
// =================================================================================
function saveToUndoStack(action, data) {
    undoStack.push({
        action: action,
        data: data,
        timestamp: new Date().toISOString()
    });
    
    if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
    }
    
    showUndoNotification(action);
}

function showUndoNotification(action) {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notificationIcon');
    const textEl = document.getElementById('notificationText');
    
    notification.className = 'notification with-undo';
    icon.textContent = '🗑️';
    
    let actionText = 'Gelöscht';
    switch(action) {
        case 'delete_entry': actionText = 'Eintrag gelöscht'; break;
        case 'delete_entries': actionText = 'Einträge gelöscht'; break;
        case 'delete_cashflow': actionText = 'Cashflow gelöscht'; break;
        case 'delete_platform': actionText = 'Plattform gelöscht'; break;
        case 'bulk_delete': actionText = 'Mehrere Einträge gelöscht'; break;
    }
    
    textEl.innerHTML = `${actionText} <button class="undo-btn" onclick="undoLastAction()">↩️ Rückgängig</button>`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 6000);
}

function undoLastAction() {
    if (undoStack.length === 0) {
        showNotification('Nichts zum Rückgängigmachen vorhanden', 'warning');
        return;
    }
    
    const lastAction = undoStack.pop();
    
    switch(lastAction.action) {
        case 'delete_entry':
            entries.push(lastAction.data);
            break;
            
        case 'delete_entries':
            entries.push(...lastAction.data);
            break;
            
        case 'delete_cashflow':
            cashflows.push(lastAction.data);
            break;
            
        case 'delete_platform':
            platforms.push(lastAction.data.platform);
            entries.push(...lastAction.data.entries);
            if (lastAction.data.wasFavorite) {
                favorites.push(lastAction.data.platform.name);
            }
            renderPlatformButtons();
            updateCashflowTargets();
            break;
            
        case 'bulk_delete':
            entries.push(...lastAction.data);
            selectedHistoryEntries.clear();
            break;
    }
    
    saveData();
    applyDateFilter();
    showNotification('Aktion rückgängig gemacht! ✅');
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
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCsvImport);
    }
    
    const jsonFileInput = document.getElementById('jsonFileInput');
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', handleJsonImport);
    }
    
    const historySearch = document.getElementById('historySearch');
    if (historySearch) {
        historySearch.addEventListener('input', (e) => updateHistory());
    }
    const cashflowTypeRadios = document.querySelectorAll('input[name="cashflowType"]');
    const cashflowTargetField = document.getElementById('cashflowTargetDiv');
    const setCashflowTargetVisibility = (value) => {
        if (!cashflowTargetField) return;
        cashflowTargetField.style.display = value === 'deposit' ? '' : 'none';
    };

    cashflowTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => setCashflowTargetVisibility(e.target.value));
    });
    const initialCashflowType = document.querySelector('input[name="cashflowType"]:checked');
    if (initialCashflowType) {
        setCashflowTargetVisibility(initialCashflowType.value);
    }
    const selectAllHistory = document.getElementById('selectAllHistory');
    if (selectAllHistory) {
        selectAllHistory.addEventListener('change', toggleSelectAllHistory);
    }

    const notesSearchInput = document.getElementById('notesSearchInput');
    if (notesSearchInput) {
        notesSearchInput.addEventListener('input', (e) => {
            noteSearchTerm = e.target.value;
            renderNotesList();
        });
    }

    const noteTitleInput = document.getElementById('noteTitleInput');
    if (noteTitleInput) {
        noteTitleInput.addEventListener('input', scheduleNoteDraftSave);
    }

    const noteContentEditor = document.getElementById('noteContentEditor');
    if (noteContentEditor) {
        noteContentEditor.addEventListener('input', () => {
            syncNoteEditorHiddenInput();
            scheduleNoteDraftSave();
            renderNotePreview();
        });
        ['mouseup', 'keyup', 'mouseleave'].forEach(evt => {
            noteContentEditor.addEventListener(evt, saveNoteEditorSelection);
        });
        noteContentEditor.addEventListener('focus', restoreNoteEditorSelection);
        noteContentEditor.addEventListener('blur', saveNoteEditorSelection);
    }

    const noteToolbar = document.getElementById('noteToolbar');
    if (noteToolbar) {
        noteToolbar.addEventListener('click', handleNoteToolbarClick);
    }

    const noteColorPicker = document.getElementById('noteColorPicker');
    if (noteColorPicker) {
        noteColorPicker.addEventListener('input', handleNoteColorChange);
    }

    const notePinnedToggle = document.getElementById('notePinnedToggle');
    if (notePinnedToggle) {
        notePinnedToggle.addEventListener('change', scheduleNoteDraftSave);
    }

    const noteTagsInput = document.getElementById('noteTagsInput');
    if (noteTagsInput) {
        noteTagsInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                commitTagFromInput();
            } else if (event.key === 'Backspace' && !noteTagsInput.value && noteEditorTags.length) {
                noteEditorTags.pop();
                renderNoteTagChips();
                scheduleNoteDraftSave();
            }
        });
        noteTagsInput.addEventListener('blur', () => commitTagFromInput(true));
        noteTagsInput.addEventListener('input', () => {
            // If user typed a comma, convert immediately
            if (noteTagsInput.value.includes(',')) {
                commitTagFromInput();
            } else {
                scheduleNoteDraftSave();
            }
        });
    }

    const noteAttachmentInput = document.getElementById('noteAttachmentInput');
    if (noteAttachmentInput) {
        noteAttachmentInput.addEventListener('change', handleNoteAttachmentInput);
    }

    const notePreviewToggle = document.getElementById('notePreviewToggle');
    if (notePreviewToggle) {
        notePreviewEnabled = notePreviewToggle.checked;
        notePreviewToggle.addEventListener('change', () => {
            notePreviewEnabled = notePreviewToggle.checked;
            renderNotePreview();
        });
    }

    document.getElementById('notePinnedFilterBtn')?.addEventListener('click', togglePinnedFilter);

    const noteSortSelect = document.getElementById('noteSortSelect');
    if (noteSortSelect) {
        noteSortSelect.addEventListener('change', (event) => setNoteSortMode(event.target.value));
    }

    document.getElementById('noteFilterResetBtn')?.addEventListener('click', () => resetNoteFilters(true));

    const galleryOverlay = document.getElementById('noteGalleryOverlay');
    if (galleryOverlay) {
        galleryOverlay.addEventListener('click', (event) => {
            if (event.target === galleryOverlay) {
                closeNoteGallery();
            }
        });
    }
    document.getElementById('noteGalleryClose')?.addEventListener('click', closeNoteGallery);
    document.getElementById('noteGalleryPrev')?.addEventListener('click', prevNoteGallery);
    document.getElementById('noteGalleryNext')?.addEventListener('click', nextNoteGallery);
    const galleryWrapper = document.getElementById('noteGalleryImageWrapper');
    if (galleryWrapper) {
        galleryWrapper.addEventListener('touchstart', handleNoteGalleryTouchStart, { passive: true });
        galleryWrapper.addEventListener('touchend', handleNoteGalleryTouchEnd, { passive: true });
    }
    document.addEventListener('keydown', handleNoteGalleryKeydown);

    document.getElementById('noteSaveBtn')?.addEventListener('click', saveNote);
    document.getElementById('noteCancelBtn')?.addEventListener('click', resetNoteForm);
    document.getElementById('notesNewBtn')?.addEventListener('click', () => {
        resetNoteForm();
        document.getElementById('noteTitleInput')?.focus();
    });

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

    // Tooltip während des Scrollens deaktivieren
    let isScrolling;
    window.addEventListener('scroll', () => {
        document.body.classList.add('scrolling');
        hideChartTooltip();

        clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
            document.body.classList.remove('scrolling');
        }, 200); // Entfernt die Klasse nach 200ms Inaktivität
    });

    window.addEventListener('touchmove', () => hideChartTooltip(), { passive: true });
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

        if (e.altKey && e.key >= '1' && e.key <= '7') {
            e.preventDefault();
            const keyMap = { '1': 'dashboard', '2': 'entry', '3': 'platforms', '4': 'history', '5': 'notes', '6': 'settings' };
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

        // UNDO SHORTCUT
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoLastAction();
        }

        if (e.key === 'Escape') {
            closeBottomSheet();
            closeGlobalSearch();
        }
    });
}

function updateBreadcrumbs() {
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    if (!breadcrumbsContainer) return;
    
    let path = ['Dashboard'];
    
    switch(currentTab) {
        case 'entry': path.push('Neuer Eintrag'); break;
        case 'history': path.push('Historie'); break;
        case 'cashflow': path.push('Cashflow'); break;
        case 'platforms': path.push('Plattformen'); break;
        case 'notes': path.push('Notizen'); break;
        case 'settings': path.push('Einstellungen'); break;
    }

    if (singleItemFilter && singleItemFilter.itemName) {
        path.push(singleItemFilter.itemName);
    }
    
    breadcrumbsContainer.innerHTML = path.map((item, index) => 
        index === path.length - 1 
            ? `<span>${item}</span>`
            : `${item} &gt;`
    ).join(' ');
}

// =================================================================================
// UI/UX ENHANCEMENT FUNCTIONS
// =================================================================================

function showAutoSaveIndicator(status) {
    let indicator = document.getElementById('autoSaveIndicator');
    if (!indicator) return;

    indicator.style.display = 'flex';
    if (status === 'saving') {
        indicator.innerHTML = '<span class="spinner"></span> Speichert...';
        indicator.classList.remove('success');
    } else {
        indicator.innerHTML = '✓ Automatisch gespeichert';
        indicator.classList.add('success');
    }

    indicator.style.animation = 'none';
    setTimeout(() => {
        indicator.style.animation = 'slideInOut 3s ease';
    }, 10);
}

function renderEmptyState(container, type) {
    const emptyStates = {
        history: {
            icon: '📜',
            title: 'Noch keine Einträge',
            description: 'Beginne mit deinem ersten Portfolio-Eintrag, um deine Historie aufzubauen.',
            action: '<button class="btn btn-primary" onclick="switchTab(\'entry\')">Ersten Eintrag erstellen</button>'
        },
        cashflow: {
            icon: '💸',
            title: 'Keine Cashflows',
            description: 'Tracke deine Ein- und Auszahlungen für bessere Performance-Analyse.',
            action: '<button class="btn btn-primary" onclick="switchTab(\'cashflow\'); document.getElementById(\'cashflowAmount\').focus()">Cashflow hinzufügen</button>'
        }
    };
    const state = emptyStates[type];
    if (!state || !container) return;
    container.innerHTML = `
        <div class="empty-state-enhanced">
            <div class="empty-state-icon">${state.icon}</div>
            <div class="empty-state-title">${state.title}</div>
            <div class="empty-state-description">${state.description}</div>
            ${state.action}
        </div>
    `;
}

function showTableSkeleton(container, rows = 5, cols = 4) {
    if (!container) return;
    let skeletonHTML = '';
    for (let i = 0; i < rows; i++) {
        skeletonHTML += '<tr class="skeleton-row">';
        for (let j = 0; j < cols; j++) {
            const width = 80 + Math.random() * 40;
            skeletonHTML += `<td><div class="skeleton-box" style="width: ${width}px"></div></td>`;
        }
        skeletonHTML += '</tr>';
    }
    container.innerHTML = skeletonHTML;
}

function addTooltips() {
    // Diese Funktion kann erweitert werden, um Tooltips dynamisch hinzuzufügen.
    // Aktuell werden Tooltips direkt im HTML über das `title`-Attribut gesetzt.
}


// =================================================================================
// MOBILE & TOUCH FEATURES
// =================================================================================

function setupTouchGestures() {
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0, pullDistance = 0;
    
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.chart-container, .data-table-wrapper, .bottom-sheet-body, button, a, .sortable-ghost')) {
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (e.target.closest('.chart-container, .data-table-wrapper, .bottom-sheet-body, button, a, .sortable-ghost')) {
            return;
        }
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
}

function handleSwipe(startX, endX) {
    const swipeThreshold = 50;
    const diff = startX - endX;
    
    if (Math.abs(diff) < swipeThreshold) return;
    
    const tabs = ['dashboard', 'entry', 'cashflow', 'history'];
    const currentIndex = tabs.indexOf(currentTab);
    
    if (diff > 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        switchTab(tabs[currentIndex + 1]);
    } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        switchTab(tabs[currentIndex - 1]);
    }
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
    
    // Ruft alle Update-Funktionen auf, um die Beträge aus- oder einzublenden
    updateDisplay();
    
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
    let notesData = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}portfolioNotes`));

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
                notesData = backup.notes;
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
    notes = (notesData || []).map(normalizeNote).filter(Boolean);
    
    console.log(`📊 Loaded data: ${entries.length} entries, ${platforms.length} platforms, ${favorites.length} favorites`);
    if (entries.length > 0) {
        const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
        console.log(`📅 Entry dates: ${dates.slice(0, 5).join(', ')}${dates.length > 5 ? '...' : ''}`);
    }
    
    renderNotesList();
    resetNoteForm({ preserveDraft: true, silent: true });
    loadNoteDraft();
    renderNotePreview();
    applyDateFilter();
}

﻿function saveData(triggerSync = true) {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}portfolioPlatforms`, JSON.stringify(platforms));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioEntries`, JSON.stringify(entries));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioCashflows`, JSON.stringify(cashflows));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioDayStrategies`, JSON.stringify(dayStrategies));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioFavorites`, JSON.stringify(favorites));
        localStorage.setItem(`${STORAGE_PREFIX}portfolioNotes`, JSON.stringify(notes));
        const timestamp = new Date().toISOString();
        localStorage.setItem(`${STORAGE_PREFIX}lastModified`, timestamp);
        localStorage.setItem(`${STORAGE_PREFIX}lastModifiedDevice`, getDeviceId());
        saveBackupToIndexedDB();
    } catch (error) {
        if (error && error.name === 'QuotaExceededError') {
            showNotification('Speicher voll! Bereinige alte Daten oder nutze Cloud-Sync.', 'error');
            const allKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                allKeys.push(localStorage.key(i));
            }
            console.error('LocalStorage quota exceeded:', {
                platformsCount: platforms.length,
                entriesCount: entries.length,
                platformsSize: JSON.stringify(platforms).length,
                entriesSize: JSON.stringify(entries).length,
                totalSize: JSON.stringify({ platforms, entries, cashflows, dayStrategies, favorites, notes }).length,
                localStorageKeys: allKeys.length,
                allKeys: allKeys.slice(0, 20),
                storageUsage: JSON.stringify(localStorage).length
            });

            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (
                    key &&
                    !key.startsWith(STORAGE_PREFIX) &&
                    !key.includes('theme') &&
                    !key.includes('biometric') &&
                    !key.includes('auth')
                ) {
                    keysToRemove.push(key);
                }
            }

            const oldKeys = allKeys.filter(key => key && (
                key.includes('_v10_') ||
                key.includes('portfolio_') ||
                (key.startsWith('w3pt_') && !key.startsWith(STORAGE_PREFIX))
            ));
            keysToRemove.push(...oldKeys);

            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (removeError) {
                    console.warn('Could not remove key:', key, removeError);
                }
            });

            try {
                localStorage.setItem(`${STORAGE_PREFIX}portfolioEntries`, JSON.stringify(entries));
                console.log(`Saved ${entries.length} entries successfully`);

                localStorage.setItem(`${STORAGE_PREFIX}portfolioFavorites`, JSON.stringify(favorites));
                localStorage.setItem(`${STORAGE_PREFIX}portfolioCashflows`, JSON.stringify(cashflows || []));
                localStorage.setItem(`${STORAGE_PREFIX}portfolioDayStrategies`, JSON.stringify(dayStrategies || []));
                localStorage.setItem(`${STORAGE_PREFIX}portfolioNotes`, JSON.stringify(notes || []));

                const usedPlatformNames = new Set(entries.map(entry => entry.protocol));
                const minimalPlatforms = platforms.filter(platform =>
                    usedPlatformNames.has(platform.name) ||
                    DEFAULT_PLATFORMS.some(defaultPlatform => defaultPlatform.name === platform.name)
                );
                localStorage.setItem(`${STORAGE_PREFIX}portfolioPlatforms`, JSON.stringify(minimalPlatforms));

                const timestamp = new Date().toISOString();
                localStorage.setItem(`${STORAGE_PREFIX}lastModified`, timestamp);
                localStorage.setItem(`${STORAGE_PREFIX}lastModifiedDevice`, getDeviceId());

                showNotification(`${keysToRemove.length} alte Keys entfernt, ${entries.length} Eintraege gesichert`, 'warning');
                console.log(`Emergency save completed: ${entries.length} entries, ${minimalPlatforms.length} platforms`);
                console.log(`Removed ${keysToRemove.length} old keys:`, keysToRemove.slice(0, 10));
            } catch (cleanupError) {
                console.error('Critical storage error:', cleanupError);
                showNotification('Kritischer Speicherfehler - nutze Cloud-Sync!', 'error');
            }
            return false;
        }

        console.error('Unexpected storage error:', error);
        showNotification('Speichern fehlgeschlagen. Details in der Konsole.', 'error');
        return false;
    }

    if (triggerSync && githubToken && gistId && localStorage.getItem(`${STORAGE_PREFIX}autoSync`) === 'true') {
        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(() => syncNow(), 2000);
    }

    return true;
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

// =================================================================================
// NOTES WORKSPACE
// =================================================================================
function resetNoteForm(options = {}) {
    const { preserveDraft = false, silent = false } = options;
    editingNoteId = null;
    noteEditorAttachments = [];
    noteEditorTags = [];

    const titleInput = document.getElementById('noteTitleInput');
    const tagsInput = document.getElementById('noteTagsInput');
    const pinnedToggle = document.getElementById('notePinnedToggle');
    const fileInput = document.getElementById('noteAttachmentInput');

    if (titleInput) titleInput.value = '';
    setNoteEditorHtml('');
    if (tagsInput) tagsInput.value = '';
    if (pinnedToggle) pinnedToggle.checked = false;
    if (fileInput) fileInput.value = '';

    renderNoteTagChips();
    updateNoteAttachmentPreview();
    updateNoteEditorMode();
    renderNotePreview();

    if (!preserveDraft) {
        clearNoteDraft(!silent);
    } else if (!silent) {
        updateNoteDraftStatus('Entwurf bereit.');
    }
}

function renderNoteTagChips() {
    const container = document.getElementById('noteTagChips');
    if (!container) return;

    container.innerHTML = '';
    if (!noteEditorTags.length) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    noteEditorTags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'note-tag-chip';
        chip.dataset.tag = tag;
        chip.innerHTML = `<span>${tag}</span><span class="note-tag-remove" aria-hidden="true">✕</span>`;
        chip.addEventListener('click', () => removeNoteTag(tag));
        container.appendChild(chip);
    });
}

function removeNoteTag(tag) {
    noteEditorTags = noteEditorTags.filter(existing => existing !== tag);
    renderNoteTagChips();
    scheduleNoteDraftSave();
}

function commitTagFromInput(force = false) {
    const input = document.getElementById('noteTagsInput');
    if (!input) return;

    let raw = input.value.trim();
    if (!raw && !force) {
        return;
    }

    raw = raw.replace(/,+$/, '');
    const candidates = raw
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);

    if (!candidates.length) {
        input.value = '';
        return;
    }

    const existing = new Set(noteEditorTags.map(tag => tag.toLowerCase()));
    candidates.forEach(candidate => {
        const lower = candidate.toLowerCase();
        if (!existing.has(lower)) {
            existing.add(lower);
            noteEditorTags.push(candidate);
        }
    });

    noteEditorTags = noteEditorTags.sort((a, b) => a.localeCompare(b, 'de')); // keep list tidy
    renderNoteTagChips();
    input.value = '';
    scheduleNoteDraftSave();
}

function scheduleNoteDraftSave() {
    if (noteDraftTimer) {
        clearTimeout(noteDraftTimer);
    }
    syncNoteEditorHiddenInput();
    updateNoteDraftStatus('Speichere Entwurf...');
    noteDraftTimer = setTimeout(saveNoteDraft, NOTE_AUTOSAVE_DELAY);
}

function saveNoteDraft() {
    const title = document.getElementById('noteTitleInput')?.value || '';
    const contentHtml = getNoteEditorHtml();
    const contentText = stripHtml(contentHtml);
    const isPinned = document.getElementById('notePinnedToggle')?.checked || false;

    const draftPayload = {
        title,
        contentHtml,
        contentText,
        tags: [...noteEditorTags],
        isPinned,
        editingNoteId
    };

    if (!title && !contentText && !noteEditorTags.length && !isPinned && !editingNoteId) {
        clearNoteDraft();
        return;
    }

    localStorage.setItem(NOTE_DRAFT_KEY, JSON.stringify({
        ...draftPayload,
        updatedAt: new Date().toISOString()
    }));

    updateNoteDraftStatus('Entwurf gespeichert.');
}

function clearNoteDraft(showMessage = false) {
    localStorage.removeItem(NOTE_DRAFT_KEY);
    updateNoteDraftStatus(showMessage ? 'Entwurf verworfen.' : '');
}

function loadNoteDraft() {
    const rawDraft = localStorage.getItem(NOTE_DRAFT_KEY);
    if (!rawDraft) return;

    try {
        const draft = JSON.parse(rawDraft);
        const titleInput = document.getElementById('noteTitleInput');
        const pinnedToggle = document.getElementById('notePinnedToggle');

        if (titleInput) titleInput.value = draft.title || '';
        setNoteEditorHtml(draft.contentHtml || draft.contentText || draft.content || '');
        if (Array.isArray(draft.tags)) {
            noteEditorTags = draft.tags.filter(tag => !!tag);
        }
        if (pinnedToggle) pinnedToggle.checked = !!draft.isPinned;
        let editingNote = null;
        if (draft.editingNoteId && notes.some(n => n.id === draft.editingNoteId)) {
            editingNoteId = draft.editingNoteId;
            editingNote = notes.find(n => n.id === draft.editingNoteId) || null;
        } else {
            editingNoteId = null;
        }

        if (editingNote) {
            noteEditorAttachments = (editingNote.attachments || []).map(att => ({
                ...att,
                originalSize: att.originalSize || att.size || (att.data ? calculateDataUrlSize(att.data) : 0)
            }));
        } else {
            noteEditorAttachments = [];
        }
        updateNoteAttachmentPreview();

        renderNoteTagChips();
        updateNoteEditorMode();
        renderNotePreview();
        if (draft.updatedAt) {
            const date = new Date(draft.updatedAt);
            if (!Number.isNaN(date.getTime())) {
                updateNoteDraftStatus(`Entwurf vom ${date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`);
            }
        }
    } catch (error) {
        console.warn('Konnte Notiz-Entwurf nicht laden:', error);
        clearNoteDraft();
    }
}

function updateNoteDraftStatus(message) {
    const statusEl = document.getElementById('noteDraftStatus');
    if (!statusEl) return;

    if (noteDraftStatusTimeout) {
        clearTimeout(noteDraftStatusTimeout);
        noteDraftStatusTimeout = null;
    }

    statusEl.textContent = message || '';
    statusEl.style.opacity = message ? '1' : '0';

    if (message) {
        noteDraftStatusTimeout = setTimeout(() => {
            statusEl.style.opacity = '0';
        }, NOTE_DRAFT_MESSAGE_DURATION);
    }
}

function normalizeNote(rawNote) {
    if (!rawNote) return null;

    const attachments = Array.isArray(rawNote.attachments)
        ? rawNote.attachments.map(att => ({
            ...att,
            id: att.id || generateNoteId('attachment'),
            name: att.name || 'Screenshot',
            size: att.size || 0
        }))
        : [];

    const uniqueTags = Array.isArray(rawNote.tags)
        ? Array.from(new Set(rawNote.tags
            .map(tag => (typeof tag === 'string' ? tag.trim() : '')
            ).filter(Boolean)))
        : [];

    const contentHtmlRaw = typeof rawNote.contentHtml === 'string' ? rawNote.contentHtml : rawNote.content || '';
    const contentHtml = sanitizeNoteHtml(contentHtmlRaw);
    const plainContent = stripHtml(contentHtml).trim();

    return {
        ...rawNote,
        attachments,
        tags: uniqueTags,
        isPinned: !!rawNote.isPinned,
        title: rawNote.title || '',
        content: plainContent,
        contentHtml
    };
}

function getNoteContentFragments(note) {
    const sanitizedHtml = note.contentHtml ? sanitizeNoteHtml(note.contentHtml) : convertTextToHtml(note.content || '');
    const plainText = stripHtml(sanitizedHtml);
    const MAX_PREVIEW_CHARS = 360;
    const MAX_PREVIEW_LINES = 8;
    const previewLines = plainText.split(/\r?\n/);
    const isClamped = plainText.length > MAX_PREVIEW_CHARS || previewLines.length > MAX_PREVIEW_LINES;

    const previewText = isClamped ? plainText.slice(0, MAX_PREVIEW_CHARS).trim() : plainText;
    const previewHtml = sanitizedHtml;

    return {
        previewText,
        fullText: plainText,
        previewHtml,
        fullHtml: sanitizedHtml,
        isClamped
    };
}

function escapeHtmlForHighlight(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightHtml(html, term) {
    if (!term || !term.trim() || !html) return html;
    const safeTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeTerm, 'gi');
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }
    textNodes.forEach(node => {
        const value = node.nodeValue;
        if (!value || !regex.test(value)) return;
        const wrapper = document.createElement('span');
        wrapper.innerHTML = value.replace(regex, '<mark class="note-highlight">$&</mark>');
        const fragment = document.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach(child => fragment.appendChild(child));
        node.replaceWith(fragment);
    });
    return template.innerHTML;
}

function highlightNoteText(text, term) {
    const raw = String(text ?? '');
    if (!term || !term.trim()) {
        return escapeHtmlForHighlight(raw).replace(/\r?\n/g, '<br>');
    }

    const normalizedTerm = term.trim();
    const markerStart = '__<<HIGHLIGHT_START>>__';
    const markerEnd = '__<<HIGHLIGHT_END>>__';
    const safeTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeTerm, 'gi');

    const marked = raw.replace(regex, match => `${markerStart}${match}${markerEnd}`);
    let escaped = escapeHtmlForHighlight(marked).replace(/\r?\n/g, '<br>');
    escaped = escaped
        .replaceAll(markerStart, '<mark class="note-highlight">')
        .replaceAll(markerEnd, '</mark>');
    return escaped;
}

function calculateNoteSearchScore(note, term) {
    if (!term) return 0;
    const comparableTerm = term.toLowerCase();
    const fuzzyAvailable = globalSearchEngine && typeof globalSearchEngine.fuzzyMatch === 'function';
    const fuzzy = fuzzyAvailable ? globalSearchEngine.fuzzyMatch.bind(globalSearchEngine) : null;

    const addScore = (value, weight = 1) => {
        if (!value) return 0;
        let score = 0;
        const text = String(value);
        const lower = text.toLowerCase();
        if (lower.includes(comparableTerm)) {
            score += weight;
        }
        if (fuzzy) {
            score += fuzzy(text, comparableTerm, 0.35) * weight * 1.5;
        }
        return score;
    };

    let score = 0;
    score += addScore(note.title, 6);
    score += addScore((note.content || '').slice(0, 1000), 4);
    (note.tags || []).forEach(tag => {
        score += addScore(tag, 3);
    });
    (note.attachments || []).forEach(att => {
        score += addScore(att.name, 2);
    });

    return score;
}

function noteMatchesTerm(note, term) {
    if (!term) return true;
    const comparable = term.toLowerCase();
    if ((note.title || '').toLowerCase().includes(comparable)) return true;
    if ((note.content || '').toLowerCase().includes(comparable)) return true;
    if ((note.tags || []).some(tag => tag.toLowerCase().includes(comparable))) return true;
    if ((note.attachments || []).some(att => (att.name || '').toLowerCase().includes(comparable))) return true;
    return false;
}

function buildNoteSearchMeta(note, term, score, fragments) {
    const matchingTags = (note.tags || []).filter(tag => tag.toLowerCase().includes(term));
    const previewHtml = fragments.previewHtml ? highlightHtml(fragments.previewHtml, term) : highlightNoteText(fragments.previewText, term);
    const fullHtml = fragments.fullHtml ? highlightHtml(fragments.fullHtml, term) : highlightNoteText(fragments.fullText, term);
    return {
        score,
        titleHtml: highlightNoteText(note.title || 'Ohne Titel', term),
        previewHtml,
        fullHtml,
        previewText: fragments.previewText,
        fullText: fragments.fullText,
        isClamped: fragments.isClamped,
        matchingTags
    };
}

function compareNotesBySortMode(a, b) {
    switch (noteSortMode) {
        case 'updated-asc':
            return new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0);
        case 'created-desc':
            return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
        case 'created-asc':
            return new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0);
        case 'title-asc':
            return (a.title || '').localeCompare(b.title || '', 'de', { sensitivity: 'base' });
        case 'title-desc':
            return (b.title || '').localeCompare(a.title || '', 'de', { sensitivity: 'base' });
        case 'updated-desc':
        default:
            return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    }
}

function convertInlineMarkdown(text) {
    if (!text) return '';

    let result = escapeHtmlForHighlight(text);
    const codePlaceholders = [];

    result = result.replace(/`([^`]+)`/g, (match, code) => {
        const index = codePlaceholders.length;
        codePlaceholders.push(`<code class="note-md-inline">${code}</code>`);
        return `__CODE_${index}__`;
    });

    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
        const safeHref = href.trim();
        if (!safeHref || /^(javascript:|data:)/i.test(safeHref)) {
            return label;
        }
        return `<a href="${escapeHtmlForHighlight(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    result = result.replace(/\\\*/g, '__AST__').replace(/\\_/g, '__UND__');

    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');

    result = result.replace(/__CODE_(\d+)__/g, (match, idx) => codePlaceholders[idx] || match);
    result = result.replace(/__AST__/g, '*').replace(/__UND__/g, '_');

    return result;
}

function renderMarkdown(text) {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    const html = [];
    let listBuffer = [];
    let listType = null;
    let inCodeBlock = false;
    let codeBuffer = [];

    const flushList = () => {
        if (!listBuffer.length) return;
        html.push(`<${listType}>${listBuffer.join('')}</${listType}>`);
        listBuffer = [];
        listType = null;
    };

    const flushCode = () => {
        html.push(`<pre class="note-md-code"><code>${escapeHtmlForHighlight(codeBuffer.join('\n'))}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
    };

    lines.forEach(line => {
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                flushCode();
            } else {
                flushList();
                inCodeBlock = true;
            }
            return;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            return;
        }

        const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        const unordered = line.match(/^\s*[-*+]\s+(.*)$/);

        if (ordered) {
            if (listType !== 'ol') {
                flushList();
                listType = 'ol';
            }
            listBuffer.push(`<li>${convertInlineMarkdown(ordered[2])}</li>`);
            return;
        }

        if (unordered) {
            if (listType !== 'ul') {
                flushList();
                listType = 'ul';
            }
            listBuffer.push(`<li>${convertInlineMarkdown(unordered[1])}</li>`);
            return;
        }

        flushList();

        if (!line.trim()) {
            html.push('<br>');
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = Math.min(6, headingMatch[1].length);
            html.push(`<h${level} class="note-md-heading">${convertInlineMarkdown(headingMatch[2])}</h${level}>`);
            return;
        }

        html.push(`<p>${convertInlineMarkdown(line)}</p>`);
    });

    if (inCodeBlock) {
        flushCode();
    } else {
        flushList();
    }

    return html.join('');
}

function renderNotePreview() {
    const preview = document.getElementById('notePreview');
    const toggle = document.getElementById('notePreviewToggle');
    if (!preview) return;

    if (toggle) {
        notePreviewEnabled = toggle.checked;
    }

    if (!notePreviewEnabled) {
        preview.innerHTML = '';
        preview.classList.add('collapsed');
        preview.classList.add('note-preview-empty');
        return;
    }

    preview.classList.remove('collapsed');
    const contentHtml = getNoteEditorHtml();
    const contentText = stripHtml(contentHtml).trim();
    if (!contentText) {
        preview.innerHTML = '<div class="note-preview-empty">Vorschau erscheint hier.</div>';
        preview.classList.add('note-preview-empty');
        return;
    }

    preview.classList.remove('note-preview-empty');
    preview.innerHTML = contentHtml;
}

function renderNoteFilters() {
    const pinnedBtn = document.getElementById('notePinnedFilterBtn');
    if (pinnedBtn) {
        const isActive = !!noteFilterState.pinnedOnly;
        pinnedBtn.classList.toggle('active', isActive);
        pinnedBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    const tagContainer = document.getElementById('noteTagFilters');
    if (tagContainer) {
        const allTags = Array.from(new Set(notes.flatMap(note => note.tags || [])))
            .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

        tagContainer.innerHTML = '';

        if (!allTags.length) {
            const emptyIndicator = document.createElement('span');
            emptyIndicator.className = 'notes-filter-empty';
            emptyIndicator.textContent = 'Noch keine Tags';
            tagContainer.appendChild(emptyIndicator);
        } else {
            allTags.forEach(tag => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'notes-filter-chip';
                const isSelected = noteFilterState.tags.some(selected => selected.toLowerCase() === tag.toLowerCase());
                if (isSelected) btn.classList.add('active');
                btn.textContent = `#${tag}`;
                btn.addEventListener('click', () => toggleNoteTagFilter(tag));
                tagContainer.appendChild(btn);
            });
        }
    }

    const sortSelect = document.getElementById('noteSortSelect');
    if (sortSelect && sortSelect.value !== noteSortMode) {
        sortSelect.value = noteSortMode;
    }

    const resetBtn = document.getElementById('noteFilterResetBtn');
    if (resetBtn) {
        const hasFilters = noteFilterState.pinnedOnly || noteFilterState.tags.length > 0 || !!noteSearchTerm.trim();
        resetBtn.disabled = !hasFilters;
    }
}

function togglePinnedFilter() {
    noteFilterState.pinnedOnly = !noteFilterState.pinnedOnly;
    renderNotesList();
}

function toggleNoteTagFilter(tag) {
    const normalized = tag.toLowerCase();
    const index = noteFilterState.tags.findIndex(existing => existing.toLowerCase() === normalized);
    if (index > -1) {
        noteFilterState.tags.splice(index, 1);
    } else {
        noteFilterState.tags.push(tag);
    }
    renderNotesList();
}

function resetNoteFilters(includeSearch = true) {
    noteFilterState.tags = [];
    noteFilterState.pinnedOnly = false;
    if (includeSearch) {
        noteSearchTerm = '';
        const searchInput = document.getElementById('notesSearchInput');
        if (searchInput) searchInput.value = '';
    }
    renderNotesList();
}

function setNoteSortMode(value) {
    noteSortMode = value;
    renderNotesList();
}

function updateNoteEditorMode() {
    const editor = document.getElementById('noteEditor');
    const saveBtn = document.getElementById('noteSaveBtn');
    const cancelBtn = document.getElementById('noteCancelBtn');
    if (!editor || !saveBtn || !cancelBtn) return;
    if (editingNoteId) {
        editor.classList.add('editing');
        saveBtn.textContent = 'Aktualisieren';
        cancelBtn.textContent = 'Abbrechen';
    } else {
        editor.classList.remove('editing');
        saveBtn.textContent = 'Speichern';
        cancelBtn.textContent = 'Zurücksetzen';
    }
}

function generateNoteId(prefix = 'note') {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

﻿﻿function updateNoteAttachmentPreview() {
    const container = document.getElementById('noteAttachmentPreview');
    if (!container) return;
    container.innerHTML = '';

    if (!noteEditorAttachments.length) {
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    noteEditorAttachments.forEach(attachment => {
        const item = document.createElement('div');
        item.className = 'note-attachment';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'note-attachment-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = 'x';
        removeBtn.addEventListener('click', () => removeNoteAttachment(attachment.id));

        const preview = document.createElement('img');
        preview.src = attachment.thumbnail || attachment.url || attachment.data || '';
        preview.alt = attachment.name || 'Anhang';

        const meta = document.createElement('div');
        meta.className = 'note-attachment-meta';
        const sizeText = formatFileSize(attachment.size || 0);
        const originalSizeText = attachment.originalSize && attachment.originalSize > (attachment.size || 0) + 1024
            ? ` (von ${formatFileSize(attachment.originalSize)})`
            : '';
        meta.textContent = `${attachment.name || 'Screenshot'} - ${sizeText}${originalSizeText}`;

        item.appendChild(removeBtn);
        item.appendChild(preview);
        item.appendChild(meta);
        container.appendChild(item);
    });
}

function removeNoteAttachment(attachmentId) {
    noteEditorAttachments = noteEditorAttachments.filter(att => att.id !== attachmentId);
    updateNoteAttachmentPreview();
    scheduleNoteDraftSave();
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function calculateDataUrlSize(dataUrl) {
    if (!dataUrl) return 0;
    const parts = dataUrl.split(',');
    if (parts.length < 2) return 0;
    const base64 = parts[1];
    const padding = (base64.match(/=+$/) || [''])[0].length;
    return Math.floor(base64.length * 3 / 4) - padding;
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.decoding = 'async';
        img.src = dataUrl;
    });
}

async function optimizeImageDataUrl(dataUrl, mimeType) {
    const MAX_DIMENSION = 1200;
    const TARGET_SIZE_BYTES = 100 * 1024; // Max 100KB

    const image = await loadImageFromDataUrl(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
        return { dataUrl, mimeType, size: calculateDataUrlSize(dataUrl) };
    }

    const maxSide = Math.max(width, height);
    const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        return { dataUrl, mimeType, size: calculateDataUrlSize(dataUrl) };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    // Immer WebP für maximale Komprimierung
    let outputType = 'image/webp';
    let quality = 0.6;
    let optimized = canvas.toDataURL(outputType, quality);
    let optimizedSize = calculateDataUrlSize(optimized);

    // Aggressive Qualitätsreduktion bis 50KB erreicht
    while (optimizedSize > TARGET_SIZE_BYTES && quality > 0.2) {
        quality = Math.max(0.2, quality - 0.05);
        optimized = canvas.toDataURL(outputType, quality);
        optimizedSize = calculateDataUrlSize(optimized);
        if (quality <= 0.2) break;
    }

    return { dataUrl: optimized, mimeType: outputType, size: optimizedSize };
}

async function uploadToGitHub(file, optimizedDataUrl) {
    // Konvertiere DataURL zu Base64
    const base64 = optimizedDataUrl.split(',')[1];

    try {
        // Upload direkt ins Repo
        const uploadUrl = await uploadImageToGitHub(base64, file.name);
        return uploadUrl;
    } catch (error) {
        console.error('GitHub Upload Fehler:', error);
        throw error;
    }
}

async function uploadImageToGitHub(base64Content, filename) {
    // Erstelle Pfad: images/YYYY-MM/timestamp-filename
    const monthPath = new Date().toISOString().slice(0, 7); // z.B. "2025-01"
    const timestamp = Date.now();
    const path = `images/${monthPath}/${timestamp}-${filename}`;

    console.log('📤 Upload zu GitHub:', path);

    // Upload via Git Contents API
    const response = await fetch(
        `https://api.github.com/repos/${GITHUB_IMAGES_REPO}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload ${filename}`,
                content: base64Content,
                branch: 'main'
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        console.error('GitHub API Error:', errorData);
        throw new Error(`GitHub Upload fehlgeschlagen: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('✅ Upload erfolgreich:', data.content.html_url);

    // Nutze html_url + ?raw=true für direkten Bildabruf
    const rawUrl = `${data.content.html_url}?raw=true`;
    console.log('📸 Raw URL:', rawUrl);
    return rawUrl;
}

async function prepareNoteAttachment(file) {
    const OPTIMIZATION_THRESHOLD = 100 * 1024; // Nur komprimieren wenn >100KB

    const baseDataUrl = await readFileAsDataURL(file);
    const baseSize = calculateDataUrlSize(baseDataUrl);
    const attachment = {
        id: generateNoteId('attachment'),
        name: file.name,
        type: file.type,
        originalSize: file.size,
        size: baseSize,
        data: baseDataUrl
    };

    if (!file.type.startsWith('image/')) {
        return attachment;
    }

    // Optimiere Bild falls nötig
    let dataToUpload = baseDataUrl;
    if (baseSize > OPTIMIZATION_THRESHOLD) {
        showNotification('Großes Bild wird optimiert...', 'info');
        try {
            const optimized = await optimizeImageDataUrl(baseDataUrl, file.type);
            if (optimized && optimized.dataUrl) {
                const optimizedSize = optimized.size || calculateDataUrlSize(optimized.dataUrl);
                dataToUpload = optimized.dataUrl;
                attachment.size = optimizedSize;
                attachment.type = optimized.mimeType || file.type;

                const savedKB = ((baseSize - optimizedSize) / 1024).toFixed(0);
                console.log(`Bild optimiert: ${savedKB}KB gespart`);
            }
        } catch (error) {
            console.warn('Konnte Bildanhang nicht optimieren:', error);
        }
    }

    // Upload zu GitHub
    showNotification('Bild wird hochgeladen...', 'info');
    try {
        const githubUrl = await uploadToGitHub(file, dataToUpload);

        if (githubUrl) {
            // Speichere nur URL + kleines Thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = 150;
            canvas.height = 150;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataToUpload;
            });
            ctx.drawImage(img, 0, 0, 150, 150);

            attachment.url = githubUrl;
            attachment.thumbnail = canvas.toDataURL('image/webp', 0.6);
            attachment.storage = 'github';
            delete attachment.data; // Entferne Base64, spare Platz!

            showNotification('Bild auf GitHub hochgeladen!', 'success');
        } else {
            throw new Error('Upload fehlgeschlagen');
        }
    } catch (error) {
        console.error('GitHub Upload Fehler:', error);
        showNotification('Upload fehlgeschlagen - Bild wird lokal gespeichert', 'warning');
        // Behalte Base64 als Fallback
        attachment.data = dataToUpload;
        attachment.storage = 'local';
    }

    return attachment;
}

async function handleNoteAttachmentInput(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    let added = 0;

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            showNotification(`${file.name} ist kein unterstuetztes Bildformat.`, 'error');
            continue;
        }

        try {
            const attachment = await prepareNoteAttachment(file);
            noteEditorAttachments.push(attachment);
            added += 1;
        } catch (error) {
            console.error('Fehler beim Verarbeiten des Anhangs:', error);
            showNotification(`Konnte ${file.name} nicht laden`, 'error');
        }
    }

    if (added) {
        updateNoteAttachmentPreview();
        scheduleNoteDraftSave();
    }

    if (event.target) {
        event.target.value = '';
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const thresholds = [
        { unit: 'GB', value: 1024 * 1024 * 1024 },
        { unit: 'MB', value: 1024 * 1024 },
        { unit: 'KB', value: 1024 }
    ];
    for (const threshold of thresholds) {
        if (bytes >= threshold.value) {
            return `${(bytes / threshold.value).toFixed(1)} ${threshold.unit}`;
        }
    }
    return `${bytes} B`;
}

function formatNoteTimestamp(note) {
    const createdDate = note.createdAt ? new Date(note.createdAt) : null;
    const updatedDate = note.updatedAt ? new Date(note.updatedAt) : null;

    const format = (date) => {
        if (!date || Number.isNaN(date.getTime())) return null;
        return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const createdText = format(createdDate);
    const updatedText = format(updatedDate);

    if (createdText && updatedText && note.updatedAt && note.updatedAt !== note.createdAt) {
        return `Erstellt ${createdText} · Aktualisiert ${updatedText}`;
    }

    if (createdText) {
        return `Erstellt ${createdText}`;
    }

    if (updatedText) {
        return `Aktualisiert ${updatedText}`;
    }

    return '';
}

function formatNoteShort(note) {
    if (note.updatedAt && note.updatedAt !== note.createdAt) {
        const updated = new Date(note.updatedAt);
        if (!Number.isNaN(updated.getTime())) {
            return `Aktualisiert ${updated.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`;
        }
    }
    if (note.createdAt) {
        const created = new Date(note.createdAt);
        if (!Number.isNaN(created.getTime())) {
            return `Erstellt ${created.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`;
        }
    }
    return '';
}

function getFilteredNotes() {
    let filtered = [...notes];

    if (noteFilterState.pinnedOnly) {
        filtered = filtered.filter(note => note.isPinned);
    }

    if (noteFilterState.tags.length) {
        const selectedTags = noteFilterState.tags.map(tag => tag.toLowerCase());
        filtered = filtered.filter(note => {
            const noteTags = (note.tags || []).map(tag => tag.toLowerCase());
            return selectedTags.every(tag => noteTags.includes(tag));
        });
    }

    const term = noteSearchTerm.trim().toLowerCase();
    noteSearchMetadata.clear();
    if (term) {
        filtered = filtered.filter(note => {
            const fragments = getNoteContentFragments(note);
            const score = calculateNoteSearchScore(note, term);
            const matches = score > 0 || noteMatchesTerm(note, term);
            if (!matches) return false;

            const meta = buildNoteSearchMeta(note, term, Math.max(score, 0), fragments);
            noteSearchMetadata.set(note.id, meta);
            return true;
        });
    }

    return filtered;
}

function buildNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.id = note.id;
    if (note.isPinned) {
        card.classList.add('note-card-pinned');
    }

    const searchMeta = noteSearchMetadata.get(note.id);

    const header = document.createElement('div');
    header.className = 'note-card-header';

    const title = document.createElement('div');
    title.className = 'note-card-title';
    const defaultTitle = note.title?.trim() || 'Ohne Titel';
    if (searchMeta && searchMeta.titleHtml) {
        title.innerHTML = searchMeta.titleHtml;
    } else {
        title.textContent = defaultTitle;
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'note-card-meta';

    const metaInfo = document.createElement('div');
    metaInfo.className = 'note-card-meta-info';

    const date = document.createElement('span');
    date.className = 'note-card-date';
    date.textContent = formatNoteShort(note);
    metaInfo.appendChild(date);

    const tagsSummary = document.createElement('span');
    tagsSummary.className = 'note-card-tags-summary';
    const tagList = (note.tags || []).slice(0, 2);
    if (tagList.length) {
        tagsSummary.textContent = tagList.map(tag => `#${tag}`).join(' · ');
        metaInfo.appendChild(tagsSummary);
    }

    const pinToggle = document.createElement('button');
    pinToggle.className = note.isPinned ? 'note-card-pin-toggle active' : 'note-card-pin-toggle';
    pinToggle.type = 'button';
    pinToggle.title = note.isPinned ? 'Pin entfernen' : 'Anheften';
    pinToggle.innerHTML = '📌';
    pinToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleNotePin(note.id);
    });

    header.appendChild(title);
    metaRow.appendChild(metaInfo);
    metaRow.appendChild(pinToggle);
    header.appendChild(metaRow);
    card.appendChild(header);

    let toggleButton = null;
    let attachmentsRow = null;

    const fragments = searchMeta
        ? {
            previewText: searchMeta.previewText,
            fullText: searchMeta.fullText,
            previewHtml: searchMeta.previewHtml,
            fullHtml: searchMeta.fullHtml,
            isClamped: searchMeta.isClamped
        }
        : getNoteContentFragments(note);
    const clampedText = fragments.previewText && fragments.fullText && fragments.previewText !== fragments.fullText;

    if (fragments.fullText) {
        const content = document.createElement('div');
        content.className = 'note-card-content';
        if (fragments.isClamped) {
            const previewHtml = fragments.previewHtml || highlightNoteText(fragments.previewText, noteSearchTerm.trim().toLowerCase());
            content.innerHTML = previewHtml;
            content.dataset.previewHtml = previewHtml;
            content.dataset.previewText = fragments.previewText;
            const fullHtml = fragments.fullHtml || highlightNoteText(fragments.fullText, noteSearchTerm.trim().toLowerCase());
            content.dataset.fullHtml = fullHtml;
            content.dataset.fullText = fragments.fullText;
            content.classList.add('note-card-content-clamped');

            if (clampedText) {
                toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'note-card-toggle';
                toggleButton.textContent = 'Mehr anzeigen';
                toggleButton.setAttribute('aria-expanded', 'false');
                toggleButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
                    if (expanded) {
                        if (content.dataset.previewHtml) {
                            content.innerHTML = content.dataset.previewHtml;
                        } else {
                            content.textContent = content.dataset.previewText || '';
                        }
                        content.classList.add('note-card-content-clamped');
                        toggleButton.textContent = 'Mehr anzeigen';
                        toggleButton.setAttribute('aria-expanded', 'false');
                    } else {
                        if (content.dataset.fullHtml) {
                            content.innerHTML = content.dataset.fullHtml;
                        } else {
                            content.textContent = content.dataset.fullText || '';
                        }
                        content.classList.remove('note-card-content-clamped');
                        toggleButton.textContent = 'Weniger anzeigen';
                        toggleButton.setAttribute('aria-expanded', 'true');
                    }
                });
            }
        } else {
            if (fragments.previewHtml) {
                content.innerHTML = fragments.previewHtml;
            } else {
                content.textContent = fragments.previewText;
            }
            content.dataset.previewText = fragments.previewText;
            content.dataset.fullText = fragments.fullText;
            if (fragments.previewHtml) content.dataset.previewHtml = fragments.previewHtml;
            if (fragments.fullHtml) content.dataset.fullHtml = fragments.fullHtml;
        }

        card.appendChild(content);
    }
    if (note.attachments && note.attachments.length) {
        attachmentsRow = document.createElement('div');
        attachmentsRow.className = 'note-card-attachments summary';

        const previewButton = document.createElement('button');
        previewButton.type = 'button';
        previewButton.className = 'note-card-attachments-trigger';
        previewButton.title = 'Anhänge ansehen';
        previewButton.innerHTML = `📎 ${note.attachments.length}`;
        previewButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openNoteGallery(note.id, 0);
        });

        attachmentsRow.appendChild(previewButton);
        card.appendChild(attachmentsRow);
    }

    if (toggleButton) {
        if (attachmentsRow) {
            card.insertBefore(toggleButton, attachmentsRow);
        } else {
            card.appendChild(toggleButton);
        }
    }

    const actions = document.createElement('div');
    actions.className = 'note-card-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'note-card-action';
    viewBtn.type = 'button';
    viewBtn.title = 'Notiz anzeigen';
    viewBtn.setAttribute('aria-label', 'Notiz anzeigen');
    viewBtn.innerHTML = '<span class="action-icon">👁️</span>';
    viewBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openNoteDetail(note.id);
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'note-card-action';
    editBtn.type = 'button';
    editBtn.title = 'Bearbeiten';
    editBtn.setAttribute('aria-label', 'Notiz bearbeiten');
    editBtn.innerHTML = '<span class="action-icon">✏️</span>';
    editBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        editNote(note.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-card-action delete';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Löschen';
    deleteBtn.setAttribute('aria-label', 'Notiz löschen');
    deleteBtn.innerHTML = '<span class="action-icon">🗑️</span>';
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteNote(note.id);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    card.addEventListener('click', () => openNoteDetail(note.id));

    return card;
}

function renderNotesList() {
    const legacyList = document.getElementById('notesList');
    const pinnedContainer = document.getElementById('notesPinned');
    const regularContainer = document.getElementById('notesRegular');
    const emptyState = document.getElementById('notesEmptyState');
    const stats = document.getElementById('notesStats');

    if (!legacyList && (!pinnedContainer || !regularContainer)) {
        return;
    }

    const filtered = getFilteredNotes();
    const hasSearch = !!noteSearchTerm.trim();

    filtered.sort((a, b) => {
        const pinDiff = Number(b.isPinned) - Number(a.isPinned);
        if (!noteFilterState.pinnedOnly && pinDiff !== 0) {
            return pinDiff;
        }

        if (hasSearch) {
            const scoreDiff = (noteSearchMetadata.get(b.id)?.score || 0) - (noteSearchMetadata.get(a.id)?.score || 0);
            if (Math.abs(scoreDiff) > 0.0001) {
                return scoreDiff;
            }
        }

        return compareNotesBySortMode(a, b);
    });

    const pinnedGroup = document.getElementById('notesPinnedGroup');
    const regularGroup = document.getElementById('notesRegularGroup');

    if (pinnedContainer && regularContainer) {
        pinnedContainer.innerHTML = '';
        regularContainer.innerHTML = '';

        filtered.forEach(cardNote => {
            const cardEl = buildNoteCard(cardNote);
            if (cardNote.isPinned) {
                pinnedContainer.appendChild(cardEl);
            } else {
                regularContainer.appendChild(cardEl);
            }
        });

        if (pinnedGroup) {
            pinnedGroup.style.display = pinnedContainer.children.length ? '' : 'none';
        }
        if (regularGroup) {
            regularGroup.style.display = regularContainer.children.length ? '' : 'none';
        }
    } else {
        legacyList.innerHTML = '';
        filtered.forEach(note => legacyList.appendChild(buildNoteCard(note)));
    }

    renderNoteFilters();

    if (!filtered.length) {
        if (pinnedGroup) pinnedGroup.style.display = 'none';
        if (regularGroup) regularGroup.style.display = 'none';

        if (emptyState) {
            if (!notes.length) {
                emptyState.querySelector('h3').textContent = 'Keine Notizen gespeichert';
                emptyState.querySelector('p').textContent = 'Halte spontane Ideen, wichtige Todos oder Links fest. Über den Button oben kannst du Screenshots hinzufügen.';
            } else if (noteSearchTerm.trim()) {
                emptyState.querySelector('h3').textContent = 'Keine Treffer';
                emptyState.querySelector('p').textContent = 'Passe deine Suche an oder lege eine neue Notiz an.';
            } else if (noteFilterState.tags.length || noteFilterState.pinnedOnly) {
                emptyState.querySelector('h3').textContent = 'Keine Notizen für diese Filter';
                emptyState.querySelector('p').textContent = 'Setze die Filter zurück oder erstelle eine neue Notiz.';
            }
            emptyState.style.display = 'flex';
        }
    } else if (emptyState) {
        emptyState.style.display = 'none';
    }

    if (stats) {
        const total = notes.length;
        const attachmentsTotal = notes.reduce((sum, note) => sum + ((note.attachments || []).length), 0);
        const pinnedCount = notes.filter(note => note.isPinned).length;
        const pinnedInfo = pinnedCount ? ` · ${pinnedCount} angepinnt` : '';
        if (!total) {
            stats.textContent = 'Noch keine Notizen';
        } else if (noteSearchTerm.trim()) {
            stats.textContent = `${filtered.length} von ${total} Notizen · ${attachmentsTotal} Anhänge${pinnedInfo}`;
        } else {
            stats.textContent = `${total} Notizen · ${attachmentsTotal} Anhänge${pinnedInfo}`;
        }
    }
}

function saveNote() {
    const titleInput = document.getElementById('noteTitleInput');
    const title = titleInput ? titleInput.value.trim() : '';
    const contentHtml = getNoteEditorHtml();
    const contentText = stripHtml(contentHtml).trim();
    const pinnedToggle = document.getElementById('notePinnedToggle');
    const isPinned = pinnedToggle ? pinnedToggle.checked : false;
    const tagsForNote = [...noteEditorTags];

    if (!title && !contentText && noteEditorAttachments.length === 0) {
        showNotification('Bitte gib einen Text ein oder haenge einen Screenshot an.', 'error');
        return;
    }

    const timestamp = new Date().toISOString();
    const attachmentsForNote = noteEditorAttachments.map(att => {
        const attachment = {
            id: att.id || generateNoteId('attachment'),
            name: att.name,
            type: att.type,
            size: att.size || (att.data ? calculateDataUrlSize(att.data) : 0)
        };

        // Speichere je nach Storage-Typ
        if (att.storage === 'github' && att.url) {
            attachment.storage = 'github';
            attachment.url = att.url;
            attachment.thumbnail = att.thumbnail;
        } else if (att.data) {
            attachment.data = att.data;
        }

        if (att.originalSize) {
            attachment.originalSize = att.originalSize;
        }
        return attachment;
    });

    if (editingNoteId) {
        const noteIndex = notes.findIndex(n => n.id === editingNoteId);
        if (noteIndex === -1) {
            showNotification('Notiz nicht gefunden.', 'error');
            return;
        }

        const previousNote = JSON.parse(JSON.stringify(notes[noteIndex]));

        notes[noteIndex] = {
            ...notes[noteIndex],
            title,
            content: contentText,
            contentHtml,
            attachments: attachmentsForNote,
            tags: tagsForNote,
            isPinned,
            updatedAt: timestamp
        };

        const saved = saveData();
        if (!saved) {
            notes[noteIndex] = previousNote;
            showNotification('Speichern fehlgeschlagen. Aenderungen wurden nicht uebernommen.', 'error');
            return;
        }

        showNotification('Notiz aktualisiert!', 'success');
    } else {
        const newNote = {
            id: generateNoteId(),
            title,
            content: contentText,
            contentHtml,
            attachments: attachmentsForNote,
            tags: tagsForNote,
            isPinned,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        notes.push(newNote);

        const saved = saveData();
        if (!saved) {
            notes.pop();
            showNotification('Speichern fehlgeschlagen. Notiz wurde nicht gespeichert.', 'error');
            return;
        }

        showNotification('Notiz gespeichert!', 'success');
    }

    renderNotesList();
    resetNoteForm({ silent: true });
    updateNoteDraftStatus('Notiz gespeichert.');
}

function editNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    editingNoteId = noteId;
    const titleInput = document.getElementById('noteTitleInput');
    const tagsInput = document.getElementById('noteTagsInput');
    const pinnedToggle = document.getElementById('notePinnedToggle');
    if (titleInput) titleInput.value = note.title || '';
    setNoteEditorHtml(note.contentHtml || note.content || '');
    if (tagsInput) tagsInput.value = '';
    noteEditorTags = Array.isArray(note.tags) ? [...note.tags] : [];
    renderNoteTagChips();
    if (pinnedToggle) pinnedToggle.checked = !!note.isPinned;
    noteEditorAttachments = (note.attachments || []).map(att => ({
        ...att,
        originalSize: att.originalSize || att.size || (att.data ? calculateDataUrlSize(att.data) : 0)
    }));
    updateNoteAttachmentPreview();
    updateNoteEditorMode();
    renderNotePreview();
    updateNoteDraftStatus('Bearbeite bestehende Notiz.');
    scheduleNoteDraftSave();
    const editor = document.getElementById('noteEditor');
    if (editor) {
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (titleInput) {
        titleInput.focus();
    }
}

async function deleteNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const confirmed = await showCustomPrompt({
        title: '🗑️ Notiz löschen?',
        text: 'Diese Notiz wird dauerhaft entfernt.',
        actions: [
            { text: 'Abbrechen', class: 'btn-secondary', value: 'cancel' },
            { text: 'Löschen', class: 'btn-danger', value: 'confirm' }
        ]
    });

    if (confirmed !== 'confirm') {
        return;
    }

    notes = notes.filter(n => n.id !== noteId);
    saveData();
    renderNotesList();
    if (editingNoteId === noteId) {
        resetNoteForm();
    }
    showNotification('Notiz gelöscht.', 'success');
}

function toggleNotePin(noteId) {
    const index = notes.findIndex(note => note.id === noteId);
    if (index === -1) return;

    const newState = !notes[index].isPinned;
    notes[index].isPinned = newState;
    notes[index].updatedAt = new Date().toISOString();
    saveData();
    renderNotesList();

    if (editingNoteId === noteId) {
        const pinnedToggle = document.getElementById('notePinnedToggle');
        if (pinnedToggle) pinnedToggle.checked = newState;
        scheduleNoteDraftSave();
    }

    showNotification(newState ? 'Notiz angepinnt.' : 'Pin entfernt.', 'success');
}

async function resolveAttachmentSource(attachment) {
    if (!attachment) throw new Error('Kein Anhang vorhanden');
    if (noteAttachmentCache.has(attachment.id)) {
        return noteAttachmentCache.get(attachment.id);
    }

    if (attachment.data) {
        noteAttachmentCache.set(attachment.id, attachment.data);
        return attachment.data;
    }

    if (attachment.storage === 'github' && attachment.url) {
        if (!githubToken) {
            const directUrl = attachment.url.includes('raw=true') ? attachment.url : `${attachment.url}?raw=true`;
            noteAttachmentCache.set(attachment.id, directUrl);
            return directUrl;
        }

        const urlMatch = attachment.url.match(/github\.com\/([^/]+\/[^/]+)\/blob\/main\/(.+?)(?:\?raw=true)?$/);
        if (!urlMatch) {
            throw new Error('Ungültiges GitHub URL Format');
        }

        const repo = urlMatch[1];
        const path = decodeURIComponent(urlMatch[2]);
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const base64Content = data.content.replace(/\n/g, '');
            const mimeType = attachment.type || 'image/webp';
            const dataUrl = `data:${mimeType};base64,${base64Content}`;
            noteAttachmentCache.set(attachment.id, dataUrl);
            return dataUrl;
        } catch (error) {
            console.warn('Fallback auf Raw-URL für GitHub Anhang:', error);
            const fallbackUrl = attachment.url.includes('raw=true') ? attachment.url : `${attachment.url}?raw=true`;
            noteAttachmentCache.set(attachment.id, fallbackUrl);
            return fallbackUrl;
        }
    }

    if (attachment.url) {
        noteAttachmentCache.set(attachment.id, attachment.url);
        return attachment.url;
    }

    if (attachment.thumbnail) {
        noteAttachmentCache.set(attachment.id, attachment.thumbnail);
        return attachment.thumbnail;
    }

    throw new Error('Keine Quelle für Anhang gefunden');
}

function openNoteDetail(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const attachments = note.attachments || [];
    const metadata = formatNoteTimestamp(note) || '';
    const tagHtml = (note.tags || []).map(tag => `<span class="note-detail-tag">#${escapeHtmlForHighlight(tag)}</span>`).join('');
    const detailContentHtml = note.contentHtml && note.contentHtml.trim()
        ? sanitizeNoteHtml(note.contentHtml)
        : (note.content ? renderMarkdown(note.content) : '<p><em>Kein Inhalt</em></p>');

    const attachmentsHtml = attachments.length
        ? `<div class="note-detail-attachments">${attachments.map((attachment, index) => {
            const thumbSrc = attachment.thumbnail || attachment.url || attachment.data || '';
            const name = escapeHtmlForHighlight(attachment.name || `Anhang ${index + 1}`);
            return `
                <button class="note-detail-attachment" onclick="openNoteGallery('${noteId}', ${index})">
                    <img src="${thumbSrc}" alt="${name}">
                    <span>${name}</span>
                </button>
            `;
        }).join('')}</div>`
        : '';

    const contentHtml = `
        <div class="modal-header note-detail-header">
            <h2 class="modal-title">🗒️ ${escapeHtmlForHighlight(note.title || 'Ohne Titel')}</h2>
            <button class="note-detail-close" type="button" onclick="closeBottomSheet()" aria-label="Schließen">✕</button>
        </div>
        <div class="modal-body note-detail-body">
            <div class="note-detail-meta">
                <span>${escapeHtmlForHighlight(metadata)}</span>
                ${note.isPinned ? '<span class="note-detail-badge">📌 Angepinnt</span>' : ''}
            </div>
            ${tagHtml ? `<div class="note-detail-tags">${tagHtml}</div>` : ''}
            <div class="note-detail-content">${detailContentHtml}</div>
            ${attachmentsHtml}
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="editNote('${noteId}'); closeBottomSheet();">Bearbeiten</button>
            <button class="btn btn-danger" onclick="deleteNote('${noteId}'); closeBottomSheet();">Löschen</button>
        </div>
    `;

    openBottomSheet(contentHtml);
}

async function openNoteGallery(noteId, attachmentIndex = 0) {
    const overlay = document.getElementById('noteGalleryOverlay');
    if (!overlay) return;

    const note = notes.find(n => n.id === noteId);
    if (!note || !(note.attachments || []).length) {
        showNotification('Keine Anhänge verfügbar.', 'error');
        return;
    }

    noteGalleryState = {
        noteId,
        attachments: note.attachments,
        index: attachmentIndex
    };

    overlay.classList.add('visible');
    document.body.classList.add('modal-open');

    await showNoteGalleryAttachment(attachmentIndex);
}

async function showNoteGalleryAttachment(index) {
    const overlay = document.getElementById('noteGalleryOverlay');
    const imageEl = document.getElementById('noteGalleryImage');
    const captionEl = document.getElementById('noteGalleryCaption');
    const counterEl = document.getElementById('noteGalleryCounter');
    const loaderEl = document.getElementById('noteGalleryLoader');

    if (!overlay || !imageEl || !captionEl || !counterEl) return;

    const attachments = noteGalleryState.attachments || [];
    if (!attachments.length) {
        showNotification('Keine Anhänge verfügbar.', 'error');
        return;
    }

    const clampedIndex = Math.max(0, Math.min(index, attachments.length - 1));
    const attachment = attachments[clampedIndex];
    if (!attachment) return;

    noteGalleryState.index = clampedIndex;
    counterEl.textContent = `${clampedIndex + 1} / ${attachments.length}`;
    captionEl.textContent = `${attachment.name || 'Screenshot'} · ${formatFileSize(attachment.size || 0)}`;

    if (loaderEl) loaderEl.style.display = 'flex';
    imageEl.classList.add('is-loading');

    try {
        const src = await resolveAttachmentSource(attachment);
        imageEl.src = src;
        imageEl.alt = attachment.name || 'Screenshot';
    } catch (error) {
        console.error('Fehler beim Laden des Anhangs:', error);
        showNotification('Bild konnte nicht geladen werden.', 'error');
    } finally {
        if (loaderEl) loaderEl.style.display = 'none';
        imageEl.classList.remove('is-loading');
    }
}

function closeNoteGallery() {
    const overlay = document.getElementById('noteGalleryOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    document.body.classList.remove('modal-open');
    noteGalleryState = { noteId: null, attachments: [], index: 0 };
}

function nextNoteGallery() {
    const attachments = noteGalleryState.attachments || [];
    if (!attachments.length) return;
    const nextIndex = (noteGalleryState.index + 1) % attachments.length;
    showNoteGalleryAttachment(nextIndex);
}

function prevNoteGallery() {
    const attachments = noteGalleryState.attachments || [];
    if (!attachments.length) return;
    const prevIndex = (noteGalleryState.index - 1 + attachments.length) % attachments.length;
    showNoteGalleryAttachment(prevIndex);
}

function handleNoteGalleryKeydown(event) {
    const overlay = document.getElementById('noteGalleryOverlay');
    if (!overlay || !overlay.classList.contains('visible')) return;

    if (event.key === 'Escape') {
        closeNoteGallery();
    } else if (event.key === 'ArrowRight') {
        nextNoteGallery();
    } else if (event.key === 'ArrowLeft') {
        prevNoteGallery();
    }
}

function handleNoteGalleryTouchStart(event) {
    noteGallerySwipeStartX = event.touches[0].clientX;
}

function handleNoteGalleryTouchEnd(event) {
    if (noteGallerySwipeStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - noteGallerySwipeStartX;
    const threshold = 40;
    if (deltaX > threshold) {
        prevNoteGallery();
    } else if (deltaX < -threshold) {
        nextNoteGallery();
    }
    noteGallerySwipeStartX = null;
}

function highlightNoteCard(noteId) {
    const card = document.querySelector(`.note-card[data-id="${noteId}"]`);
    if (!card) return;
    card.classList.add('highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('highlight'), 1500);
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
    const balance = parseLocaleNumberString(inputElement.value); // Make sure this function exists and is correct
    const note = document.getElementById(`note_${platformName.replace(/\s+/g, '_')}`)?.value || '';
    const strategy = document.getElementById(`strategy_${platformName.replace(/\s+/g, '_')}`)?.value || '';

    if (!inputElement.value || isNaN(balance)) return;

    entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
    entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance, note, strategy });

    saveData();
    applyDateFilter();

    // Nach erfolgreichem Speichern Status aktualisieren
    const card = inputElement.closest('.input-card');
    if (card) {
        card.classList.remove('unsaved-state');
        card.classList.add('saved-state');
        inputElement.classList.add('is-saved');
        inputElement.dataset.saved = 'true';
        
        const indicators = card.querySelector('.input-indicators');
        if (indicators) indicators.innerHTML = '<span class="indicator-saved">✓</span>';
        
        const statusEl = card.querySelector('.value-status');
        if (statusEl) statusEl.innerHTML = '<span class="status-saved">✓ Heute gespeichert</span>';
    }

    showNotification(`${platformName} gespeichert!`);
    updateEntrySummary();
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

function updateSettingsConnectionStatus(status, message = '') {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    switch(status) {
        case 'connected':
            statusEl.className = 'connection-status connected';
            statusEl.innerHTML = `<span>✅</span><span>${message || 'Erfolgreich mit GitHub verbunden!'}</span>`;
            break;
        case 'error':
            statusEl.className = 'connection-status disconnected';
            statusEl.innerHTML = `<span>❌</span><span>Verbindungsfehler: ${message}</span>`;
            break;
        case 'initial':
        default:
            statusEl.className = 'connection-status disconnected';
            statusEl.innerHTML = `<span>⚠️</span><span>Nicht verbunden - Konfiguriere GitHub für Cloud Sync</span>`;
            break;
    }
}

function getDeviceId() {
    if (!deviceId) {
        deviceId = localStorage.getItem(`${STORAGE_PREFIX}deviceId`);
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
            localStorage.setItem(`${STORAGE_PREFIX}deviceId`, deviceId);
        }
    }
    return deviceId;
}

function loadGitHubConfig() {
    githubToken = localStorage.getItem(`${STORAGE_PREFIX}githubToken`);
    lastSyncTime = localStorage.getItem(`${STORAGE_PREFIX}lastSyncTime`);
    const autoSync = localStorage.getItem(`${STORAGE_PREFIX}autoSync`) === 'true';
    getDeviceId();

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
        let cloudData;
        try {
            cloudData = await fetchGistData();
        } catch (fetchError) {
            // Check if it's a JSON parsing error
            if (fetchError instanceof SyntaxError && fetchError.message.toLowerCase().includes('json')) {
                const confirmed = await showCustomPrompt({
                    title: 'Cloud-Daten korrupt',
                    text: 'Die Daten in der Cloud konnten nicht gelesen werden (JSON-Fehler). Dies kann passieren, wenn die Daten zu groß sind. Möchten Sie die Cloud-Daten mit Ihren lokalen Daten überschreiben?',
                    actions: [
                        { text: 'Abbrechen', class: 'btn-secondary', value: 'cancel' },
                        { text: 'Cloud überschreiben', class: 'btn-danger', value: 'overwrite' }
                    ]
                });

                if (confirmed === 'overwrite') {
                    const localDataForOverwrite = { platforms, entries, cashflows, dayStrategies, favorites, notes, lastSync: new Date().toISOString(), lastModifiedDevice: getDeviceId(), syncMetadata: { deviceId: getDeviceId(), timestamp: new Date().toISOString(), version: 'v11' } };
                    await saveToGist(localDataForOverwrite); // This will use the new size-checking logic
                    showNotification('Cloud-Daten erfolgreich überschrieben!', 'success');
                    
                    // After overwriting, we can consider the sync successful.
                    lastSyncTime = new Date().toISOString();
                    localStorage.setItem(`${STORAGE_PREFIX}lastSyncTime`, lastSyncTime);
                    updateLastSyncDisplay();
                    updateSyncUI('connected');
                    return true;
                } else {
                    // User cancelled, throw a specific error to be caught by the outer catch block
                    throw new Error("Sync abgebrochen. Cloud-Daten sind korrupt.");
                }
            }
            // Re-throw other fetch errors (e.g., network issues)
            throw fetchError;
        }

        const localData = {
            platforms, 
            entries, 
            cashflows, 
            dayStrategies, 
            favorites, 
            notes, 
            lastSync: new Date().toISOString(),
            lastModifiedDevice: getDeviceId(),
            syncMetadata: {
                deviceId: getDeviceId(),
                timestamp: new Date().toISOString(),
                version: 'v11'
            }
        };
        const mergedData = await mergeData(localData, cloudData);
        await saveToGist(mergedData);

        // Stelle sicher, dass alle DEFAULT_PLATFORMS vorhanden sind (ohne Duplikate)
        const mergedPlatformNames = new Set(mergedData.platforms.map(p => p.name));
        const missingDefaults = DEFAULT_PLATFORMS.filter(p => !mergedPlatformNames.has(p.name));
        
        platforms = [...mergedData.platforms, ...missingDefaults];
        
        // Entferne mögliche Duplikate basierend auf Namen
        const uniquePlatforms = [];
        const seenNames = new Set();
        platforms.forEach(platform => {
            if (!seenNames.has(platform.name)) {
                seenNames.add(platform.name);
                uniquePlatforms.push(platform);
            }
        });
        platforms = uniquePlatforms;
        entries = mergedData.entries;
        cashflows = mergedData.cashflows;
        dayStrategies = mergedData.dayStrategies || [];
        favorites = mergedData.favorites || [];
        notes = mergedData.notes || [];
        saveData(false);

        lastSyncTime = new Date().toISOString();
        localStorage.setItem(`${STORAGE_PREFIX}lastSyncTime`, lastSyncTime);
        updateLastSyncDisplay();

        applyDateFilter();
        renderNotesList();
        resetNoteForm();

        updateSettingsConnectionStatus('connected', `Zuletzt synchronisiert: ${new Date().toLocaleTimeString('de-DE')}`);
        showNotification('Erfolgreich synchronisiert! ✨');
        updateSyncUI('connected');
        return true;
    } catch (error) {
        console.error('Sync error:', error);
        updateSettingsConnectionStatus('error', error.message);
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
    if (!content) return { platforms: [...DEFAULT_PLATFORMS], entries: [], cashflows: [], dayStrategies: [], favorites: [], notes: [], lastSync: null };

    const data = JSON.parse(content);
    console.log('✅ Daten aus Gist geladen (Bilder sind Imgur-URLs)');

    return data;
}

async function saveToGist(data) {
    const GIST_FILE_SIZE_LIMIT = 950 * 1024; // 950 KB

    const contentToSave = JSON.stringify(data, null, 2);
    const currentSize = contentToSave.length;

    if (currentSize > GIST_FILE_SIZE_LIMIT) {
        // Zähle Bilder in Notizen
        const imageCount = data.notes.reduce((sum, note) => sum + (note.attachments?.length || 0), 0);

        throw new Error(
            `Daten zu groß (${(currentSize / 1024).toFixed(0)} KB / 950 KB).\n\n` +
            `Du hast ${imageCount} Bilder in Notizen.\n\n` +
            `Lösungen:\n` +
            `• Lösche alte Notizen mit Bildern\n` +
            `• Exportiere alte Notizen (JSON Backup)\n` +
            `• Lösche alte Portfolio-Einträge`
        );
    }

    // Warnung bei 80% voll
    if (currentSize > GIST_FILE_SIZE_LIMIT * 0.8) {
        const percentUsed = ((currentSize / GIST_FILE_SIZE_LIMIT) * 100).toFixed(0);
        showNotification(`Gist zu ${percentUsed}% voll - bald Platz schaffen!`, 'warning');
    }

    // Speichere Haupt-Daten
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { 'portfolio-data-v11.json': { content: contentToSave } } })
    });
    if (!response.ok) throw new Error(`GitHub API Fehler: ${response.status}`);
}

async function mergeData(localData, cloudData) {
    if (!cloudData || !cloudData.lastSync) {
        localData.notes = localData.notes || [];
        return localData;
    }

    localData.notes = localData.notes || [];
    cloudData.notes = cloudData.notes || [];
    
    const localTime = new Date(localStorage.getItem(`${STORAGE_PREFIX}lastModified`) || 0);
    const cloudTime = new Date(cloudData.lastSync);
    const localDeviceId = getDeviceId();
    const cloudDeviceId = cloudData.lastModifiedDevice || cloudData.syncMetadata?.deviceId;
    
    // Wenn es vom gleichen Gerät ist, automatisch mergen
    if (cloudDeviceId === localDeviceId) {
        if (cloudTime > localTime) {
            showNotification("Cloud-Daten vom gleichen Gerät geladen.", "info");
            return cloudData;
        }
        return localData;
    }
    
    // Multi-Device Konflikt: Zeige detailliertere Info
    if (cloudTime > localTime) {
        const cloudDeviceName = cloudDeviceId ? `Gerät ${cloudDeviceId.slice(-6)}` : 'Unbekanntes Gerät';
        const result = await showCustomPrompt({
            title: 'Multi-Device Sync-Konflikt',
            text: `Die Daten in der Cloud sind neuer (${cloudTime.toLocaleString('de-DE')}) und stammen von einem anderen Gerät (${cloudDeviceName}). Wie möchten Sie fortfahren?`,
            actions: [
                { text: 'Lokale behalten', value: 'local' },
                { text: 'Cloud laden', value: 'cloud', class: 'btn-primary' },
                { text: 'Intelligent mergen', value: 'smart', class: 'btn-secondary' }
            ]
        });
        
        if (result === 'cloud') {
            showNotification("Neuere Daten aus der Cloud geladen.", "warning");
            return cloudData;
        }
        
        if (result === 'smart') {
            showNotification("Führe intelligenten Merge durch...", "info");
            return await smartMerge(localData, cloudData);
        }
        
        // Lokale Daten behalten
        showNotification("Lokale Daten werden beibehalten und beim nächsten Sync hochgeladen.", "info");
        localData.lastSync = new Date().toISOString();
        return localData;
    }
    
    return localData;
}

async function smartMerge(localData, cloudData) {
    const merged = { ...localData };
    
    // Merge Plattformen (neue hinzufügen, nicht überschreiben) + DEFAULT_PLATFORMS sicherstellen
    const localPlatformNames = new Set(localData.platforms.map(p => p.name));
    cloudData.platforms.forEach(cloudPlatform => {
        if (!localPlatformNames.has(cloudPlatform.name)) {
            merged.platforms.push(cloudPlatform);
        }
    });
    
    // Stelle sicher, dass alle DEFAULT_PLATFORMS vorhanden sind
    const allPlatformNames = new Set(merged.platforms.map(p => p.name));
    const missingDefaults = DEFAULT_PLATFORMS.filter(p => !allPlatformNames.has(p.name));
    merged.platforms.push(...missingDefaults);
    
    // Merge Einträge basierend auf ID
    const localEntryIds = new Set(localData.entries.map(e => e.id));
    cloudData.entries.forEach(cloudEntry => {
        if (!localEntryIds.has(cloudEntry.id)) {
            merged.entries.push(cloudEntry);
        }
    });
    
    // Merge Cashflows basierend auf ID
    const localCashflowIds = new Set(localData.cashflows.map(c => c.id));
    cloudData.cashflows.forEach(cloudCashflow => {
        if (!localCashflowIds.has(cloudCashflow.id)) {
            merged.cashflows.push(cloudCashflow);
        }
    });
    
    // Merge Favoriten (union)
    merged.favorites = [...new Set([...localData.favorites, ...cloudData.favorites])];
    
    // *** NEU: Intelligenter Merge für Notizen ***
    const notesMap = new Map();
    // 1. Alle lokalen Notizen zur Map hinzufügen
    (localData.notes || []).forEach(note => {
        notesMap.set(note.id, note);
    });

    // 2. Cloud-Notizen durchgehen und Map aktualisieren
    let newNotesFromCloud = 0;
    (cloudData.notes || []).forEach(cloudNote => {
        if (notesMap.has(cloudNote.id)) {
            // Notiz existiert bereits, behalte die neuere Version
            const localNote = notesMap.get(cloudNote.id);
            const localDate = new Date(localNote.updatedAt || localNote.createdAt || 0);
            const cloudDate = new Date(cloudNote.updatedAt || cloudNote.createdAt || 0);
            if (cloudDate > localDate) {
                notesMap.set(cloudNote.id, cloudNote);
            }
        } else {
            // Neue Notiz aus der Cloud
            notesMap.set(cloudNote.id, cloudNote);
            newNotesFromCloud++;
        }
    });

    merged.notes = Array.from(notesMap.values());
    // *** Ende Notizen-Merge ***

    merged.lastSync = new Date().toISOString();
    merged.lastModifiedDevice = getDeviceId();

    const newEntriesCount = cloudData.entries.filter(e => !localEntryIds.has(e.id)).length;
    let mergeMessage = `Smart Merge: ${newEntriesCount} neue Einträge`;
    if (newNotesFromCloud > 0) {
        mergeMessage += ` & ${newNotesFromCloud} neue Notizen`;
    }
    mergeMessage += ' hinzugefügt.';
    showNotification(mergeMessage, "success");

    return merged;
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
    if (!tokenInput) {
        console.error('Token Input nicht gefunden');
        return;
    }
    
    const token = tokenInput.value.trim();
    if (!token) return showNotification('Bitte Token eingeben', 'error');
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        return showNotification('Ungültiges Token Format', 'error');
    }
    
    githubToken = token;
    localStorage.setItem(`${STORAGE_PREFIX}githubToken`, token);
    
    // Prüfe ob das Element existiert bevor du es updatest
    const tokenDisplay = document.getElementById('tokenDisplay');
    if (tokenDisplay) {
        tokenDisplay.textContent = 'ghp_****' + token.slice(-4);
    }
    
    closeBottomSheet();
    showNotification('Token gespeichert!');
    updateSyncStatus();
    updateSyncBarVisibility();
    
    // Verzögere testConnection() minimal
    setTimeout(() => {
        testConnection();
    }, 100);
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
            updateSettingsConnectionStatus('initial');
            updateSyncStatus();
            updateSyncBarVisibility();
            showNotification('GitHub Token gelöscht');
        }
    });
}

async function testConnection() {
    if (!githubToken || !gistId) return showNotification('Bitte Token und Gist ID konfigurieren', 'error');
    try {
        showNotification('Teste Verbindung...');
        await fetchGistData();
        updateSettingsConnectionStatus('connected', 'Verbindung erfolgreich!');
        showNotification('Verbindung erfolgreich! ✅');
        updateSyncStatus();
    } catch (error) {
        updateSettingsConnectionStatus('error', error.message);
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
    localStorage.setItem(LAST_ACTIVE_TAB_KEY, tabName);
    
    // NEU: Automatisch letzte Einträge laden beim Wechsel zu "entry"
    if (tabName === 'entry') {
        // Prüfe ob bereits Einträge vorhanden sind
        const hasExistingInputs = document.getElementById('platformInputs').children.length > 0;
        console.log(`🔄 Switching to entry tab. Has existing inputs: ${hasExistingInputs}, Total entries: ${entries.length}`);
        
        if (!hasExistingInputs && entries.length > 0) {
            console.log('🚀 Loading last entries...');
            setTimeout(() => {
                loadLastEntries();
            }, 100);
        } else if (hasExistingInputs) {
            console.log('ℹ️ Skipping loadLastEntries - inputs already exist');
        } else {
            console.log('ℹ️ Skipping loadLastEntries - no entries available');
        }
    }
    
    if (!options.skipScroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
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

    if (tabName === 'history') {
        updateHistory();
    } else if (tabName === 'cashflow') {
        updateCashflowDisplay();
        updateCashflowStats(cashflows, entries);
        document.getElementById('cashflowDate').value = new Date().toISOString().split('T')[0];
    } else if (tabName === 'platforms') {
        updatePlatformDetails();
    } else if (tabName === 'notes') {
        renderNotesList();
        const searchInput = document.getElementById('notesSearchInput');
        if (searchInput && !isMobileDevice()) {
            searchInput.focus();
        }
    }
    updateBreadcrumbs(); // Breadcrumbs bei jedem Tab-Wechsel aktualisieren
}

function restoreLastActiveTab() {
    const savedTab = localStorage.getItem(LAST_ACTIVE_TAB_KEY);
    const fallbackTab = 'dashboard';
    const targetTab = (savedTab && document.getElementById(savedTab)) ? savedTab : fallbackTab;
    switchTab(targetTab, { preserveFilter: true, skipScroll: true });
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
    updateThemeIcon(); // Mobile theme icon aktualisieren
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
    [portfolioChart, allocationChart, forecastChart].forEach(chart => {
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

    const createTile = (p, { inFavorites = false } = {}) => {
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

        const isFavorite = favorites.includes(p.name);
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

        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-star';
        favoriteButton.type = 'button';
        favoriteButton.title = isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';
        favoriteButton.textContent = isFavorite ? '⭐' : '☆';
        favoriteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleFavorite(p.name);
        });
        tile.prepend(favoriteButton);

        if (inFavorites) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'favorite-remove-btn';
            removeBtn.type = 'button';
            removeBtn.title = 'Aus Favoriten entfernen';
            removeBtn.innerHTML = '✕';
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                removeFavoritePlatform(p.name);
            });
            tile.appendChild(removeBtn);
        }
        return tile;
    };

    sortedFavorites.forEach(p => favoritesGrid.appendChild(createTile(p, { inFavorites: true })));
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

function guessPlatformMetadata(name) {
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();

    if (!lower) {
        return {
            type: '',
            category: '',
            tags: [],
            icon: '💎'
        };
    }

    const predefinedMatches = [
        { names: ['ondo', 'ondo finance'], type: 'Yield', category: 'DeFi', tags: ['yield', 'rwa'], icon: '🏦' },
        { names: ['pendle', 'pendle finance'], type: 'Yield', category: 'DeFi', tags: ['yield'], icon: '🌾' },
        { names: ['curve', 'curve finance'], type: 'DEX', category: 'DeFi', tags: ['dex'], icon: '🔄' },
        { names: ['binance', 'binance earn'], type: 'Exchange', category: 'Exchange', tags: ['exchange'], icon: '🏦' }
    ];

    let predefined = predefinedMatches.find(entry => entry.names.some(n => lower === n || lower.startsWith(n))); 
    if (predefined) {
        return {
            type: predefined.type || '',
            category: predefined.category || '',
            tags: predefined.tags ? [...predefined.tags] : [],
            icon: predefined.icon || '💎'
        };
    }

    let match = DEFAULT_PLATFORMS.find(p => p.name.toLowerCase() === lower);
    if (!match && lower.length >= 2) {
        const partialMatches = DEFAULT_PLATFORMS.filter(p => p.name.toLowerCase().startsWith(lower));
        if (partialMatches.length === 1) {
            match = partialMatches[0];
        }
    }
    if (match) {
        return {
            type: match.type || '',
            category: match.category || '',
            tags: match.tags ? [...match.tags] : [],
            icon: match.icon || '💎'
        };
    }

    const heuristics = [
        { keywords: ['binance', 'coinbase', 'kraken', 'exchange', 'trade'], type: 'Exchange', category: 'Exchange', icon: '🏦', tags: ['exchange'] },
        { keywords: ['swap', 'dex', 'uni', 'sushi', 'curve', 'balancer'], type: 'DEX', category: 'DeFi', icon: '🔄', tags: ['dex'] },
        { keywords: ['lend', 'loan', 'borrow', 'aave', 'compound'], type: 'Lending', category: 'Lending', icon: '🤝', tags: ['lending'] },
        { keywords: ['wallet', 'safe', 'vault', 'ledger', 'trezor', 'metamask'], type: 'Wallet', category: 'Wallet', icon: '👛', tags: ['wallet'] },
        { keywords: ['nft', 'opensea', 'blur', 'rarible'], type: 'NFT', category: 'DeFi', icon: '🖼️', tags: ['nft'] },
        { keywords: ['stake', 'yield', 'farm', 'liquidity', 'earning'], type: 'Yield', category: 'DeFi', icon: '🌾', tags: ['yield'] },
        { keywords: ['bridge', 'layer', 'chain', 'rollup'], type: 'Infrastructure', category: 'DeFi', icon: '🛠️', tags: ['infrastructure'] }
    ];

    for (const rule of heuristics) {
        if (rule.keywords.some(keyword => lower.includes(keyword) || keyword.includes(lower))) {
            return {
                type: rule.type || '',
                category: rule.category || '',
                tags: rule.tags ? [...rule.tags] : [],
                icon: rule.icon || '💎'
            };
        }
    }

    return {
        type: '',
        category: '',
        tags: [],
        icon: '💎'
    };
}

function toggleFavorite(platformName, options = {}) {
    const { silent = false } = options;
    if (!platformName) return;

    const wasFavorite = favorites.includes(platformName);

    if (wasFavorite) {
        favorites = favorites.filter(name => name !== platformName);
        if (!silent) {
            showNotification(`${platformName} aus Favoriten entfernt.`, 'info');
            setEntryStatus(`${platformName} aus den Favoriten entfernt.`, 'info');
        }
    } else {
        favorites.push(platformName);
        if (!silent) {
            showNotification(`${platformName} zu Favoriten hinzugefügt!`, 'success');
            setEntryStatus(`${platformName} als Favorit markiert.`, 'success');
        }
    }

    saveData();
    renderPlatformButtons();
}

function removeFavoritePlatform(platformName) {
    if (!platformName || !favorites.includes(platformName)) return;
    toggleFavorite(platformName, { silent: true });
    setEntryStatus(`${platformName} aus der Favoriten-Zone entfernt.`, 'info');
}

function setEntryStatus(message, variant = 'info') {
    const statusEl = document.getElementById('entryLoadStatus');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.classList.remove('status-success', 'status-warning', 'status-info');

    const classMap = {
        success: 'status-success',
        warning: 'status-warning',
        info: 'status-info'
    };
    const className = classMap[variant];
    if (className) statusEl.classList.add(className);
}

function updateEntrySelectionStatus() {
    if (!Array.isArray(selectedPlatforms)) return;
    if (selectedPlatforms.length === 0) {
        setEntryStatus('Noch keine Auswahl aktiv.', 'info');
    } else {
        const label = selectedPlatforms.length === 1 ? 'Plattform' : 'Plattformen';
        setEntryStatus(`${selectedPlatforms.length} ${label} aktiv.`, 'info');
    }
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
    updateEntrySelectionStatus();
}

function addCustomPlatform() {
    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">Neue Plattform hinzufügen</h2></div>
        <div class="modal-body">
            <form id="newPlatformForm" class="new-platform-form">
                <div class="github-input-group">
                    <label>Name</label>
                    <input type="text" id="newPlatformName" class="input-field" placeholder="z.B. Binance" autocomplete="off">
                    <div class="new-platform-hint" id="newPlatformSuggestionHint">Gib einen Namen ein – Typ, Kategorie und Tags schlagen wir automatisch vor.</div>
                </div>
                <div class="grid-two-cols">
                    <div class="github-input-group">
                        <label>Typ</label>
                        <input type="text" id="newPlatformType" class="input-field" placeholder="Exchange, DEX ..." list="newPlatformTypeOptions">
                    </div>
                    <div class="github-input-group">
                        <label>Kategorie</label>
                        <input type="text" id="newPlatformCategory" class="input-field" placeholder="Exchange, DeFi ..." list="newPlatformCategoryOptions">
                    </div>
                </div>
                <div class="github-input-group">
                    <label>Tags (kommagetrennt)</label>
                    <input type="text" id="newPlatformTags" class="input-field" placeholder="z.B. staking, layer2">
                </div>
                <div class="github-input-group">
                    <label>Icon (Emoji)</label>
                    <input type="text" id="newPlatformIcon" class="input-field" maxlength="2" placeholder="💎">
                </div>
                <datalist id="newPlatformTypeOptions">
                    <option value="Exchange">
                    <option value="DEX">
                    <option value="Lending">
                    <option value="Yield">
                    <option value="NFT">
                    <option value="Wallet">
                    <option value="Infrastructure">
                    <option value="Custom">
                </datalist>
                <datalist id="newPlatformCategoryOptions">
                    <option value="Exchange">
                    <option value="DeFi">
                    <option value="Lending">
                    <option value="Yield">
                    <option value="NFT">
                    <option value="Wallet">
                    <option value="Infrastructure">
                    <option value="Custom">
                </datalist>
                <div class="modal-footer" style="justify-content: flex-end; gap: 12px;">
                    <button type="button" class="btn btn-danger" id="newPlatformCancelBtn">Abbrechen</button>
                    <button type="submit" class="btn btn-success" id="newPlatformSaveBtn">Speichern</button>
                </div>
            </form>
        </div>
    `;

    openBottomSheet(contentHtml);

    const form = document.getElementById('newPlatformForm');
    const nameInput = document.getElementById('newPlatformName');
    const typeInput = document.getElementById('newPlatformType');
    const categoryInput = document.getElementById('newPlatformCategory');
    const tagsInput = document.getElementById('newPlatformTags');
    const iconInput = document.getElementById('newPlatformIcon');
    const hintEl = document.getElementById('newPlatformSuggestionHint');
    const cancelBtn = document.getElementById('newPlatformCancelBtn');

    if (!form || !nameInput || !typeInput || !categoryInput || !tagsInput || !iconInput) {
        console.error('Neue Plattform UI konnte nicht initialisiert werden');
        return;
    }

    let internalUpdate = false;
    const editState = { type: false, category: false, tags: false, icon: false };

    const updateSuggestion = () => {
        const nameValue = nameInput.value.trim();
        if (!nameValue) {
            if (hintEl) hintEl.textContent = 'Gib einen Namen ein – Typ, Kategorie und Tags schlagen wir automatisch vor.';
            internalUpdate = true;
            if (!editState.type) typeInput.value = '';
            if (!editState.category) categoryInput.value = '';
            if (!editState.tags) tagsInput.value = '';
            if (!editState.icon) iconInput.value = '💎';
            internalUpdate = false;
            return;
        }

        const suggestion = guessPlatformMetadata(nameValue);
        if (hintEl) {
            const tagText = suggestion.tags && suggestion.tags.length ? ` • Tags: ${suggestion.tags.join(', ')}` : '';
            const typeLabel = suggestion.type || '–';
            const categoryLabel = suggestion.category || '–';
            hintEl.innerHTML = `Vorschlag: <strong>${typeLabel}</strong> / <strong>${categoryLabel}</strong>${tagText}`;
        }

        internalUpdate = true;
        if (!editState.type) typeInput.value = suggestion.type || '';
        if (!editState.category) categoryInput.value = suggestion.category || '';
        if (!editState.tags) tagsInput.value = suggestion.tags ? suggestion.tags.join(', ') : '';
        if (!editState.icon) iconInput.value = suggestion.icon || '💎';
        internalUpdate = false;
    };

    const handleManualEdit = (field) => {
        return () => {
            if (internalUpdate) return;
            const value = field.value.trim();
            if (field === typeInput) editState.type = value.length > 0;
            if (field === categoryInput) editState.category = value.length > 0;
            if (field === tagsInput) editState.tags = value.length > 0;
            if (field === iconInput) editState.icon = value.length > 0;
        };
    };

    typeInput.addEventListener('input', handleManualEdit(typeInput));
    categoryInput.addEventListener('input', handleManualEdit(categoryInput));
    tagsInput.addEventListener('input', handleManualEdit(tagsInput));
    iconInput.addEventListener('input', handleManualEdit(iconInput));

    nameInput.addEventListener('input', updateSuggestion);

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeBottomSheet());
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const newName = nameInput.value.trim();
        if (!newName) {
            showNotification('Bitte einen Namen angeben.', 'error');
            nameInput.focus();
            return;
        }

        if (platforms.some(p => p.name.toLowerCase() === newName.toLowerCase())) {
            showNotification('Plattform existiert bereits!', 'error');
            return;
        }

        const fallbackSuggestion = guessPlatformMetadata(newName);
        const newType = typeInput.value.trim() || fallbackSuggestion.type || '';
        const newCategory = categoryInput.value.trim() || fallbackSuggestion.category || '';
        const newTags = tagsInput.value
            ? tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
            : [];
        const newIcon = iconInput.value.trim() || fallbackSuggestion.icon || '💎';

        platforms.push({
            name: newName,
            type: newType,
            category: newCategory,
            icon: newIcon,
            tags: newTags
        });

        saveData();
        renderPlatformButtons();
        updateCashflowTargets();
        showNotification(`${newName} hinzugefügt!`, 'success');
        setEntryStatus(`${newName} hinzugefügt.`, 'success');
        closeBottomSheet();
    });

    updateSuggestion();
    nameInput.focus();
}
function addPlatformInput(platformName) {
    const container = document.getElementById('platformInputs');
    const inputId = platformName.replace(/\s+/g, '_');
    if (document.getElementById(`input_${inputId}`)) return;

    if (container.children.length === 0) {
        const strategyContainer = document.getElementById('dayStrategyContainer');
        if (strategyContainer) {
            strategyContainer.style.display = 'flex';
            const date = document.getElementById('entryDate').value;
            const strategyInput = document.getElementById('dailyStrategy');
            if (strategyInput) strategyInput.value = getStrategyForDate(date);
        }
    }

    const lastEntry = getLastEntryForPlatform(platformName);
    const lastValue = lastEntry ? lastEntry.balance : 0;
    const lastNote = lastEntry ? lastEntry.note : '';
    
    // Prüfe ob für das aktuelle Datum bereits ein Wert existiert
    const currentDate = document.getElementById('entryDate').value;
    const todayEntry = entries.find(e => e.date === currentDate && e.protocol === platformName);
    const isSaved = !!todayEntry;
    const currentValue = todayEntry ? todayEntry.balance : lastValue;

    const div = document.createElement('div');
    div.id = `input_${inputId}`;
    div.className = `input-card ${isSaved ? 'saved-state' : 'unsaved-state'}`;
    
    div.innerHTML = `
        <div class="input-row">
            <div class="platform-info">
                <div class="platform-name">${platformName}</div>
                <div class="value-status">
                    ${isSaved ? 
                        `<span class="status-saved">✓ Heute gespeichert</span>` : 
                        `<span class="status-unsaved">Letzter Wert: ${formatDollar(lastValue)} (${lastEntry ? formatDate(lastEntry.date) : 'Nie'})</span>`
                    }
                </div>
            </div>
            <div class="input-group">
                <input type="text" 
                       inputmode="decimal" 
                       id="balance_${inputId}" 
                       class="input-field ${isSaved ? 'is-saved' : ''}" 
                       placeholder="${isSaved ? 'Gespeichert' : 'Neuer Wert...'}"
                       data-platform="${platformName}"
                       data-original-value="${lastValue}"
                       data-saved="${isSaved}"
                       value="${currentValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}">
                <div class="input-indicators">
                    ${isSaved ? '<span class="indicator-saved">✓</span>' : '<span class="indicator-pending">!</span>'}
                </div>
            </div>
            <div class="input-notes-section">
                <input type="text" id="note_${inputId}" class="note-input" placeholder="Notiz..." value="${todayEntry?.note || lastNote}">
                <input type="text" id="strategy_${inputId}" class="strategy-input" placeholder="🎯 Strategie..." value="${todayEntry?.strategy || ''}" title="Strategie für ${platformName}">
            </div>
            <button class="remove-btn" onclick="removePlatformInput('${platformName}')">✕</button>
        </div>`;
    container.appendChild(div);
    
    // Bei Änderung Status updaten
    const input = document.getElementById(`balance_${inputId}`);
    input.addEventListener('input', () => {
        div.classList.remove('saved-state');
        div.classList.add('unsaved-state');
        input.classList.remove('is-saved');
        input.dataset.saved = 'false';
        
        // Update indicators
        const indicators = div.querySelector('.input-indicators');
        indicators.innerHTML = '<span class="indicator-pending">!</span>';
        
        const statusEl = div.querySelector('.value-status');
        statusEl.innerHTML = '<span class="status-unsaved">Nicht gespeichert</span>';
        updateEntrySummary();
    });

    // Mit "Enter" speichern und zum nächsten Feld springen
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveSingleEntry(input);

            // Kurzes Timeout, um dem Browser Zeit für das Update zu geben
            setTimeout(() => {
                const allInputs = Array.from(document.querySelectorAll('#platformInputs .input-field'));
                const currentIndex = allInputs.indexOf(input);
                
                if (currentIndex > -1 && currentIndex < allInputs.length - 1) {
                    const nextInput = allInputs[currentIndex + 1];
                    nextInput.focus();
                    nextInput.select();
                }
            }, 50);
        }
    });
}

function getStrategyForDate(date) {
    const strategy = dayStrategies.find(s => s.date === date);
    return strategy ? strategy.strategy : '';
}

function getDisplayStrategyForEntry(entry) {
    // Priority: platform-specific strategy first, then general day strategy
    if (entry.strategy && entry.strategy.trim() !== '') {
        return entry.strategy;
    }
    return getStrategyForDate(entry.date) || '-';
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

    updateEntrySummary();
}

function clearEntryInputs() {
    const container = document.getElementById('platformInputs');
    if (container) container.innerHTML = '';

    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];

    const strategyContainer = document.getElementById('dayStrategyContainer');
    if (strategyContainer) strategyContainer.style.display = 'none';

    const autoZeroHint = document.getElementById('autoZeroHint');
    if (autoZeroHint) autoZeroHint.classList.remove('visible');

    setEntryStatus('Auswahl zurückgesetzt.', 'info');
    updateEntrySummary();
}

function selectFavoritePlatformsForEntry() {
    if (!favorites || favorites.length === 0) {
        setEntryStatus('Keine Favoriten gespeichert.', 'warning');
        showNotification('Keine Favoriten gespeichert.', 'warning');
        return;
    }

    let newlySelected = 0;
    favorites.forEach(platformName => {
        const button = Array.from(document.querySelectorAll('.platform-btn')).find(btn => {
            return btn.dataset.platform === platformName || btn.querySelector('.name')?.textContent === platformName;
        });

        if (button && !button.classList.contains('selected')) {
            togglePlatform(button, platformName);
            newlySelected++;
        }
    });

    if (newlySelected === 0) {
        setEntryStatus('Alle Favoriten sind bereits aktiv.', 'info');
    } else {
        const label = newlySelected === 1 ? 'Favorit' : 'Favoriten';
        setEntryStatus(`${newlySelected} ${label} übernommen.`, 'success');
        showNotification(`${newlySelected} Favoriten übernommen.`, 'success');
    }
}

function selectPlatformsWithBalance() {
    if (!entries || entries.length === 0) {
        setEntryStatus('Keine vorhandenen Einträge.', 'warning');
        showNotification('Keine früheren Einträge gefunden.', 'warning');
        return;
    }

    const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a));
    if (sortedDates.length === 0) {
        setEntryStatus('Keine vorhandenen Einträge.', 'warning');
        return;
    }

    const lastDate = sortedDates[0];
    const platformsToSelect = entries
        .filter(e => e.date === lastDate && e.balance > 0)
        .map(e => e.protocol);

    if (platformsToSelect.length === 0) {
        setEntryStatus('Keine Plattformen mit Bestand gefunden.', 'warning');
        showNotification('Am letzten Stichtag gab es keine Bestände.', 'warning');
        return;
    }

    let newlySelected = 0;
    platformsToSelect.forEach(platformName => {
        const button = Array.from(document.querySelectorAll('.platform-btn')).find(btn => {
            return btn.dataset.platform === platformName || btn.querySelector('.name')?.textContent === platformName;
        });

        if (button && !button.classList.contains('selected')) {
            togglePlatform(button, platformName);
            newlySelected++;
        }
    });

    if (newlySelected === 0) {
        setEntryStatus('Alle Plattformen mit Bestand sind bereits aktiv.', 'info');
    } else {
        const dateLabel = formatDate(lastDate);
        setEntryStatus(`${newlySelected} Plattformen mit Bestand vom ${dateLabel} geladen.`, 'success');
        showNotification(`${newlySelected} Plattformen mit Bestand vom ${dateLabel} geladen.`, 'success');
    }
}

function openCashflowFromEntry() {
    const currentDate = document.getElementById('entryDate')?.value;
    switchTab('cashflow');
    if (currentDate) {
        const cashflowDateInput = document.getElementById('cashflowDate');
        if (cashflowDateInput) cashflowDateInput.value = currentDate;
    }
    setEntryStatus('Cashflow-Erfassung geöffnet.', 'info');
}


function loadLastEntries() {
    const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a));
    if (sortedDates.length === 0) {
        showNotification('Keine früheren Einträge gefunden.', 'error');
        setEntryStatus('Keine früheren Einträge gefunden.', 'warning');
        return;
    }
    const lastEntryDate = sortedDates[0];
    const entriesFromLastDate = entries.filter(e => e.date === lastEntryDate);
    const platformsToLoad = [...new Set(entriesFromLastDate.map(e => e.protocol))];

    console.log(`📊 Loading entries from ${lastEntryDate}: ${entriesFromLastDate.length} entries, ${platformsToLoad.length} platforms`);
    console.log(`📋 Platforms to load:`, platformsToLoad);
    console.log(`💰 Entry balances:`, entriesFromLastDate.map(e => `${e.protocol}: ${e.balance}`));

    if (platformsToLoad.length === 0) {
        showNotification(`Keine Einträge am ${formatDate(lastEntryDate)} gefunden.`, 'warning');
        setEntryStatus(`Keine Einträge am ${formatDate(lastEntryDate)} gefunden.`, 'warning');
        return;
    }
    
    document.getElementById('platformInputs').innerHTML = '';
    document.querySelectorAll('.platform-btn.selected').forEach(btn => btn.classList.remove('selected'));
    selectedPlatforms = [];
    
    // Prüfe ob alle benötigten Plattformen in der platforms-Liste existieren
    const missingPlatforms = platformsToLoad.filter(name => 
        !platforms.some(p => p.name === name)
    );
    
    if (missingPlatforms.length > 0) {
        console.warn(`⚠️ Missing platforms detected:`, missingPlatforms);
        // Automatisch fehlende Plattformen hinzufügen
        missingPlatforms.forEach(platformName => {
            const newPlatform = {
                name: platformName,
                icon: '🏛️',
                type: 'Custom',
                category: 'Custom',
                tags: ['custom']
            };
            platforms.push(newPlatform);
            console.log(`➕ Added missing platform: ${platformName}`);
        });
        
        // Platform-Buttons neu rendern
        renderPlatformButtons();
        // Speichere die erweiterte platforms-Liste
        saveData();
        // Kurz warten bis Buttons gerendert sind
        setTimeout(() => {
            loadLastEntriesAfterRender(platformsToLoad, lastEntryDate);
        }, 200);
        setEntryStatus('Fehlende Plattformen ergänzt. Bitte prüfen.', 'info');
        return;
    }
    
    loadLastEntriesAfterRender(platformsToLoad, lastEntryDate);
}

function loadLastEntriesAfterRender(platformsToLoad, lastEntryDate) {
    platformsToLoad.forEach(platformName => {
        const button = Array.from(document.querySelectorAll('.platform-btn[data-platform]')).find(btn => btn.dataset.platform === platformName);
        console.log(`🔍 Looking for platform "${platformName}": ${button ? 'Found' : 'NOT FOUND'}`);
        if (button) {
            console.log(`✅ Toggling platform: ${platformName}`);
            togglePlatform(button, platformName);
        } else {
            console.warn(`❌ Platform button still not found: ${platformName}`);
        }
    });

    const lastStrategy = getStrategyForDate(lastEntryDate);
    if (lastStrategy) {
        document.getElementById('dailyStrategy').value = lastStrategy;
    }

    // NEU: Fokussiere und selektiere das erste Eingabefeld
    setTimeout(() => {
        const firstInput = document.querySelector('#platformInputs .input-field');
        if (firstInput) {
            firstInput.focus();
            firstInput.select(); // Wert wird selektiert für schnelles Überschreiben
        }
    }, 200);

    showNotification(`${platformsToLoad.length} Plattformen vom ${formatDate(lastEntryDate)} geladen. Tab/Enter für nächstes Feld.`);
    setEntryStatus(`${platformsToLoad.length} Plattformen vom ${formatDate(lastEntryDate)} geladen.`, 'success');
    updateEntrySummary();
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
    let autoZeroSkipped = false;

    const dayStrategy = document.getElementById('dailyStrategy')?.value || '';
    const oldStrategy = getStrategyForDate(date);
    if (dayStrategy.trim() !== oldStrategy.trim()) {
        saveStrategyForDate(date, dayStrategy.trim());
        strategyChanged = true;
    }
    
    // Logik für Auto-Zeroing für nicht ausgewählte Plattformen
    const unselectedPlatformsToZero = getPlatformsToAutoZero();
    if (unselectedPlatformsToZero.length > 0) {
        const listHtml = `<ul>${unselectedPlatformsToZero.map(p => `<li>${p}</li>`).join('')}</ul>`;
        const confirmed = await showCustomPrompt({
            title: 'Auto-Zero Bestätigung',
            text: 'Sollen die folgenden Plattformen, die nicht ausgewählt wurden, für dieses Datum auf 0 gesetzt werden?',
            listHtml: listHtml,
            actions: [
                { text: 'Nein' },
                { text: 'Ja, auf 0 setzen', class: 'btn-success', value: 'true' }
            ]
        });

        if (confirmed === 'true') {
            unselectedPlatformsToZero.forEach(platformName => {
                entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
                entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance: 0, note: 'Auto-Zero (Kapital verschoben)' });
                zeroedCount++;
            });
        } else {
            autoZeroSkipped = true;
        }
    }

    // Speichere die Werte für alle ausgewählten Plattformen
    selectedPlatforms.forEach(platformName => {
        const inputId = platformName.replace(/\s+/g, '_');
        const balanceInput = document.getElementById(`balance_${inputId}`);
        const noteInput = document.getElementById(`note_${inputId}`);
        const strategyInput = document.getElementById(`strategy_${inputId}`);
        if (balanceInput) {
            const value = balanceInput.value.trim();
            const balance = value === '' ? 0 : parseLocaleNumberString(value);
            if (isNaN(balance)) {
                showNotification(`Ungültiger Wert für ${platformName} übersprungen.`, 'warning');
                return; // continue
            }
            entries = entries.filter(e => !(e.date === date && e.protocol === platformName));
            entries.push({ id: Date.now() + Math.random(), date, protocol: platformName, balance, note: noteInput?.value || '', strategy: strategyInput?.value || '' });
            newEntriesCount++;
        }
    });

    if (newEntriesCount === 0 && zeroedCount === 0 && !strategyChanged) {
        if (autoZeroSkipped) {
            return showNotification('Auto-Zeroing übersprungen. Keine weiteren Änderungen.', 'info');
        } else {
            return showNotification('Keine Änderungen zum Speichern!', 'error');
        }
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

    updateEntrySummary();

    let message = '';
    if (newEntriesCount > 0) message += `${newEntriesCount} Einträge gespeichert. `;
    if (zeroedCount > 0) {
        message += `${zeroedCount} Plattformen auf 0 gesetzt. `;
    } else if (autoZeroSkipped) {
        message += 'Auto-Zeroing übersprungen. ';
    }
    if (strategyChanged) message += `Tages-Strategie gespeichert.`;
    showNotification(message.trim(), 'success');
}

function saveCashflow() {
    const type = document.querySelector('input[name="cashflowType"]:checked')?.value;
    const amount = parseLocaleNumberString(document.getElementById('cashflowAmount').value);
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

/**
 * Parses a number string that could be in German (1.234,56) or US/ISO (1,234.56) format.
 * @param {string} str The number string to parse.
 * @returns {number} The parsed number, or NaN if invalid.
 */
function parseLocaleNumberString(str) {
    if (typeof str !== 'string' || !str.trim()) {
        return NaN;
    }
    const cleanedStr = str.trim();
    const lastDot = cleanedStr.lastIndexOf('.');
    const lastComma = cleanedStr.lastIndexOf(',');

    // Case 1: German format (comma is decimal separator), e.g., "1.234,56"
    if (lastComma > lastDot) {
        return parseFloat(cleanedStr.replace(/\./g, '').replace(',', '.'));
    }

    // Case 2: US/ISO format (dot is decimal separator), e.g., "1,234.56" or "1234.56"
    // The comma is a thousands separator and must be removed.
    return parseFloat(cleanedStr.replace(/,/g, ''));
}

async function deleteEntry(entryId) {
    const entry = entries.find(e => e.id == entryId);
    if (entry) {
        saveToUndoStack('delete_entry', entry);
    }
    entries = entries.filter(e => e.id != entryId);
    saveData();
    applyDateFilter();
}

async function deleteCashflow(cashflowId) {
    const cashflow = cashflows.find(c => c.id == cashflowId);
    if (cashflow) {
        saveToUndoStack('delete_cashflow', cashflow);
    }
    cashflows = cashflows.filter(c => c.id != cashflowId);
    saveData();
    applyDateFilter();
}

function deletePlatform(platformName) {
    const platformToDelete = platforms.find(p => p.name === platformName);
    if (!platformToDelete) return;

    const entriesToDelete = entries.filter(e => e.protocol === platformName);
    const wasFavorite = favorites.includes(platformName);

    const undoData = { platform: platformToDelete, entries: entriesToDelete, wasFavorite: wasFavorite };
    saveToUndoStack('delete_platform', undoData);

    platforms = platforms.filter(p => p.name !== platformName);
    favorites = favorites.filter(f => f !== platformName);
    entries = entries.filter(e => e.protocol !== platformName);
    saveData();
    applyDateFilter();
    renderPlatformButtons();
    updateCashflowTargets();
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
        notes = [];
        saveData();
        applyDateFilter();
        renderNotesList();
        resetNoteForm();
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
    
    input.addEventListener('blur', save);
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
        const newValue = parseLocaleNumberString(input.value);
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
    
    input.addEventListener('blur', save);
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
    updateForecastChart();
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

    updateCashflowStats(filteredCashflows || [], filteredEntries || []);
}

function updateCashflowStats(cashflowsToUse, entriesToUse) {
    // Ensure arrays exist and are valid
    const validCashflows = Array.isArray(cashflowsToUse) ? cashflowsToUse : [];
    const validEntries = Array.isArray(entriesToUse) ? entriesToUse : [];
    
    const totalDeposits = validCashflows.filter(c => c && c.type === 'deposit').reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalWithdrawals = validCashflows.filter(c => c && c.type === 'withdraw').reduce((sum, c) => sum + (c.amount || 0), 0);
    const netCashflow = totalDeposits - totalWithdrawals;
    
    // Get current value from entries
    let currentValue = 0;
    if (validEntries.length > 0) {
        const lastDateOverall = [...new Set(validEntries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a))[0];
        currentValue = lastDateOverall ? validEntries.filter(e => e.date === lastDateOverall).reduce((sum, e) => sum + (e.balance || 0), 0) : 0;
    }
    
    const totalProfit = currentValue - netCashflow;
    const roi = netCashflow > 0 ? (totalProfit / netCashflow) * 100 : 0;
    
    // Update DOM elements
    const totalDepositsEl = document.getElementById('totalDeposits');
    const totalWithdrawalsEl = document.getElementById('totalWithdrawals');
    const netCashflowEl = document.getElementById('netCashflow');
    const roiPercentEl = document.getElementById('roiPercent');
    
    if (totalDepositsEl) {
        totalDepositsEl.textContent = formatDollar(totalDeposits);
    }
    
    if (totalWithdrawalsEl) {
        totalWithdrawalsEl.textContent = formatDollar(totalWithdrawals);
    }
    
    if (netCashflowEl) {
        netCashflowEl.textContent = formatDollar(netCashflow);
        netCashflowEl.className = `cashflow-stat-value dollar-value ${netCashflow >= 0 ? 'positive' : 'negative'}`;
    }
    
    if (roiPercentEl) {
        roiPercentEl.textContent = `${roi.toFixed(2)}%`;
        roiPercentEl.className = `cashflow-stat-value ${roi >= 0 ? 'positive' : 'negative'}`;
    }
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
    
    const avgMonthlyReturn = durationYears > 0 ? Math.pow(1 + annualizedReturn, 1/12) - 1 : 0;
    document.getElementById('metricAvgMonthlyReturn').textContent = `${(avgMonthlyReturn * 100).toFixed(2)}%`;
    
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

// --- NEUE, VERBESSERTE PROGNOSE-FUNKTIONEN ---

function setForecastPeriod(years) {
    currentForecastPeriod = years;
    // Update active button
    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    // Safely find the button that was clicked.
    const buttons = document.querySelectorAll('.time-selector .time-btn');
    buttons.forEach(btn => {
        if (btn.textContent.includes(years)) {
            btn.classList.add('active');
        }
    });
    updateForecastChart();
}

function toggleScenarios() {
    showForecastScenarios = !showForecastScenarios;
    const btn = document.querySelector('.scenario-toggle');
    if(btn) btn.textContent = showForecastScenarios ? '📊 Szenarien' : '📈 Einfach';
    updateForecastChart();
}

function updateForecastChart() {
    const forecastWidget = document.getElementById('forecastWidget');
    if (!forecastWidget) return;

    // Hide widget if not enough data
    if (entries.length < 2) {
        forecastWidget.style.display = 'none';
        return;
    }

    const sortedEntries = [...entries].sort((a,b) => new Date(a.date) - new Date(b.date));
    const firstDate = new Date(sortedEntries[0].date);
    const lastDate = new Date(sortedEntries[sortedEntries.length - 1].date);
    const durationMs = lastDate - firstDate;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    if (durationDays < 30) {
        forecastWidget.style.display = 'none';
        return;
    }
    forecastWidget.style.display = 'block';

    // --- Berechnungen ---
    const durationYears = durationDays / 365.25;
    const currentPortfolioValue = sortedEntries.filter(e => e.date === sortedEntries[sortedEntries.length - 1].date).reduce((s, e) => s + e.balance, 0);
    const sortedCashflows = [...cashflows].sort((a,b) => new Date(a.date) - new Date(b.date));
    const totalNetInvested = sortedCashflows.reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
    const totalReturnSum = currentPortfolioValue - totalNetInvested;
    const totalReturnPercent = totalNetInvested > 0 ? (totalReturnSum / totalNetInvested) * 100 : 0;
    const annualizedReturn = durationYears > 0 ? Math.pow(1 + (totalReturnPercent / 100), 1 / durationYears) - 1 : 0;

    // Szenarien definieren
    const realisticReturn = annualizedReturn;
    const conservativeReturn = annualizedReturn * 0.5; // Annahme: 50% der hist. Rendite
    const optimisticReturn = annualizedReturn * 1.5;   // Annahme: 150% der hist. Rendite

    const generateScenario = (startValue, annualReturn, years) => {
        const data = [startValue];
        for (let i = 1; i <= years; i++) {
            data.push(startValue * Math.pow(1 + annualReturn, i));
        }
        return data;
    };

    const realisticData = generateScenario(currentPortfolioValue, realisticReturn, currentForecastPeriod);
    const conservativeData = generateScenario(currentPortfolioValue, conservativeReturn, currentForecastPeriod);
    const optimisticData = generateScenario(currentPortfolioValue, optimisticReturn, currentForecastPeriod);

    // --- DOM Updates ---
    document.getElementById('forecastMetricRealisticValue').textContent = formatDollar(realisticData[realisticData.length - 1]);
    document.getElementById('forecastMetricRealisticLabel').textContent = `Erwarteter Wert (${currentForecastPeriod}J)`;
    document.getElementById('forecastMetricAnnualReturn').textContent = `${(realisticReturn * 100).toFixed(1)}%`;
    document.getElementById('forecastMetricTotalProfit').textContent = formatDollar(realisticData[realisticData.length - 1] - currentPortfolioValue);
    document.getElementById('forecastMetricConservativeValue').textContent = formatDollar(conservativeData[conservativeData.length - 1]);
    document.getElementById('forecastMetricConservativeLabel').textContent = `"Pessimistisch" (${currentForecastPeriod}J)`;
    
    document.getElementById('conservativeValue').textContent = formatDollar(conservativeData[conservativeData.length - 1]);
    document.getElementById('realisticValue').textContent = formatDollar(realisticData[realisticData.length - 1]);
    document.getElementById('optimisticValue').textContent = formatDollar(optimisticData[optimisticData.length - 1]);
    document.getElementById('conservativeReturnLabel').textContent = `+${(conservativeReturn * 100).toFixed(1)}% jährlich`;
    document.getElementById('realisticReturnLabel').textContent = `+${(realisticReturn * 100).toFixed(1)}% jährlich`;
    document.getElementById('optimisticReturnLabel').textContent = `+${(optimisticReturn * 100).toFixed(1)}% jährlich`;

    // --- Chart Update ---
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const labels = Array.from({length: currentForecastPeriod + 1}, (_, i) => i === 0 ? 'Heute' : `Jahr ${i}`);

    const datasets = [{
        label: 'Realistisch',
        data: realisticData,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: false,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
    }];

    if (showForecastScenarios) {
        datasets.push({
            label: 'Konservativ',
            data: conservativeData,
            borderColor: '#ef4444',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
        }, {
            label: 'Optimistisch',
            data: optimisticData,
            borderColor: '#10b981',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
        });
    }

    if (forecastChart) {
        forecastChart.destroy();
    }

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                datalabels: {
                    display: false // Verhindert, dass die Zahlen direkt auf dem Chart angezeigt werden
                },
                legend: { position: 'bottom', align: 'center', labels: { usePointStyle: true, padding: 20, font: { size: 14, weight: '500' }}},
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label}: ${formatDollar(c.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: (value) => formatDollar(value), font: { size: 12 }},
                    grid: { color: 'rgba(0, 0, 0, 0.08)', drawBorder: false }
                },
                x: {
                    ticks: { font: { size: 12 }},
                    grid: { display: false }
                }
            },
            elements: { point: { backgroundColor: '#ffffff', borderWidth: 2 }}
        }
    });
}

async function editEntry(entryId) {
    const entry = entries.find(e => e.id == entryId);
    if (!entry) return;

    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">Eintrag bearbeiten</h2></div>
        <div class="modal-body">
            <div class="github-input-group">
                <label>Datum</label>
                <input type="date" id="editEntryDate" class="date-input" value="${entry.date}">
            </div>
            <div class="github-input-group">
                <label>Plattform</label>
                <input type="text" id="editEntryProtocol" class="input-field" value="${entry.protocol}" readonly>
            </div>
            <div class="github-input-group">
                <label>Balance</label>
                <input type="text" inputmode="decimal" id="editEntryBalance" class="input-field" value="${entry.balance.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}">
            </div>
            <div class="github-input-group">
                <label>Notiz</label>
                <input type="text" id="editEntryNote" class="input-field" value="${entry.note || ''}">
            </div>
            <div class="github-input-group">
                <label>🎯 Strategie</label>
                <input type="text" id="editEntryStrategy" class="input-field" placeholder="Strategie für ${entry.protocol}..." value="${entry.strategy || ''}">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="closeBottomSheet()">Abbrechen</button>
            <button class="btn btn-success" onclick="saveEntryEdit(${entryId})">Speichern</button>
        </div>
    `;
    openBottomSheet(contentHtml);
    setTimeout(() => document.getElementById('editEntryBalance').focus(), 200);
}

function saveEntryEdit(entryId) {
    const entry = entries.find(e => e.id == entryId);
    if (!entry) return;

    entry.date = document.getElementById('editEntryDate').value;
    entry.balance = parseLocaleNumberString(document.getElementById('editEntryBalance').value);
    entry.note = document.getElementById('editEntryNote').value;
    entry.strategy = document.getElementById('editEntryStrategy').value;

    if (isNaN(entry.balance)) {
        return showNotification('Ungültiger Betrag.', 'error');
    }

    saveData();
    applyDateFilter();
    closeBottomSheet();
    showNotification('Eintrag aktualisiert!', 'success');
}

async function editCashflow(cashflowId) {
    const cashflow = cashflows.find(c => c.id == cashflowId);
    if (!cashflow) return;

    const contentHtml = `
        <div class="modal-header"><h2 class="modal-title">Cashflow bearbeiten</h2></div>
        <div class="modal-body">
            <div class="github-input-group">
                <label>Datum</label>
                <input type="date" id="editCashflowDate" class="date-input" value="${cashflow.date}">
            </div>
            <div class="github-input-group">
                <label>Typ</label>
                <select id="editCashflowType" class="input-field">
                    <option value="deposit" ${cashflow.type === 'deposit' ? 'selected' : ''}>Einzahlung</option>
                    <option value="withdraw" ${cashflow.type === 'withdraw' ? 'selected' : ''}>Auszahlung</option>
                </select>
            </div>
            <div class="github-input-group">
                <label>Betrag</label>
                <input type="text" inputmode="decimal" id="editCashflowAmount" class="input-field" value="${cashflow.amount.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}">
            </div>
            <div class="github-input-group">
                <label>Plattform</label>
                <input type="text" id="editCashflowPlatform" class="input-field" value="${cashflow.platform || ''}" placeholder="Optional">
            </div>
            <div class="github-input-group">
                <label>Notiz</label>
                <input type="text" id="editCashflowNote" class="input-field" value="${cashflow.note || ''}" placeholder="Optional">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="closeBottomSheet()">Abbrechen</button>
            <button class="btn btn-success" onclick="saveCashflowEdit(${cashflowId})">Speichern</button>
        </div>
    `;
    openBottomSheet(contentHtml);
    setTimeout(() => document.getElementById('editCashflowAmount').focus(), 200);
}

function saveCashflowEdit(cashflowId) {
    const cashflow = cashflows.find(c => c.id == cashflowId);
    if (!cashflow) return;

    cashflow.date = document.getElementById('editCashflowDate').value;
    cashflow.type = document.getElementById('editCashflowType').value;
    cashflow.amount = parseLocaleNumberString(document.getElementById('editCashflowAmount').value);
    cashflow.platform = document.getElementById('editCashflowPlatform').value;
    cashflow.note = document.getElementById('editCashflowNote').value;

    if (isNaN(cashflow.amount) || cashflow.amount <= 0) {
        return showNotification('Ungültiger Betrag.', 'error');
    }

    saveData();
    updateCashflow();
    closeBottomSheet();
    showNotification('Cashflow aktualisiert!', 'success');
}

async function deleteEntriesForDate(date) {
    const entriesOnDate = entries.filter(e => e.date === date);
    if (entriesOnDate.length === 0) {
        return showNotification('Keine Einträge an diesem Datum zum Löschen vorhanden.', 'warning');
    }

    const confirmed = await showCustomPrompt({
        title: 'Einträge löschen',
        text: `Möchtest du wirklich alle ${entriesOnDate.length} Einträge vom ${formatDate(date)} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
        actions: [
            { text: 'Abbrechen' },
            { text: 'Löschen', class: 'btn-danger', value: true }
        ]
    });

    if (confirmed === 'true') {
        saveToUndoStack('delete_entries', entriesOnDate);
        entries = entries.filter(e => e.date !== date);
        saveData();
        applyDateFilter(); // This will re-render the history view
    }
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
    const byDateView = document.getElementById('historyByDateView');
    const mobileCards = document.getElementById('historyMobileCards');
    const searchInput = document.getElementById('historySearch');

    const tbody = document.getElementById('historyTableBody');
    if (!tbody) {
        console.error('historyTableBody nicht gefunden');
        return;
    }
    
    const historySection = tbody.closest('.section');
    if (historySection) {
        let clearBtnContainer = historySection.querySelector('.clear-filter-btn-container');
        if (clearBtnContainer) clearBtnContainer.remove();
    } else {
        console.warn('History section not found');
    }
    
    const historySearchEl = document.getElementById('historySearch');
    const searchTerm = historySearchEl ? historySearchEl.value.toLowerCase() : '';
    let dataToDisplay;

    if (singleItemFilter && singleItemFilter.type === 'history') {
        dataToDisplay = entries.filter(singleItemFilter.filterFunction);
        const clearButtonHtml = `<div class="clear-filter-btn-container" style="margin-top: 16px; text-align: center;"><button class="btn btn-primary" onclick="clearSingleItemFilter()">Alle Einträge anzeigen</button></div>`;
        const tableWrapper = tbody.closest('.data-table-wrapper');
        if (tableWrapper) {
            tableWrapper.insertAdjacentHTML('afterend', clearButtonHtml);
        }
    } else {
        if (historyViewMode === 'grouped') {
            listView.style.display = 'none';
            mobileCards.style.display = 'none';
            byDateView.style.display = 'none';
            groupedView.style.display = 'block';
            searchInput.style.visibility = 'visible';
            searchInput.placeholder = "Gruppe suchen...";
            renderGroupedHistory(searchTerm);
            return;
        } else if (historyViewMode === 'bydate') {
            listView.style.display = 'none';
            mobileCards.style.display = 'none';
            groupedView.style.display = 'none';
            byDateView.style.display = 'block';
            searchInput.style.visibility = 'visible';
            searchInput.placeholder = "Nach Datum suchen (z.B. 05.09, September, 2025)...";
            renderGroupedHistoryByDate(searchTerm);
            return;
        }
        dataToDisplay = filteredEntries.filter(e => 
            e.protocol.toLowerCase().includes(searchTerm) || 
            e.date.toLowerCase().includes(searchTerm) ||
            (e.note && e.note.toLowerCase().includes(searchTerm)) ||
            getDisplayStrategyForEntry(e).toLowerCase().includes(searchTerm)
        );
    }

    listView.style.display = 'block';
    groupedView.style.display = 'none';
    byDateView.style.display = 'none';
    searchInput.placeholder = "In Liste suchen...";
    searchInput.style.visibility = 'visible'; // Sicherstellen, dass es sichtbar ist
    if (window.innerWidth <= 768) mobileCards.style.display = 'block';

    // Augment data with strategy for correct sorting
    const augmentedData = dataToDisplay.map(entry => ({
        ...entry,
        strategy: getDisplayStrategyForEntry(entry)
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

    // Hide table and show card container instead
    const table = tbody.closest('.data-table-wrapper') || tbody.closest('table');
    if (table) table.style.display = 'none';
    
    // Always ensure we have a card container, create if needed
    let cardContainer = listView.querySelector('.history-cards-container');
    if (!cardContainer) {
        cardContainer = document.createElement('div');
        cardContainer.className = 'history-cards-container';
        cardContainer.style.cssText = 'padding: 16px;';
        listView.appendChild(cardContainer);
    }
    
    if (augmentedData.length === 0) {
        // Check if this is due to search or genuinely no entries
        if (searchTerm && searchTerm.trim() !== '') {
            // Show search-specific empty state in card container
            cardContainer.innerHTML = `
                <div class="empty-state-enhanced" style="text-align: center; padding: 60px 20px;">
                    <div class="empty-state-icon" style="font-size: 4rem; margin-bottom: 16px;">🔍</div>
                    <div class="empty-state-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Keine Suchergebnisse</div>
                    <div class="empty-state-description" style="color: var(--text-secondary); margin-bottom: 20px;">
                        Keine Einträge gefunden für "${searchTerm}"
                    </div>
                    <button class="btn btn-secondary" onclick="clearHistorySearch();">Suche zurücksetzen</button>
                </div>
            `;
        } else {
            renderEmptyState(listView, 'history');
        }
        return;
    }

    // Render unified card-based layout for all entries
    const html = augmentedData.map((entry, index) => {
        const strategy = getDisplayStrategyForEntry(entry);
        return `
            <div class="history-card" data-id="${entry.id}" data-index="${index}" 
                 style="margin-bottom: 12px; padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
                <div class="history-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="checkbox" ${selectedHistoryEntries.has(entry.id) ? 'checked' : ''} 
                               onclick="handleHistoryRowClick(event, this.closest('.history-card'), ${entry.id}, ${index})" 
                               style="margin: 0;">
                        <div class="entry-date" style="font-weight: 600; color: var(--text-primary);">${formatDate(entry.date)}</div>
                        <div class="entry-platform" style="font-weight: 600; color: var(--primary);">${entry.protocol}</div>
                    </div>
                    <div class="entry-balance dollar-value editable" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')" 
                         style="font-size: 1.2em; font-weight: 700; cursor: pointer;">${formatDollar(entry.balance)}</div>
                </div>
                <div class="history-card-details" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${strategy !== '-' ? `<div style="font-size: 13px; color: var(--text-secondary);"><strong>Strategie:</strong> ${strategy}</div>` : ''}
                        <div class="entry-note editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')" 
                             style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">
                            ${entry.note || '<span style="color: var(--text-muted);">Notiz hinzufügen...</span>'}
                        </div>
                    </div>
                    <div class="history-card-actions" style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editEntry(${entry.id})" 
                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})" 
                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    cardContainer.innerHTML = html;
    
    // Render mobile cards
    renderHistoryMobileCards(augmentedData);
    
    updateSelectAllCheckbox();
    updateBulkActionsBar();
}

function clearHistorySearch() {
    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
        searchInput.value = '';
    }
    updateHistory();
}

function renderGroupedHistoryByDate(searchTerm = '') {
    const container = document.getElementById('historyByDateView');
    
    // Filter entries based on search term - enhanced date search
    let entriesToDisplay = filteredEntries;
    if (searchTerm && searchTerm.trim() !== '') {
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        entriesToDisplay = filteredEntries.filter(e => {
            // Standard search in protocol, note, strategy
            const standardMatch = e.protocol.toLowerCase().includes(lowerSearchTerm) || 
                                 (e.note && e.note.toLowerCase().includes(lowerSearchTerm)) ||
                                 getDisplayStrategyForEntry(e).toLowerCase().includes(lowerSearchTerm);
            
            // Enhanced date search
            const dateMatch = searchInDate(e.date, searchTerm);
            
            return standardMatch || dateMatch;
        });
    }
    
    function searchInDate(entryDate, searchTerm) {
        const term = searchTerm.trim();
        if (!term) return false;
        
        // Parse entry date (format: YYYY-MM-DD)
        const date = new Date(entryDate);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        // Generate various date formats to search in
        const dateFormats = [
            entryDate,                                          // 2025-09-05
            `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`,  // 05.09.2025
            `${day}.${month}.${year}`,                         // 5.9.2025
            `${month}/${day}/${year}`,                         // 9/5/2025
            `${day}/${month}/${year}`,                         // 5/9/2025
            date.toLocaleDateString('de-DE'),                  // 05.09.2025
            date.toLocaleDateString('en-US'),                  // 9/5/2025
            day.toString(),                                    // 5 (day only)
            month.toString(),                                  // 9 (month only)
            year.toString(),                                   // 2025 (year only)
            date.toLocaleDateString('de-DE', { month: 'long' }),        // September
            date.toLocaleDateString('de-DE', { month: 'short' }),       // Sep
            date.toLocaleDateString('de-DE', { weekday: 'long' }),      // Donnerstag
            date.toLocaleDateString('de-DE', { weekday: 'short' }),     // Do
        ];
        
        // Check if search term matches any date format
        return dateFormats.some(format => 
            format.toLowerCase().includes(term.toLowerCase())
        );
    }
    
    // Check for empty results due to search
    if (entriesToDisplay.length === 0 && searchTerm && searchTerm.trim() !== '') {
        container.innerHTML = `
            <div class="empty-state-enhanced" style="text-align: center; padding: 60px 20px;">
                <div class="empty-state-icon" style="font-size: 4rem; margin-bottom: 16px;">🔍</div>
                <div class="empty-state-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Keine Suchergebnisse</div>
                <div class="empty-state-description" style="color: var(--text-secondary); margin-bottom: 20px;">
                    Keine Einträge gefunden für "${searchTerm}"
                </div>
                <button class="btn btn-secondary" onclick="clearHistorySearch();">Suche zurücksetzen</button>
            </div>
        `;
        return;
    }
    
    // Gruppiere Einträge nach Datum
    const entriesByDate = {};
    entriesToDisplay.forEach(entry => {
        if (!entriesByDate[entry.date]) {
            entriesByDate[entry.date] = [];
        }
        entriesByDate[entry.date].push(entry);
    });
    
    // Sortiere Daten absteigend
    const sortedDates = Object.keys(entriesByDate).sort((a, b) => new Date(b) - new Date(a));
    
    let html = '';
    sortedDates.forEach(date => {
        const dayEntries = entriesByDate[date];
        const dayStrategy = dayStrategies.find(s => s.date === date);
        const dayTotal = dayEntries.reduce((sum, e) => sum + e.balance, 0);
        
        // Vergleich zum Vortag
        const prevDate = sortedDates[sortedDates.indexOf(date) + 1];
        let dayChange = 0;
        let dayChangePercent = 0;
        if (prevDate) {
            const prevTotal = entriesByDate[prevDate].reduce((sum, e) => sum + e.balance, 0);
            const cashflowBetween = cashflows
                .filter(c => c.date > prevDate && c.date <= date)
                .reduce((sum, c) => sum + (c.type === 'deposit' ? c.amount : -c.amount), 0);
            
            dayChange = dayTotal - prevTotal - cashflowBetween;
            dayChangePercent = prevTotal > 0 ? (dayChange / prevTotal) * 100 : 0;
        }
        
        html += `
            <details class="history-date-group" ${sortedDates.indexOf(date) === 0 ? 'open' : ''}>
                <summary class="date-group-header">
                    <div class="date-header-left">
                        <div class="date-info">
                            <span class="date-label">📅 ${formatDate(date)}</span>
                            ${date === new Date().toISOString().split('T')[0] ? '<span class="today-badge">Heute</span>' : ''}
                        </div>
                    </div>
                    <div class="date-header-right">
                        <div class="date-summary">
                            <span class="entry-count">${dayEntries.length} Einträge</span>
                            <span class="day-total">${formatDollar(dayTotal)}</span>
                            <span class="day-change ${dayChange >= 0 ? 'positive' : 'negative'}">
                                ${dayChange >= 0 ? '↑' : '↓'} ${formatDollar(Math.abs(dayChange))} (${dayChangePercent.toFixed(1)}%)
                            </span>
                        </div>
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteEntriesForDate('${date}')" title="Alle Einträge für diesen Tag löschen">🗑️</button>
                    </div>
                </summary>
                <div class="date-group-content">
                    ${dayStrategy ? `
                        <div class="day-strategy">
                            <strong>Strategie:</strong> ${dayStrategy.strategy}
                        </div>
                    ` : ''}
                    <div class="day-entries" style="padding: 8px;">
                        ${dayEntries.sort((a,b) => b.balance - a.balance).map(entry => {
                            const strategy = getDisplayStrategyForEntry(entry);
                            return `
                                <div class="history-card" style="margin-bottom: 8px; padding: 12px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                                    <div class="history-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div class="entry-platform" style="font-weight: 600; color: var(--primary);">${entry.protocol}</div>
                                        <div class="entry-balance dollar-value editable" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')" 
                                             style="font-size: 1.1em; font-weight: 700; cursor: pointer;">${formatDollar(entry.balance)}</div>
                                    </div>
                                    <div class="history-card-details" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            ${strategy !== '-' ? `<div style="font-size: 13px; color: var(--text-secondary);"><strong>Strategie:</strong> ${strategy}</div>` : ''}
                                            <div class="entry-note editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')" 
                                                 style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">
                                                ${entry.note || '<span style="color: var(--text-muted);">Notiz hinzufügen...</span>'}
                                            </div>
                                        </div>
                                        <div class="history-card-actions" style="display: flex; gap: 8px;">
                                            <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editEntry(${entry.id})" 
                                                    style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✏️</button>
                                            <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})" 
                                                    style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </details>
        `;
    });
    
    container.innerHTML = html || renderEmptyState(container, 'history');
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

        // Use unified card layout for all entries in this platform group
        html += `<div style="padding: 8px; max-height: 400px; overflow-y: auto;">
            ${entries.map(entry => {
                const strategy = getDisplayStrategyForEntry(entry);
                return `
                    <div class="history-card" style="margin-bottom: 8px; padding: 12px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                        <div class="history-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div class="entry-date editable" onclick="event.stopPropagation(); makeDateEditable(this, ${entry.id}, 'entry')" 
                                 style="font-weight: 600; color: var(--text-primary); cursor: pointer;">${formatDate(entry.date)}</div>
                            <div class="entry-balance dollar-value editable" onclick="event.stopPropagation(); makeBalanceEditable(this, ${entry.id}, 'entry')" 
                                 style="font-size: 1.1em; font-weight: 700; cursor: pointer;">${formatDollar(entry.balance)}</div>
                        </div>
                        <div class="history-card-details" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${strategy !== '-' ? `<div style="font-size: 13px; color: var(--text-secondary);"><strong>Strategie:</strong> ${strategy}</div>` : ''}
                                <div class="entry-note editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${entry.id}, 'entry')" 
                                     style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">
                                    ${entry.note || '<span style="color: var(--text-muted);">Notiz hinzufügen...</span>'}
                                </div>
                            </div>
                            <div class="history-card-actions" style="display: flex; gap: 8px;">
                                <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editEntry(${entry.id})" 
                                        style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✏️</button>
                                <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteSingleEntryWithConfirmation(${entry.id})" 
                                        style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>`;
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
    if (confirmed === true) {
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
        const newAmount = parseLocaleNumberString(amountValue);

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
    if (confirmed === 'true') {
        const deletedEntries = entries.filter(e => selectedHistoryEntries.has(e.id));
        if (deletedEntries.length > 0) {
            saveToUndoStack('bulk_delete', deletedEntries);
        }
        entries = entries.filter(e => !selectedHistoryEntries.has(e.id));
        selectedHistoryEntries.clear();
        saveData();
        applyDateFilter();
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

function toggleHistorySelection(entryId, shouldBeSelected, options = {}) {
    const { skipStatusUpdate = false } = options;
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
    
    if (!skipStatusUpdate) {
        updateSelectAllCheckbox();
        updateBulkActionsBar();
    }
}

function toggleSelectAllHistory(e) {
    const isChecked = e.target.checked;
    const visibleIds = getVisibleHistoryIds();

    if (isChecked) {
        visibleIds.forEach(id => selectedHistoryEntries.add(id));
    } else {
        visibleIds.forEach(id => selectedHistoryEntries.delete(id));
    }

    updateHistory();

    const selectAllCheckbox = document.getElementById('selectAllHistory');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = isChecked && visibleIds.size > 0;
        selectAllCheckbox.indeterminate = false;
    }

    updateBulkActionsBar();
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
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
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
            renderCashflowTable(container, filteredCashflows || []);
        } else {
            renderGroupedCashflow(container, cashflowViewMode, filteredCashflows || []);
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
                <div class="cashflow-group-details" style="padding: 8px; max-height: 400px; overflow-y: auto;">
                    ${group.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(cf => {
                        const typeLabel = cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung';
                        const typeClass = cf.type === 'deposit' ? 'positive' : 'negative';
                        
                        return `
                            <div class="history-card" data-id="${cf.id}" 
                                 style="margin-bottom: 8px; padding: 12px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                                <div class="history-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div class="entry-date" style="font-weight: 600; color: var(--text-primary);">${formatDate(cf.date)}</div>
                                        <span class="type-badge type-${cf.type}" style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${typeLabel}</span>
                                    </div>
                                    <div class="entry-balance dollar-value ${typeClass}" 
                                         style="font-size: 1.1em; font-weight: 700;">${formatDollar(cf.amount)}</div>
                                </div>
                                <div class="history-card-details" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        ${cf.platform ? `<div style="font-size: 13px; color: var(--text-secondary);"><strong>Plattform:</strong> ${cf.platform}</div>` : ''}
                                        <div class="entry-note editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${cf.id}, 'cashflow')" 
                                             style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">
                                            ${cf.note || '<span style="color: var(--text-muted);">Notiz hinzufügen...</span>'}
                                        </div>
                                    </div>
                                    <div class="history-card-actions" style="display: flex; gap: 8px;">
                                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editCashflow(${cf.id})" 
                                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✏️</button>
                                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteCashflowWithConfirmation(${cf.id})" 
                                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </details>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderCashflowTable(container, dataToDisplay) {
    // Sort data
    dataToDisplay.sort((a, b) => {
        const aVal = a[cashflowSort.key] || 0;
        const bVal = b[cashflowSort.key] || 0;
        const order = cashflowSort.order === 'asc' ? 1 : -1;
        if (cashflowSort.key === 'date') return (new Date(bVal) - new Date(aVal)) * order;
        if (typeof aVal === 'string') return aVal.localeCompare(bVal) * order;
        return (aVal - bVal) * order;
    });

    if (dataToDisplay.length === 0) {
        renderEmptyState(container, 'cashflow');
        return;
    }

    // Render unified card-based layout for cashflow entries
    const html = dataToDisplay.map(cf => {
        const typeLabel = cf.type === 'deposit' ? 'Einzahlung' : 'Auszahlung';
        const typeClass = cf.type === 'deposit' ? 'positive' : 'negative';
        
        return `
            <div class="history-card" data-id="${cf.id}" 
                 style="margin-bottom: 12px; padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
                <div class="history-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="entry-date" style="font-weight: 600; color: var(--text-primary);">${formatDate(cf.date)}</div>
                        <span class="type-badge type-${cf.type}" style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${typeLabel}</span>
                    </div>
                    <div class="entry-balance dollar-value ${typeClass}" 
                         style="font-size: 1.2em; font-weight: 700;">${formatDollar(cf.amount)}</div>
                </div>
                <div class="history-card-details" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${cf.platform ? `<div style="font-size: 13px; color: var(--text-secondary);"><strong>Plattform:</strong> ${cf.platform}</div>` : ''}
                        <div class="entry-note editable" onclick="event.stopPropagation(); makeNoteEditable(this, ${cf.id}, 'cashflow')" 
                             style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">
                            ${cf.note || '<span style="color: var(--text-muted);">Notiz hinzufügen...</span>'}
                        </div>
                    </div>
                    <div class="history-card-actions" style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); editCashflow(${cf.id})" 
                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteCashflowWithConfirmation(${cf.id})" 
                                style="padding: 8px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `<div class="cashflow-cards-container" style="padding: 16px;">${html}</div>`;
}

async function deleteCashflowWithConfirmation(cashflowId) {
    const confirmed = await showCustomPrompt({
        title: 'Löschen bestätigen',
        text: 'Sind Sie sicher, dass Sie diesen Cashflow-Eintrag endgültig löschen möchten?',
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed === true) {
        deleteCashflow(cashflowId);
    }
}

async function deletePlatformWithConfirmation(platformName) {
    const confirmed = await showCustomPrompt({
        title: 'Plattform löschen',
        text: `Sind Sie sicher, dass Sie die Plattform '${platformName}' löschen möchten? Alle zugehörigen Einträge werden ebenfalls entfernt.`,
        actions: [{text: 'Abbrechen'}, {text: 'Löschen', class: 'btn-danger', value: true}]
    });
    if (confirmed === true) {
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
            <td data-label="Plattform" style="font-weight: 600;">${data.platform}</td>
            <td data-label="Einträge">${data.entries}</td>
            <td data-label="Erster Eintrag">${formatDate(data.first)}</td>
            <td data-label="Letzter Eintrag">${formatDate(data.last)}</td>
            <td data-label="Avg Balance" class="dollar-value">${formatDollar(data.avg)}</td>
            <td data-label="Total Return" class="dollar-value ${data.total >= 0 ? 'positive' : 'negative'}">${data.total.toLocaleString('de-DE', {signDisplay: 'always', minimumFractionDigits: 2})}</td>
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
    // Strategy Logic: General strategy has priority, otherwise show platform-specific strategies
    const dayStrategy = dayStrategies.find(s => s.date === date)?.strategy || '';
    const entriesWithStrategies = entries.filter(e => e.date === date && e.strategy && e.strategy.trim() !== '');
    
    let strategyToDisplay = '';
    if (dayStrategy && dayStrategy.trim() !== '') {
        // Show general strategy if it exists
        strategyToDisplay = dayStrategy;
    } else if (entriesWithStrategies.length > 0) {
        // Show platform-specific strategies as fallback
        const platformStrategies = entriesWithStrategies.map(e => `• ${e.protocol}: ${e.strategy}`).join('<br>');
        strategyToDisplay = platformStrategies;
    } else {
        strategyToDisplay = 'Keine Strategie für diesen Tag hinterlegt.';
    }
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
    if (strategyToDisplay !== 'Keine Strategie für diesen Tag hinterlegt.' || activeProtocols) {
        const infoSection = document.createElement('div');
        infoSection.style.marginTop = '8px';infoSection.style.paddingTop = '8px';infoSection.style.borderTop = '1px solid var(--border)';infoSection.style.fontSize = '0.8em';
        let infoHTML = '';
        
        // Check if we have platform-specific strategies
        const hasPlatformStrategies = entriesWithStrategies.length > 0 && (!dayStrategy || dayStrategy.trim() === '');
        
        if (strategyToDisplay !== 'Keine Strategie für diesen Tag hinterlegt.') {
            const strategyTitle = hasPlatformStrategies ? '🎯 Plattform-Strategien' : '🎯 Strategie';
            infoHTML += `<div style="margin-bottom: 6px;"><div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">${strategyTitle}</div><div style="color: var(--text-secondary); padding-left: 4px;">${strategyToDisplay}</div></div>`;
            
            // Only show platform list if we have general strategy (not platform-specific)
            if (activeProtocols && !hasPlatformStrategies) {
                infoHTML += `<div style="border-bottom: 1px solid var(--border); margin: 8px 0;"></div>`;
                infoHTML += `<div style="margin-bottom: 6px;"><div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">💼 Plattformen</div><div style="color: var(--text-secondary); padding-left: 4px;">${activeProtocols}</div></div>`;
            }
        } else if (activeProtocols) {
            // No strategies, only show platforms
            infoHTML += `<div style="margin-bottom: 6px;"><div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">💼 Plattformen</div><div style="color: var(--text-secondary); padding-left: 4px;">${activeProtocols}</div></div>`;
        }
        
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
                hideChartTooltip();
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

function hideChartTooltip() {
    const tooltipEl = document.querySelector('.chartjs-tooltip');
    if (tooltipEl) {
        tooltipEl.style.opacity = '0';
        tooltipEl.style.pointerEvents = 'none';
    }

    if (portfolioChart) {
        if (typeof portfolioChart.setActiveElements === 'function') {
            portfolioChart.setActiveElements([]);
        }
        if (portfolioChart.tooltip && typeof portfolioChart.tooltip.update === 'function') {
            portfolioChart.tooltip.update();
        }
        if (typeof portfolioChart.update === 'function') {
            portfolioChart.update('none');
        } else if (typeof portfolioChart.draw === 'function') {
            portfolioChart.draw();
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
    
    // KORREKTUR: Alle Datums-Strings explizit als UTC behandeln, um Zeitzonenfehler zu vermeiden.
    // Dies stellt sicher, dass die Vergleiche konsistent sind, egal wo auf der Welt der Benutzer ist.
    const firstBenchmarkDate = new Date(benchmarkPoints[0].date + 'T00:00:00Z');
    const lastBenchmarkDate = new Date(benchmarkPoints[benchmarkPoints.length - 1].date + 'T00:00:00Z');

    const result = [];
    
    for (const date of dates) {
        const dateObj = new Date(date + 'T00:00:00Z');

        if (dateObj < firstBenchmarkDate || dateObj > lastBenchmarkDate) {
            result.push([dateObj.getTime(), null]);
            continue;
        }
        
        // Finde die zwei nächsten Stützpunkte
        let before = null;
        let after = null;
        
        for (let i = 0; i < benchmarkPoints.length; i++) {
            const pointDate = new Date(benchmarkPoints[i].date + 'T00:00:00Z');
            
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
            const beforeDate = new Date(before.date + 'T00:00:00Z');
            const afterDate = new Date(after.date + 'T00:00:00Z');
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
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 1000; // 1 second

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status; // Attach status to error object
                throw error;
            }
            const data = await response.json();
            return data.prices || []; // Success, return data
        } catch (error) {
            // Specific handling for rate limiting
            if (error.status === 429 && attempt < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                console.warn(`CoinGecko rate limit hit for ${id}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Go to next attempt
            }

            // Handle final failure or other errors
            if (error.status === 429) {
                console.error(`CoinGecko API rate limit hit for ${id} after ${MAX_RETRIES} attempts. Using fallback.`);
            } else {
                console.error(`Failed to fetch ${id} data, using fallback:`, error);
            }
            return []; // Return empty array as a fallback
        }
    }
    return []; // Should not be reached, but as a safeguard
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
                    // KORREKTUR: Wenn für ein Datum kein Benchmark-Wert gefunden wird (z.B. am Ende des Zeitraums),
                    // füge 'null' ein. Chart.js wird dadurch eine Lücke in der Linie erzeugen,
                    // anstatt eine irreführende flache Linie zu zeichnen.
                    results.push(null);
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
        await new Promise(resolve => setTimeout(resolve, 1500)); // Längere Pause zur Vermeidung von Rate-Limits
        const ethPrices = await fetchMarketData('ethereum', fromTs, toTs);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Längere Pause zur Vermeidung von Rate-Limits
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
    const baseUrl = CORS_PROXY + sheetUrl; // Verwende den CORS-Proxy

    // NEU: Wiederholungslogik für den Abruf
    const MAX_RETRIES = 4; // Erhöht auf 4 Versuche
    // NEU: Längere Startverzögerung, da Google Sheets manchmal langsam sind
    const INITIAL_RETRY_DELAY = 4000; // Start mit 4 Sekunden

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Logik für den Ladeversuch bleibt, aber ohne Benachrichtigung an den User.
            // NEU: Cache-Busting Parameter hinzufügen, um immer eine frische Antwort zu erzwingen
            const urlWithBust = baseUrl + '&_=' + new Date().getTime();
            const response = await fetch(urlWithBust);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const csvText = await response.text();

            const csvTextLower = csvText.trim().toLowerCase();
            if (csvTextLower.startsWith('wird geladen...') || csvTextLower.startsWith('loading...')) {
                // Dies ist ein temporärer Fehler, wir werfen einen Fehler, um einen neuen Versuch auszulösen.
                throw new Error('Google Sheet is still loading');
            }

            // Wenn wir hier sind, sind die Daten gültig. Verarbeite sie.
            const lines = csvText.split(/\r\n|\n/);
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            
            const dateColIndex = headers.findIndex(h => h.includes('date') || h.includes('datum'));
            const closeColIndex = headers.findIndex(h => h.includes('close') || h.includes('schluss'));

            if (dateColIndex === -1 || closeColIndex === -1) {
                console.warn(`Konnte Header "Date/Datum" und "Close/Schluss" im CSV für ${ticker} nicht finden. Gefundene Header:`, headers);
                showNotification(`Fehler im CSV-Format für ${decodedTicker}. Fallback wird genutzt.`, 'warning');
                return useStaticFallback(ticker); // Dies ist ein permanenter Fehler, kein neuer Versuch.
            }

            const prices = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;
                const fields = line.split(',').map(f => f.replace(/"/g, '').trim());
                const dateStr = fields[dateColIndex] || '';
                const priceStr = fields[closeColIndex] || '';
                if (dateStr && priceStr) {
                    const datePart = dateStr.split(' ')[0];
                    const [day, month, year] = datePart.split('.');

                    if (month && day && year) {
                        const date = new Date(Date.UTC(year, month - 1, day));
                        const price = parseLocaleNumberString(priceStr);
                        if (!isNaN(date.getTime()) && !isNaN(price) && price > 0) {
                            prices.push([date.getTime(), price]);
                        }
                    }
                }
            }
            if (prices.length > 0) {
                console.log(`%cErfolgreich ${prices.length} Datenpunkte für ${decodedTicker} aus Google Sheet geladen.`, 'color: green; font-weight: bold;');
            }
            return prices; // Erfolg, die Schleife wird verlassen.

        } catch (error) {
            console.log(`Versuch ${attempt}/${MAX_RETRIES} für ${decodedTicker} fehlgeschlagen, versuche erneut...`);
            if (attempt === MAX_RETRIES) {
                // Nach dem letzten Versuch aufgeben und Fallback nutzen.
                console.log(`Laden für ${decodedTicker} nach ${MAX_RETRIES} Versuchen fehlgeschlagen. Nutze statische Fallback-Daten.`);
                // Die Benachrichtigung wird entfernt, da der Fallback nahtlos funktioniert.
                return useStaticFallback(ticker);
            }
            // Warten vor dem nächsten Versuch.
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    // Dieser Punkt sollte nicht erreicht werden, aber als Sicherheitsnetz.
    return useStaticFallback(ticker);
}

/**
 * NEU: Sendet "Wake-up Calls" an die Google Sheet APIs, um sie aus dem Schlafmodus zu holen.
 * Dies geschieht "fire-and-forget" im Hintergrund, ohne auf eine Antwort zu warten.
 */
function warmUpBenchmarkApis() {
    console.log('Warming up Google Sheet APIs...');
    Object.values(GOOGLE_SHEET_URLS).forEach(sheetUrl => {
        if (sheetUrl && !sheetUrl.includes('YOUR_')) {
            // 'no-cors' ist hier wichtig, da wir die Antwort nicht benötigen und CORS-Fehler ignorieren wollen.
            fetch(CORS_PROXY + sheetUrl, { mode: 'no-cors' }).catch(() => {});
        }
    });
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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ platforms, entries, cashflows, dayStrategies, favorites, notes }));
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
                const amount = parseLocaleNumberString(amountStr || '0');

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
                    notes = data.notes || [];
                    saveData();
                    applyDateFilter();
                    renderNotesList();
                    resetNoteForm();
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

const formatDollarSigned = (value) => {
    const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    if (document.body.classList.contains('privacy-mode')) return '$******';
    if (numericValue === 0) return formatDollar(0);
    const formatted = formatDollar(Math.abs(numericValue));
    const sign = numericValue > 0 ? '+' : '-';
    return `${sign}${formatted}`;
};

function updateEntrySummary() {
    const summaryCard = document.getElementById('entrySummary');
    if (!summaryCard) return;

    const inputCards = Array.from(document.querySelectorAll('#platformInputs .input-card'));
    const activeCount = inputCards.length;

    const activeCountEl = document.getElementById('summaryActiveCount');
    const totalValueEl = document.getElementById('summaryTotalValue');
    const deltaValueEl = document.getElementById('summaryDeltaValue');
    const pendingCountEl = document.getElementById('summaryPendingCount');

    if (activeCount === 0) {
        summaryCard.style.display = 'none';
        if (activeCountEl) activeCountEl.textContent = '0';
        if (totalValueEl) totalValueEl.textContent = formatDollar(0);
        if (deltaValueEl) {
            deltaValueEl.textContent = formatDollar(0);
            deltaValueEl.classList.remove('positive', 'negative');
        }
        if (pendingCountEl) pendingCountEl.textContent = '0';
        return;
    }

    summaryCard.style.display = 'block';

    let totalCurrent = 0;
    let totalOriginal = 0;
    let pendingCount = 0;

    inputCards.forEach(card => {
        const input = card.querySelector('.input-field');
        if (!input) return;

        const currentValue = parseLocaleNumberString(input.value);
        if (!Number.isNaN(currentValue)) {
            totalCurrent += currentValue;
        }

        const originalValue = parseFloat(input.dataset.originalValue || '0');
        if (!Number.isNaN(originalValue)) {
            totalOriginal += originalValue;
        }

        if (input.dataset.saved !== 'true') {
            pendingCount += 1;
        }
    });

    const delta = totalCurrent - totalOriginal;

    if (activeCountEl) activeCountEl.textContent = String(activeCount);
    if (totalValueEl) totalValueEl.textContent = formatDollar(totalCurrent);
    if (deltaValueEl) {
        deltaValueEl.textContent = formatDollarSigned(delta);
        deltaValueEl.classList.remove('positive', 'negative');
        if (delta > 0) {
            deltaValueEl.classList.add('positive');
        } else if (delta < 0) {
            deltaValueEl.classList.add('negative');
        }
    }
    if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);
}


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
    if (sheet) {
        sheet.classList.remove('visible');
    }
    if (promptResolve) {
        promptResolve(value);
        promptResolve = null;
    }
}

function showCustomPrompt({ title, text, showInput = false, showDateInput = false, listHtml = '', actions = [] }) {
    return new Promise(resolve => {
        promptResolve = resolve;

        // Definiert, welche Aktionswerte eine Eingabe vom Benutzer erwarten.
        const positiveActionValues = ['next', 'save', 'confirm', 'change', 'reset', 'DELETE ALL', 'RESTORE'];

        let actionsHtml = actions.map(action => {
            let onclickCall;
            // Wenn ein Input angezeigt wird UND die Aktion eine Bestätigungsaktion ist,
            // wird der Wert des Inputs an closeBottomSheet übergeben.
            if ((showInput || showDateInput) && positiveActionValues.includes(action.value)) {
                const inputId = showInput ? 'bottomSheet_input' : 'bottomSheet_date_input';
                onclickCall = `closeBottomSheet(document.getElementById('${inputId}').value)`;
            } else {
                // Andernfalls wird der Wert der Aktion selbst oder null (für Abbrechen) übergeben.
                // Der Wert wird in Anführungszeichen gesetzt, um ihn als String zu übergeben, es sei denn, er ist 'true' oder 'null'.
                const param = action.value !== undefined && action.value !== null ? (typeof action.value === 'boolean' ? action.value : `'${action.value}'`) : 'null';
                onclickCall = `closeBottomSheet(${param})`;
            }
            return `<button class="btn ${action.class || 'btn-primary'}" onclick="${onclickCall}">${action.text}</button>`;
        }).join('');

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
                notes = backup.notes || [];
                
                saveData(); // Speichert die wiederhergestellten Daten in localStorage und aktualisiert das Backup
                applyDateFilter();
                renderNotesList();
                resetNoteForm();
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

async function clearApiCache() {
    const confirmed = await showCustomPrompt({
        title: 'API Cache leeren',
        text: 'Dies löscht alle zwischengespeicherten Marktdaten. Die App wird sie beim nächsten Mal neu laden. Fortfahren?',
        actions: [{ text: 'Abbrechen' }, { text: 'Cache leeren', class: 'btn-warning', value: true }]
    });

    if (confirmed) {
        if ('serviceWorker' in navigator) {
            // VERBESSERT: .ready wartet, bis der SW aktiv ist, anstatt .controller sofort zu prüfen.
            // Das verhindert Race Conditions nach dem Neuladen der Seite.
            navigator.serviceWorker.ready.then(registration => {
                if (registration.active) {
                    registration.active.postMessage({ action: 'clearApiCache' });
                } else {
                    showNotification('Service Worker ist nicht aktiv. Bitte laden Sie die Seite neu.', 'error');
                }
            }).catch(error => {
                console.error('Fehler beim Zugriff auf den Service Worker:', error);
                showNotification('Fehler beim Zugriff auf den Service Worker.', 'error');
            });
        } else {
            showNotification('Service Worker wird von diesem Browser nicht unterstützt.', 'error');
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

        /* --- NEUE STILE FÜR PROGNOSE-WIDGET --- */
        .forecast-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 10px;
        }
        .forecast-title {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 10px;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            margin-bottom: 0;
        }
        .forecast-subtitle {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.5;
        }
        .forecast-controls {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }
        .time-selector {
            display: flex;
            background: var(--background-alt);
            border-radius: 12px;
            padding: 4px;
            border: 1px solid var(--border);
        }
        .time-btn {
            padding: 6px 12px;
            border: none;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            color: var(--text-secondary);
            transition: all 0.2s;
        }
        .time-btn.active {
            background: var(--primary);
            color: white;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }
        .scenario-toggle {
            background: var(--primary-dark);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .scenario-toggle:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .forecast-chart-container {
            height: 350px;
            margin-bottom: 24px;
            position: relative;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            padding: 24px;
        }
        .dark-mode .forecast-chart-container {
            background: rgba(30, 41, 59, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .forecast-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .metric-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .dark-mode .metric-card {
            background: rgba(31, 41, 55, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .metric-card::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--primary);
        }
        .metric-card.success::before { background: var(--success); }
        .metric-card.warning::before { background: var(--warning); }
        .metric-card.danger::before { background: var(--danger); }
        .metric-icon { font-size: 28px; margin-bottom: 8px; display: block; }
        .metric-value { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .metric-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; }
        
        .scenario-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
        }
        .scenario-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .dark-mode .scenario-card {
            background: rgba(31, 41, 55, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .scenario-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
        .scenario-card.conservative::before { background: var(--danger); }
        .scenario-card.realistic::before { background: var(--primary); }
        .scenario-card.optimistic::before { background: var(--success); }
        .scenario-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .scenario-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; }
        .conservative .scenario-icon { background: var(--danger); }
        .realistic .scenario-icon { background: var(--primary); }
        .optimistic .scenario-icon { background: var(--success); }
        .scenario-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
        .scenario-subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
        .scenario-value { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
        .conservative .scenario-value { color: var(--danger); }
        .realistic .scenario-value { color: var(--primary); }
        .optimistic .scenario-value { color: var(--success); }

        .scenario-details {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
        }
        .probability-bar {
            width: 100%;
            height: 6px;
            background: var(--background-alt);
            border-radius: 3px;
            overflow: hidden;
            margin: 12px 0;
        }
        .probability-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 1s ease-in-out;
        }
        .conservative .probability-fill { background: var(--danger); width: 25%; }
        .realistic .probability-fill { background: var(--primary); width: 50%; }
        .optimistic .probability-fill { background: var(--success); width: 25%; }
        .disclaimer {
            background: rgba(245, 158, 11, 0.08);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 12px;
            padding: 16px;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin-top: 24px;
        }
        .disclaimer-icon { color: var(--warning); margin-right: 8px; }

        @media (max-width: 768px) {
            .forecast-header { flex-direction: column; align-items: stretch; }
            .forecast-controls { justify-content: center; }
            .forecast-chart-container { height: 300px; }
            .forecast-metrics { grid-template-columns: 1fr 1fr; }
            .scenario-cards { grid-template-columns: 1fr; }
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #forecastWidget { animation: slideUp 0.6s ease-out; }
        .metric-card, .scenario-card {
            animation: slideUp 0.6s ease-out;
            animation-fill-mode: both;
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
            
            /* Hide platforms tab on mobile */
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
        
        /* Hide settings tab from main menu as it's in the dropdown */
        .tab-btn[onclick="switchTab('settings')"],
        .tab-btn[data-tab="settings"]
        {
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
        { title: 'Plattformen', icon: '💼', category: 'Navigation', type: 'action', action: () => switchTab('platforms'), tags: ['platform', 'übersicht', 'details'] },
        { title: 'Historie', icon: '📜', category: 'Navigation', type: 'action', action: () => switchTab('history'), tags: ['history', 'past', 'records'] },
        { title: 'Notizbuch', icon: '🗒️', category: 'Navigation', type: 'action', action: () => switchTab('notes'), tags: ['notes', 'journal', 'ideen'] },
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

    // 5. Notizen durchsuchen (Titel, Inhalt, Dateinamen)
    notes.forEach(note => {
        const noteText = `${note.title || ''} ${note.content || ''}`.toLowerCase();
        const attachmentMatch = (note.attachments || []).some(att => (att.name || '').toLowerCase().includes(lowerTerm));
        if (noteText.includes(lowerTerm) || attachmentMatch) {
            const id = `note-${note.id}`;
            if (!addedIds.has(id)) {
                const relevance = globalSearchEngine.calculateRelevance({
                    title: note.title || 'Notiz',
                    subtitle: note.content || '',
                    category: 'Notizen',
                    tags: (note.attachments || []).map(att => att.name || '')
                }, term);

                results.push({
                    title: note.title?.trim() || 'Notiz',
                    subtitle: formatNoteTimestamp(note) || 'Notiz',
                    icon: '🗒️',
                    category: 'Notizen',
                    type: 'note',
                    relevance: relevance || 4,
                    action: () => {
                        switchTab('notes');
                        setTimeout(() => {
                            noteSearchTerm = term;
                            const searchInput = document.getElementById('notesSearchInput');
                            if (searchInput) {
                                searchInput.value = term;
                            }
                            renderNotesList();
                            highlightNoteCard(note.id);
                        }, 150);
                    }
                });
                addedIds.add(id);
            }
        }
    });

    // 6. Cashflows nach Typ durchsuchen
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

    // 7. Nach Datum suchen (Format DD.MM.YYYY oder YYYY-MM-DD)
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

    // 8. Tages-Strategien durchsuchen (gruppiert)
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
        
        // Mobile nav anzeigen
        const mobileNav = document.querySelector('.mobile-bottom-nav');
        if (mobileNav) {
            mobileNav.style.display = 'flex';
        } else {
            console.warn('Mobile navigation not found');
        }
        
        // Sync mit aktivem Tab
        const activeTab = document.querySelector(".tab-btn.active");
        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/switchTab\('(.+?)'\)/);
                if (match) {
                    const tabName = match[1];
                    document.querySelectorAll(".mobile-nav-item").forEach(btn => {
                        btn.classList.toggle("active", btn.dataset.tab === tabName);
                    });
                }
            }
        }
        
        // Theme Icon initialisieren
        updateThemeIcon();
        
        // Ensure functions are globally available
        window.openMobileMenu = openMobileMenu;
    } else {
        // Hide mobile nav on desktop
        const mobileNav = document.querySelector('.mobile-bottom-nav');
        if (mobileNav) {
            mobileNav.style.display = 'none';
        }
        document.body.classList.remove("has-mobile-nav");
    }
}

function openMobileMenu() {
    const cloudIconEl = document.getElementById('cloudIcon');
    const cloudTextEl = document.getElementById('cloudText');
    const cloudStatusEl = document.getElementById('cloudStatusIndicator');
    const cloudIcon = cloudIconEl ? cloudIconEl.textContent.trim() : '🔌';
    const cloudText = cloudTextEl ? cloudTextEl.textContent.trim() : 'Offline';
    const cloudStatusClass = cloudStatusEl
        ? cloudStatusEl.className.split(' ').filter(cls => cls !== 'status-indicator').join(' ')
        : 'disconnected';

    const filterBadgeEl = document.getElementById('activeFilterBadge');
    const filterBadge = filterBadgeEl && filterBadgeEl.style.display !== 'none'
        ? filterBadgeEl.textContent.trim()
        : '';

    const isPrivacyMode = document.body.classList.contains('privacy-mode');
    const isCompactMode = document.body.classList.contains('compact-mode');
    const biometricEnabled = localStorage.getItem(`${STORAGE_PREFIX}biometricEnabled`) === 'true';
    const themeLabel = currentTheme === 'light' ? 'Dark Mode aktivieren' : 'Light Mode aktivieren';

    const contentHtml = `
        <div class="mobile-menu">
            <div class="mobile-menu-section">
                <h3 class="mobile-menu-title">Cloud & Filter</h3>
                <button class="dropdown-item-flex mobile-menu-item" onclick="openCloudSettings(); closeBottomSheet();">
                    <span class="item-icon">${cloudIcon}</span>
                    <span class="item-text">${cloudText}</span>
                    <span class="status-indicator ${cloudStatusClass}"></span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="syncNow(); closeBottomSheet();">
                    <span class="item-icon">☁️</span>
                    <span class="item-text">Cloud Sync starten</span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="openDateFilterModal(); closeBottomSheet();">
                    <span class="item-icon">🗓️</span>
                    <span class="item-text">Zeitraum filtern</span>
                    ${filterBadge ? `<span class="status-indicator-badge mobile-menu-badge">${filterBadge}</span>` : ''}
                </button>
            </div>
            <div class="mobile-menu-section">
                <h3 class="mobile-menu-title">Navigation</h3>
                <button class="dropdown-item-flex mobile-menu-item" onclick="switchTab('cashflow'); closeBottomSheet();">
                    <span class="item-icon">💸</span>
                    <span class="item-text">Cashflow verwalten</span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="switchTab('settings'); closeBottomSheet();">
                    <span class="item-icon">⚙️</span>
                    <span class="item-text">Einstellungen</span>
                </button>
            </div>
            <div class="mobile-menu-section">
                <h3 class="mobile-menu-title">Darstellung</h3>
                <button class="dropdown-item-flex mobile-menu-item" onclick="toggleTheme(); updateThemeIcon(); closeBottomSheet();">
                    <span class="item-icon">${currentTheme === 'light' ? '🌙' : '☀️'}</span>
                    <span class="item-text">${themeLabel}</span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="togglePrivacyMode(); closeBottomSheet();">
                    <span class="item-icon">👁️</span>
                    <span class="item-text">${isPrivacyMode ? 'Privatsphäre deaktivieren' : 'Privatsphäre aktivieren'}</span>
                    <span class="mobile-menu-toggle ${isPrivacyMode ? 'active' : ''}">${isPrivacyMode ? 'AN' : 'AUS'}</span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="toggleCompactMode(); closeBottomSheet();">
                    <span class="item-icon">📱</span>
                    <span class="item-text">${isCompactMode ? 'Kompaktmodus deaktivieren' : 'Kompaktmodus aktivieren'}</span>
                    <span class="mobile-menu-toggle ${isCompactMode ? 'active' : ''}">${isCompactMode ? 'AN' : 'AUS'}</span>
                </button>
                <button class="dropdown-item-flex mobile-menu-item" onclick="toggleBiometric(); closeBottomSheet();">
                    <span class="item-icon">🔐</span>
                    <span class="item-text">${biometricEnabled ? 'Bio Auth deaktivieren' : 'Bio Auth aktivieren'}</span>
                    <span class="mobile-menu-toggle ${biometricEnabled ? 'active' : ''}">${biometricEnabled ? 'AN' : 'AUS'}</span>
                </button>
            </div>
            <div class="mobile-menu-section">
                <h3 class="mobile-menu-title">Export</h3>
                <div class="mobile-menu-grid">
                    <button class="mobile-menu-action" onclick="exportPDF(); closeBottomSheet();">📄 PDF Export</button>
                    <button class="mobile-menu-action" onclick="exportJSON(); closeBottomSheet();">💾 JSON Backup</button>
                    <button class="mobile-menu-action" onclick="exportCSV(); closeBottomSheet();">📊 CSV Export</button>
                </div>
            </div>
        </div>
    `;
    openBottomSheet(contentHtml);
}

// Theme Icon Update
function updateThemeIcon() {
    const themeIcon = document.querySelector('.mobile-nav-item .theme-icon');
    if (themeIcon) {
        themeIcon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
    }
}

// Make mobile menu functions globally available
window.openMobileMenu = openMobileMenu;
window.updateThemeIcon = updateThemeIcon;
window.openNoteDetail = openNoteDetail;

// =================================================================================
// UI/UX ENHANCEMENT FUNCTIONS (Implementation)
// =================================================================================

function setupSwipeNavigation() {
    const mainContainer = document.querySelector('.container');
    let touchStartX = 0;
    let touchEndX = 0;

    mainContainer.addEventListener('touchstart', e => {
        // Ignore swipes on interactive elements
        if (e.target.closest('button, a, input, select, textarea, .chart-container, .data-table-wrapper, .bottom-sheet-content')) {
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mainContainer.addEventListener('touchend', e => {
        if (e.target.closest('button, a, input, select, textarea, .chart-container, .data-table-wrapper, .bottom-sheet-content')) {
            return;
        }
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
}

function improveKeyboardNavigation() {
    // Diese Funktion wird absichtlich leer gelassen, da die "Enter"-Logik
    // in `addPlatformInput` bereits das vom Benutzer gewünschte Verhalten
    // (Speichern und zum nächsten Feld springen) implementiert.
}

function addAriaLabels() {
    document.querySelectorAll('button, .btn').forEach(btn => {
        if (!btn.getAttribute('aria-label') && btn.title) {
            btn.setAttribute('aria-label', btn.title);
        } else if (!btn.getAttribute('aria-label')) {
            const text = btn.textContent.trim().replace(/\s+/g, ' ');
            if (text) btn.setAttribute('aria-label', text);
        }
    });

    document.querySelectorAll('input').forEach(input => {
        if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
            const label = input.closest('div, label')?.querySelector('label, .setting-label, .platform-name');
            if (label) {
                if (!label.id) label.id = `label-${Math.random().toString(36).substr(2, 9)}`;
                input.setAttribute('aria-labelledby', label.id);
            }
        }
    });

    updateEntrySummary();
}

function convertTablesToMobile() {
    if (window.innerWidth > 768) return;

    document.querySelectorAll('.data-table').forEach(table => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        if (headers.length === 0) return;

        table.querySelectorAll('tbody tr').forEach(tr => {
            tr.querySelectorAll('td').forEach((td, index) => {
                if (headers[index]) {
                    td.setAttribute('data-label', headers[index]);
                }
            });
        });
    });
}

function validateInput(input) {
    const value = input.value;
    const type = input.dataset.validateType;

    const existingError = input.parentElement.querySelector('.input-error-message');
    if (existingError) existingError.remove();

    let isValid = true;
    let errorMessage = '';

    if (type === 'number') {
        const parsed = parseLocaleNumberString(value);
        if (value && (isNaN(parsed) || parsed < 0)) {
            isValid = false;
            errorMessage = 'Bitte eine positive Zahl eingeben.';
        }
    }

    if (!isValid) {
        input.classList.add('input-error');
        input.classList.remove('input-success');
        const error = document.createElement('span');
        error.className = 'input-error-message';
        error.textContent = errorMessage;
        input.parentElement.appendChild(error);
    } else {
        input.classList.remove('input-error');
        if (value) {
            input.classList.add('input-success');
        } else {
            input.classList.remove('input-success');
        }
    }
    return isValid;
}

function enableBatchSelection() {
    const container = document.getElementById('platformGrid');
    if (!container) return;

    let isSelecting = false;
    let batchSelectedPlatforms = new Set();
    let longPressTimer;

    const startSelection = (e) => {
        const platformBtn = e.target.closest('.platform-btn');
        if (!platformBtn || platformBtn.textContent.includes('Andere')) return;
        
        isSelecting = true;
        container.classList.add('selection-mode');
        if (navigator.vibrate) navigator.vibrate(50);
        updateBatchActionBar(batchSelectedPlatforms);
    };

    container.addEventListener('touchstart', e => {
        longPressTimer = setTimeout(() => startSelection(e), 500);
    }, { passive: true });

    const clearLongPress = () => clearTimeout(longPressTimer);
    container.addEventListener('touchend', clearLongPress);
    container.addEventListener('touchmove', clearLongPress);

    container.addEventListener('click', e => {
        if (!isSelecting) return;
        e.preventDefault();
        e.stopPropagation();

        const platformBtn = e.target.closest('.platform-btn');
        if (!platformBtn) return;

        platformBtn.classList.toggle('batch-selected');
        const name = platformBtn.dataset.platform;

        if (batchSelectedPlatforms.has(name)) {
            batchSelectedPlatforms.delete(name);
        } else {
            batchSelectedPlatforms.add(name);
        }
        updateBatchActionBar(batchSelectedPlatforms);
    });

    window.addSelectedPlatforms = () => {
        batchSelectedPlatforms.forEach(name => {
            const btn = document.querySelector(`.platform-btn[data-platform="${name}"]`);
            if (btn && !btn.classList.contains('selected')) {
                togglePlatform(btn, name);
            }
        });
        cancelBatchSelection();
    };

    window.cancelBatchSelection = () => {
        isSelecting = false;
        container.classList.remove('selection-mode');
        container.querySelectorAll('.batch-selected').forEach(el => el.classList.remove('batch-selected'));
        batchSelectedPlatforms.clear();
        updateBatchActionBar(batchSelectedPlatforms);
    };
}

function updateBatchActionBar(selected) {
    let bar = document.getElementById('batchActionBar');
    if (!bar) return;

    if (selected.size === 0) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = `
        <span>${selected.size} ausgewählt</span>
        <div>
            <button class="btn btn-primary btn-small" onclick="addSelectedPlatforms()">Hinzufügen</button>
            <button class="btn btn-small" onclick="cancelBatchSelection()">Abbrechen</button>
        </div>
    `;
}

function improveKeyboardNavigation() {
    document.body.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('.input-field, .note-input')) {
            const form = e.target.closest('form, .section');
            if (!form) return;

            const focusable = Array.from(form.querySelectorAll('input, select, button, textarea')).filter(el => !el.disabled && el.offsetParent !== null);
            const index = focusable.indexOf(e.target);

            if (index > -1 && (index < focusable.length - 1)) {
                e.preventDefault();
                const nextElement = focusable[index + 1];
                nextElement.focus();
                if (typeof nextElement.select === 'function') {
                    nextElement.select();
                }
            }
        }
    });
}

function enableBatchSelection() {
    const container = document.getElementById('platformGrid');
    if (!container) return;

    let isSelecting = false;
    let batchSelectedPlatforms = new Set();

    container.addEventListener('touchstart', e => {
        const timer = setTimeout(() => {
            isSelecting = true;
            container.classList.add('selection-mode');
            if (navigator.vibrate) navigator.vibrate(50);
            updateBatchActionBar(batchSelectedPlatforms);
        }, 500);

        const clearTimer = () => clearTimeout(timer);
        container.addEventListener('touchend', clearTimer, { once: true });
        container.addEventListener('touchmove', clearTimer, { once: true });
    });

    container.addEventListener('click', e => {
        if (!isSelecting) return;
        e.preventDefault();
        e.stopPropagation();

        const platformBtn = e.target.closest('.platform-btn');
        if (!platformBtn) return;

        platformBtn.classList.toggle('batch-selected');
        const name = platformBtn.dataset.platform;

        if (batchSelectedPlatforms.has(name)) {
            batchSelectedPlatforms.delete(name);
        } else {
            batchSelectedPlatforms.add(name);
        }
        updateBatchActionBar(batchSelectedPlatforms);
    });

    window.addSelectedPlatforms = () => {
        batchSelectedPlatforms.forEach(name => {
            const btn = document.querySelector(`.platform-btn[data-platform="${name}"]`);
            if (btn && !btn.classList.contains('selected')) {
                togglePlatform(btn, name);
            }
        });
        cancelBatchSelection();
    };

    window.cancelBatchSelection = () => {
        isSelecting = false;
        container.classList.remove('selection-mode');
        container.querySelectorAll('.batch-selected').forEach(el => el.classList.remove('batch-selected'));
        batchSelectedPlatforms.clear();
        updateBatchActionBar(batchSelectedPlatforms);
    };
}

function updateBatchActionBar(selected) {
    let bar = document.getElementById('batchActionBar');
    if (!bar) return;

    if (selected.size === 0) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = `
        <span>${selected.size} ausgewählt</span>
        <div>
            <button class="btn btn-primary btn-small" onclick="addSelectedPlatforms()">Hinzufügen</button>
            <button class="btn btn-small" onclick="cancelBatchSelection()">Abbrechen</button>
        </div>
    `;
}

function addAriaLabels() {
    document.querySelectorAll('button, .btn').forEach(btn => {
        if (!btn.getAttribute('aria-label') && !btn.getAttribute('title')) {
            const text = btn.textContent.trim().replace(/\s+/g, ' ');
            if (text) btn.setAttribute('aria-label', text);
        } else if (btn.getAttribute('title')) {
            btn.setAttribute('aria-label', btn.getAttribute('title'));
        }
    });

    document.querySelectorAll('input').forEach(input => {
        if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
            const label = input.closest('div, label')?.querySelector('label, .setting-label, .platform-name');
            if (label) {
                if (!label.id) label.id = `label-${Math.random().toString(36).substr(2, 9)}`;
                input.setAttribute('aria-labelledby', label.id);
            }
        }
    });
}

function cleanupLocalStorage() {
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        allKeys.push(localStorage.key(i));
    }
    
    const keysToRemove = allKeys.filter(key => key && (
        !key.startsWith(STORAGE_PREFIX) && 
        !key.includes('theme') &&
        !key.includes('biometric') &&
        !key.includes('auth') &&
        (key.includes('_v10_') || key.includes('portfolio_') || key.startsWith('w3pt_') && !key.startsWith(STORAGE_PREFIX))
    ));
    
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Could not remove key:', key);
        }
    });
    
    showNotification(`🧹 ${keysToRemove.length} alte Keys entfernt! Speicher bereinigt.`, 'success');
    console.log(`Cleaned up ${keysToRemove.length} old keys:`, keysToRemove);
    return keysToRemove.length;
}

// Debug function to test loadLastEntries manually
function debugLoadLastEntries() {
    console.log('🔍 DEBUG: Starting manual loadLastEntries test...');
    console.log(`Total entries: ${entries.length}`);
    if (entries.length > 0) {
        const sortedDates = [...new Set(entries.map(e => e.date))].sort((a, b) => new Date(b) - new Date(a));
        console.log(`Available dates:`, sortedDates.slice(0, 5));
        loadLastEntries();
    } else {
        console.log('No entries available');
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
