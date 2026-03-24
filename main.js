// ================================================================
//  APEX // FLUX v6.0 — TACTICAL ADVISOR EDITION
//  main.js
// ================================================================

const STATE = {
    balance:       parseFloat(localStorage.getItem('flux_bal'))          || 0,
    outbound:      JSON.parse(localStorage.getItem('flux_out'))          || [],
    inbound:       JSON.parse(localStorage.getItem('flux_in'))           || [],
    xp:            parseInt(localStorage.getItem('flux_xp'))             || 100,
    lastWeekSpend: parseFloat(localStorage.getItem('flux_last_spend'))   || 0,
    weekStartDate: localStorage.getItem('flux_week_start')               || new Date().toISOString(),
    weeklyTarget:  parseFloat(localStorage.getItem('flux_weekly_target'))|| 0,
    apexHistory:   JSON.parse(localStorage.getItem('apex_history'))      || [],
    apiKey:        localStorage.getItem('flux_api_key')                  || '',
    isPrivate:     true,
    pin:           "1234"
};

let fluxChart = null;

document.addEventListener('DOMContentLoaded', () => {
    syncUI();
    // Chart is lazy-initialized when Vortex module is opened
});


// ================================================================
//  1. EFFICIENCY ENGINE — UNCHANGED
// ================================================================
function runEfficiencyDiagnostic() {
    const now        = new Date();
    const startDate  = new Date(STATE.weekStartDate);
    const diffDays   = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    const todayStr   = new Date().toLocaleDateString();
    const todaySpend = STATE.outbound
        .filter(i => new Date(i.timestamp).toLocaleDateString() === todayStr)
        .reduce((s, i) => s + i.cost, 0);

    if (todaySpend > 200) {
        STATE.xp = Math.max(0, STATE.xp - 2);
    }

    if (diffDays >= 7) {
        const currentWeekSpend = STATE.outbound
            .filter(i => new Date(i.timestamp) > startDate)
            .reduce((s, i) => s + i.cost, 0);

        if (currentWeekSpend < STATE.lastWeekSpend || STATE.lastWeekSpend === 0) {
            STATE.xp += 100;
            alert("ENGINE OPTIMIZED: Spending was lower than last week. +100 XP");
        } else {
            STATE.xp = Math.max(0, STATE.xp - 50);
            alert("SYSTEM LEAK: Spending exceeded last week. -50 XP");
        }

        STATE.lastWeekSpend   = currentWeekSpend;
        STATE.weekStartDate   = new Date().toISOString();
        localStorage.setItem('flux_last_spend', STATE.lastWeekSpend);
        localStorage.setItem('flux_week_start', STATE.weekStartDate);
    }
}


// ================================================================
//  2. DELETE / ROLLBACK — UNCHANGED
// ================================================================
function deleteEntry(index) {
    const item = STATE.outbound[index];
    STATE.balance += item.cost;
    STATE.outbound.splice(index, 1);
    STATE.xp = Math.max(0, STATE.xp - 5);
    syncUI();
    console.log(`[ROLLBACK] ${item.name} removed. KES ${item.cost} restored.`);
}


// ================================================================
//  3. CORE SYSTEM SYNC
// ================================================================
function syncUI() {
    runEfficiencyDiagnostic();

    localStorage.setItem('flux_bal',  STATE.balance);
    localStorage.setItem('flux_out',  JSON.stringify(STATE.outbound));
    localStorage.setItem('flux_in',   JSON.stringify(STATE.inbound));
    localStorage.setItem('flux_xp',   STATE.xp);

    // Balance display
    const balEl   = document.getElementById('bal-amount');
    const privBtn = document.getElementById('toggle-privacy');
    if (STATE.isPrivate) {
        balEl.classList.add('blurred');
        balEl.innerText = "****.**";
        if (privBtn) privBtn.innerText = "REVEAL DATA";
    } else {
        balEl.classList.remove('blurred');
        balEl.innerText = STATE.balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (privBtn) privBtn.innerText = "HIDE DATA";
    }

    // Privacy status badge on security card
    const privBadge = document.getElementById('privacy-status-indicator');
    if (privBadge) {
        if (STATE.isPrivate) {
            privBadge.textContent = '\uD83D\uDD12\u00A0 PRIVATE MODE: ACTIVE';
            privBadge.classList.remove('privacy-exposed');
        } else {
            privBadge.textContent = '\uD83D\uDD13\u00A0 PRIVATE MODE: OFF';
            privBadge.classList.add('privacy-exposed');
        }
    }

    // XP + tier
    document.getElementById('xp-display').innerText = STATE.xp;
    document.getElementById('tier-name').innerText   = getEngTier(STATE.xp);

    // Gauge
    const gaugeFill = document.getElementById('gauge-fill');
    const card      = document.getElementById('balance-card');
    const offset    = 126 - (Math.min(Math.abs(STATE.balance), 2000) / 2000 * 126);
    gaugeFill.style.strokeDashoffset = Math.max(0, offset);

    if (STATE.balance <= 0) {
        gaugeFill.style.stroke = "var(--danger)";
        card.classList.add('emergency-active');
    } else {
        gaugeFill.style.stroke = "var(--neon-green)";
        card.classList.remove('emergency-active');
    }

    renderLists();
    updateChart();
    generateWeeklyReport();
    updateBudgetProgress();
}


// ================================================================
//  4. DATA NORMALIZATION — NEW v6.0
// ================================================================
function normalizeLabel(name) {
    if (!name) return name;
    const n = name.toUpperCase().trim();

    if (n.includes('DATA BUNDLES') || n.includes('DATA BUNDLE') ||
        n.includes('MPESA DATA')   || n.includes('M-PESA DATA'))    return 'DATA';
    if (n.includes('TUNUKIWA'))                                       return 'MINS';
    if (n.includes('POCHI LA BIASHARA') || n.includes('POCHI'))      return 'POCHI';
    if (n.includes('AIRTIME'))                                        return 'AIRTIME';
    if (n.includes('FULIZA'))                                         return 'FULIZA';
    if (n.includes('PAYBILL'))                                        return 'PAYBILL';
    if (n.includes('BUY GOODS') || n.includes('MERCHANT'))           return 'TILL PMT';
    if (n.includes('WITHDRAW'))                                       return 'WITHDRAWAL';
    if (n.includes('OKOA JAHAZI') || n.includes('OKOA'))             return 'EMERGENCY DATA';

    // P2P: "TO FIRSTNAME LASTNAME..." → extract first name
    const p2p = name.match(/^(?:TO|sent to)\s+([A-Za-z]+)/i);
    if (p2p) {
        const first = p2p[1];
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    return name;
}


// ================================================================
//  5. SMART SHREDDER — updated to use normalizeLabel
// ================================================================
function shredSMS() {
    const input    = document.getElementById('sms-area');
    const text     = input.value;
    const balRegex = /(?:New|Your) M-PESA balance is (?:Ksh\s?)?([\d,]+\.?\d{0,2})/;
    const balMatch = text.match(balRegex);

    if (balMatch) {
        const newTotal = parseFloat(balMatch[1].replace(/,/g, ''));
        const diff     = newTotal - STATE.balance;
        const absDiff  = Math.abs(diff);
        let   label    = "M-PESA TRANS";
        let   category = "General";

        if (text.includes("sent to")) {
            const nameMatch = text.match(/sent to\s(.*?)\s\d/);
            label    = nameMatch ? `TO ${nameMatch[1]}` : "SENT MONEY";
            category = "Transfer";
        } else if (text.includes("Bundle") || text.includes("DATA BUNDLES") || text.includes("data bundle")) {
            label    = "DATA BUNDLES";
            category = "Utility";
        } else if (text.includes("Airtime") || text.includes("airtime")) {
            label    = "AIRTIME";
            category = "Utility";
        } else if (text.includes("Pay Bill") || text.includes("Paybill") || text.includes("paybill")) {
            label    = "PAYBILL";
            category = "Utility";
        } else if (text.includes("Buy Goods") || text.includes("Merchant") || text.includes("merchant")) {
            label    = "BUY GOODS";
            category = "General";
        } else if (text.includes("withdraw") || text.includes("Withdraw")) {
            label    = "WITHDRAWAL";
            category = "General";
        } else if (text.includes("Fuliza")) {
            label    = "FULIZA";
            category = "Debt";
        } else if (text.includes("Tunukiwa") || text.includes("TUNUKIWA")) {
            label    = "TUNUKIWA MINUTES";
            category = "Utility";
        } else if (text.includes("Pochi") || text.includes("POCHI")) {
            label    = "POCHI LA BIASHARA";
            category = "Transfer";
        }

        // Apply normalization
        label = normalizeLabel(label);

        if (diff > 0) {
            STATE.inbound.push({ label, amount: absDiff, timestamp: Date.now() });
            STATE.xp += 10;
        } else if (diff < 0) {
            STATE.outbound.push({ name: label, cost: absDiff, cat: category, timestamp: Date.now() });
        }

        STATE.balance = newTotal;
        input.value   = "";
        syncUI();
    } else {
        alert("SHREDDER ERROR: Balance not found.");
    }
}


// ================================================================
//  6. RENDER & UI UPDATES — UNCHANGED
// ================================================================
function renderLists() {
    const outboundContainer = document.getElementById('outbound-list');
    outboundContainer.innerHTML = STATE.outbound.slice(-6).reverse().map((i, idx) => {
        const actualIdx = STATE.outbound.length - 1 - idx;
        return `
            <div class="log-entry">
                <div class="log-info"><b>${i.name}</b><small>${i.cat}</small></div>
                <div class="log-actions">
                    <span class="amount-out">-${i.cost.toLocaleString()}</span>
                    <button class="delete-btn" onclick="deleteEntry(${actualIdx})">&#215;</button>
                </div>
            </div>`;
    }).join('');

    document.getElementById('inbound-list').innerHTML = STATE.inbound.slice(-4).reverse().map(i => `
        <div class="log-entry">
            <b>${i.label}</b>
            <span class="amount-in">+${i.amount.toLocaleString()}</span>
        </div>
    `).join('');
}


// ================================================================
//  7. COLLAPSIBLE LEDGER TOGGLE — UNCHANGED
// ================================================================
function toggleLedger(type) {
    const panel     = document.getElementById('panel-' + type);
    const btn       = document.getElementById('btn-' + type);
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('ledger-active', !isVisible);
}


// ================================================================
//  8. UTILITY FUNCTIONS — UNCHANGED
// ================================================================
function getEngTier(xp) {
    if (xp < 200)  return "CAD INTERN";
    if (xp < 500)  return "JUNIOR TECHNICIAN";
    if (xp < 1000) return "PLANT ENGINEER";
    if (xp < 2500) return "CHIEF OPERATIONS OFFICER";
    return "INDUSTRIAL MAGNATE";
}

function addManualEntry() {
    const name = document.getElementById('item-name').value;
    const cost = parseFloat(document.getElementById('item-cost').value);
    const cat  = document.getElementById('item-category').value;
    if (name && !isNaN(cost)) {
        STATE.outbound.push({ name, cost, cat, timestamp: Date.now() });
        STATE.balance -= cost;
        syncUI();
        document.getElementById('item-name').value = "";
        document.getElementById('item-cost').value = "";
    }
}

function generateWeeklyReport() {
    const now         = Date.now();
    const oneWeekAgo  = now - (7 * 24 * 60 * 60 * 1000);
    const weeklySpend = STATE.outbound.filter(item => item.timestamp > oneWeekAgo);
    const total       = weeklySpend.reduce((acc, curr) => acc + curr.cost, 0);
    const container   = document.getElementById('weekly-report-content');
    if (!container) return;
    if (total === 0) { container.innerHTML = `<p class="dim-text">No weekly data.</p>`; return; }
    const categories = ["Food", "Transport", "Academic", "Utility", "Transfer", "General", "Debt"];
    let html = `<p class="neon-text" style="font-size:0.85rem; margin-bottom:8px;">TOTAL: KES ${total.toLocaleString()}</p>`;
    categories.forEach(cat => {
        const catTotal = weeklySpend
            .filter(i => i.cat === cat || (cat === "Utility" && i.cat === "Utilities"))
            .reduce((s, i) => s + i.cost, 0);
        const percent = ((catTotal / total) * 100).toFixed(0);
        if (catTotal > 0) {
            html += `
                <div class="report-item"><span>${cat}</span><span>${percent}%</span></div>
                <div class="report-bar-wrap"><div class="report-bar-fill" style="width:${percent}%"></div></div>`;
        }
    });
    container.innerHTML = html;
}

function exportBlueprint() {
    let report = `APEX // FLUX - ENGINEERING LOG\nGenerated: ${new Date().toLocaleString()}\nTier: ${getEngTier(STATE.xp)}\nAssets: KES ${STATE.balance.toLocaleString()}\n-------------------------------------------\n\n[OUTBOUND]\n`;
    STATE.outbound.forEach(i => {
        report += `${new Date(i.timestamp).toLocaleDateString()} | ${i.name.padEnd(20)} | KES ${i.cost.toLocaleString().padStart(8)} | (${i.cat})\n`;
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Flux_Blueprint.txt`;
    a.click();
}


// ================================================================
//  9. AUTH & NAVIGATION — core functions UNCHANGED, verifyPin updated
// ================================================================
let enteredPin = "";
function inputPin(n)  { if (enteredPin.length < 4) { enteredPin += n; document.getElementById('pin-input').value = "*".repeat(enteredPin.length); } }
function clearPin()   { enteredPin = ""; document.getElementById('pin-input').value = ""; }

function verifyPin() {
    if (enteredPin === STATE.pin) {
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        checkWeeklyArchive();   // Memory Engine: archive if new week
        syncUI();
        updateBudgetProgress();
    } else {
        alert("DENIED");
        clearPin();
    }
}

function openSecureModal() {
    if (!STATE.isPrivate) { STATE.isPrivate = true; syncUI(); return; }
    document.getElementById('secure-modal').style.display = 'flex';
}
function closeSecureModal() { document.getElementById('secure-modal').style.display = 'none'; }
function confirmSecureToggle() {
    const p = document.getElementById('modal-pin').value;
    if (p === STATE.pin) {
        STATE.isPrivate = false;
        closeSecureModal();
        document.getElementById('modal-pin').value = "";
        syncUI();
    } else { alert("INVALID"); }
}

function initChart() {
    const canvas = document.getElementById('fluxChart');
    if (!canvas || fluxChart) return;
    const ctx  = canvas.getContext('2d');
    fluxChart  = new Chart(ctx, {
        type: 'line',
        data: {
            labels:   [],
            datasets: [{ borderColor: '#00ff41', data: [], tension: 0.3 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales:  { y: { grid: { color: '#111' } } }
        }
    });
    updateChart();
}

function updateChart() {
    if (!fluxChart) return;
    fluxChart.data.labels               = STATE.outbound.slice(-7).map(i => i.name);
    fluxChart.data.datasets[0].data    = STATE.outbound.slice(-7).map(i => i.cost);
    fluxChart.update();
}

function showModule(id) {
    document.querySelectorAll('.module-content').forEach(m => m.style.display = 'none');
    document.getElementById('mod-' + id).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    try { event.currentTarget.classList.add('active'); } catch (e) {}
    // Highlight correct nav button when called programmatically
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.classList.add('active');
}

function launchModule(id) {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('modules-view').style.display   = 'flex';
    if (id === 'viz') initChart();  // Lazy chart init
    showModule(id);
}

function goToDashboard() {
    document.getElementById('modules-view').style.display   = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    updateBudgetProgress();
}


// ================================================================
//  10. BUDGET CONTROL FUNCTION
// ================================================================
function setWeeklyTarget() {
    const val = parseFloat(document.getElementById('weekly-target-input').value);
    if (!isNaN(val) && val > 0) {
        STATE.weeklyTarget = val;
        localStorage.setItem('flux_weekly_target', val);
        document.getElementById('weekly-target-input').value = "";
        updateBudgetProgress();
    }
}

function updateBudgetProgress() {
    const barEl    = document.getElementById('budget-progress-bar');
    const spendEl  = document.getElementById('budget-spend-display');
    const targetEl = document.getElementById('budget-target-display');
    const pctEl    = document.getElementById('budget-pct-display');
    if (!barEl) return;

    const now        = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekSpend  = STATE.outbound
        .filter(i => i.timestamp > oneWeekAgo)
        .reduce((s, i) => s + i.cost, 0);

    const target = STATE.weeklyTarget;

    if (spendEl)  spendEl.innerText  = `KES ${weekSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (targetEl) targetEl.innerText = target > 0 ? `KES ${target.toLocaleString()}` : 'NOT SET';

    const pct = target > 0 ? Math.min((weekSpend / target) * 100, 100) : 0;
    barEl.style.width = pct + '%';

    // Traffic-light colour
    if (pct >= 100) {
        barEl.style.background = 'var(--danger)';
        barEl.style.boxShadow  = '0 0 10px rgba(255,62,62,0.4)';
    } else if (pct > 70) {
        barEl.style.background = '#ffaa00';
        barEl.style.boxShadow  = '0 0 8px rgba(255,170,0,0.3)';
    } else {
        barEl.style.background = 'var(--neon-green)';
        barEl.style.boxShadow  = '0 0 8px rgba(0,255,65,0.3)';
    }

    if (pctEl) pctEl.innerText = target > 0 ? `${pct.toFixed(0)}%` : '--%';

    // Overburn: pulse dashboard borders red
    const dashView = document.getElementById('dashboard-view');
    if (dashView) {
        if (target > 0 && weekSpend > target) {
            dashView.classList.add('overburn-active');
        } else {
            dashView.classList.remove('overburn-active');
        }
    }
}


// ================================================================
//  11. MEMORY ENGINE — Weekly Archive (NEW v6.0)
// ================================================================
function getThisWeekSpend() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return STATE.outbound
        .filter(i => i.timestamp > oneWeekAgo)
        .reduce((s, i) => s + i.cost, 0);
}

function getTopCategory(entries) {
    const cats = {};
    entries.forEach(i => { cats[i.cat] = (cats[i.cat] || 0) + i.cost; });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : 'N/A';
}

function checkWeeklyArchive() {
    const history = STATE.apexHistory;
    const now     = new Date();

    if (history.length === 0) {
        // First session — record current week start, no snapshot yet
        return;
    }

    const lastEntry  = history[history.length - 1];
    const lastDate   = new Date(lastEntry.week_start);
    const daysSince  = (now - lastDate) / (1000 * 60 * 60 * 24);

    if (daysSince >= 7) {
        archiveCurrentWeek();
    }
}

function archiveCurrentWeek() {
    const now        = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekData   = STATE.outbound.filter(i => i.timestamp > oneWeekAgo);
    const total      = weekData.reduce((s, i) => s + i.cost, 0);
    const topCat     = getTopCategory(weekData);

    const snapshot = {
        week_start:  new Date(oneWeekAgo).toISOString(),
        total_spent: total,
        budget_met:  STATE.weeklyTarget > 0 ? total <= STATE.weeklyTarget : null,
        top_category: topCat
    };

    STATE.apexHistory.push(snapshot);

    // Keep last 12 weeks max
    if (STATE.apexHistory.length > 12) {
        STATE.apexHistory = STATE.apexHistory.slice(-12);
    }

    localStorage.setItem('apex_history', JSON.stringify(STATE.apexHistory));
    console.log('[MEMORY ENGINE] Weekly snapshot archived:', snapshot);
}


// ================================================================
//  12. APEX ADVISOR — Ghost Sidebar (NEW v6.0)
// ================================================================
let advisorHistory = [];   // In-memory chat history (session only)
let advisorGreeted = false;

function toggleAdvisor() {
    const panel    = document.getElementById('advisor-panel');
    const fab      = document.getElementById('advisor-fab');
    const backdrop = document.getElementById('advisor-backdrop');
    const isOpen   = panel.classList.contains('open');

    panel.classList.toggle('open', !isOpen);
    fab.classList.toggle('open', !isOpen);
    backdrop.classList.toggle('visible', !isOpen);

    if (!isOpen) {
        initAdvisorUI();
        if (STATE.apiKey && !advisorGreeted) {
            showAdvisorGreeting();
            advisorGreeted = true;
        }
    }
}

function initAdvisorUI() {
    const setup = document.getElementById('advisor-setup');
    const chat  = document.getElementById('advisor-chat');
    if (STATE.apiKey) {
        setup.style.display = 'none';
        chat.style.display  = 'flex';
    } else {
        setup.style.display = 'flex';
        chat.style.display  = 'none';
    }
}

function setApiKey() {
    const input = document.getElementById('api-key-input');
    const key   = input.value.trim();
    if (key.length > 10) {
        STATE.apiKey = key;
        localStorage.setItem('flux_api_key', key);
        input.value = '';
        initAdvisorUI();
        showAdvisorGreeting();
        advisorGreeted = true;
    } else {
        alert('Invalid key format.');
    }
}

// ─── Greeting — generated locally, no API call ───────────────────
function buildAdvisorGreeting() {
    const thisWeek = getThisWeekSpend();
    const history  = STATE.apexHistory;
    const lastWeek = history.length > 0 ? history[history.length - 1] : null;

    let greeting = '';

    if (lastWeek && lastWeek.total_spent > 0) {
        const pctChange  = ((thisWeek - lastWeek.total_spent) / lastWeek.total_spent) * 100;
        const absPct     = Math.abs(pctChange).toFixed(1);
        const lastStr    = lastWeek.total_spent.toLocaleString();
        if (pctChange <= 0) {
            greeting = `Yo, you're crushing it — spend is down ${absPct}% vs last week (KES ${lastStr}). That's discipline.`;
        } else {
            greeting = `Heads up — we're ${absPct}% above last week's pace (KES ${lastStr}). Let's recalibrate before this becomes a trend.`;
        }
    } else {
        greeting = `APEX Advisor online. ${history.length === 0 ? "First session — we're building your baseline." : "Welcome back."} Tier: ${getEngTier(STATE.xp)}.`;
    }

    // Daily safe limit
    if (STATE.weeklyTarget > 0) {
        const remaining = STATE.weeklyTarget - thisWeek;
        if (remaining > 0) {
            const dayOfWeek  = new Date().getDay(); // 0=Sun
            const daysLeft   = Math.max(7 - dayOfWeek, 1);
            const dailyLimit = Math.floor(remaining / daysLeft);
            greeting += ` Daily safe limit: KES ${dailyLimit.toLocaleString()}.`;
        } else {
            const over = Math.abs(remaining).toLocaleString();
            greeting += ` Real talk — you're KES ${over} over budget. Overburn state active.`;
        }
    }

    return greeting;
}

function showAdvisorGreeting() {
    const greeting = buildAdvisorGreeting();
    appendAdvisorMessage('advisor', greeting);
}

// ─── Context builder — financial data injected into system prompt ──
function buildAdvisorContext() {
    const thisWeek = getThisWeekSpend();
    const lastWeek = STATE.apexHistory[STATE.apexHistory.length - 1];
    const remaining = STATE.weeklyTarget > 0 ? STATE.weeklyTarget - thisWeek : null;
    const dayOfWeek  = new Date().getDay();
    const daysLeft   = Math.max(7 - dayOfWeek, 1);
    const dailyLimit = remaining !== null && remaining > 0
        ? Math.floor(remaining / daysLeft)
        : null;

    const recentCats = {};
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    STATE.outbound.filter(i => i.timestamp > oneWeekAgo).forEach(i => {
        recentCats[i.cat] = (recentCats[i.cat] || 0) + i.cost;
    });
    const topCatEntry = Object.entries(recentCats).sort((a,b) => b[1]-a[1])[0];
    const topCat = topCatEntry ? `${topCatEntry[0]} (KES ${topCatEntry[1].toLocaleString()})` : 'N/A';

    return `You are APEX, a tactical financial advisor for a young professional in Nairobi, Kenya who uses M-PESA.
Tone: Direct, supportive, casual-smart — like a savvy friend who knows finance. Use: "Yo", "crushing it", "Heads up", "real talk", "let's lock in", "Overburn", "recalibrate".
Keep responses to 3-4 sentences max. Be specific with numbers when relevant. Never fabricate data outside what is provided below.
All computation and data access happens locally — you only receive a context summary.

LIVE FINANCIAL CONTEXT:
- Balance: KES ${STATE.balance.toLocaleString()}
- This Week Spend: KES ${thisWeek.toLocaleString()}
- Weekly Budget: ${STATE.weeklyTarget > 0 ? 'KES ' + STATE.weeklyTarget.toLocaleString() : 'Not set'}
- Budget Remaining: ${remaining !== null ? 'KES ' + Math.floor(remaining).toLocaleString() : 'N/A'}
- Daily Safe Limit (${daysLeft} days left): ${dailyLimit ? 'KES ' + dailyLimit.toLocaleString() : 'N/A'}
- Top Spend Category (this week): ${topCat}
- Last Week Total: ${lastWeek ? 'KES ' + lastWeek.total_spent.toLocaleString() : 'No history yet'}
- Last Week Budget Met: ${lastWeek ? (lastWeek.budget_met === null ? 'No budget set' : lastWeek.budget_met ? 'Yes ✓' : 'No ✗') : 'N/A'}
- XP / Tier: ${STATE.xp} XP — ${getEngTier(STATE.xp)}`;
}

// ─── Chat rendering ───────────────────────────────────────────────
function appendAdvisorMessage(role, text) {
    const msgs    = document.getElementById('advisor-messages');
    if (!msgs) return;
    const isUser  = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `adv-msg adv-${role}`;
    wrapper.innerHTML = `
        <div class="adv-sender">${isUser ? 'YOU' : 'APEX ADVISOR'}</div>
        <div class="adv-bubble">${text}</div>`;
    msgs.appendChild(wrapper);
    msgs.scrollTop = msgs.scrollHeight;
}

function showAdvisorThinking() {
    const msgs = document.getElementById('advisor-messages');
    if (!msgs) return;
    const el   = document.createElement('div');
    el.className = 'adv-msg adv-advisor adv-thinking';
    el.id        = 'adv-thinking';
    el.innerHTML = `
        <div class="adv-sender">APEX ADVISOR</div>
        <div class="adv-bubble">
            <span class="thinking-dots">
                <span></span><span></span><span></span>
            </span>
        </div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
}

function hideAdvisorThinking() {
    const el = document.getElementById('adv-thinking');
    if (el) el.remove();
}

// ─── Send message to Anthropic API ───────────────────────────────
async function sendAdvisorMessage() {
    const inputEl = document.getElementById('advisor-input');
    const userMsg = inputEl ? inputEl.value.trim() : '';
    if (!userMsg) return;

    if (!STATE.apiKey) {
        initAdvisorUI(); // Show setup
        return;
    }

    inputEl.value = '';
    inputEl.disabled = true;

    appendAdvisorMessage('user', userMsg);
    advisorHistory.push({ role: 'user', content: userMsg });

    // Cap history to last 10 turns to save tokens
    if (advisorHistory.length > 10) {
        advisorHistory = advisorHistory.slice(-10);
    }

    showAdvisorThinking();

    const systemPrompt = buildAdvisorContext();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type':                             'application/json',
                'x-api-key':                               STATE.apiKey,
                'anthropic-version':                       '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model:      'claude-sonnet-4-20250514',
                max_tokens: 300,
                system:     systemPrompt,
                messages:   advisorHistory
            })
        });

        const data  = await response.json();

        if (!response.ok) {
            const errMsg = data.error?.message || `API error ${response.status}`;
            hideAdvisorThinking();
            appendAdvisorMessage('advisor', `Signal lost: ${errMsg}. Check your API key.`);
            inputEl.disabled = false;
            return;
        }

        const reply = data.content?.[0]?.text || "Signal lost. Try again.";
        advisorHistory.push({ role: 'assistant', content: reply });
        hideAdvisorThinking();
        appendAdvisorMessage('advisor', reply);

    } catch (err) {
        hideAdvisorThinking();
        appendAdvisorMessage('advisor', `Network error. Check your connection and try again.`);
        console.error('[ADVISOR] fetch error:', err);
    } finally {
        if (inputEl) inputEl.disabled = false;
        if (inputEl) inputEl.focus();
    }
}
