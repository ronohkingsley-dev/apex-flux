/*const STATE = {
    balance: parseFloat(localStorage.getItem('flux_bal')) || 0,
    outbound: JSON.parse(localStorage.getItem('flux_out')) || [],
    inbound: JSON.parse(localStorage.getItem('flux_in')) || [],
    xp: parseInt(localStorage.getItem('flux_xp')) || 100, // Initial 100 XP
    lastWeekSpend: parseFloat(localStorage.getItem('flux_last_spend')) || 0,
    weekStartDate: localStorage.getItem('flux_week_start') || new Date().toISOString(),
    isPrivate: true,
    pin: "1234"
};

let fluxChart = null;

document.addEventListener('DOMContentLoaded', () => {
    syncUI();
    initChart();
});

// --- 1. THE EFFICIENCY ENGINE ---
function runEfficiencyDiagnostic() {
    const now = new Date();
    const startDate = new Date(STATE.weekStartDate);
    const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    // Daily Wear & Tear (-2 XP if spending > 200 KES today)
    const todayStr = new Date().toLocaleDateString();
    const todaySpend = STATE.outbound
        .filter(i => new Date(i.timestamp).toLocaleDateString() === todayStr)
        .reduce((s, i) => s + i.cost, 0);

    if (todaySpend > 200) {
        STATE.xp = Math.max(0, STATE.xp - 2);
    }

    // Weekly Cycle Check (Every 7 Days)
    if (diffDays >= 7) {
        const currentWeekSpend = STATE.outbound
            .filter(i => new Date(i.timestamp) > startDate)
            .reduce((s, i) => s + i.cost, 0);

        if (currentWeekSpend < STATE.lastWeekSpend || STATE.lastWeekSpend === 0) {
            STATE.xp += 100; // Efficiency Bonus
            alert("ENGINE OPTIMIZED: Spending was lower than last week. +100 XP");
        } else {
            STATE.xp = Math.max(0, STATE.xp - 50); // Efficiency Loss
            alert("SYSTEM LEAK: Spending exceeded last week. -50 XP");
        }

        STATE.lastWeekSpend = currentWeekSpend;
        STATE.weekStartDate = new Date().toISOString();
        localStorage.setItem('flux_last_spend', STATE.lastWeekSpend);
        localStorage.setItem('flux_week_start', STATE.weekStartDate);
    }
}

// --- 2. THE DELETE/ROLLBACK LOGIC ---
function deleteEntry(index) {
    const item = STATE.outbound[index];

    // Restoration: Refund money to balance
    STATE.balance += item.cost;

    // Remove from array
    STATE.outbound.splice(index, 1);

    // Correction Penalty
    STATE.xp = Math.max(0, STATE.xp - 5);

    syncUI();
    console.log(`[ROLLBACK] ${item.name} removed. KES ${item.cost} restored.`);
}

// --- 3. CORE SYSTEM SYNC ---
function syncUI() {
    runEfficiencyDiagnostic();

    localStorage.setItem('flux_bal', STATE.balance);
    localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
    localStorage.setItem('flux_in', JSON.stringify(STATE.inbound));
    localStorage.setItem('flux_xp', STATE.xp);

    const balEl = document.getElementById('bal-amount');
    const privBtn = document.getElementById('toggle-privacy');
    if (STATE.isPrivate) {
        balEl.classList.add('blurred');
        balEl.innerText = "****.**";
        privBtn.innerText = "REVEAL DATA";
    } else {
        balEl.classList.remove('blurred');
        balEl.innerText = STATE.balance.toLocaleString(undefined, {minimumFractionDigits: 2});
        privBtn.innerText = "HIDE DATA";
    }

    document.getElementById('xp-display').innerText = STATE.xp;
    document.getElementById('tier-name').innerText = getEngTier(STATE.xp);

    const gaugeFill = document.getElementById('gauge-fill');
    const card = document.getElementById('balance-card');
    const offset = 126 - (Math.min(Math.abs(STATE.balance), 2000) / 2000 * 126);
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
}

// --- 4. SMART SHREDDER ---
function shredSMS() {
    const input = document.getElementById('sms-area');
    const text = input.value;
    const balRegex = /(?:New|Your) M-PESA balance is (?:Ksh\s?)?([\d,]+\.?\d{0,2})/;
    const balMatch = text.match(balRegex);

    if (balMatch) {
        const newTotal = parseFloat(balMatch[1].replace(/,/g, ''));
        const diff = newTotal - STATE.balance;
        const absDiff = Math.abs(diff);
        let label = "M-PESA TRANS";
        let category = "General";

        if (text.includes("sent to")) {
            const nameMatch = text.match(/sent to\s(.*?)\s\d/);
            label = nameMatch ? nameMatch[1] : "SENT MONEY";
            category = "Transfer";
        } else if (text.includes("Airtime") || text.includes("Bundle")) {
            label = "AIRTIME/DATA";
            category = "Utility";
        } else if (text.includes("Fuliza")) {
            label = "FULIZA REPAY";
            category = "Debt";
        }

        if (diff > 0) {
            STATE.inbound.push({ label, amount: absDiff, timestamp: Date.now() });
            STATE.xp += 10; // Small incentive for refueling
        } else if (diff < 0) {
            STATE.outbound.push({ name: label, cost: absDiff, cat: category, timestamp: Date.now() });
            // Note: Instant XP for spending is now removed.
        }

        STATE.balance = newTotal;
        input.value = "";
        syncUI();
    } else { alert("SHREDDER ERROR: Balance not found."); }
}

// --- 5. RENDER & UI UPDATES ---
function renderLists() {
    const outboundContainer = document.getElementById('outbound-list');
    outboundContainer.innerHTML = STATE.outbound.slice(-6).reverse().map((i, idx) => {
        const actualIdx = STATE.outbound.length - 1 - idx;
        return `
            <div class="log-entry">
                <div class="log-info"><b>${i.name}</b><small>${i.cat}</small></div>
                <div class="log-actions">
                    <span class="amount-out">-${i.cost.toLocaleString()}</span>
                    <button class="delete-btn" onclick="deleteEntry(${actualIdx})">×</button>
                </div>
            </div>`;
    }).join('');

    document.getElementById('inbound-list').innerHTML = STATE.inbound.slice(-4).reverse().map(i => `
        <div class="log-entry"><b>${i.label}</b><span class="amount-in">+${i.amount.toLocaleString()}</span></div>
    `).join('');
}

// --- 6. COLLAPSIBLE LEDGER TOGGLE ---
function toggleLedger(type) {
    const panel = document.getElementById('panel-' + type);
    const btn = document.getElementById('btn-' + type);
    const isVisible = panel.style.display === 'block';

    panel.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('ledger-active', !isVisible);
}

// --- 7. UTILITY FUNCTIONS ---
function getEngTier(xp) {
    if (xp < 200) return "CAD INTERN";
    if (xp < 500) return "JUNIOR TECHNICIAN";
    if (xp < 1000) return "PLANT ENGINEER";
    if (xp < 2500) return "CHIEF OPERATIONS OFFICER";
    return "INDUSTRIAL MAGNATE";
}

function addManualEntry() {
    const name = document.getElementById('item-name').value;
    const cost = parseFloat(document.getElementById('item-cost').value);
    const cat = document.getElementById('item-category').value;
    if (name && !isNaN(cost)) {
        STATE.outbound.push({ name, cost, cat, timestamp: Date.now() });
        STATE.balance -= cost;
        syncUI();
        document.getElementById('item-name').value = "";
        document.getElementById('item-cost').value = "";
    }
}

function generateWeeklyReport() {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weeklySpend = STATE.outbound.filter(item => item.timestamp > oneWeekAgo);
    const total = weeklySpend.reduce((acc, curr) => acc + curr.cost, 0);
    const container = document.getElementById('weekly-report-content');
    if (total === 0) { container.innerHTML = `<p class="dim-text">No weekly data.</p>`; return; }
    const categories = ["Food", "Transport", "Academic", "Utility", "Transfer"];
    let html = `<p class="neon-text" style="font-size:0.9rem; margin-bottom:10px;">TOTAL: KES ${total.toLocaleString()}</p>`;
    categories.forEach(cat => {
        const catTotal = weeklySpend.filter(i => i.cat === cat || (cat === "Utility" && i.cat === "Utilities")).reduce((s, i) => s + i.cost, 0);
        const percent = ((catTotal / total) * 100).toFixed(0);
        if (catTotal > 0) { html += `<div class="report-item"><span>${cat}</span><span>${percent}%</span></div><div class="report-bar-wrap"><div class="report-bar-fill" style="width:${percent}%"></div></div>`; }
    });
    container.innerHTML = html;
}

function exportBlueprint() {
    let report = `APEX // FLUX - ENGINEERING LOG\nGenerated: ${new Date().toLocaleString()}\nTier: ${getEngTier(STATE.xp)}\nAssets: KES ${STATE.balance.toLocaleString()}\n-------------------------------------------\n\n[OUTBOUND]\n`;
    STATE.outbound.forEach(i => { report += `${new Date(i.timestamp).toLocaleDateString()} | ${i.name.padEnd(20)} | KES ${i.cost.toLocaleString().padStart(8)} | (${i.cat})\n`; });
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Flux_Blueprint.txt`; a.click();
}

// --- 8. AUTH & NAVIGATION ---
let enteredPin = "";
function inputPin(n) { if (enteredPin.length < 4) { enteredPin += n; document.getElementById('pin-input').value = "*".repeat(enteredPin.length); } }
function clearPin() { enteredPin = ""; document.getElementById('pin-input').value = ""; }
function verifyPin() { if (enteredPin === STATE.pin) { document.getElementById('guardian-overlay').style.display = 'none'; } else { alert("DENIED"); clearPin(); } }
function openSecureModal() { if (!STATE.isPrivate) { STATE.isPrivate = true; syncUI(); return; } document.getElementById('secure-modal').style.display = 'flex'; }
function closeSecureModal() { document.getElementById('secure-modal').style.display = 'none'; }
function confirmSecureToggle() { const p = document.getElementById('modal-pin').value; if (p === STATE.pin) { STATE.isPrivate = false; closeSecureModal(); document.getElementById('modal-pin').value = ""; syncUI(); } else { alert("INVALID"); } }
function initChart() { const ctx = document.getElementById('fluxChart').getContext('2d'); fluxChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ borderColor: '#00ff41', data: [], tension: 0.3 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#111' } } } } }); }
function updateChart() { if (!fluxChart) return; fluxChart.data.labels = STATE.outbound.slice(-7).map(i => i.name); fluxChart.data.datasets[0].data = STATE.outbound.slice(-7).map(i => i.cost); fluxChart.update(); }
function showModule(id) { document.querySelectorAll('.module-content').forEach(m => m.style.display='none'); document.getElementById('mod-'+id).style.display='block'; document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); event.currentTarget.classList.add('active'); }
*/
