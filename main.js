// ================================================================
//  APEX // FLUX v7.0 — TACTICAL INTELLIGENCE ENGINE
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
    lastReset:     parseInt(localStorage.getItem('flux_last_reset'))     || Date.now(),
    isPrivate:     true,
    pin:           "1234"
};

// Pending manual entry temp storage
let _pendingEntry = null;
// Chart instance
let fluxChart = null;
// Advisor state
let advisorGreeted = false;

document.addEventListener('DOMContentLoaded', () => {
    // Do not call syncUI on load — dashboard is hidden until PIN is entered.
    // syncUI will be called inside verifyPin().
});


// ================================================================
//  PHASE 1 — LANDING
// ================================================================
function initializeSystem() {
    document.getElementById('landing-view').style.display = 'none';
    const overlay = document.getElementById('guardian-overlay');
    overlay.style.display = 'flex';
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

    if (todaySpend > 200) {
        STATE.xp = Math.max(0, STATE.xp - 2);
    }

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
    STATE.outbound.splice(index, 1);
    STATE.xp = Math.max(0, STATE.xp - 5);
    syncUI();
    console.log(`[ROLLBACK] ${item.name} removed. KES ${item.cost} restored.`);
}


// ================================================================
//  3. CORE SYSTEM SYNC — UNCHANGED logic, safe null checks added
// ================================================================
function syncUI() {
    runEfficiencyDiagnostic();

    localStorage.setItem('flux_bal', STATE.balance);
    localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
    localStorage.setItem('flux_in',  JSON.stringify(STATE.inbound));
    localStorage.setItem('flux_xp',  STATE.xp);

    // Balance display
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

    // Privacy status badge
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

    // XP + tier
    const xpEl   = document.getElementById('xp-display');
    const tierEl = document.getElementById('tier-name');
    if (xpEl)   xpEl.innerText   = STATE.xp;
    if (tierEl) tierEl.innerText = getEngTier(STATE.xp);

    // Gauge
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

    renderLists();
    updateChart();
    generateWeeklyReport();
    updateBudgetProgress();
}


// ================================================================
//  4. DATA NORMALIZATION — UNCHANGED
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

    const p2p = name.match(/^(?:TO|sent to)\s+([A-Za-z]+)/i);
    if (p2p) {
        const first = p2p[1];
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    return name;
}


// ================================================================
//  5. SMART SHREDDER — UNCHANGED
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

        label = normalizeLabel(label);

        if (diff > 0) {
            STATE.inbound.push({ label, amount: absDiff, timestamp: Date.now() });
            STATE.xp += 10;
        } else if (diff < 0) {
            STATE.outbound.push({ name: label, cost: absDiff, cat: category, commodityType: label, timestamp: Date.now() });
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
    const outEl = document.getElementById('outbound-list');
    const inEl  = document.getElementById('inbound-list');
    if (!outEl || !inEl) return;

    outEl.innerHTML = STATE.outbound.slice(-6).reverse().map((i, idx) => {
        const actualIdx = STATE.outbound.length - 1 - idx;
        const type = i.commodityType ? `<em style="color:var(--text-dim);font-size:0.7rem;">${i.commodityType}</em>` : `<small>${i.cat}</small>`;
        return `
            <div class="log-entry">
                <div class="log-info"><b>${i.name}</b>${type}</div>
                <div class="log-actions">
                    <span class="amount-out">-${i.cost.toLocaleString()}</span>
                    <button class="delete-btn" onclick="deleteEntry(${actualIdx})">&#215;</button>
                </div>
            </div>`;
    }).join('');

    inEl.innerHTML = STATE.inbound.slice(-4).reverse().map(i => `
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

function getNextTierXP(xp) {
    if (xp < 200)  return 200;
    if (xp < 500)  return 500;
    if (xp < 1000) return 1000;
    if (xp < 2500) return 2500;
    return null;
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
    let report = `APEX // FLUX — ENGINEERING LOG\nGenerated: ${new Date().toLocaleString()}\nTier: ${getEngTier(STATE.xp)}\nAssets: KES ${STATE.balance.toLocaleString()}\n-------------------------------------------\n\n[OUTBOUND]\n`;
    STATE.outbound.forEach(i => {
        const type = i.commodityType ? i.commodityType : i.cat;
        report += `${new Date(i.timestamp).toLocaleDateString()} | ${i.name.padEnd(20)} | KES ${i.cost.toLocaleString().padStart(8)} | (${type})\n`;
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Flux_Blueprint.txt`;
    a.click();
}


// ================================================================
//  9. AUTH & NAVIGATION
// ================================================================
let enteredPin = "";
function inputPin(n)  { if (enteredPin.length < 4) { enteredPin += n; document.getElementById('pin-input').value = "*".repeat(enteredPin.length); } }
function clearPin()   { enteredPin = ""; document.getElementById('pin-input').value = ""; }

function verifyPin() {
    if (enteredPin === STATE.pin) {
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        // Run 7-day reset check on every login
        check7DayReset();
        syncUI();
        updateBudgetProgress();
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
    try { event.currentTarget.classList.add('active'); } catch (e) {}
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.classList.add('active');
    // Lazy chart init when vortex is opened
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
//  10. BUDGET CONTROL — UNCHANGED
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

    if (pct >= 100) {
        barEl.style.background = 'var(--danger)';
        barEl.style.boxShadow  = '0 0 10px rgba(255,49,49,0.4)';
    } else if (pct > 70) {
        barEl.style.background = '#ffaa00';
        barEl.style.boxShadow  = '0 0 8px rgba(255,170,0,0.3)';
    } else {
        barEl.style.background = 'var(--neon-green)';
        barEl.style.boxShadow  = '0 0 8px rgba(0,255,65,0.3)';
    }

    if (pctEl) pctEl.innerText = target > 0 ? `${pct.toFixed(0)}%` : '--%';

    // Overburn state
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
//  11. VORTEX CHART — Aggregated by day, with placeholder
// ================================================================
function get7DaySpendData() {
    const labels = [];
    const data   = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr   = d.toLocaleDateString();
        const daySpend = STATE.outbound
            .filter(item => new Date(item.timestamp).toLocaleDateString() === dayStr)
            .reduce((s, item) => s + item.cost, 0);
        data.push(daySpend);
        labels.push(d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' }));
    }
    return { labels, data };
}

function initChart() {
    const canvas      = document.getElementById('fluxChart');
    const placeholder = document.getElementById('vortex-placeholder');
    if (!canvas) return;

    const { labels, data } = get7DaySpendData();
    const hasData = data.some(v => v > 0);

    if (!hasData) {
        // Show placeholder, hide canvas
        canvas.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        return;
    }

    // Has data — hide placeholder, show canvas
    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';

    if (fluxChart) {
        // Update existing chart
        fluxChart.data.labels            = labels;
        fluxChart.data.datasets[0].data  = data;
        fluxChart.update();
        return;
    }

    const ctx = canvas.getContext('2d');
    fluxChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label:           'KES Spent',
                borderColor:     '#00ff41',
                backgroundColor: 'rgba(0,255,65,0.06)',
                data,
                tension:         0.3,
                pointBackgroundColor: '#00ff41',
                pointRadius:     4,
                fill:            true
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid:  { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#88929b', font: { family: 'Rajdhani', size: 11 } }
                },
                y: {
                    grid:  { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#88929b', font: { family: 'Rajdhani', size: 11 }, callback: v => 'KES ' + v.toLocaleString() }
                }
            }
        }
    });
}

function updateChart() {
    if (!fluxChart) return;
    const { labels, data } = get7DaySpendData();
    fluxChart.data.labels           = labels;
    fluxChart.data.datasets[0].data = data;
    fluxChart.update();
}


// ================================================================
//  12. MANUAL ENTRY — TWO-STEP COMMODITY FLOW
// ================================================================
function openCommodityModal() {
    const name = document.getElementById('item-name').value.trim();
    const cost = parseFloat(document.getElementById('item-cost').value);
    const cat  = document.getElementById('item-category').value;

    if (!name || isNaN(cost) || cost <= 0) {
        alert("Enter item label and cost first.");
        return;
    }

    // Store pending entry
    _pendingEntry = { name, cost, cat };

    // Clear and show modal
    document.getElementById('commodity-input').value = '';
    document.getElementById('commodity-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('commodity-input').focus(), 100);
}

function setCommodity(type) {
    document.getElementById('commodity-input').value = type;
}

function closeCommodityModal() {
    document.getElementById('commodity-modal').style.display = 'none';
    _pendingEntry = null;
}

function confirmManualEntry() {
    if (!_pendingEntry) return;

    const commodityType = document.getElementById('commodity-input').value.trim() || _pendingEntry.cat;

    STATE.outbound.push({
        name:          _pendingEntry.name,
        cost:          _pendingEntry.cost,
        cat:           _pendingEntry.cat,
        commodityType: commodityType,
        timestamp:     Date.now()
    });
    STATE.balance -= _pendingEntry.cost;
    STATE.xp = Math.max(0, STATE.xp); // no XP change on manual entry

    // Clear form
    document.getElementById('item-name').value  = '';
    document.getElementById('item-cost').value  = '';
    document.getElementById('commodity-input').value = '';
    document.getElementById('commodity-modal').style.display = 'none';
    _pendingEntry = null;

    syncUI();
}

// Legacy addManualEntry kept as fallback (called by nothing in v7 but preserved)
function addManualEntry() {
    openCommodityModal();
}


// ================================================================
//  13. 7-DAY VORTEX RESET — Archive + Efficiency Grade
// ================================================================
function check7DayReset() {
    const lastReset = STATE.lastReset;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (Date.now() > lastReset + sevenDays) {
        executeVortexReset();
    }
}

function calculateEfficiencyGrade() {
    const total  = STATE.outbound.reduce((s, i) => s + i.cost, 0);
    if (STATE.weeklyTarget <= 0) {
        // Grade by absolute spending discipline (without a budget)
        if (total === 0) return { grade: 'A', desc: 'ZERO SPEND — MAXIMUM EFFICIENCY', detail: 'No expenditure this cycle.' };
        return { grade: 'B', desc: 'OPERATING WITHOUT TARGET', detail: `KES ${total.toLocaleString()} deployed. Set a weekly budget for precise grading.` };
    }
    const ratio = total / STATE.weeklyTarget;
    if (ratio <= 0.70) return { grade: 'A', desc: 'OPERATING WITHIN MARGINS', detail: `Deployed ${(ratio*100).toFixed(0)}% of budget. KES ${(STATE.weeklyTarget - total).toLocaleString()} surplus.` };
    if (ratio <= 0.90) return { grade: 'B', desc: 'EFFICIENT OPERATIONS', detail: `Deployed ${(ratio*100).toFixed(0)}% of budget — solid week.` };
    if (ratio <= 1.10) return { grade: 'C', desc: 'MARGINAL PERFORMANCE', detail: `Deployed ${(ratio*100).toFixed(0)}% of budget. Tighten spend next cycle.` };
    return { grade: 'D', desc: 'OVERBURN — BUDGET EXCEEDED', detail: `KES ${(total - STATE.weeklyTarget).toLocaleString()} over target. Recalibrate immediately.` };
}

function getTopCategory() {
    const cats = {};
    STATE.outbound.forEach(i => {
        const key = i.commodityType || i.cat || 'General';
        cats[key] = (cats[key] || 0) + i.cost;
    });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : 'N/A';
}

function executeVortexReset() {
    // 1. Calculate grade BEFORE wiping
    const gradeData  = calculateEfficiencyGrade();
    const totalSpent = STATE.outbound.reduce((s, i) => s + i.cost, 0);

    // 2. Archive snapshot
    const snapshot = {
        week_start:   new Date(STATE.lastReset).toISOString(),
        total_spent:  totalSpent,
        budget_met:   STATE.weeklyTarget > 0 ? totalSpent <= STATE.weeklyTarget : null,
        top_category: getTopCategory(),
        grade:        gradeData.grade
    };
    STATE.apexHistory.push(snapshot);
    if (STATE.apexHistory.length > 12) STATE.apexHistory = STATE.apexHistory.slice(-12);
    localStorage.setItem('apex_history', JSON.stringify(STATE.apexHistory));

    // 3. Wipe active ledger
    STATE.outbound = [];
    STATE.inbound  = [];

    // 4. Update reset timestamp
    STATE.lastReset = Date.now();
    localStorage.setItem('flux_last_reset', STATE.lastReset.toString());
    localStorage.setItem('flux_out', JSON.stringify([]));
    localStorage.setItem('flux_in',  JSON.stringify([]));

    // 5. XP bonus for completing a cycle
    STATE.xp += 25;

    // 6. Show grade notification
    showEfficiencyGrade(gradeData);
}

function showEfficiencyGrade(gradeData) {
    const notif   = document.getElementById('grade-notification');
    const gradeEl = document.getElementById('grade-value');
    const descEl  = document.getElementById('grade-desc');
    const detailEl= document.getElementById('grade-detail');

    gradeEl.textContent  = gradeData.grade;
    descEl.textContent   = gradeData.desc;
    detailEl.textContent = gradeData.detail;

    // Colour-code the grade
    gradeEl.className = 'grade-notif-grade';
    if (gradeData.grade === 'B') gradeEl.classList.add('grade-b');
    if (gradeData.grade === 'C') gradeEl.classList.add('grade-c');
    if (gradeData.grade === 'D') gradeEl.classList.add('grade-d');

    notif.style.display = 'flex';
}

function dismissGrade() {
    document.getElementById('grade-notification').style.display = 'none';
}


// ================================================================
//  14. LOCAL ADVISOR — Zero API, commodity-type rule engine
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
        // Greeting with 1.5s processing delay
        showAdvisorTerminal();
        setTimeout(() => {
            hideAdvisorTerminal();
            appendAdvisorMessage('advisor', buildLocalGreeting());
        }, 1500);
    }
}

function buildLocalGreeting() {
    const thisWeek = getThisWeekSpend();
    const history  = STATE.apexHistory;
    const lastWeek = history.length > 0 ? history[history.length - 1] : null;
    let   msg      = '';

    if (lastWeek && lastWeek.total_spent > 0) {
        const pctChange = ((thisWeek - lastWeek.total_spent) / lastWeek.total_spent) * 100;
        const absPct    = Math.abs(pctChange).toFixed(1);
        if (pctChange <= 0) {
            msg = `Yo, you're crushing it — spend is down ${absPct}% vs last cycle (KES ${lastWeek.total_spent.toLocaleString()}). That's discipline.`;
        } else {
            msg = `Heads up — we're ${absPct}% above last cycle's pace (KES ${lastWeek.total_spent.toLocaleString()}). Let's recalibrate before this trends wrong.`;
        }
    } else {
        msg = `APEX Advisor online. ${history.length === 0 ? "First session — building your baseline." : "Welcome back."} Tier: ${getEngTier(STATE.xp)}.`;
    }

    if (STATE.weeklyTarget > 0) {
        const remaining = STATE.weeklyTarget - thisWeek;
        if (remaining > 0) {
            const dayOfWeek  = new Date().getDay();
            const daysLeft   = Math.max(7 - dayOfWeek, 1);
            const dailyLimit = Math.floor(remaining / daysLeft);
            msg += ` Daily safe limit: KES ${dailyLimit.toLocaleString()}.`;
        } else {
            msg += ` Real talk — KES ${Math.abs(remaining).toLocaleString()} over budget. Overburn state active.`;
        }
    }

    return msg;
}

function getThisWeekSpend() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return STATE.outbound.filter(i => i.timestamp > oneWeekAgo).reduce((s, i) => s + i.cost, 0);
}

// ─── Local Rule Engine ───────────────────────────────────────────
function generateLocalResponse(query) {
    const q          = query.toLowerCase();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekItems  = STATE.outbound.filter(i => i.timestamp > oneWeekAgo);
    const thisWeek   = weekItems.reduce((s, i) => s + i.cost, 0);

    // Count commodity types (case-insensitive)
    const typeCounts = {};
    weekItems.forEach(i => {
        const key = (i.commodityType || i.cat || '').toLowerCase().trim();
        if (key) typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    const supperCount    = (typeCounts['supper'] || 0) + (typeCounts['food'] || 0) + (typeCounts['lunch'] || 0) + (typeCounts['dinner'] || 0);
    const fareCount      = (typeCounts['fare'] || 0) + (typeCounts['transport'] || 0) + (typeCounts['matatu'] || 0);
    const printCount     = (typeCounts['printing'] || 0) + (typeCounts['print'] || 0);
    const snackCount     = typeCounts['snack'] || 0;
    const dataCount      = (typeCounts['data'] || 0) + (typeCounts['airtime'] || 0);

    // ── FOOD / SUPPER ──
    if (q.includes('food') || q.includes('supper') || q.includes('eat') || q.includes('lunch') || q.includes('dinner')) {
        return `Observation: Food margins are thin — ${supperCount > 0 ? supperCount + ' food entries' : 'multiple food entries'} detected this cycle. Relocate to Mama Dua Kiosk for an estimated 15% savings. Consider meal prep on Sundays to cut daily spend by KES 50–80.`;
    }
    // ── TRANSPORT / FARE ──
    if (q.includes('fare') || q.includes('transport') || q.includes('matatu') || q.includes('boda') || fareCount > 2) {
        return `Tactical Tip: Walking to Lurambi Stage saves KES 30/day — KES 210/week. ${fareCount > 2 ? 'You have ' + fareCount + ' fare entries this cycle — high frequency flagged. ' : ''}Activate the walking protocol and an XP efficiency bonus is queued at next cycle reset.`;
    }
    // ── PRINTING ──
    if (q.includes('print') || q.includes('printing') || printCount > 0) {
        return `Signal: ${printCount > 0 ? printCount + ' printing entries' : 'Printing activity'} logged. Check if CAT reports can be submitted digitally — saves KES 20–50/job. Library printing at KES 5/page is available as an alternative channel.`;
    }
    // ── BUDGET / SPEND ──
    if (q.includes('budget') || q.includes('spend') || q.includes('status') || q.includes('how much')) {
        const remaining = STATE.weeklyTarget > 0 ? STATE.weeklyTarget - thisWeek : null;
        if (!remaining) return `No weekly budget armed. Set a target in the Sentry Control card to activate full burn-rate monitoring. Current cycle spend: KES ${thisWeek.toLocaleString()}.`;
        if (remaining < 0) return `Overburn confirmed — KES ${Math.abs(remaining).toLocaleString()} over budget. Lock down discretionary spend immediately. Only essentials until cycle reset.`;
        const daysLeft   = Math.max(7 - new Date().getDay(), 1);
        const dailyLimit = Math.floor(remaining / daysLeft);
        return `Budget status: KES ${remaining.toLocaleString()} remaining over ${daysLeft} day(s). Daily safe limit: KES ${dailyLimit.toLocaleString()}. Operating within margins — let's keep it locked in.`;
    }
    // ── XP / TIER ──
    if (q.includes('xp') || q.includes('tier') || q.includes('rank') || q.includes('level')) {
        const next = getNextTierXP(STATE.xp);
        return `Tier: ${getEngTier(STATE.xp)} at ${STATE.xp} XP. ${next ? 'Next tier at ' + next + ' XP — ' + (next - STATE.xp) + ' to go.' : 'Max tier achieved.'} Consistent weekly under-budget performance is the fastest XP path.`;
    }
    // ── DATA / AIRTIME ──
    if (q.includes('data') || q.includes('airtime') || dataCount > 2) {
        return `Data/airtime: ${dataCount} entries this cycle. Consider Safaricom's weekly bundles over daily top-ups — typically 20–30% cheaper per MB. Okoa Jahazi is an emergency option only; it compounds cost.`;
    }
    // ── SCAN (auto-detect top issue) ──
    if (supperCount > 3) return `Auto-scan: Food entries dominate this cycle (${supperCount}). Mama Dua Kiosk protocol recommended — 15% margin recovery estimated.`;
    if (fareCount > 2)  return `Auto-scan: High transport frequency (${fareCount} entries). Walking protocol to Lurambi Stage — KES 30/day, KES ${fareCount * 30} potential recovery.`;
    if (printCount > 2) return `Auto-scan: ${printCount} printing entries flagged. Digital submission where possible eliminates this spend category entirely.`;

    // ── DEFAULT ──
    return `Ledger scan complete. Week spend: KES ${thisWeek.toLocaleString()}. ${STATE.weeklyTarget > 0 ? 'Budget utilization: ' + ((thisWeek/STATE.weeklyTarget)*100).toFixed(0) + '%.' : 'No target armed.'} Query: "food", "fare", "printing", "budget", or "xp" for targeted analysis.`;
}

// ─── Chat wiring ─────────────────────────────────────────────────
function showAdvisorTerminal() {
    const msgs = document.getElementById('advisor-messages');
    if (!msgs) return;
    const el = document.createElement('div');
    el.id = 'adv-terminal-line';
    el.className = 'adv-msg adv-advisor';
    el.innerHTML = `
        <div class="adv-sender">APEX ADVISOR</div>
        <div class="adv-terminal">[ PROCESSING MARGINS... ]</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
}

function hideAdvisorTerminal() {
    const el = document.getElementById('adv-terminal-line');
    if (el) el.remove();
}

function appendAdvisorMessage(role, text) {
    const msgs = document.getElementById('advisor-messages');
    if (!msgs) return;
    const wrapper = document.createElement('div');
    wrapper.className = `adv-msg adv-${role}`;
    wrapper.innerHTML = `
        <div class="adv-sender">${role === 'user' ? 'YOU' : 'LOCAL ADVISOR'}</div>
        <div class="adv-bubble">${text}</div>`;
    msgs.appendChild(wrapper);
    msgs.scrollTop = msgs.scrollHeight;
}

function sendAdvisorMessage() {
    const inputEl = document.getElementById('advisor-input');
    const userMsg = inputEl ? inputEl.value.trim() : '';
    if (!userMsg) return;

    inputEl.value    = '';
    inputEl.disabled = true;

    appendAdvisorMessage('user', userMsg);
    advisorHistory.push(userMsg);

    // 1.5s terminal processing delay
    showAdvisorTerminal();
    setTimeout(() => {
        hideAdvisorTerminal();
        const response = generateLocalResponse(userMsg);
        appendAdvisorMessage('advisor', response);
        inputEl.disabled = false;
        inputEl.focus();
    }, 1500);
}


// ================================================================
//  15. MEMORY ENGINE — Weekly Archive helper (used by reset)
// ================================================================
function checkWeeklyArchive() {
    // Kept for compatibility — logic moved into check7DayReset
}
