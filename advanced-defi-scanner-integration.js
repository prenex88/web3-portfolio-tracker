// =================================================================================
// ADVANCED DEFI SCANNER WITH REAL APIS - Integration für GO LIVE 1.1.HTML
// =================================================================================
// Diesen Code in deine GO LIVE HTML einfügen, NACH dem bestehenden Code
// Ersetzt die Dummy-Funktionen mit echten API Calls!

// =================================================================================
// REAL API CONFIGURATION
// =================================================================================
const REAL_DEFI_APIS = {
    defiLlama: {
        yields: 'https://yields.llama.fi/pools',
        protocols: 'https://api.llama.fi/protocols',
        chains: 'https://api.llama.fi/v2/chains',
        tvl: 'https://api.llama.fi/v2/historicalChainTvl',
        stablecoins: 'https://stablecoins.llama.fi/stablecoins',
        volumes: 'https://api.llama.fi/overview/dexs',
        fees: 'https://api.llama.fi/overview/fees'
    },
    
    // CORS Proxy für Browser (falls nötig)
    proxy: '', // Leer lassen, DefiLlama hat CORS erlaubt!
    
    // Cache Einstellungen
    cache: {
        yields: 5 * 60 * 1000,      // 5 Minuten
        protocols: 60 * 60 * 1000,  // 1 Stunde
        chains: 24 * 60 * 60 * 1000 // 1 Tag
    }
};

// Globale Variablen für DeFi Scanner
let realYieldPools = [];
let realProtocolData = [];
let realChainData = [];
let defiScannerCache = new Map();

// =================================================================================
// ERSETZE DIE DUMMY startDefiScan FUNKTION
// =================================================================================
async function startDefiScan() {
    const scanBtn = document.getElementById('scanBtn');
    if (!scanBtn) return;
    
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="spinner"></span><span>Scanning Real Data...</span>';
    
    try {
        showNotification('Fetching real DeFi data from DefiLlama...', 'warning');
        
        // Parallel fetch für bessere Performance
        const [yieldsData, protocolsData, chainsData] = await Promise.all([
            fetchRealYieldData(),
            fetchRealProtocolData(),
            fetchRealChainData()
        ]);
        
        // Process und merge data
        const processedData = processRealDefiData(yieldsData, protocolsData, chainsData);
        
        // Generate real insights
        const alerts = generateRealAlerts(processedData);
        
        // Update UI mit echten Daten
        updateScannerResults(processedData.pools);
        updateAlerts(alerts);
        updateScannerStats(processedData.pools, alerts);
        
        // Cache für offline
        saveToLocalCache('defiScanData', processedData);
        
        showNotification(`Scan complete! Found ${processedData.pools.length} yield opportunities`, 'success');
        
    } catch (error) {
        console.error('DeFi scan error:', error);
        showNotification('Error fetching data - trying cache...', 'error');
        loadFromLocalCache();
    } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<span>🚀</span><span>Scan Now</span>';
    }
}

// =================================================================================
// REAL DATA FETCHING FUNCTIONS
// =================================================================================

async function fetchRealYieldData() {
    const cacheKey = 'yields_data';
    const cached = getCachedData(cacheKey, REAL_DEFI_APIS.cache.yields);
    if (cached) return cached;
    
    try {
        console.log('Fetching yields from DefiLlama...');
        const response = await fetch(REAL_DEFI_APIS.defiLlama.yields);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log(`Fetched ${data.data.length} pools`);
        
        setCachedData(cacheKey, data.data);
        return data.data;
        
    } catch (error) {
        console.error('Yield fetch error:', error);
        // Try fallback
        return getCachedData(cacheKey, Infinity) || [];
    }
}

async function fetchRealProtocolData() {
    const cacheKey = 'protocols_data';
    const cached = getCachedData(cacheKey, REAL_DEFI_APIS.cache.protocols);
    if (cached) return cached;
    
    try {
        console.log('Fetching protocol data...');
        const response = await fetch(REAL_DEFI_APIS.defiLlama.protocols);
        const data = await response.json();
        
        setCachedData(cacheKey, data);
        return data;
        
    } catch (error) {
        console.error('Protocol fetch error:', error);
        return getCachedData(cacheKey, Infinity) || [];
    }
}

async function fetchRealChainData() {
    const cacheKey = 'chains_data';
    const cached = getCachedData(cacheKey, REAL_DEFI_APIS.cache.chains);
    if (cached) return cached;
    
    try {
        const response = await fetch(REAL_DEFI_APIS.defiLlama.chains);
        const data = await response.json();
        
        setCachedData(cacheKey, data);
        return data;
        
    } catch (error) {
        console.error('Chain fetch error:', error);
        return getCachedData(cacheKey, Infinity) || [];
    }
}

// =================================================================================
// PROCESS REAL DEFI DATA
// =================================================================================

function processRealDefiData(yields, protocols, chains) {
    // Create protocol map for quick lookup
    const protocolMap = new Map();
    protocols.forEach(p => {
        protocolMap.set(p.slug?.toLowerCase(), p);
        protocolMap.set(p.name?.toLowerCase(), p);
    });
    
    // Process yield pools with real risk scoring
    const processedPools = yields
        .filter(pool => {
            // Filter valid pools
            return pool.apy > 0 && 
                   pool.tvlUsd > 100000 && // Min $100k TVL
                   pool.project !== null;
        })
        .map(pool => {
            // Get protocol info
            const protocol = protocolMap.get(pool.project?.toLowerCase());
            
            // Calculate real risk score
            const riskScore = calculateRealRiskScore(pool, protocol);
            
            // Estimate gas costs
            const gasCost = estimateRealGasCost(pool.chain);
            
            return {
                // Pool basic info
                id: pool.pool || `${pool.project}-${pool.symbol}`,
                name: pool.project,
                symbol: pool.symbol,
                chain: pool.chain,
                
                // Yields
                apy: pool.apy || 0,
                apyBase: pool.apyBase || 0,
                apyReward: pool.apyReward || 0,
                apyMean7d: pool.apyMean7d,
                apyMean30d: pool.apyMean30d,
                
                // TVL & Volume
                tvl: pool.tvlUsd || 0,
                volumeUsd1d: pool.volumeUsd1d,
                volumeUsd7d: pool.volumeUsd7d,
                
                // Risk metrics
                ilRisk: pool.ilRisk,
                exposure: pool.exposure,
                stablecoin: pool.stablecoin,
                riskScore: riskScore,
                
                // Protocol info
                category: protocol?.category || pool.poolMeta,
                audits: protocol?.audits ? 'Yes' : 'No',
                twitter: protocol?.twitter,
                listedAt: protocol?.listedAt,
                tvlChange7d: protocol?.change_7d,
                
                // Additional
                rewardTokens: pool.rewardTokens || [],
                underlyingTokens: pool.underlyingTokens || [],
                url: pool.url,
                gasCost: gasCost,
                
                // Calculated metrics
                realAPY: pool.apy - (gasCost * 12 / 1000 * 100), // Assuming $1000 investment
                confidence: pool.apyMean30d ? 'High' : 'Medium'
            };
        })
        .sort((a, b) => {
            // Sort by risk-adjusted APY
            const aScore = a.apy / (a.riskScore || 5);
            const bScore = b.apy / (b.riskScore || 5);
            return bScore - aScore;
        });
    
    // Get top protocols by TVL
    const topProtocols = protocols
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 100);
    
    return {
        pools: processedPools,
        protocols: topProtocols,
        chains: chains,
        timestamp: Date.now()
    };
}

function calculateRealRiskScore(pool, protocol) {
    let score = 5; // Base score
    
    // TVL Risk
    if (pool.tvlUsd < 1000000) score += 3;
    else if (pool.tvlUsd < 10000000) score += 1;
    else if (pool.tvlUsd > 100000000) score -= 2;
    else if (pool.tvlUsd > 1000000000) score -= 3;
    
    // IL Risk
    if (pool.ilRisk === 'YES') score += 2;
    else if (pool.ilRisk === 'NO') score -= 1;
    
    // Stablecoin = Lower risk
    if (pool.stablecoin) score -= 2;
    
    // Pool type risk
    if (pool.exposure === 'MULTI') score += 1;
    if (pool.exposure === 'SINGLE') score -= 1;
    
    // Protocol age (if available)
    if (protocol?.listedAt) {
        const ageInDays = (Date.now() - protocol.listedAt * 1000) / (1000 * 60 * 60 * 24);
        if (ageInDays < 30) score += 3;  // Very new
        else if (ageInDays < 90) score += 1;
        else if (ageInDays > 365) score -= 1;  // Established
    }
    
    // Audit status
    if (!protocol?.audits) score += 1;
    
    // APY suspiciously high?
    if (pool.apy > 100) score += 2;
    else if (pool.apy > 50) score += 1;
    
    // Clamp between 1-10
    return Math.max(1, Math.min(10, Math.round(score)));
}

function estimateRealGasCost(chain) {
    // Real gas cost estimates in USD
    const gasCosts = {
        'Ethereum': 30,
        'Arbitrum': 1,
        'Arbitrum Nova': 0.5,
        'Optimism': 1,
        'Base': 1,
        'Polygon': 0.1,
        'Polygon zkEVM': 0.5,
        'BSC': 0.5,
        'Gnosis': 0.1,
        'Avalanche': 2,
        'Fantom': 0.1,
        'Klaytn': 0.1,
        'Aurora': 0.1,
        'Celo': 0.1,
        'Harmony': 0.01,
        'Moonriver': 0.1,
        'Moonbeam': 0.5,
        'Metis': 0.5,
        'Cronos': 0.5,
        'zkSync Era': 0.5,
        'Linea': 1,
        'Scroll': 1,
        'Manta': 0.5
    };
    
    return gasCosts[chain] || 5; // Default $5 if unknown
}

// =================================================================================
// GENERATE REAL ALERTS
// =================================================================================

function generateRealAlerts(data) {
    const alerts = [];
    
    // High APY opportunities
    const highAPY = data.pools.filter(p => p.apy > 50 && p.riskScore <= 6);
    highAPY.forEach(pool => {
        alerts.push({
            id: `apy-${pool.id}`,
            type: 'opportunity',
            severity: 'medium',
            protocol: pool.name,
            message: `High APY opportunity: ${pool.apy.toFixed(2)}% on ${pool.chain}`,
            data: pool
        });
    });
    
    // Low risk stable opportunities
    const stableYields = data.pools.filter(p => p.stablecoin && p.apy > 8 && p.riskScore <= 4);
    stableYields.forEach(pool => {
        alerts.push({
            id: `stable-${pool.id}`,
            type: 'stable_yield',
            severity: 'low',
            protocol: pool.name,
            message: `Stable yield: ${pool.apy.toFixed(2)}% with low risk`,
            data: pool
        });
    });
    
    // New protocol alerts
    const newProtocols = data.pools.filter(pool => {
        const protocol = data.protocols.find(p => p.name === pool.name);
        if (protocol?.listedAt) {
            const ageInDays = (Date.now() - protocol.listedAt * 1000) / (1000 * 60 * 60 * 24);
            return ageInDays < 7; // Less than a week old
        }
        return false;
    });
    
    newProtocols.forEach(pool => {
        alerts.push({
            id: `new-${pool.id}`,
            type: 'new_protocol',
            severity: 'high',
            protocol: pool.name,
            message: `New protocol detected - Higher risk!`,
            data: pool
        });
    });
    
    // IL Risk warnings for high TVL pools
    const ilRiskPools = data.pools.filter(p => p.ilRisk === 'YES' && p.tvl > 10000000);
    if (ilRiskPools.length > 0) {
        alerts.push({
            id: 'il-warning',
            type: 'risk_warning',
            severity: 'medium',
            protocol: 'Multiple',
            message: `${ilRiskPools.length} high-TVL pools have IL risk`,
            data: ilRiskPools
        });
    }
    
    return alerts;
}

// =================================================================================
// UPDATE SCANNER UI WITH REAL DATA
// =================================================================================

function updateScannerResults(pools) {
    const tbody = document.getElementById('defiScannerResults');
    if (!tbody) return;
    
    // Show top 100 pools
    const topPools = pools.slice(0, 100);
    
    tbody.innerHTML = topPools.map(pool => {
        const riskClass = pool.riskScore <= 3 ? 'low' : 
                         pool.riskScore <= 6 ? 'medium' : 'high';
        
        const apyColor = pool.apy > 20 ? '#10b981' : 
                        pool.apy > 10 ? '#f59e0b' : '#6b7280';
        
        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="https://icons.llama.fi/icons/protocols/${pool.name.toLowerCase()}.png" 
                             style="width:24px; height:24px; border-radius:50%;" 
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%23667eea%22/></svg>'">
                        <span style="font-weight:600;">${pool.name}</span>
                    </div>
                </td>
                <td><span class="tag-badge">${pool.chain}</span></td>
                <td>$${formatTVL(pool.tvl)}</td>
                <td style="color: ${apyColor}; font-weight: 700; font-size: 16px;">
                    ${pool.apy.toFixed(2)}%
                    ${pool.apyBase > 0 ? `<br><small style="color:#6b7280">Base: ${pool.apyBase.toFixed(2)}%</small>` : ''}
                </td>
                <td><span class="risk-badge risk-${riskClass}">${pool.riskScore}/10</span></td>
                <td class="${pool.tvlChange7d >= 0 ? 'positive' : 'negative'}">
                    ${pool.tvlChange7d ? pool.tvlChange7d.toFixed(2) + '%' : 'N/A'}
                </td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="addPoolToStrategy('${pool.id}', ${pool.apy})">
                        Strategy
                    </button>
                    ${pool.url ? `<a href="${pool.url}" target="_blank" class="btn btn-small">View</a>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// =================================================================================
// ENHANCED STRATEGY FUNCTIONS WITH REAL DATA
// =================================================================================

async function scanOptimalYieldStrategies() {
    showNotification('Finding optimal strategies with real data...', 'warning');
    
    try {
        // Get fresh yield data
        const yields = await fetchRealYieldData();
        
        // Find best strategies
        const strategies = analyzeRealYieldStrategies(yields);
        
        // Update UI
        updateYieldOptimizerUI(strategies);
        
        showNotification(`Found ${strategies.length} optimal strategies!`, 'success');
        
    } catch (error) {
        console.error('Strategy scan error:', error);
        showNotification('Strategy scan failed', 'error');
    }
}

function analyzeRealYieldStrategies(yields) {
    const strategies = [];
    
    // 1. Best Stable Strategies (Low Risk)
    const stableStrategies = yields
        .filter(p => p.stablecoin && p.apy > 5 && p.tvlUsd > 1000000)
        .map(p => ({
            type: 'stable',
            protocol: p.project,
            chain: p.chain,
            apy: p.apy,
            tvl: p.tvlUsd,
            symbol: p.symbol,
            risk: calculateRealRiskScore(p),
            category: 'Low Risk Stable',
            recommendation: `Deposit ${p.symbol} for ${p.apy.toFixed(2)}% APY`
        }))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 5);
    
    strategies.push(...stableStrategies);
    
    // 2. Best ETH Strategies
    const ethStrategies = yields
        .filter(p => p.symbol?.includes('ETH') && !p.symbol.includes('WETH') && p.apy > 3)
        .map(p => ({
            type: 'eth',
            protocol: p.project,
            chain: p.chain,
            apy: p.apy,
            tvl: p.tvlUsd,
            symbol: p.symbol,
            risk: calculateRealRiskScore(p),
            category: 'ETH Yield',
            recommendation: `Stake ETH for ${p.apy.toFixed(2)}% APY on ${p.chain}`
        }))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 5);
    
    strategies.push(...ethStrategies);
    
    // 3. High APY Opportunities (Higher Risk)
    const highAPY = yields
        .filter(p => p.apy > 30 && p.tvlUsd > 500000)
        .map(p => ({
            type: 'high_yield',
            protocol: p.project,
            chain: p.chain,
            apy: p.apy,
            tvl: p.tvlUsd,
            symbol: p.symbol,
            risk: calculateRealRiskScore(p),
            category: 'High Risk/Reward',
            recommendation: `${p.apy.toFixed(2)}% APY - ${p.ilRisk === 'YES' ? 'WITH IL RISK' : 'No IL'}`
        }))
        .sort((a, b) => (b.apy / b.risk) - (a.apy / a.risk)) // Risk-adjusted
        .slice(0, 5);
    
    strategies.push(...highAPY);
    
    // 4. Best Looping Opportunities
    const lendingProtocols = ['Aave', 'Compound', 'Radiant', 'Benqi', 'Venus'];
    const loopingOps = yields
        .filter(p => lendingProtocols.some(lp => p.project?.includes(lp)) && p.apy > 2)
        .map(p => ({
            type: 'looping',
            protocol: p.project,
            chain: p.chain,
            apy: p.apy * 2.5, // Estimated with 2.5x leverage
            tvl: p.tvlUsd,
            symbol: p.symbol,
            risk: Math.min(10, calculateRealRiskScore(p) + 3), // Higher risk for leverage
            category: 'Leveraged/Looping',
            recommendation: `Loop ${p.symbol} for ~${(p.apy * 2.5).toFixed(2)}% APY (with leverage)`
        }))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 5);
    
    strategies.push(...loopingOps);
    
    return strategies;
}

// =================================================================================
// ARBITRAGE SCANNER WITH REAL DATA
// =================================================================================

async function scanArbitrageOpportunities() {
    showNotification('Scanning for real arbitrage opportunities...', 'warning');
    
    try {
        const yields = await fetchRealYieldData();
        
        // Find same assets across different chains/protocols
        const arbitrageOps = findRealArbitrageOpportunities(yields);
        
        updateArbitrageOpportunitiesUI(arbitrageOps);
        
        showNotification(`Found ${arbitrageOps.length} arbitrage opportunities!`, 'success');
        
    } catch (error) {
        console.error('Arbitrage scan error:', error);
        showNotification('Arbitrage scan failed', 'error');
    }
}

function findRealArbitrageOpportunities(yields) {
    const opportunities = [];
    
    // Group by similar tokens
    const tokenGroups = {};
    
    yields.forEach(pool => {
        // Normalize token names
        const baseToken = pool.symbol?.replace(/[-_]/, ' ').split(' ')[0];
        if (!baseToken) return;
        
        if (!tokenGroups[baseToken]) {
            tokenGroups[baseToken] = [];
        }
        tokenGroups[baseToken].push(pool);
    });
    
    // Find arbitrage within same token
    Object.entries(tokenGroups).forEach(([token, pools]) => {
        if (pools.length < 2) return;
        
        // Sort by APY
        pools.sort((a, b) => b.apy - a.apy);
        
        // Check if significant difference exists
        const best = pools[0];
        const worst = pools[pools.length - 1];
        
        if (best.apy - worst.apy > 3) { // More than 3% difference
            opportunities.push({
                token: token,
                highPool: {
                    protocol: best.project,
                    chain: best.chain,
                    apy: best.apy,
                    tvl: best.tvlUsd
                },
                lowPool: {
                    protocol: worst.project,
                    chain: worst.chain,
                    apy: worst.apy,
                    tvl: worst.tvlUsd
                },
                spread: best.apy - worst.apy,
                estimatedProfit: (best.apy - worst.apy) * 100, // On $10k
                risk: calculateRealRiskScore(best)
            });
        }
    });
    
    return opportunities.sort((a, b) => b.spread - a.spread).slice(0, 10);
}

// =================================================================================
// CACHE MANAGEMENT
// =================================================================================

function getCachedData(key, maxAge) {
    const cached = localStorage.getItem(`defi_cache_${key}`);
    if (!cached) return null;
    
    try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age > maxAge) {
            localStorage.removeItem(`defi_cache_${key}`);
            return null;
        }
        
        return data;
    } catch (e) {
        return null;
    }
}

function setCachedData(key, data) {
    try {
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(`defi_cache_${key}`, JSON.stringify(cacheData));
    } catch (e) {
        console.error('Cache write failed:', e);
        // Clear old cache if storage full
        clearOldCache();
    }
}

function clearOldCache() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('defi_cache_'));
    keys.forEach(key => {
        const cached = localStorage.getItem(key);
        if (cached) {
            try {
                const { timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp > 24 * 60 * 60 * 1000) { // Older than 1 day
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        }
    });
}

function saveToLocalCache(key, data) {
    try {
        localStorage.setItem(`defi_${key}`, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error('Failed to save to cache:', e);
    }
}

function loadFromLocalCache() {
    try {
        const cached = localStorage.getItem('defi_scanData');
        if (cached) {
            const { data } = JSON.parse(cached);
            updateScannerResults(data.pools || []);
            showNotification('Loaded from cache (offline mode)', 'warning');
        }
    } catch (e) {
        console.error('Failed to load from cache:', e);
    }
}

// =================================================================================
// UTILITY FUNCTIONS
// =================================================================================

function formatTVL(tvl) {
    if (tvl >= 1000000000) return (tvl / 1000000000).toFixed(2) + 'B';
    if (tvl >= 1000000) return (tvl / 1000000).toFixed(2) + 'M';
    if (tvl >= 1000) return (tvl / 1000).toFixed(2) + 'K';
    return tvl.toFixed(2);
}

function addPoolToStrategy(poolId, apy) {
    // Integration mit Portfolio Tracker
    showNotification(`Added to strategy calculator: ${apy.toFixed(2)}% APY`, 'success');
    
    // Hier kannst du die Integration mit deinem Portfolio Tracker machen
    // z.B. switchTab('entry') und dann die Plattform hinzufügen
}

// =================================================================================
// AUTO-REFRESH
// =================================================================================

// Refresh data every 5 minutes when on DeFi Scanner tab
let defiScannerInterval = null;

function startAutoRefresh() {
    if (defiScannerInterval) clearInterval(defiScannerInterval);
    
    defiScannerInterval = setInterval(() => {
        if (currentTab === 'defi-scanner') {
            console.log('Auto-refreshing DeFi data...');
            startDefiScan();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// =================================================================================
// INITIALIZATION
// =================================================================================

// Erweitere die bestehende DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Wenn DeFi Scanner Tab ausgewählt wird, lade Daten
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabName) {
        originalSwitchTab(tabName);
        
        if (tabName === 'defi-scanner' && realYieldPools.length === 0) {
            // Erste Ladung
            setTimeout(() => startDefiScan(), 500);
            startAutoRefresh();
        }
    };
});

console.log('✅ Advanced DeFi Scanner with REAL APIs loaded successfully!');
console.log('📊 Ready to fetch real yield data from DefiLlama');