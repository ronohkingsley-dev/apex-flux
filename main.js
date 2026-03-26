// ================================================================
//  APEX // FLUX v8.0 — TACTICAL INTELLIGENCE ENGINE
//  main.js
// ================================================================

const STATE = {
    balance:        parseFloat(localStorage.getItem('flux_bal'))           || 0,
    outbound:       JSON.parse(localStorage.getItem('flux_out'))           || [],
    inbound:        JSON.parse(localStorage.getItem('flux_in'))            || [],
    xp:             parseInt(localStorage.getItem('flux_xp'))              || 100,
    lastWeekSpend:  parseFloat(localStorage.getItem('flux_last_spend'))    || 0,
    weekStartDate:  localStorage.getItem('flux_week_start')                || new Date().toISOString(),
    weeklyTarget:   parseFloat(localStorage.getItem('flux_weekly_target')) || 0,
    apexHistory:    JSON.parse(localStorage.getItem('apex_history'))       || [],
    lastReset:      parseInt(localStorage.getItem('flux_last_reset'))      || Date.now(),
    liability:      parseFloat(localStorage.getItem('flux_liability'))     || 0,
    frequentRoutes: JSON.parse(localStorage.getItem('flux_routes'))        || {},
    pin:            localStorage.getItem('flux_pin') || null,   // null = first run
    isPrivate:      true
};

// Per-session vars
let fluxChart       = null;
let advisorGreeted  = false;
let _pendingEntry   = null;
let _pendingP2PName = null;   // route modal staging

// ── Ghost Mode ──────────────────────────────────────────────────
let ghostTimer     = null;
const GHOST_IDLE   = 3 * 60 * 1000;  // 3 minutes

function activateGhostMode() {
    document.body.classList.add('ghost-mode');
    const badge = document.getElementById('ghost-badge');
    if (badge) badge.style.display = 'block';
}
function deactivateGhostMode() {
    document.body.classList.remove('ghost-mode');
    const badge = document.getElementById('ghost-badge');
    if (badge) badge.style.display = 'none';
    clearTimeout(ghostTimer);
    ghostTimer = setTimeout(activateGhostMode, GHOST_IDLE);
}
function startGhostWatcher() {
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(e =>
        document.addEventListener(e, deactivateGhostMode, { passive: true }));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) activateGhostMode();
        else deactivateGhostMode();
    });
    ghostTimer = setTimeout(activateGhostMode, GHOST_IDLE);
}

// ── Bootstrap ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkFirstRun();
});


// ================================================================
//  PHASE 1 — FIRST RUN / PIN SETUP
// ================================================================
let _setupStep  = 1;   // 1 = create, 2 = confirm
let _setupFirst = "";  // stores first entry

function checkFirstRun() {
    if (!STATE.pin) {
        // No PIN exists — hide landing, show setup
        document.getElementById('landing-view').style.display   = 'none';
        document.getElementById('pin-setup-overlay').style.display = 'flex';
    }
    // If PIN exists, landing is visible by default
}

function setupInputPin(n) {
    const display = document.getElementById('setup-pin-display');
    const current = display.value.replace(/\*/g, '');
    if (current.length < 4) {
        display.value = '*'.repeat(current.length + 1);
        display.dataset.raw = (display.dataset.raw || '') + n;
    }
}
function setupClearPin() {
    const display = document.getElementById('setup-pin-display');
    display.value      = '';
    display.dataset.raw = '';
}
function setupConfirmPin() {
    const display  = document.getElementById('setup-pin-display');
    const entered  = display.dataset.raw || '';

    if (entered.length < 4) {
        alert("Enter a full 4-digit code.");
        return;
    }

    if (_setupStep === 1) {
        // Store and move to confirm
        _setupFirst = entered;
        _setupStep  = 2;
        document.getElementById('setup-hint-text').textContent = 'CONFIRM YOUR ACCESS CODE';
        setupClearPin();
    } else {
        // Confirm step
        if (entered === _setupFirst) {
            STATE.pin = entered;
            localStorage.setItem('flux_pin', entered);
            document.getElementById('pin-setup-overlay').style.display = 'none';
            document.getElementById('landing-view').style.display = 'flex';
            // Reset setup state
            _setupStep  = 1;
            _setupFirst = "";
        } else {
            alert("Codes don't match. Try again.");
            _setupStep  = 1;
            _setupFirst = "";
            document.getElementById('setup-hint-text').textContent = 'CREATE YOUR 4-DIGIT ACCESS CODE';
            setupClearPin();
        }
    }
}

// ── Landing CTA ─────────────────────────────────────────────────
function initializeSystem() {
    document.getElementById('landing-view').style.display        = 'none';
    document.getElementById('guardian-overlay').style.display    = 'flex';
}


// ================================================================
//  1. EFFICIENCY ENGINE — UNCHANGED
// ================================================================
function runEfficiencyDiagnostic() {
    const now       = new Date();
    const startDate = new Date(STATE.weekStartDate);
    const diffDays  = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    const todayStr   = new Date().toLocaleDateString();
    const todaySpend = STATE.outbound
        .filter(i => new Date(i.timestamp).toLocaleDateString() === todayStr)
        .reduce((s, i) => s + i.cost, 0);
    if (todaySpend > 200) STATE.xp = Math.max(0, STATE.xp - 2);

    if (diffDays >= 7) {
        const currentWeekSpend = STATE.outbound
            .filter(i => new Date(i.timestamp) > startDate)
            .reduce((s, i) => s + i.cost, 0);
        if (currentWeekSpend < STATE.lastWeekSpend || STATE.lastWeekSpend === 0) {
            STATE.xp += 100;
        } else {
            STATE.xp = Math.max(0, STATE.xp - 50);
        }
        STATE.lastWeekSpend = currentWeekSpend;
        STATE.weekStartDate = new Date().toISOString();
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
    // If this was a debt entry, also deduct from liability
    if (item.tag === '[DEBT]') {
        STATE.liability = Math.max(0, STATE.liability - item.cost);
        localStorage.setItem('flux_liability', STATE.liability);
    }
    STATE.outbound.splice(index, 1);
    STATE.xp = Math.max(0, STATE.xp - 5);
    syncUI();
}


// ================================================================
//  3. CORE SYSTEM SYNC
// ================================================================
function syncUI() {
    runEfficiencyDiagnostic();

    localStorage.setItem('flux_bal', STATE.balance);
    localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
    localStorage.setItem('flux_in',  JSON.stringify(STATE.inbound));
    localStorage.setItem('flux_xp',  STATE.xp);

    // Balance
    const balEl   = document.getElementById('bal-amount');
    const privBtn = document.getElementById('toggle-privacy');
    if (balEl) {
        if (STATE.isPrivate) {
            balEl.classList.add('blurred');
            balEl.innerText = "****.**";
            if (privBtn) privBtn.innerText = "REVEAL DATA";
        } else {
            balEl.classList.remove('blurred');
            balEl.innerText = STATE.balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
            if (privBtn) privBtn.innerText = "HIDE DATA";
        }
    }

    // Privacy badge
    const privBadge = document.getElementById('privacy-status-indicator');
    if (privBadge) {
        if (STATE.isPrivate) {
            privBadge.innerHTML = '&#128274;&nbsp; PRIVATE MODE: ACTIVE';
            privBadge.classList.remove('privacy-exposed');
        } else {
            privBadge.innerHTML = '&#128275;&nbsp; PRIVATE MODE: OFF';
            privBadge.classList.add('privacy-exposed');
        }
    }

    // XP + Tier
    const xpEl   = document.getElementById('xp-display');
    const tierEl = document.getElementById('tier-name');
    if (xpEl)   xpEl.innerText   = STATE.xp;
    if (tierEl) tierEl.innerText = getEngTier(STATE.xp);

    // Fuel gauge (green — balance vs target)
    const gaugeFill = document.getElementById('gauge-fill');
    const card      = document.getElementById('balance-card');
    if (gaugeFill) {
        const offset = 126 - (Math.min(Math.abs(STATE.balance), 2000) / 2000 * 126);
        gaugeFill.style.strokeDashoffset = Math.max(0, offset);
        if (STATE.balance <= 0) {
            gaugeFill.style.stroke = "var(--danger)";
            if (card) card.classList.add('emergency-active');
        } else {
            gaugeFill.style.stroke = "var(--neon-green)";
            if (card) card.classList.remove('emergency-active');
        }
    }

    updateDebtGauge();
    renderLists();
    updateChart();
    generateWeeklyReport();
    updateBudgetProgress();
}


// ================================================================
//  4. DEBT GAUGE
// ================================================================
function updateDebtGauge() {
    const barEl      = document.getElementById('debt-bar-fill');
    const pctEl      = document.getElementById('debt-pct-display');
    const liabEl     = document.getElementById('liability-display');
    if (!barEl) return;

    const liability = STATE.liability;
    const reference = Math.max(STATE.balance, 500);   // gauge fills relative to balance
    const pct       = Math.min((liability / reference) * 100, 100);

    barEl.style.width = pct + '%';
    if (liabEl) liabEl.innerText = `KES ${liability.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (pctEl)  pctEl.innerText  = `${pct.toFixed(0)}%`;

    // Escalate glow at high debt
    if (pct >= 50) {
        barEl.style.boxShadow = '0 0 14px rgba(255,49,49,0.6)';
    } else {
        barEl.style.boxShadow = '0 0 8px rgba(255,49,49,0.3)';
    }
}


// ================================================================
//  5. DATA NORMALIZATION — UNCHANGED + route label lookup
// ================================================================
function normalizeLabel(name) {
    if (!name) return name;
    const n = name.toUpperCase().trim();

    if (n.includes('DATA BUNDLES') || n.includes('DATA BUNDLE') ||
        n.includes('MPESA DATA')   || n.includes('M-PESA DATA'))   return 'DATA';
    if (n.includes('TUNUKIWA'))                                      return 'MINS';
    if (n.includes('POCHI LA BIASHARA') || n.includes('POCHI'))     return 'POCHI';
    if (n.includes('AIRTIME'))                                       return 'AIRTIME';
    if (n.includes('FULIZA'))                                        return 'FULIZA';
    if (n.includes('PAYBILL'))                                       return 'PAYBILL';
    if (n.includes('BUY GOODS') || n.includes('MERCHANT'))          return 'TILL PMT';
    if (n.includes('WITHDRAW'))                                      return 'WITHDRAWAL';
    if (n.includes('OKOA JAHAZI') || n.includes('OKOA'))            return 'EMERGENCY DATA';

    // P2P — extract first name, check frequentRoutes
    const p2p = name.match(/^(?:TO|sent to)\s+([A-Za-z]+)/i);
    if (p2p) {
        const first     = p2p[1].charAt(0).toUpperCase() + p2p[1].slice(1).toLowerCase();
        const routeKey  = first.toLowerCase();
        return STATE.frequentRoutes[routeKey] || first;
    }

    return name;
}


// ================================================================
//  6. CARRIER-AGNOSTIC SMART SHREDDER
// ================================================================
function shredSMS() {
    const input = document.getElementById('sms-area');
    const text  = input.value.trim();
    if (!text) { alert("No SMS text detected."); return; }

    // ── Balance regex (Safaricom + Airtel) ──
    const safBalRegex  = /(?:New|Your) M-PESA balance is (?:Ksh\s?)?([\d,]+\.?\d{0,2})/i;
    const airtelBalReg = /(?:Airtel Money [Bb]alance|balance is(?:\s*KES)?)[:\s]*(?:KES\s*)?([\d,]+\.?\d{0,2})/i;

    const safMatch    = text.match(safBalRegex);
    const airtelMatch = text.match(airtelBalReg);
    const balMatch    = safMatch || airtelMatch;
    const carrier     = safMatch ? 'SAFARICOM' : airtelMatch ? 'AIRTEL' : null;

    if (!balMatch) {
        alert("SHREDDER ERROR: Balance not detected.\nSupported formats: M-PESA, Airtel Money.");
        return;
    }

    const newTotal = parseFloat(balMatch[1].replace(/,/g, ''));
    const diff     = newTotal - STATE.balance;
    const absDiff  = Math.abs(diff);

    let label    = carrier === 'AIRTEL' ? "AIRTEL TRANS" : "M-PESA TRANS";
    let category = "General";
    let tag      = "";
    let p2pName  = null;  // for frequency tracking

    const t = text.toLowerCase();

    // ── DEBT DETECTION ──
    const isDebtFuliza = /fuliza/i.test(text);
    const isDebtOkoa   = /okoa/i.test(text);
    const isRepayment  = /repayment|paid.*fuliza|cleared.*fuliza|fuliza.*repaid/i.test(text);

    if (isRepayment) {
        STATE.liability = Math.max(0, STATE.liability - absDiff);
        localStorage.setItem('flux_liability', STATE.liability);
        label    = "DEBT REPAYMENT";
        category = "Debt";
        tag      = "[DEBT]";
    } else if (isDebtFuliza || isDebtOkoa) {
        STATE.liability += absDiff;
        localStorage.setItem('flux_liability', STATE.liability);
        label    = isDebtFuliza ? "FULIZA" : "OKOA JAHAZI";
        category = "Debt";
        tag      = "[DEBT]";
    }
    // ── BUY GOODS / TILL → [RETAIL] ──
    else if (/buy goods|till|retail/i.test(text)) {
        const tillMatch = text.match(/till\s+(?:no\.?|number)?\s*(\d+)/i);
        label    = tillMatch ? `TILL ${tillMatch[1]}` : "TILL PMT";
        category = "General";
        tag      = "[RETAIL]";
    }
    // ── PAYBILL → [SERVICE] ──
    else if (/pay bill|paybill/i.test(text)) {
        const pbMatch = text.match(/paybill.*?(\d{4,7})/i);
        label    = pbMatch ? `PAYBILL ${pbMatch[1]}` : "PAYBILL";
        category = "Utility";
        tag      = "[SERVICE]";
    }
    // ── P2P TRANSFER ──
    else if (/sent to|you sent/i.test(text)) {
        const nameMatch = text.match(/(?:sent to|you sent\s+KES[\d,.]+\s+to)\s+([A-Za-z][A-Za-z\s]+?)(?:\s+\d|\s+on\s|\s+via|\.)/i);
        if (nameMatch) {
            const rawName = nameMatch[1].trim().split(/\s+/)[0]; // first word
            const first   = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
            p2pName       = first;
            const routeKey = first.toLowerCase();
            label    = STATE.frequentRoutes[routeKey] || first;
        } else {
            label = "SENT MONEY";
        }
        category = "Transfer";
        tag      = "[P2P]";
    }
    // ── DATA / BUNDLE ──
    else if (/bundle|data bundles?/i.test(text)) {
        label    = "DATA";
        category = "Utility";
    }
    // ── AIRTIME ──
    else if (/airtime/i.test(text)) {
        label    = "AIRTIME";
        category = "Utility";
    }
    // ── WITHDRAWAL ──
    else if (/withdraw/i.test(text)) {
        label    = "WITHDRAWAL";
        category = "General";
    }
    // ── POCHI ──
    else if (/pochi/i.test(text)) {
        label    = "POCHI";
        category = "Transfer";
    }

    // ── SAVE TRANSACTION ──
    if (diff > 0) {
        STATE.inbound.push({ label, amount: absDiff, tag, carrier, timestamp: Date.now() });
        STATE.xp += 10;
    } else if (diff < 0) {
        STATE.outbound.push({ name: label, cost: absDiff, cat: category, commodityType: label, tag, carrier, timestamp: Date.now() });
    }

    STATE.balance = newTotal;
    input.value   = "";
    syncUI();

    // ── P2P FREQUENCY CHECK ──
    if (p2pName) {
        const routeKey = p2pName.toLowerCase();
        if (!STATE.frequentRoutes[routeKey]) {
            const count = STATE.outbound.filter(i =>
                i.tag === '[P2P]' &&
                (i.name.toLowerCase() === p2pName.toLowerCase() ||
                 (i.commodityType || '').toLowerCase() === p2pName.toLowerCase())
            ).length;
            if (count > 3) openRouteModal(p2pName, count);
        }
    }
}


// ================================================================
//  7. FREQUENT ROUTE MODAL
// ================================================================
function openRouteModal(name, count) {
    _pendingP2PName = name;
    const body = document.getElementById('route-modal-body');
    if (body) body.innerHTML = `<strong>${name}</strong> appears <strong>${count}</strong> times in your ledger. Assign a label for cleaner tracking.`;
    document.getElementById('route-label-input').value = '';
    document.getElementById('route-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('route-label-input').focus(), 100);
}
function confirmRouteLabel() {
    const label = document.getElementById('route-label-input').value.trim();
    if (!label || !_pendingP2PName) { skipRouteLabel(); return; }
    const routeKey = _pendingP2PName.toLowerCase();
    STATE.frequentRoutes[routeKey] = label;
    localStorage.setItem('flux_routes', JSON.stringify(STATE.frequentRoutes));
    document.getElementById('route-modal').style.display = 'none';
    _pendingP2PName = null;
    syncUI(); // refresh labels
}
function skipRouteLabel() {
    document.getElementById('route-modal').style.display = 'none';
    _pendingP2PName = null;
}


// ================================================================
//  8. RENDER & UI UPDATES
// ================================================================
function tagBadge(tag) {
    if (!tag) return '';
    const map = {
        '[RETAIL]':  '<span class="entry-tag tag-retail">RETAIL</span>',
        '[SERVICE]': '<span class="entry-tag tag-service">SERVICE</span>',
        '[P2P]':     '<span class="entry-tag tag-p2p">P2P</span>',
        '[DEBT]':    '<span class="entry-tag tag-debt">DEBT</span>'
    };
    return map[tag] || '';
}

function renderLists() {
    const outEl = document.getElementById('outbound-list');
    const inEl  = document.getElementById('inbound-list');
    if (!outEl || !inEl) return;

    outEl.innerHTML = STATE.outbound.slice(-6).reverse().map((i, idx) => {
        const actualIdx = STATE.outbound.length - 1 - idx;
        const type = i.commodityType ? `<em style="color:var(--text-dim);font-size:0.7rem;">${i.commodityType}</em>` : `<small>${i.cat}</small>`;
        return `
            <div class="log-entry">
                <div class="log-info"><b>${i.name}</b>${tagBadge(i.tag)}${type}</div>
                <div class="log-actions">
                    <span class="amount-out">-${i.cost.toLocaleString()}</span>
                    <button class="delete-btn" onclick="deleteEntry(${actualIdx})">&#215;</button>
                </div>
            </div>`;
    }).join('');

    inEl.innerHTML = STATE.inbound.slice(-4).reverse().map(i => `
        <div class="log-entry">
            <b>${i.label}</b>${tagBadge(i.tag)}
            <span class="amount-in">+${i.amount.toLocaleString()}</span>
        </div>
    `).join('');
}


// ================================================================
//  9. COLLAPSIBLE LEDGER — UNCHANGED
// ================================================================
function toggleLedger(type) {
    const panel     = document.getElementById('panel-' + type);
    const btn       = document.getElementById('btn-' + type);
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('ledger-active', !isVisible);
}


// ================================================================
//  10. UTILITY FUNCTIONS — UNCHANGED
// ================================================================
function getEngTier(xp) {
    if (xp < 200)  return "CAD INTERN";
    if (xp < 500)  return "JUNIOR TECHNICIAN";
    if (xp < 1000) return "PLANT ENGINEER";
    if (xp < 2500) return "CHIEF OPERATIONS OFFICER";
    return "INDUSTRIAL MAGNATE";
}
function getNextTierXP(xp) {
    if (xp < 200)  return 200;
    if (xp < 500)  return 500;
    if (xp < 1000) return 1000;
    if (xp < 2500) return 2500;
    return null;
}

function generateWeeklyReport() {
    const now         = Date.now();
    const oneWeekAgo  = now - 7 * 24 * 60 * 60 * 1000;
    const weeklySpend = STATE.outbound.filter(i => i.timestamp > oneWeekAgo);
    const total       = weeklySpend.reduce((s, i) => s + i.cost, 0);
    const container   = document.getElementById('weekly-report-content');
    if (!container) return;
    if (total === 0) { container.innerHTML = `<p class="dim-text">No weekly data.</p>`; return; }
    const categories = ["Food", "Transport", "Academic", "Utility", "Transfer", "General", "Debt"];
    let html = `<p class="neon-text" style="font-size:0.85rem; margin-bottom:8px;">TOTAL: KES ${total.toLocaleString()}</p>`;
    categories.forEach(cat => {
        const catTotal = weeklySpend.filter(i => i.cat === cat).reduce((s, i) => s + i.cost, 0);
        const pct      = ((catTotal / total) * 100).toFixed(0);
        if (catTotal > 0) {
            html += `<div class="report-item"><span>${cat}</span><span>${pct}%</span></div>
                     <div class="report-bar-wrap"><div class="report-bar-fill" style="width:${pct}%"></div></div>`;
        }
    });
    container.innerHTML = html;
}

function exportBlueprint() {
    let report = `APEX // FLUX — ENGINEERING LOG\nGenerated: ${new Date().toLocaleString()}\nTier: ${getEngTier(STATE.xp)}\nAssets: KES ${STATE.balance.toLocaleString()}\nLiability: KES ${STATE.liability.toLocaleString()}\n${'-'.repeat(45)}\n\n[OUTBOUND]\n`;
    STATE.outbound.forEach(i => {
        const type = i.commodityType || i.cat;
        report += `${new Date(i.timestamp).toLocaleDateString()} | ${i.name.padEnd(20)} | KES ${i.cost.toLocaleString().padStart(8)} | ${(i.tag || '').padEnd(9)} | (${type})\n`;
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Flux_Blueprint.txt'; a.click();
}


// ================================================================
//  11. AUTH & NAVIGATION
// ================================================================
let enteredPin = "";
function inputPin(n)  { if (enteredPin.length < 4) { enteredPin += n; document.getElementById('pin-input').value = '*'.repeat(enteredPin.length); } }
function clearPin()   { enteredPin = ""; document.getElementById('pin-input').value = ""; }

function verifyPin() {
    if (enteredPin === STATE.pin) {
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        check7DayReset();
        syncUI();
        updateBudgetProgress();
        startGhostWatcher();  // begin ghost mode idle tracking
    } else {
        alert("ACCESS DENIED");
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
    } else { alert("INVALID PIN"); }
}

function showModule(id) {
    document.querySelectorAll('.module-content').forEach(m => m.style.display = 'none');
    document.getElementById('mod-' + id).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    try { event.currentTarget.classList.add('active'); } catch(e) {}
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.classList.add('active');
    if (id === 'viz') initChart();
}
function launchModule(id) {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('modules-view').style.display   = 'flex';
    if (id === 'viz') initChart();
    showModule(id);
}
function goToDashboard() {
    document.getElementById('modules-view').style.display   = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    updateBudgetProgress();
}


// ================================================================
//  12. BUDGET CONTROL — UNCHANGED
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
    const barEl   = document.getElementById('budget-progress-bar');
    const spendEl = document.getElementById('budget-spend-display');
    const targEl  = document.getElementById('budget-target-display');
    const pctEl   = document.getElementById('budget-pct-display');
    if (!barEl) return;

    const now        = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekSpend  = STATE.outbound.filter(i => i.timestamp > oneWeekAgo).reduce((s, i) => s + i.cost, 0);
    const target     = STATE.weeklyTarget;

    if (spendEl) spendEl.innerText = `KES ${weekSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (targEl)  targEl.innerText  = target > 0 ? `KES ${target.toLocaleString()}` : 'NOT SET';

    const pct = target > 0 ? Math.min((weekSpend / target) * 100, 100) : 0;
    barEl.style.width = pct + '%';
    if (pct >= 100) { barEl.style.background = 'var(--danger)'; barEl.style.boxShadow = '0 0 10px rgba(255,49,49,0.4)'; }
    else if (pct > 70) { barEl.style.background = '#ffaa00'; barEl.style.boxShadow = '0 0 8px rgba(255,170,0,0.3)'; }
    else { barEl.style.background = 'var(--neon-green)'; barEl.style.boxShadow = '0 0 8px rgba(0,255,65,0.3)'; }

    if (pctEl) pctEl.innerText = target > 0 ? `${pct.toFixed(0)}%` : '--%';

    const dashView = document.getElementById('dashboard-view');
    if (dashView) {
        if (target > 0 && weekSpend > target) dashView.classList.add('overburn-active');
        else dashView.classList.remove('overburn-active');
    }
}


// ================================================================
//  13. VORTEX CHART — 7-day calendar aggregation
// ================================================================
function get7DayData() {
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
        const d    = new Date();
        d.setDate(d.getDate() - i);
        const ds   = d.toLocaleDateString();
        const amt  = STATE.outbound.filter(x => new Date(x.timestamp).toLocaleDateString() === ds).reduce((s, x) => s + x.cost, 0);
        data.push(amt);
        labels.push(d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' }));
    }
    return { labels, data };
}
function initChart() {
    const canvas      = document.getElementById('fluxChart');
    const placeholder = document.getElementById('vortex-placeholder');
    if (!canvas) return;

    const { labels, data } = get7DayData();
    const hasData = data.some(v => v > 0);

    if (!hasData) {
        canvas.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        return;
    }
    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';

    if (fluxChart) {
        fluxChart.data.labels           = labels;
        fluxChart.data.datasets[0].data = data;
        fluxChart.update();
        return;
    }
    const ctx = canvas.getContext('2d');
    fluxChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'KES Spent', borderColor: '#00ff41',
                backgroundColor: 'rgba(0,255,65,0.06)',
                data, tension: 0.3,
                pointBackgroundColor: '#00ff41', pointRadius: 4, fill: true
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#88929b', font: { family: 'Rajdhani', size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#88929b', font: { family: 'Rajdhani', size: 11 }, callback: v => 'KES ' + v.toLocaleString() } }
            }
        }
    });
}
function updateChart() {
    if (!fluxChart) return;
    const { labels, data } = get7DayData();
    fluxChart.data.labels           = labels;
    fluxChart.data.datasets[0].data = data;
    fluxChart.update();
}


// ================================================================
//  14. MANUAL ENTRY — TWO-STEP COMMODITY FLOW
// ================================================================
function openCommodityModal() {
    const name = document.getElementById('item-name').value.trim();
    const cost = parseFloat(document.getElementById('item-cost').value);
    if (!name || isNaN(cost) || cost <= 0) { alert("Enter item label and cost first."); return; }
    _pendingEntry = { name, cost, cat: document.getElementById('item-category').value };
    document.getElementById('commodity-input').value = '';
    document.getElementById('commodity-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('commodity-input').focus(), 100);
}
function setCommodity(type) { document.getElementById('commodity-input').value = type; }
function closeCommodityModal() { document.getElementById('commodity-modal').style.display = 'none'; _pendingEntry = null; }
function confirmManualEntry() {
    if (!_pendingEntry) return;
    const commodityType = document.getElementById('commodity-input').value.trim() || _pendingEntry.cat;
    // Determine tag from category
    let tag = '';
    if (_pendingEntry.cat === 'Transport') tag = '[P2P]';

    STATE.outbound.push({
        name: _pendingEntry.name, cost: _pendingEntry.cost,
        cat: _pendingEntry.cat, commodityType, tag, timestamp: Date.now()
    });
    STATE.balance -= _pendingEntry.cost;
    document.getElementById('item-name').value = '';
    document.getElementById('item-cost').value = '';
    document.getElementById('commodity-input').value = '';
    document.getElementById('commodity-modal').style.display = 'none';
    _pendingEntry = null;
    syncUI();
}
// Legacy shim
function addManualEntry() { openCommodityModal(); }


// ================================================================
//  15. 7-DAY VORTEX RESET
// ================================================================
function check7DayReset() {
    if (Date.now() > STATE.lastReset + 7 * 24 * 60 * 60 * 1000) executeVortexReset();
}
function getTopCategory() {
    const cats = {};
    STATE.outbound.forEach(i => { const k = i.commodityType || i.cat || 'General'; cats[k] = (cats[k] || 0) + i.cost; });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : 'N/A';
}
function calculateEfficiencyGrade() {
    const total = STATE.outbound.reduce((s, i) => s + i.cost, 0);
    if (STATE.weeklyTarget <= 0) return { grade: 'B', desc: 'NO TARGET SET', detail: `KES ${total.toLocaleString()} deployed this cycle.` };
    const ratio = total / STATE.weeklyTarget;
    if (ratio <= 0.70) return { grade: 'A', desc: 'OPERATING WITHIN MARGINS',  detail: `Deployed ${(ratio*100).toFixed(0)}% of budget. KES ${(STATE.weeklyTarget - total).toLocaleString()} surplus.` };
    if (ratio <= 0.90) return { grade: 'B', desc: 'EFFICIENT OPERATIONS',      detail: `Deployed ${(ratio*100).toFixed(0)}% of budget — solid week.` };
    if (ratio <= 1.10) return { grade: 'C', desc: 'MARGINAL PERFORMANCE',      detail: `Deployed ${(ratio*100).toFixed(0)}% of budget. Tighten next cycle.` };
    return { grade: 'D', desc: 'OVERBURN — BUDGET EXCEEDED', detail: `KES ${(total - STATE.weeklyTarget).toLocaleString()} over target.` };
}
function executeVortexReset() {
    const gradeData  = calculateEfficiencyGrade();
    const totalSpent = STATE.outbound.reduce((s, i) => s + i.cost, 0);
    const snapshot   = {
        week_start: new Date(STATE.lastReset).toISOString(),
        total_spent: totalSpent,
        budget_met: STATE.weeklyTarget > 0 ? totalSpent <= STATE.weeklyTarget : null,
        top_category: getTopCategory(),
        grade: gradeData.grade
    };
    STATE.apexHistory.push(snapshot);
    if (STATE.apexHistory.length > 12) STATE.apexHistory = STATE.apexHistory.slice(-12);
    localStorage.setItem('apex_history', JSON.stringify(STATE.apexHistory));

    STATE.outbound  = [];
    STATE.inbound   = [];
    STATE.lastReset = Date.now();
    STATE.xp       += 25;
    localStorage.setItem('flux_last_reset', STATE.lastReset.toString());
    localStorage.setItem('flux_out', JSON.stringify([]));
    localStorage.setItem('flux_in',  JSON.stringify([]));

    showEfficiencyGrade(gradeData);
}
function showEfficiencyGrade(g) {
    const el = document.getElementById('grade-notification');
    document.getElementById('grade-value').textContent  = g.grade;
    document.getElementById('grade-desc').textContent   = g.desc;
    document.getElementById('grade-detail').textContent = g.detail;
    const gradeEl = document.getElementById('grade-value');
    gradeEl.className = 'grade-notif-grade';
    if (g.grade === 'B') gradeEl.classList.add('grade-b');
    if (g.grade === 'C') gradeEl.classList.add('grade-c');
    if (g.grade === 'D') gradeEl.classList.add('grade-d');
    el.style.display = 'flex';
}
function dismissGrade() { document.getElementById('grade-notification').style.display = 'none'; }


// ================================================================
//  16. LOCAL ADVISOR — Rule Engine (no API)
// ================================================================
let advisorHistory = [];

function toggleAdvisor() {
    const panel    = document.getElementById('advisor-panel');
    const fab      = document.getElementById('advisor-fab');
    const backdrop = document.getElementById('advisor-backdrop');
    const isOpen   = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    fab.classList.toggle('open', !isOpen);
    backdrop.classList.toggle('visible', !isOpen);

    if (!isOpen && !advisorGreeted) {
        advisorGreeted = true;
        showAdvisorTerminal();
        setTimeout(() => {
            hideAdvisorTerminal();
            appendAdvisorMessage('advisor', buildLocalGreeting());
        }, 1500);
    }
}

function getThisWeekSpend() {
    return STATE.outbound.filter(i => i.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000).reduce((s, i) => s + i.cost, 0);
}

function buildLocalGreeting() {
    const thisWeek = getThisWeekSpend();
    const lastWeek = STATE.apexHistory.length > 0 ? STATE.apexHistory[STATE.apexHistory.length - 1] : null;
    let msg = '';

    if (lastWeek && lastWeek.total_spent > 0) {
        const pct = ((thisWeek - lastWeek.total_spent) / lastWeek.total_spent * 100);
        msg = pct <= 0
            ? `Yo, you're crushing it — spend is down ${Math.abs(pct).toFixed(1)}% vs last cycle (KES ${lastWeek.total_spent.toLocaleString()}). That's discipline.`
            : `Heads up — we're ${pct.toFixed(1)}% above last cycle's pace. Let's recalibrate before this trends wrong.`;
    } else {
        msg = `APEX Advisor online. ${STATE.apexHistory.length === 0 ? "First session — building your baseline." : "Welcome back."} Tier: ${getEngTier(STATE.xp)}.`;
    }

    if (STATE.liability > 0) {
        msg += ` Liability flag: KES ${STATE.liability.toLocaleString()} in active debt — clear this first.`;
    }
    if (STATE.weeklyTarget > 0) {
        const rem = STATE.weeklyTarget - thisWeek;
        if (rem > 0) {
            const days = Math.max(7 - new Date().getDay(), 1);
            msg += ` Daily safe limit: KES ${Math.floor(rem / days).toLocaleString()}.`;
        } else {
            msg += ` Real talk — KES ${Math.abs(rem).toLocaleString()} over budget. Overburn active.`;
        }
    }
    return msg;
}

// ── Rule Engine ──────────────────────────────────────────────────
function generateLocalResponse(query) {
    const q          = query.toLowerCase();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekItems  = STATE.outbound.filter(i => i.timestamp > oneWeekAgo);
    const thisWeek   = weekItems.reduce((s, i) => s + i.cost, 0);

    // Count tags
    const retailItems  = weekItems.filter(i => i.tag === '[RETAIL]');
    const serviceItems = weekItems.filter(i => i.tag === '[SERVICE]');
    const debtItems    = weekItems.filter(i => i.tag === '[DEBT]');
    const retailTotal  = retailItems.reduce((s, i) => s + i.cost, 0);
    const serviceTotal = serviceItems.reduce((s, i) => s + i.cost, 0);

    // Count commodities
    const commodityCounts = {};
    weekItems.forEach(i => {
        const k = (i.commodityType || '').toLowerCase();
        if (k) commodityCounts[k] = (commodityCounts[k] || 0) + 1;
    });
    const supperCount = (commodityCounts['supper'] || 0) + (commodityCounts['food'] || 0) + (commodityCounts['lunch'] || 0);
    const fareCount   = (commodityCounts['fare'] || 0) + (commodityCounts['transport'] || 0);

    // ── RETAIL HIGH ──
    if (q.includes('retail') || (retailItems.length >= 3 && (q.includes('buy') || q.includes('goods') || q.includes('shop') || q.includes('spend')))) {
        return `Retail spend is elevated — ${retailItems.length} till transactions totalling KES ${retailTotal.toLocaleString()} this cycle. Bulk buying from Gikomba or Toi Market can cut 20–30% off staples. Consider consolidating grocery runs to one weekly trip.`;
    }
    // ── SERVICE HIGH ──
    if (q.includes('service') || q.includes('paybill') || (serviceItems.length >= 2 && q.includes('spend'))) {
        return `Service payments detected: ${serviceItems.length} paybill entries (KES ${serviceTotal.toLocaleString()}). Review which can be replaced with data bundles — Safaricom weekly bundles are typically 40% cheaper than equivalent paybill payments. Consider bundled DSTV Lite packages if this is streaming.`;
    }
    // ── DEBT ──
    if (q.includes('debt') || q.includes('fuliza') || q.includes('okoa') || q.includes('liability')) {
        const lib = STATE.liability;
        if (lib === 0) return `No active debt detected in your ledger. Liability gauge is clear.`;
        return `Active liability: KES ${lib.toLocaleString()}. Fuliza/Okoa compounds at ~1% daily — clearing this before discretionary spend is the highest-ROI move. If Fuliza repayment was auto-deducted, paste that SMS into the Shredder to log it.`;
    }
    // ── FOOD / SUPPER ──
    if (q.includes('food') || q.includes('supper') || supperCount > 2) {
        return `Observation: Food margins are thin — ${supperCount > 0 ? supperCount + ' food entries' : 'multiple entries'} this cycle. Relocate to Mama Dua Kiosk for ~15% savings. Sunday meal prep can cut daily food spend by KES 50–80.`;
    }
    // ── TRANSPORT / FARE ──
    if (q.includes('fare') || q.includes('transport') || fareCount > 2) {
        return `Tactical tip: Walking to Lurambi Stage saves KES 30/day — KES ${fareCount * 30} in potential cycle recovery. ${fareCount > 2 ? 'High frequency flagged: ' + fareCount + ' entries. ' : ''}Activate the walking protocol for an efficiency XP boost.`;
    }
    // ── BUDGET ──
    if (q.includes('budget') || q.includes('status') || q.includes('how much') || q.includes('remaining')) {
        const rem = STATE.weeklyTarget > 0 ? STATE.weeklyTarget - thisWeek : null;
        if (!rem) return `No weekly budget armed. Set a target in Sentry Control to activate full burn-rate monitoring. Current cycle: KES ${thisWeek.toLocaleString()}.`;
        const days = Math.max(7 - new Date().getDay(), 1);
        if (rem < 0) return `Overburn confirmed — KES ${Math.abs(rem).toLocaleString()} over target. Lockdown: essentials only until cycle reset.`;
        return `Budget remaining: KES ${rem.toLocaleString()} over ${days} day(s). Daily safe limit: KES ${Math.floor(rem / days).toLocaleString()}. Operating within margins.`;
    }
    // ── XP / TIER ──
    if (q.includes('xp') || q.includes('tier') || q.includes('rank')) {
        const next = getNextTierXP(STATE.xp);
        return `Tier: ${getEngTier(STATE.xp)} at ${STATE.xp} XP. ${next ? 'Next tier at ' + next + ' XP — ' + (next - STATE.xp) + ' to go.' : 'Max tier. Industrial Magnate status locked.'} Consistent under-budget weeks are the fastest XP path.`;
    }
    // ── AUTO-SCAN ──
    if (retailItems.length >= 3) return `Auto-scan: High retail frequency (${retailItems.length} till transactions). Bulk buying protocol recommended.`;
    if (serviceItems.length >= 2) return `Auto-scan: ${serviceItems.length} service payments. Review data bundle alternatives — significant margin recovery available.`;

    return `Ledger scan: KES ${thisWeek.toLocaleString()} this cycle. ${STATE.weeklyTarget > 0 ? 'Budget: ' + ((thisWeek/STATE.weeklyTarget)*100).toFixed(0) + '%.' : 'No target set.'} Query: "retail", "service", "debt", "food", "fare", "budget", or "xp".`;
}

// ── Chat wiring ──────────────────────────────────────────────────
function showAdvisorTerminal() {
    const msgs = document.getElementById('advisor-messages');
    if (!msgs) return;
    const el = document.createElement('div');
    el.id = 'adv-terminal-line'; el.className = 'adv-msg adv-advisor';
    el.innerHTML = `<div class="adv-sender">LOCAL ADVISOR</div><div class="adv-terminal">[ PROCESSING MARGINS... ]</div>`;
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight;
}
function hideAdvisorTerminal() { const el = document.getElementById('adv-terminal-line'); if (el) el.remove(); }
function appendAdvisorMessage(role, text) {
    const msgs = document.getElementById('advisor-messages');
    if (!msgs) return;
    const w = document.createElement('div');
    w.className = `adv-msg adv-${role}`;
    w.innerHTML = `<div class="adv-sender">${role === 'user' ? 'YOU' : 'LOCAL ADVISOR'}</div><div class="adv-bubble">${text}</div>`;
    msgs.appendChild(w); msgs.scrollTop = msgs.scrollHeight;
}

function sendAdvisorMessage() {
    const inputEl = document.getElementById('advisor-input');
    const msg     = inputEl ? inputEl.value.trim() : '';
    if (!msg) return;
    inputEl.value    = '';
    inputEl.disabled = true;
    appendAdvisorMessage('user', msg);
    advisorHistory.push(msg);
    showAdvisorTerminal();
    setTimeout(() => {
        hideAdvisorTerminal();
        appendAdvisorMessage('advisor', generateLocalResponse(msg));
        inputEl.disabled = false;
        inputEl.focus();
    }, 1500);
}
