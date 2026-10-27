/**
 * THE DAILY INCIDENT — Core Game Engine & State Management
 */

(function() {
  // --- Constants & Storage Keys ---
  const STORAGE_KEY_STATE = "daily_incident_state_v1";
  const STORAGE_KEY_STATS = "daily_incident_stats_v1";
  const STORAGE_KEY_HIST  = "daily_incident_history_v1";

  const TIMER_DEFAULT_SEC = 180;
  const MAX_INVESTIGATIONS = 5;

  // --- Global App State ---
  let currentIncident = null;
  let timerInterval = null;
  let timeRemaining = TIMER_DEFAULT_SEC;
  let investigationsUsed = 0;
  let selectedHypothesisId = null;
  let currentLogs = [];

  // --- DOM Elements ---
  const screens = {
    landing: document.getElementById("screen-landing"),
    game: document.getElementById("screen-game"),
    result: document.getElementById("screen-result"),
    history: document.getElementById("screen-history")
  };

  // --- Deterministic Daily Selection ---
  function getDailyIncident() {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dateNum = parseInt(todayStr, 10);
    const index = dateNum % INCIDENTS.length;
    return INCIDENTS[index];
  }

  // --- Local Storage Helpers ---
  function getStats() {
    const defaultStats = { streak: 0, bestScore: 0, totalPlayed: 0, totalCompleted: 0, lastPlayedDate: null };
    return JSON.parse(localStorage.getItem(STORAGE_KEY_STATS)) || defaultStats;
  }

  function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  }

  function getHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_HIST)) || [];
  }

  function saveHistoryItem(item) {
    const history = getHistory();
    history.unshift(item);
    localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(history));
  }

  function getSavedGameState() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_STATE));
  }

  function saveGameState(state) {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
  }

  // --- State Router ---
  function showScreen(screenName) {
    Object.keys(screens).forEach(key => {
      screens[key].classList.remove("active");
    });
    screens[screenName].classList.add("active");
  }

  // --- Initialization ---
  function init() {
    currentIncident = getDailyIncident();
    setupEventListeners();
    updateLandingUI();

    const savedState = getSavedGameState();
    const todayStr = new Date().toISOString().slice(0, 10);

    if (savedState && savedState.date === todayStr && savedState.completed) {
      renderResultScreen(savedState.resultData);
      showScreen("result");
    } else {
      showScreen("landing");
    }
  }

  function updateLandingUI() {
    const stats = getStats();
    document.getElementById("landing-streak").innerText = `🔥 ${stats.streak}`;
    document.getElementById("landing-category").innerText = currentIncident.category.toUpperCase();
    document.getElementById("landing-difficulty").innerText = currentIncident.difficulty;
  }

  // --- Game Loop Methods ---
  function startGame() {
    timeRemaining = TIMER_DEFAULT_SEC;
    investigationsUsed = 0;
    selectedHypothesisId = null;
    currentLogs = ["SYSTEM INITIALIZED. Select a node or telemetry option to investigate."];

    renderGameUI();
    showScreen("game");
    startTimer();
  }

  function startTimer() {
    clearInterval(timerInterval);
    const timerElem = document.getElementById("timer-display");

    timerInterval = setInterval(() => {
      timeRemaining--;
      const mins = Math.floor(timeRemaining / 60);
      const secs = timeRemaining % 60;
      timerElem.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (timeRemaining <= 60 && timeRemaining > 30) {
        timerElem.className = "timer-display timer-warning";
      } else if (timeRemaining <= 30) {
        timerElem.className = "timer-display timer-critical";
      } else {
        timerElem.className = "timer-display";
      }

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        handleGameCompletion(false, true);
      }
    }, 1000);
  }

  function renderGameUI() {
    document.getElementById("incident-title").innerText = currentIncident.title;
    document.getElementById("incident-desc").innerText = currentIncident.description;
    
    // Render Difficulty Badge
    const diffBadge = document.getElementById("incident-diff-badge");
    diffBadge.innerText = currentIncident.difficulty;
    diffBadge.className = `badge badge-${currentIncident.difficulty.toLowerCase()}`;

    renderBudgetDots();
    renderTelemetryGrid();
    renderArchitectureSVG();
    renderInvestigationOptions();
    renderHypotheses();
    renderTerminalLogs();
  }

  function renderBudgetDots() {
    const container = document.getElementById("budget-dots");
    container.innerHTML = "";
    for (let i = 0; i < MAX_INVESTIGATIONS; i++) {
      const dot = document.createElement("div");
      dot.className = `dot ${i < investigationsUsed ? 'used' : ''}`;
      container.appendChild(dot);
    }
  }

  function renderTelemetryGrid() {
    const container = document.getElementById("telemetry-grid");
    container.innerHTML = "";
    currentIncident.initialTelemetry.forEach(t => {
      const card = document.createElement("div");
      card.className = `telemetry-card status-${t.status}`;
      card.innerHTML = `
        <div class="telemetry-label">${t.label}</div>
        <div class="telemetry-val">${t.value}</div>
      `;
      container.appendChild(card);
    });
  }

  function renderArchitectureSVG() {
    const container = document.getElementById("arch-svg-container");
    const nodes = currentIncident.architecture.nodes;
    const edges = currentIncident.architecture.edges;

    let svgHtml = `<svg width="100%" height="100%" viewBox="0 0 500 200">`;

    // Static horizontal positioning for V1 dynamic node layout
    const nodeXMap = {};
    const step = 460 / (nodes.length + 1);
    nodes.forEach((n, idx) => {
      nodeXMap[n.id] = { x: Math.round(step * (idx + 1)), y: 100 };
    });

    // Draw connection lines
    edges.forEach(e => {
      const from = nodeXMap[e.from];
      const to = nodeXMap[e.to];
      if (from && to) {
        svgHtml += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#263147" stroke-width="2" stroke-dasharray="4" />`;
      }
    });

    // Draw Nodes
    nodes.forEach(n => {
      const pos = nodeXMap[n.id];
      svgHtml += `
        <g class="arch-node" onclick="window.DailyIncident.handleNodeClick('${n.id}')">
          <rect x="${pos.x - 50}" y="${pos.y - 25}" width="100" height="50" />
          <text x="${pos.x}" y="${pos.y}">${n.label}</text>
        </g>
      `;
    });

    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;
  }

  function renderInvestigationOptions(filterNodeId = null) {
    const container = document.getElementById("investigation-options");
    container.innerHTML = "";

    const available = currentIncident.investigations.filter(inv => {
      return filterNodeId ? inv.componentId === filterNodeId : true;
    });

    if (available.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">No further telemetry investigations for this node.</div>`;
      return;
    }

    available.forEach(inv => {
      const btn = document.createElement("button");
      btn.className = "inv-option-btn";
      btn.disabled = investigationsUsed >= MAX_INVESTIGATIONS;
      btn.innerText = `🔍 ${inv.title} (Cost: 1)`;
      btn.onclick = () => executeInvestigation(inv);
      container.appendChild(btn);
    });
  }

  function executeInvestigation(inv) {
    if (investigationsUsed >= MAX_INVESTIGATIONS) return;

    investigationsUsed++;
    renderBudgetDots();

    inv.details.forEach(detail => currentLogs.push(detail));
    renderTerminalLogs();
    renderInvestigationOptions();
  }

  function renderTerminalLogs() {
    const container = document.getElementById("log-terminal");
    container.innerHTML = currentLogs.map(l => `<div class="log-entry">> ${l}</div>`).join("");
    container.scrollTop = container.scrollHeight;
  }

  function renderHypotheses() {
    const container = document.getElementById("hypothesis-options");
    container.innerHTML = "";

    currentIncident.hypotheses.forEach(h => {
      const btn = document.createElement("button");
      btn.className = `hypothesis-btn ${selectedHypothesisId === h.id ? 'selected' : ''}`;
      btn.innerText = h.text;
      btn.onclick = () => {
        selectedHypothesisId = h.id;
        renderHypotheses();
        document.getElementById("btn-submit-hypothesis").disabled = false;
      };
      container.appendChild(btn);
    });
  }

  // --- Scoring Engine ---
  function calculateScore(isCorrect, timeRemainingSec, unusedInv) {
    if (!isCorrect) return 0;

    const baseDiagnosis = 5000;
    const speedBonus = Math.floor((timeRemainingSec / TIMER_DEFAULT_SEC) * 3000);
    const efficiencyBonus = unusedInv * 400;

    let multiplier = 1.0;
    switch (currentIncident.difficulty) {
      case "Engineer": multiplier = 1.2; break;
      case "Senior": multiplier = 1.5; break;
      case "Architect": multiplier = 2.0; break;
    }

    const rawTotal = Math.round((baseDiagnosis + speedBonus + efficiencyBonus) * multiplier);
    return {
      base: baseDiagnosis,
      speed: speedBonus,
      efficiency: efficiencyBonus,
      multiplier: multiplier,
      total: rawTotal
    };
  }

  function handleGameCompletion(isTimedOut = false) {
    clearInterval(timerInterval);

    const chosenHypothesis = currentIncident.hypotheses.find(h => h.id === selectedHypothesisId);
    const isCorrect = !isTimedOut && chosenHypothesis && chosenHypothesis.correct;

    const unusedInv = MAX_INVESTIGATIONS - investigationsUsed;
    const scoreDetails = calculateScore(isCorrect, timeRemaining, unusedInv);

    const stats = getStats();
    const todayStr = new Date().toISOString().slice(0, 10);

    // Update Stats
    stats.totalPlayed++;
    if (isCorrect) {
      stats.totalCompleted++;
      stats.streak = (stats.lastPlayedDate === getYesterdayStr()) ? stats.streak + 1 : 1;
      if (scoreDetails.total > stats.bestScore) stats.bestScore = scoreDetails.total;
    } else {
      stats.streak = 0;
    }
    stats.lastPlayedDate = todayStr;
    saveStats(stats);

    // Save History
    const resultData = {
      date: todayStr,
      incidentId: currentIncident.id,
      title: currentIncident.title,
      difficulty: currentIncident.difficulty,
      isCorrect: isCorrect,
      score: scoreDetails.total,
      scoreDetails: scoreDetails,
      timeRemaining: timeRemaining,
      explanation: currentIncident.explanation,
      lesson: currentIncident.lesson,
      rootCause: currentIncident.rootCause
    };

    saveHistoryItem(resultData);
    saveGameState({
      date: todayStr,
      completed: true,
      resultData: resultData
    });

    renderResultScreen(resultData);
    showScreen("result");
  }

  function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function renderResultScreen(res) {
    const titleElem = document.getElementById("result-title");
    titleElem.innerText = res.isCorrect ? "ROOT CAUSE IDENTIFIED" : "SYSTEM OUTAGE ESCALATED";
    titleElem.className = `result-status-title ${res.isCorrect ? 'success' : 'failure'}`;

    document.getElementById("result-root-cause").innerText = res.rootCause;
    document.getElementById("result-total-score").innerText = res.score.toLocaleString();
    document.getElementById("result-diagnosis-score").innerText = res.isCorrect ? `+${res.scoreDetails.base}` : "+0";
    document.getElementById("result-speed-score").innerText = `+${res.scoreDetails.speed || 0}`;
    document.getElementById("result-efficiency-score").innerText = `+${res.scoreDetails.efficiency || 0}`;

    document.getElementById("result-explanation").innerText = res.explanation;
    document.getElementById("result-lesson").innerText = res.lesson;

    const stats = getStats();
    document.getElementById("result-streak-display").innerText = `🔥 ${stats.streak} DAY STREAK`;
  }

  function renderHistoryScreen() {
    const history = getHistory();
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No incident history recorded.</td></tr>`;
      return;
    }

    history.forEach(h => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${h.date}</td>
        <td>${h.title}</td>
        <td><span class="badge badge-${h.difficulty.toLowerCase()}">${h.difficulty}</span></td>
        <td>${h.score.toLocaleString()}</td>
        <td>${h.isCorrect ? '<span style="color:var(--accent-green)">✓ Solved</span>' : '<span style="color:var(--accent-red)">✕ Failed</span>'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Event Handlers & Global Bindings ---
  function setupEventListeners() {
    document.getElementById("btn-start-game").onclick = startGame;
    document.getElementById("btn-submit-hypothesis").onclick = () => handleGameCompletion(false);

    document.getElementById("btn-nav-history").onclick = () => {
      renderHistoryScreen();
      showScreen("history");
    };

    document.getElementById("btn-history-back").onclick = () => showScreen("landing");
    document.getElementById("btn-result-done").onclick = () => showScreen("landing");

    document.getElementById("btn-nav-leaderboard").onclick = () => {
      document.getElementById("modal-leaderboard").classList.add("active");
    };

    document.getElementById("btn-close-modal").onclick = () => {
      document.getElementById("modal-leaderboard").classList.remove("active");
    };

    document.getElementById("btn-share-result").onclick = shareResult;
  }

  function shareResult() {
    const stats = getStats();
    const todayStr = new Date().toISOString().slice(0, 10);
    const text = `THE DAILY INCIDENT (${todayStr})\nCategory: ${currentIncident.category}\nDifficulty: ${currentIncident.difficulty}\nStreak: 🔥 ${stats.streak}\n\nSolve production outages in 3 mins at: https://adeivass.dev`;

    if (navigator.share) {
      navigator.share({ title: "The Daily Incident", text: text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Results copied to clipboard!");
    }
  }

  // Expose node click handler for inline SVG binding
  window.DailyIncident = {
    handleNodeClick: function(nodeId) {
      renderInvestigationOptions(nodeId);
    }
  };

  // Run initial boot
  document.addEventListener("DOMContentLoaded", init);
})();