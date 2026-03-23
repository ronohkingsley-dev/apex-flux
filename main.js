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

// ============================================================
// v6.0 APEX // FLUX — MASTER COMMAND CENTER
// ============================================================

// 1. MANUAL ENTRY LOGIC (From your latest screenshot)
function addManualEntry() {
    const costInput = document.getElementById('manual-cost');
    const recipientInput = document.getElementById('manual-recipient');
    const categoryInput = document.getElementById('manual-category');

    const cost = parseFloat(costInput.value);
    const recipient = recipientInput.value || "General Trade";
    const category = categoryInput.value;

    if (!isNaN(cost) && cost > 0) {
        // Gathering the "Commodity" for the Advisor to read
        const commodity = prompt(`TACTICAL_INPUT: What was this KES ${cost.toLocaleString()} for? (e.g., Supper, Data, Fare)`, "General");

        const entry = {
            id: Date.now(),
            cost: cost,
            recipient: recipient,
            category: category,
            commodity: (commodity || "General").trim(),
            timestamp: Date.now()
        };

        STATE.outbound.push(entry);
        STATE.balance -= cost;
        
        // XP Bonus for detail
        if (commodity && commodity.toLowerCase() !== "general") STATE.xp += 5; 

        localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
        localStorage.setItem('flux_bal', STATE.balance);

        syncUI();
        updateBudgetProgress();
        
        costInput.value = "";
        recipientInput.value = "";
        console.log(`LOG_SUCCESS: ${entry.commodity} recorded.`);
    } else {
        alert("CRITICAL_ERROR: Invalid cost parameters.");
    }
}

// 2. PIN VERIFICATION & VORTEX RESET
function verifyPin() {
    const pinInput = document.getElementById('pin-input');
    const enteredPin = pinInput.value;

    if (enteredPin === STATE.pin) {
        // --- VORTEX RESET LOGIC ---
        const now = new Date();
        const weekStart = new Date(STATE.weekStartDate);
        const daysElapsed = (now - weekStart) / (1000 * 60 * 60 * 24);

        if (daysElapsed >= 7) {
            STATE.lastWeekSpend = STATE.outbound
                .filter(i => i.timestamp > weekStart.getTime())
                .reduce((s, i) => s + i.cost, 0);
            STATE.weekStartDate = now.toISOString();
            localStorage.setItem('flux_last_spend', STATE.lastWeekSpend);
            localStorage.setItem('flux_week_start', STATE.weekStartDate);
        }

        // --- UI TRANSITION ---
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        
        syncUI(); 
        updateBudgetProgress(); 
        runEfficiencyDiagnostic(); 

        const advBtn = document.getElementById('advisor-trigger');
        if(advBtn) advBtn.style.display = 'block';
    } else {
        alert("ACCESS_DENIED: Invalid Sentry PIN.");
        clearPin();
    }
}

// 3. TACTICAL ADVISOR ENGINE (2-Second Suspense Delay)
function sendMessage() {
    const input = document.getElementById('user-msg');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = "";
    appendMessage('ai', "... ANALYZING LOCAL DATABASE ... ");

    setTimeout(() => {
        const chatOutput = document.getElementById('chat-output');
        if (chatOutput && chatOutput.lastChild) chatOutput.removeChild(chatOutput.lastChild);

        let response = "";
        const lowerText = text.toLowerCase();
        const now = Date.now();
        const recentOut = STATE.outbound.filter(i => i.timestamp > (now - 7 * 24 * 60 * 60 * 1000));
        
        if (lowerText.includes("leakage") || lowerText.includes("advice")) {
            const usageMap = {};
            recentOut.forEach(item => {
                const key = (item.commodity || "general").toLowerCase();
                usageMap[key] = (usageMap[key] || 0) + item.cost;
            });
            let topComm = Object.keys(usageMap).reduce((a, b) => usageMap[a] > usageMap[b] ? a : b, "none");
            
            if (topComm !== "none") {
                response = `Leakage identified: "${topComm.toUpperCase()}". `;
                if (topComm.includes("supper") || topComm.includes("food")) {
                    response += "Advice: Mama Dua Kiosk offers better margins than the canteen for late-day trades.";
                } else if (topComm.includes("fare") || topComm.includes("bike")) {
                    response += "Advice: Walking to Lurambi stage saves KES 30 per trip.";
                } else {
                    response += `Try to reduce ${topComm} spending by 15% next week.`;
                }
            } else {
                response = "Inadequate data. Log specific commodities (e.g. 'Supper') for a deep-scan report.";
            }
        } 
        else if (lowerText.includes("limit") || lowerText.includes("today")) {
            const weekSpend = recentOut.reduce((s, i) => s + i.cost, 0);
            const remaining = STATE.weeklyTarget - weekSpend;
            response = remaining > 0 
                ? `Safety Parameter: KES ${remaining.toLocaleString()} left in your weekly ceiling.`
                : `WARNING: Budget breached. Every trade now is an Overburn.`;
        }
        else {
            response = "Tactical Advisor standing by. I can scan for 'Leakages', 'Daily Limits', or 'Trends'.";
        }

        appendMessage('ai', response);
    }, 2000); 
}

// 4. CORE SYSTEM HELPERS
function appendMessage(sender, text) {
    const chatOutput = document.getElementById('chat-output');
    if (!chatOutput) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;
    msgDiv.innerText = text;
    chatOutput.appendChild(msgDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function toggleAdvisor() {
    const sidebar = document.getElementById('advisor-sidebar');
    if(sidebar) sidebar.classList.toggle('active');
}

function handleChatEnter(e) {
    if (e.key === 'Enter') sendMessage();
}
