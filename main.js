const STATE = {
    balance: parseFloat(localStorage.getItem('flux_bal')) || 0,
    outbound: JSON.parse(localStorage.getItem('flux_out')) || [],
    inbound: JSON.parse(localStorage.getItem('flux_in')) || [],
    xp: parseInt(localStorage.getItem('flux_xp')) || 100,
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

// --- 1. THE EFFICIENCY ENGINE & VORTEX ---
function runEfficiencyDiagnostic() {
    const now = new Date();
    const startDate = new Date(STATE.weekStartDate);
    const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    const todayStr = new Date().toLocaleDateString();
    const todaySpend = STATE.outbound
        .filter(i => new Date(i.timestamp).toLocaleDateString() === todayStr)
        .reduce((s, i) => s + i.cost, 0);

    if (todaySpend > 200) { STATE.xp = Math.max(0, STATE.xp - 2); }

    // Weekly Vortex Reset
    if (diffDays >= 7) {
        const currentWeekSpend = STATE.outbound
            .filter(i => new Date(i.timestamp) > startDate)
            .reduce((s, i) => s + i.cost, 0);

        if (currentWeekSpend < STATE.lastWeekSpend || STATE.lastWeekSpend === 0) {
            STATE.xp += 100;
            alert("ENGINE OPTIMIZED: Spending lower than last week. +100 XP");
        } else {
            STATE.xp = Math.max(0, STATE.xp - 50);
            alert("SYSTEM LEAK: Spending exceeded last week. -50 XP");
        }

        STATE.lastWeekSpend = currentWeekSpend;
        STATE.weekStartDate = new Date().toISOString();
        localStorage.setItem('flux_last_spend', STATE.lastWeekSpend);
        localStorage.setItem('flux_week_start', STATE.weekStartDate);
    }
}

// --- 2. MANUAL ENTRY (Restored IDs from your screenshot) ---
function addManualEntry() {
    // Reverted to your original IDs: 'item-name' and 'item-cost'
    const nameInput = document.getElementById('item-name');
    const costInput = document.getElementById('item-cost');
    const catInput = document.getElementById('item-category');

    const name = nameInput.value;
    const cost = parseFloat(costInput.value);
    const cat = catInput.value;

    if (name && !isNaN(cost) && cost > 0) {
        // Gathering Commodity for the Advisor
        const commodity = prompt(`TACTICAL_INPUT: What was this KES ${cost.toLocaleString()} for?`, name);

        const entry = {
            name: name,
            cost: cost,
            cat: cat,
            commodity: (commodity || name).trim(),
            timestamp: Date.now()
        };

        STATE.outbound.push(entry);
        STATE.balance -= cost;
        STATE.xp += 5; // Detail bonus

        syncUI();
        
        nameInput.value = "";
        costInput.value = "";
        console.log(`LOG_SUCCESS: ${entry.name} recorded.`);
    } else {
        alert("CRITICAL_ERROR: Check your input parameters.");
    }
}

// --- 3. CORE SYSTEM SYNC ---
function syncUI() {
    runEfficiencyDiagnostic();
    localStorage.setItem('flux_bal', STATE.balance);
    localStorage.setItem('flux_out', JSON.stringify(STATE.outbound));
    localStorage.setItem('flux_xp', STATE.xp);

    const balEl = document.getElementById('bal-amount');
    if (STATE.isPrivate) {
        balEl.classList.add('blurred');
        balEl.innerText = "****.**";
    } else {
        balEl.classList.remove('blurred');
        balEl.innerText = STATE.balance.toLocaleString(undefined, {minimumFractionDigits: 2});
    }

    document.getElementById('xp-display').innerText = STATE.xp;
    document.getElementById('tier-name').innerText = getEngTier(STATE.xp);

    updateChart();
    updateBudgetProgress();
    renderLists();
}

// --- 4. TACTICAL ADVISOR ENGINE ---
function sendMessage() {
    const input = document.getElementById('user-msg');
    const text = input.value.trim().toLowerCase();
    if (!text) return;

    appendMessage('user', text);
    input.value = "";

    const chatOutput = document.getElementById('chat-output');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg msg-ai';
    loadingDiv.id = 'ai-loading';
    loadingDiv.innerText = "... SCANNING DATABASE ...";
    chatOutput.appendChild(loadingDiv);

    setTimeout(() => {
        if (document.getElementById('ai-loading')) document.getElementById('ai-loading').remove();

        let response = "";
        const now = Date.now();
        const recentOut = STATE.outbound.filter(i => i.timestamp > (now - 7 * 24 * 60 * 60 * 1000));
        
        if (text.includes("leakage") || text.includes("advice")) {
            const usageMap = {};
            recentOut.forEach(item => {
                const key = (item.commodity || item.name || "general").toLowerCase();
                usageMap[key] = (usageMap[key] || 0) + item.cost;
            });
            let topComm = Object.keys(usageMap).reduce((a, b) => usageMap[a] > usageMap[b] ? a : b, "none");
            
            if (topComm !== "none") {
                response = `Leakage identified: "${topComm.toUpperCase()}". `;
                if (topComm.includes("supper") || topComm.includes("food")) {
                    response += "Advice: Mama Dua Kiosk offers better margins than the canteen.";
                } else if (topComm.includes("fare") || topComm.includes("bike")) {
                    response += "Advice: Walking to Lurambi saves KES 30 per trip.";
                } else {
                    response += `Minimize ${topComm} trades to stabilize balance.`;
                }
            } else { response = "Need more logs to identify trends."; }
        } else {
            response = "Advisor active. Ask about 'Leakages' or 'Limits'.";
        }
        appendMessage('ai', response);
    }, 1500);
}

// --- 5. AUTH & NAVIGATION ---
let enteredPin = "";
function inputPin(n) { if (enteredPin.length < 4) { enteredPin += n; document.getElementById('pin-input').value = "*".repeat(enteredPin.length); } }
function clearPin() { enteredPin = ""; document.getElementById('pin-input').value = ""; }

function verifyPin() {
    if (enteredPin === STATE.pin) {
        document.getElementById('guardian-overlay').style.display = 'none';
        document.querySelector('.dashboard-wrapper').style.display = 'flex';
        document.getElementById('advisor-trigger').style.display = 'block';
        syncUI();
    } else {
        alert("DENIED");
        clearPin();
    }
}

// --- HELPER FUNCTIONS (KEEPING YOUR EXISTING LOGIC) ---
function appendMessage(sender, text) {
    const chatOutput = document.getElementById('chat-output');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;
    msgDiv.innerText = text;
    chatOutput.appendChild(msgDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function getEngTier(xp) {
    if (xp < 200) return "CAD INTERN";
    if (xp < 500) return "JUNIOR TECHNICIAN";
    if (xp < 1000) return "PLANT ENGINEER";
    return "INDUSTRIAL MAGNATE";
}

function toggleAdvisor() { document.getElementById('advisor-sidebar').classList.toggle('active'); }
function handleChatEnter(e) { if (e.key === 'Enter') sendMessage(); }
function initChart() { /* Keep your Chart.js init logic here */ }
function updateChart() { /* Keep your Chart.js update logic here */ }
function updateBudgetProgress() { /* Keep your Budget bar logic here */ }
function renderLists() { /* Keep your List rendering logic here */ }
