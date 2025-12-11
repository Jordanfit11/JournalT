// Configuration
let config = {
    apiKey: '',
    sheetId: '',
    sheetName: 'Trades'
};

// Charger la configuration au démarrage
window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    setDefaultDateTime();
    setupImagePreview();
    setupForm();
    
    // Si la config existe, charger les données
    if (config.apiKey && config.sheetId) {
        loadStats();
        loadHistory();
    }
});

// Navigation
function showSection(sectionName) {
    // Cacher toutes les sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Afficher la section demandée
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    // Activer le bouton correspondant
    event.target.classList.add('active');
    
    // Charger les données si nécessaire
    if (sectionName === 'stats') {
        loadStats();
    } else if (sectionName === 'history') {
        loadHistory();
    }
}

// Configuration
function saveConfig() {
    const apiKey = document.getElementById('api-key').value.trim();
    const sheetId = document.getElementById('sheet-id').value.trim();
    
    if (!apiKey || !sheetId) {
        showConfigStatus('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    config.apiKey = apiKey;
    config.sheetId = sheetId;
    
    // Sauvegarder dans le localStorage
    localStorage.setItem('tradingJournalConfig', JSON.stringify(config));
    
    showConfigStatus('Configuration enregistrée avec succès !', 'success');
    
    // Initialiser la feuille Google Sheets
    initializeSheet();
}

function loadConfig() {
    const savedConfig = localStorage.getItem('tradingJournalConfig');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        document.getElementById('api-key').value = config.apiKey;
        document.getElementById('sheet-id').value = config.sheetId;
    }
}

function showConfigStatus(message, type) {
    const statusDiv = document.getElementById('config-status');
    statusDiv.textContent = message;
    statusDiv.className = type === 'success' ? 'status-success' : 'status-error';
}

async function testConnection() {
    if (!config.apiKey || !config.sheetId) {
        showConfigStatus('Veuillez d\'abord enregistrer la configuration', 'error');
        return;
    }
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}?key=${config.apiKey}`;
        const response = await fetch(url);
        
        if (response.ok) {
            showConfigStatus('✅ Connexion réussie ! Votre Google Sheet est accessible.', 'success');
        } else {
            showConfigStatus('❌ Erreur de connexion. Vérifiez votre clé API et l\'ID du Sheet.', 'error');
        }
    } catch (error) {
        showConfigStatus('❌ Erreur: ' + error.message, 'error');
    }
}

// Initialiser la feuille Google Sheets avec les en-têtes
async function initializeSheet() {
    const headers = [
        'Date/Heure', 'Actif', 'Direction', 'Taille Position', 'Prix Entrée', 
        'Prix Sortie', 'Stop Loss', 'Take Profit', 'P&L', 'Frais', 
        'Stratégie', 'Timeframe', 'Qualité Setup', 'Émotions', 
        'Notes', 'Erreurs', 'Screenshot'
    ];
    
    try {
        // Vérifier si la feuille a déjà des en-têtes
        const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.sheetName}!A1:Q1?key=${config.apiKey}`;
        const checkResponse = await fetch(checkUrl);
        const checkData = await checkResponse.json();
        
        // Si pas d'en-têtes, les ajouter
        if (!checkData.values || checkData.values.length === 0) {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.sheetName}!A1:Q1?valueInputOption=RAW&key=${config.apiKey}`;
            await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [headers]
                })
            });
        }
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
}

// Formulaire
function setDefaultDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('date').value = now.toISOString().slice(0, 16);
}

function setupImagePreview() {
    const fileInput = document.getElementById('screenshot');
    const preview = document.getElementById('image-preview');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    });
}

function setupForm() {
    document.getElementById('trade-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!config.apiKey || !config.sheetId) {
            alert('Veuillez d\'abord configurer Google Sheets dans la section Configuration');
            showSection('config');
            return;
        }
        
        await saveTrade();
    });
}

async function saveTrade() {
    // Récupérer les données du formulaire
    const date = document.getElementById('date').value;
    const asset = document.getElementById('asset').value;
    const direction = document.getElementById('direction').value;
    const positionSize = document.getElementById('position-size').value;
    const entryPrice = document.getElementById('entry-price').value;
    const exitPrice = document.getElementById('exit-price').value;
    const stopLoss = document.getElementById('stop-loss').value;
    const takeProfit = document.getElementById('take-profit').value;
    const pnl = document.getElementById('pnl').value;
    const fees = document.getElementById('fees').value;
    const strategy = document.getElementById('strategy').value;
    const timeframe = document.getElementById('timeframe').value;
    const setupQuality = document.querySelector('input[name="setup-quality"]:checked')?.value || '';
    const emotions = document.getElementById('emotions').value;
    const notes = document.getElementById('notes').value;
    const mistakes = document.getElementById('mistakes').value;
    
    // Gérer l'image
    let imageData = '';
    const fileInput = document.getElementById('screenshot');
    if (fileInput.files[0]) {
        imageData = await fileToBase64(fileInput.files[0]);
    }
    
    // Formater la date
    const formattedDate = new Date(date).toLocaleString('fr-FR');
    
    // Préparer les données
    const row = [
        formattedDate, asset, direction, positionSize, entryPrice,
        exitPrice, stopLoss, takeProfit, pnl, fees,
        strategy, timeframe, setupQuality, emotions,
        notes, mistakes, imageData ? 'Image disponible' : ''
    ];
    
    try {
        // Ajouter la ligne à Google Sheets
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.sheetName}!A:Q:append?valueInputOption=RAW&key=${config.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: [row]
            })
        });
        
        if (response.ok) {
            alert('✅ Trade enregistré avec succès !');
            resetForm();
            
            // Sauvegarder l'image séparément si nécessaire (dans localStorage pour l'instant)
            if (imageData) {
                const tradeId = Date.now();
                localStorage.setItem(`trade_img_${tradeId}`, imageData);
            }
        } else {
            alert('❌ Erreur lors de l\'enregistrement. Vérifiez votre configuration.');
        }
    } catch (error) {
        alert('❌ Erreur: ' + error.message);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resetForm() {
    document.getElementById('trade-form').reset();
    document.getElementById('image-preview').innerHTML = '';
    setDefaultDateTime();
    
    // Réinitialiser les étoiles
    document.querySelectorAll('input[name="setup-quality"]').forEach(input => {
        input.checked = false;
    });
}

// Statistiques
async function loadStats() {
    if (!config.apiKey || !config.sheetId) return;
    
    try {
        // Récupérer toutes les données
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.sheetName}!A2:Q?key=${config.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            displayNoData();
            return;
        }
        
        const trades = data.values;
        calculateStats(trades);
        calculateAssetStats(trades);
        calculateStrategyStats(trades);
    } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
    }
}

function calculateStats(trades) {
    const totalTrades = trades.length;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;
    
    trades.forEach(trade => {
        const pnl = parseFloat(trade[8]) || 0; // Colonne P&L
        totalPnl += pnl;
        
        if (pnl > 0) {
            winningTrades++;
            totalWins += pnl;
        } else if (pnl < 0) {
            losingTrades++;
            totalLosses += Math.abs(pnl);
        }
    });
    
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0;
    const avgWin = winningTrades > 0 ? (totalWins / winningTrades).toFixed(2) : 0;
    const avgLoss = losingTrades > 0 ? (totalLosses / losingTrades).toFixed(2) : 0;
    const rrRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 0;
    
    // Afficher les stats
    document.getElementById('total-trades').textContent = totalTrades;
    document.getElementById('winning-trades').textContent = winningTrades;
    document.getElementById('losing-trades').textContent = losingTrades;
    document.getElementById('win-rate').textContent = winRate + '%';
    
    const pnlElement = document.getElementById('total-pnl');
    pnlElement.textContent = '$' + totalPnl.toFixed(2);
    pnlElement.style.color = totalPnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    
    document.getElementById('avg-win').textContent = '$' + avgWin;
    document.getElementById('avg-loss').textContent = '$' + avgLoss;
    document.getElementById('rr-ratio').textContent = rrRatio;
}

function calculateAssetStats(trades) {
    const assetStats = {};
    
    trades.forEach(trade => {
        const asset = trade[1]; // Colonne Actif
        const pnl = parseFloat(trade[8]) || 0;
        
        if (!assetStats[asset]) {
            assetStats[asset] = {
                total: 0,
                wins: 0,
                losses: 0,
                pnl: 0
            };
        }
        
        assetStats[asset].total++;
        assetStats[asset].pnl += pnl;
        
        if (pnl > 0) assetStats[asset].wins++;
        else if (pnl < 0) assetStats[asset].losses++;
    });
    
    displayAssetStats(assetStats);
}

function displayAssetStats(stats) {
    const container = document.getElementById('asset-stats');
    let html = '<table class="stats-table"><thead><tr><th>Actif</th><th>Trades</th><th>Gagnants</th><th>Perdants</th><th>Win Rate</th><th>P&L</th></tr></thead><tbody>';
    
    Object.entries(stats).forEach(([asset, data]) => {
        const winRate = ((data.wins / data.total) * 100).toFixed(1);
        const pnlClass = data.pnl >= 0 ? 'positive' : 'negative';
        
        html += `
            <tr>
                <td><strong>${asset}</strong></td>
                <td>${data.total}</td>
                <td>${data.wins}</td>
                <td>${data.losses}</td>
                <td>${winRate}%</td>
                <td class="trade-pnl ${pnlClass}">$${data.pnl.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function calculateStrategyStats(trades) {
    const strategyStats = {};
    
    trades.forEach(trade => {
        const strategy = trade[10] || 'Non spécifiée'; // Colonne Stratégie
        const pnl = parseFloat(trade[8]) || 0;
        
        if (!strategyStats[strategy]) {
            strategyStats[strategy] = {
                total: 0,
                wins: 0,
                losses: 0,
                pnl: 0
            };
        }
        
        strategyStats[strategy].total++;
        strategyStats[strategy].pnl += pnl;
        
        if (pnl > 0) strategyStats[strategy].wins++;
        else if (pnl < 0) strategyStats[strategy].losses++;
    });
    
    displayStrategyStats(strategyStats);
}

function displayStrategyStats(stats) {
    const container = document.getElementById('strategy-stats');
    let html = '<table class="stats-table"><thead><tr><th>Stratégie</th><th>Trades</th><th>Gagnants</th><th>Perdants</th><th>Win Rate</th><th>P&L</th></tr></thead><tbody>';
    
    Object.entries(stats).forEach(([strategy, data]) => {
        const winRate = ((data.wins / data.total) * 100).toFixed(1);
        const pnlClass = data.pnl >= 0 ? 'positive' : 'negative';
        
        html += `
            <tr>
                <td><strong>${strategy}</strong></td>
                <td>${data.total}</td>
                <td>${data.wins}</td>
                <td>${data.losses}</td>
                <td>${winRate}%</td>
                <td class="trade-pnl ${pnlClass}">$${data.pnl.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayNoData() {
    document.getElementById('total-trades').textContent = '0';
    document.getElementById('winning-trades').textContent = '0';
    document.getElementById('losing-trades').textContent = '0';
    document.getElementById('win-rate').textContent = '0%';
    document.getElementById('total-pnl').textContent = '$0';
    document.getElementById('avg-win').textContent = '$0';
    document.getElementById('avg-loss').textContent = '$0';
    document.getElementById('rr-ratio').textContent = '0';
    document.getElementById('asset-stats').innerHTML = '<p class="info-text">Aucune donnée disponible</p>';
    document.getElementById('strategy-stats').innerHTML = '<p class="info-text">Aucune donnée disponible</p>';
}

// Historique
async function loadHistory() {
    if (!config.apiKey || !config.sheetId) {
        document.getElementById('trades-list').innerHTML = '<p class="info-text">Veuillez configurer Google Sheets d\'abord</p>';
        return;
    }
    
    const container = document.getElementById('trades-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.sheetName}!A2:Q?key=${config.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            container.innerHTML = '<p class="info-text">Aucun trade enregistré</p>';
            return;
        }
        
        displayTrades(data.values.reverse()); // Inverser pour afficher les plus récents en premier
    } catch (error) {
        container.innerHTML = '<p class="info-text">Erreur lors du chargement</p>';
        console.error(error);
    }
}

function displayTrades(trades) {
    const container = document.getElementById('trades-list');
    let html = '';
    
    trades.forEach((trade, index) => {
        const [date, asset, direction, positionSize, entryPrice, exitPrice, 
               stopLoss, takeProfit, pnl, fees, strategy, timeframe, 
               setupQuality, emotions, notes, mistakes] = trade;
        
        const pnlValue = parseFloat(pnl) || 0;
        const tradeClass = pnlValue > 0 ? 'win' : pnlValue < 0 ? 'loss' : '';
        const pnlClass = pnlValue >= 0 ? 'positive' : 'negative';
        const directionEmoji = direction === 'LONG' ? '📈' : '📉';
        
        html += `
            <div class="trade-item ${tradeClass}">
                <div class="trade-header">
                    <div>
                        <span class="trade-asset">${directionEmoji} ${asset}</span>
                        <span style="margin-left: 10px; color: var(--text-light);">${date}</span>
                    </div>
                    <div class="trade-pnl ${pnlClass}">
                        ${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)}
                    </div>
                </div>
                
                <div class="trade-details">
                    <div><strong>Direction:</strong> ${direction}</div>
                    <div><strong>Entrée:</strong> ${entryPrice}</div>
                    ${exitPrice ? `<div><strong>Sortie:</strong> ${exitPrice}</div>` : ''}
                    ${stopLoss ? `<div><strong>SL:</strong> ${stopLoss}</div>` : ''}
                    ${takeProfit ? `<div><strong>TP:</strong> ${takeProfit}</div>` : ''}
                    ${timeframe ? `<div><strong>Timeframe:</strong> ${timeframe}</div>` : ''}
                    ${strategy ? `<div><strong>Stratégie:</strong> ${strategy}</div>` : ''}
                    ${setupQuality ? `<div><strong>Setup:</strong> ${'⭐'.repeat(parseInt(setupQuality))}</div>` : ''}
                    ${emotions ? `<div><strong>Émotions:</strong> ${emotions}</div>` : ''}
                </div>
                
                ${notes ? `<div class="trade-notes"><strong>📋 Notes:</strong><br>${notes}</div>` : ''}
                ${mistakes ? `<div class="trade-notes" style="background: #fef2f2;"><strong>❌ Erreurs:</strong><br>${mistakes}</div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function refreshHistory() {
    loadHistory();
}

// Auto-calcul du P&L
document.addEventListener('DOMContentLoaded', () => {
    const entryPrice = document.getElementById('entry-price');
    const exitPrice = document.getElementById('exit-price');
    const positionSize = document.getElementById('position-size');
    const direction = document.getElementById('direction');
    const pnlInput = document.getElementById('pnl');
    
    function calculatePnL() {
        const entry = parseFloat(entryPrice.value);
        const exit = parseFloat(exitPrice.value);
        const size = parseFloat(positionSize.value);
        const dir = direction.value;
        
        if (entry && exit && size && dir) {
            let pnl = 0;
            if (dir === 'LONG') {
                pnl = (exit - entry) * size;
            } else if (dir === 'SHORT') {
                pnl = (entry - exit) * size;
            }
            pnlInput.value = pnl.toFixed(2);
        }
    }
    
    if (entryPrice && exitPrice && positionSize && direction) {
        [entryPrice, exitPrice, positionSize, direction].forEach(el => {
            el.addEventListener('input', calculatePnL);
            el.addEventListener('change', calculatePnL);
        });
    }
});
