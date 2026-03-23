const STATE = {
    balance: parseFloat(localStorage.getItem('flux_bal')) || 0,
    outbound: JSON.parse(localStorage.getItem('flux_out')) || [],
    inbound: JSON.parse(localStorage.getItem('flux_in')) || [],
    xp: parseInt(localStorage.getItem('flux_xp')) || 100, // Initial 100 XP
    lastWeekSpend: parseFloat(localStorage.getItem('flux_last_spend')) || 0,
    weekStartDate: localStorage.getItem('flux_week_start') || new Date().toISOString(),
    weeklyTarget: parseFloat(localStorage.getItem('flux_weekly_target')) || 0,
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
    updateBudgetProgress();
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
        } else if (text.includes("Bundle") || text.includes("DATA BUNDLES") || text.includes("data bundle")) {
            label = "DATA";
            category = "Utility";
        } else if (text.includes("Airtime") || text.includes("airtime")) {
            label = "AIRTIME";
            category = "Utility";
        } else if (text.includes("Pay Bill") || text.includes("Paybill") || text.includes("paybill")) {
            label = "PAYBILL";
            category = "Utility";
        } else if (text.includes("Buy Goods") || text.includes("Merchant") || text.includes("merchant")) {
            label = "TILL PMT";
            category = "General";
        } else if (text.includes("withdraw") || text.includes("Withdraw")) {
            label = "WITHDRAWAL";
            category = "General";
        } else if (text.includes("Fuliza")) {
            label = "FULIZA";
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
    const costInput = document.getElementById('manual-cost');
    const recipientInput = document.getElementById('manual-recipient');
    const categoryInput = document.getElementById('manual-category');

    const cost = parseFloat(costInput.value);
    const recipient = recipientInput.value || "General Trade";
    const category = categoryInput.value;

    if (!isNaN(cost) && cost > 0) {
        // --- THE ACTIVE AUDITOR UPGRADE ---
        // This popup gathers the "Context" the Advisor needs to give real advice.
        const commodity = prompt(`TACTICAL_INPUT: What was this KES ${cost.toLocaleString()} for? (e.g., Supper, Data, Fare, Printing)`, "General");

        const entry = {
            id: Date.now(),
            cost: cost,
            recipient: recipient,
            category: category,
            commodity: (commodity || "Uncategorized").trim(), // The "Brain" of the AI
            timestamp: Date.now()
        };

        // Update State
        STATE.outbound.push(entry);
        STATE.balance -= cost;
        
        // Bonus XP for providing tactical detail
        if (commodity && commodity.toLowerCase() !== "general") {
            STATE.xp += 5; 
            console.log("XP_BOOST: Contextual data logged.");
        }

        // Save to LocalStorage
        localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
        localStorage.setItem('flux_bal', STATE.balance);

        // Update UI
        syncUI();
        updateBudgetProgress();
        
        // Reset Inputs
        costInput.value = "";
        recipientInput.value = "";
        
        console.log(`LOG_SUCCESS: ${entry.commodity} logged to Outbound History.`);
    } else {
        alert("CRITICAL_ERROR: Invalid cost parameters.");
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
function verifyPin() {
    if (enteredPin === STATE.pin) {
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        syncUI();
        updateBudgetProgress();

    document.getElementById('advisor-trigger').style.display = 'block';
    } else {
        alert("DENIED");
        clearPin();
    }
}
function openSecureModal() { if (!STATE.isPrivate) { STATE.isPrivate = true; syncUI(); return; } document.getElementById('secure-modal').style.display = 'flex'; }
function closeSecureModal() { document.getElementById('secure-modal').style.display = 'none'; }
function confirmSecureToggle() { const p = document.getElementById('modal-pin').value; if (p === STATE.pin) { STATE.isPrivate = false; closeSecureModal(); document.getElementById('modal-pin').value = ""; syncUI(); } else { alert("INVALID"); } }
function initChart() { const ctx = document.getElementById('fluxChart').getContext('2d'); fluxChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ borderColor: '#00ff41', data: [], tension: 0.3 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#111' } } } } }); }
function updateChart() { if (!fluxChart) return; fluxChart.data.labels = STATE.outbound.slice(-7).map(i => i.name); fluxChart.data.datasets[0].data = STATE.outbound.slice(-7).map(i => i.cost); fluxChart.update(); }
function showModule(id) {
    document.querySelectorAll('.module-content').forEach(m => m.style.display='none');
    document.getElementById('mod-'+id).style.display='block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    try { event.currentTarget.classList.add('active'); } catch(e) {}
}

// --- 9. DASHBOARD NAVIGATION ---
function launchModule(id) {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('modules-view').style.display = 'flex';
    showModule(id);
}

function goToDashboard() {
    document.getElementById('modules-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    updateBudgetProgress();
}

// --- 10. BUDGET CONTROL FUNCTION ---
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
    const progressEl = document.getElementById('budget-progress-bar');
    if (!progressEl) return; // Dashboard not visible, skip

    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekSpend = STATE.outbound
        .filter(i => i.timestamp > oneWeekAgo)
        .reduce((s, i) => s + i.cost, 0);

    const target = STATE.weeklyTarget;

    document.getElementById('budget-spend-display').innerText =
        `KES ${weekSpend.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('budget-target-display').innerText =
        target > 0 ? `TARGET: KES ${target.toLocaleString()}` : 'TARGET: NOT SET';

    const pct = target > 0 ? Math.min((weekSpend / target) * 100, 100) : 0;
    progressEl.style.width = pct + '%';
    progressEl.style.background = pct >= 100
        ? 'var(--danger)'
        : pct > 70
            ? '#ffaa00'
            : 'var(--neon-green)';

    const pctEl = document.getElementById('budget-pct-display');
    if (pctEl) pctEl.innerText = target > 0 ? `${pct.toFixed(0)}%` : '--%';
}

// ============================================================
// v6.0 TACTICAL ADVISOR ENGINE (ZERO-CLOUD)
// ============================================================
let hasAdvisorGreeted = false;

function toggleAdvisor() {
    const sidebar = document.getElementById('advisor-sidebar');
    sidebar.classList.toggle('active');
    
    // First time opening this session? Generate a context-aware greeting.
    if (sidebar.classList.contains('active') && !hasAdvisorGreeted) {
        generateGreeting();
        hasAdvisorGreeted = true;
    }
}

function generateGreeting() {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekSpend = STATE.outbound.filter(i => i.timestamp > oneWeekAgo).reduce((s, i) => s + i.cost, 0);
    const target = STATE.weeklyTarget;
    
    let msg = "";
    if (STATE.balance < 500) {
        msg = "SYSTEM ALERT: Liquidity is critically low (Under 500 KES). Recommending a total freeze on non-essential outbound trades until next inflow.";
    } else if (target > 0 && weekSpend > target) {
        msg = `Sentry triggered. We've hit Overburn mode. You are KES ${(weekSpend - target).toLocaleString()} over the weekly ceiling. Let's optimize tomorrow's spending.`;
    } else if (weekSpend < STATE.lastWeekSpend && STATE.lastWeekSpend > 0) {
        msg = `Legendary efficiency. You are tracking lower than last week's burn rate. Liquidity engine is optimal.`;
    } else {
        msg = "Tactical Advisor online. Systems look stable. What parameters are we reviewing today?";
    }
    
    appendMessage('ai', msg);
}

function appendMessage(sender, text) {
    const chatOutput = document.getElementById('chat-output');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;
    msgDiv.innerText = text;
    chatOutput.appendChild(msgDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function handleChatEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

function sendMessage() {
    const input = document.getElementById('user-msg');
    const text = input.value.trim();
    if (!text) return;

    // 1. Show user message
    appendMessage('user', text);
    input.value = "";

    // 2. Local AI Processing (Zero-Cloud response simulation)
    setTimeout(() => {
        let response = "";
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes("spend") || lowerText.includes("burn")) {
            const now = Date.now();
            const weekSpend = STATE.outbound.filter(i => i.timestamp > (now - 7 * 24 * 60 * 60 * 1000)).reduce((s, i) => s + i.cost, 0);
            response = `Current 7-day burn rate is KES ${weekSpend.toLocaleString()}.`;
        } else if (lowerText.includes("last week")) {
            response = `Last week's logged burn rate was KES ${STATE.lastWeekSpend.toLocaleString()}.`;
        } else if (lowerText.includes("balance") || lowerText.includes("liquidity")) {
            response = `Current liquidity stands at KES ${STATE.balance.toLocaleString()}.`;
        } else if (lowerText.includes("hello") || lowerText.includes("hi")) {
            response = "Ready when you are. Checking leakages or logging an entry?";
        } else {
            response = "I am restricted to local data access (Zero-Cloud). Try asking about your 'burn rate', 'balance', or 'last week'.";
        }
        
        appendMessage('ai', response);
    }, 400); // 400ms delay to feel natural
}

function sendMessage() {
    const input = document.getElementById('user-msg');
    const text = input.value.trim().toLowerCase();
    if (!text) return;

    appendMessage('user', text);
    input.value = "";

    // Show a "Scanning..." indicator so the user knows the AI is working
    const chatOutput = document.getElementById('chat-output');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg msg-ai';
    loadingDiv.id = 'ai-loading';
    loadingDiv.innerText = "... SCANNING DATABASE ...";
    chatOutput.appendChild(loadingDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;

    // INCREASED DELAY: 1.5 Seconds for "Heavy Processing" feel
    setTimeout(() => {
        // Remove the loading indicator
        const loader = document.getElementById('ai-loading');
        if (loader) loader.remove();

        let response = "";
        const now = Date.now();
        const recentOut = STATE.outbound.filter(i => i.timestamp > (now - 7 * 24 * 60 * 60 * 1000));
        const weekSpend = recentOut.reduce((s, i) => s + i.cost, 0);

        // 1. LEAKAGE & MAMA DUA MODULE
        if (text.includes("leakage") || text.includes("advice") || text.includes("spending")) {
            const usageMap = {};
            recentOut.forEach(item => {
                const key = (item.commodity || "general").toLowerCase();
                usageMap[key] = (usageMap[key] || 0) + item.cost;
            });
            let topComm = Object.keys(usageMap).reduce((a, b) => usageMap[a] > usageMap[b] ? a : b, "none");
            let topAmt = usageMap[topComm];

            if (topComm !== "none" && topAmt > 0) {
                response = `Analysis complete. Primary leakage: "${topComm.toUpperCase()}" (KES ${topAmt.toLocaleString()}). `;
                if (topComm.includes("supper") || topComm.includes("food")) {
                    response += "Strategically, Mama Dua Kiosk or the 'Small-Gate' vendors offer better margins for supper than the main mess.";
                } else if (topComm.includes("fare") || topComm.includes("town") || topComm.includes("bike")) {
                    response += "Transport burn detected. Walking to the 'Lurambi' stage instead of taking a bike from inside campus saves KES 30 per trip.";
                } else if (topComm.includes("print") || topComm.includes("assignment")) {
                    response += "Academic leakage. Bulk printing is 40% cheaper at the stalls behind the Science Block.";
                } else {
                    response += `To stabilize liquidity, try to reduce "${topComm}" spending by 15% next week.`;
                }
            } else { response = "Inadequate logs. Tag your entries (e.g., 'Supper') so I can identify leakages."; }
        } 

        // 2. SAFETY & LIMITS MODULE
        else if (text.includes("limit") || text.includes("today") || text.includes("can i spend")) {
            const remainingBudget = STATE.weeklyTarget - weekSpend;
            const daysLeft = 7 - (Math.floor((now - new Date(STATE.weekStartDate)) / (1000 * 60 * 60 * 24)) % 7);
            const safeDaily = remainingBudget > 0 ? (remainingBudget / Math.max(daysLeft, 1)).toFixed(0) : 0;
            
            response = remainingBudget > 0 
                ? `Safety Parameter: You can spend KES ${safeDaily} daily for the next ${daysLeft} days to stay within ceiling.`
                : `WARNING: Budget ceiling breached. Current liquidity does not support further non-essential outbound trades.`;
        }

        // 3. SECURITY & PRIVACY MODULE
        else if (text.includes("secure") || text.includes("private") || text.includes("cloud")) {
            response = "APEX // FLUX Protocol is 100% Local. Your M-Pesa data and 'Commodity' tags are stored in your browser's encrypted vault. No external servers have accessed this conversation.";
        }

        // 4. EFFICIENCY & XP MODULE
        else if (text.includes("xp") || text.includes("rank") || text.includes("level")) {
            response = `Current XP: ${STATE.xp}. To level up faster, provide specific 'Commodity' tags for every transaction and stay under your weekly target for 3 consecutive days.`;
        }

        // 5. DATA CLEANING MODULE (The Vortex)
        else if (text.includes("clean") || text.includes("vortex") || text.includes("labels")) {
            response = "Vortex Engine is active. I am currently normalizing P2P names and shortening Safaricom strings to keep your 'Vitals' display neat.";
        }

        // FALLBACK
        else {
            response = "Tactical Advisor standing by. I can analyze 'Leakages', 'Daily Limits', 'Security Protocols', and 'XP Efficiency'. Specify parameter for scan.";
        }

        appendMessage('ai', response);
    }, 1500); // 1.5 SECOND DELAY FOR "HEAVY PROCESSING" FEEL
}
// ... existing code above ...

function sendMessage() {
    // The big block of code I gave you previously
    // It calls appendMessage('user', text) inside it
}

// PASTE THE HELPER HERE (Outside and below sendMessage)
function appendMessage(sender, text) {
    const chatOutput = document.getElementById('chat-output');
    if (!chatOutput) return; // Safety check
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;
    msgDiv.innerText = text;
    chatOutput.appendChild(msgDiv);
    
    // Auto-scroll to the bottom so you see the latest reply
    chatOutput.scrollTop = chatOutput.scrollHeight;
}
