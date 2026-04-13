/* ========================================
   AI Study Command Center — Main App
   ======================================== */

// ========== STATE ==========
let state = {
  examName: '',
  examDate: '',
  dailyHours: 4,
  subjects: [],
  weakSubjects: [],
  plan: [],
  streak: 0,
  streakHistory: [],
  doubtHistory: [],
  currentStep: 1
};

// ========== AGENTS ==========
const planner = new PlannerAgent();
const tracker = new TrackerAgent();
const motivation = new MotivationAgent();
const doubtSolver = new DoubtSolverAgent();

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  // Set minimum date to today
  const dateInput = document.getElementById('exam-date');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate() + 1).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;

  // Slider display
  const slider = document.getElementById('daily-hours');
  const display = document.getElementById('hours-display');
  slider.addEventListener('input', () => {
    display.textContent = `${slider.value} hrs`;
    state.dailyHours = parseInt(slider.value);
  });

  // Subject input enter key
  document.getElementById('subject-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSubject();
  });

  // Load saved state
  loadState();

  // If we have a plan, show dashboard
  if (state.plan && state.plan.length > 0) {
    showSection('dashboard');
    renderDashboard();
  }
});

// ========== NAVIGATION ==========
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.getElementById(`nav-${sectionId === 'hero' ? 'home' : sectionId}`);
  if (navLink) navLink.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== SETUP STEPS ==========
function nextStep(step) {
  // Validate current step
  if (step === 2 && state.currentStep === 1) {
    const examName = document.getElementById('exam-name').value.trim();
    const examDate = document.getElementById('exam-date').value;

    if (!examName) { showToast('Please enter an exam name', 'error'); return; }
    if (!examDate) { showToast('Please select an exam date', 'error'); return; }

    state.examName = examName;
    state.examDate = examDate;
    state.dailyHours = parseInt(document.getElementById('daily-hours').value);
  }

  if (step === 3 && state.subjects.length < 2) {
    showToast('Please add at least 2 subjects', 'error');
    return;
  }

  // Update step display
  state.currentStep = step;
  document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`setup-step-${step}`).classList.add('active');

  // Update step dots
  document.querySelectorAll('.step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'completed');
    if (dotStep === step) dot.classList.add('active');
    else if (dotStep < step) dot.classList.add('completed');
  });

  // If going to step 3, show summary
  if (step === 3) updateLaunchSummary();
}

// ========== SUBJECT MANAGEMENT ==========
function addSubject() {
  const input = document.getElementById('subject-input');
  const isWeak = document.getElementById('is-weak');
  const name = input.value.trim();

  if (!name) return;
  if (state.subjects.includes(name)) {
    showToast('Subject already added', 'error');
    return;
  }

  state.subjects.push(name);
  if (isWeak.checked) {
    state.weakSubjects.push(name);
  }

  input.value = '';
  isWeak.checked = false;
  renderSubjectChips();
  updateSubjectButton();
}

function removeSubject(name) {
  state.subjects = state.subjects.filter(s => s !== name);
  state.weakSubjects = state.weakSubjects.filter(s => s !== name);
  renderSubjectChips();
  updateSubjectButton();
}

function renderSubjectChips() {
  const container = document.getElementById('subject-list');
  container.innerHTML = state.subjects.map(s => {
    const isWeak = state.weakSubjects.includes(s);
    return `
      <div class="subject-chip ${isWeak ? 'weak' : ''}">
        ${s}
        ${isWeak ? '<span class="chip-weak-badge" style="font-size:0.65rem;color:var(--accent-doubt)">weak</span>' : ''}
        <span class="chip-remove" onclick="removeSubject('${s.replace(/'/g, "\\'")}')">&times;</span>
      </div>
    `;
  }).join('');
}

function updateSubjectButton() {
  const btn = document.getElementById('step2-next');
  const hint = document.getElementById('subject-hint');
  if (state.subjects.length >= 2) {
    btn.disabled = false;
    hint.textContent = `${state.subjects.length} subjects added ✓`;
    hint.style.color = 'var(--accent-tracker)';
  } else {
    btn.disabled = true;
    hint.textContent = `Add at least 2 subjects to continue (${state.subjects.length}/2)`;
    hint.style.color = '';
  }
}

function updateLaunchSummary() {
  const examDate = new Date(state.examDate);
  const today = new Date();
  const daysLeft = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));

  document.getElementById('launch-summary').innerHTML = `
    <h4>📋 Plan Summary</h4>
    <div class="summary-items">
      <div class="summary-item">
        <span class="label">Exam</span>
        <span class="value">${state.examName}</span>
      </div>
      <div class="summary-item">
        <span class="label">Exam Date</span>
        <span class="value">${examDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div class="summary-item">
        <span class="label">Days Until Exam</span>
        <span class="value" style="color:var(--accent-motivation)">${daysLeft} days</span>
      </div>
      <div class="summary-item">
        <span class="label">Daily Study Hours</span>
        <span class="value">${state.dailyHours} hours</span>
      </div>
      <div class="summary-item">
        <span class="label">Subjects</span>
        <span class="value">${state.subjects.join(', ')}</span>
      </div>
      ${state.weakSubjects.length > 0 ? `
      <div class="summary-item">
        <span class="label">Weak Subjects</span>
        <span class="value" style="color:var(--accent-doubt)">${state.weakSubjects.join(', ')}</span>
      </div>` : ''}
    </div>
  `;
}

// ========== PLAN GENERATION ==========
function generatePlan() {
  const doubt = document.getElementById('initial-doubt').value.trim();

  // Show loading
  showLoading(async () => {
    // Generate plan
    state.plan = planner.generatePlan(state.examDate, state.subjects, state.dailyHours, state.weakSubjects);

    // Initialize streak
    state.streak = 0;
    state.streakHistory = [];

    // Save state
    saveState();

    // Handle initial doubt
    if (doubt) {
      const result = doubtSolver.solve(state.subjects[0] || 'General', doubt, 'simple');
      state.doubtHistory.unshift({
        question: doubt,
        subject: state.subjects[0] || 'General',
        mode: 'simple',
        response: result,
        time: new Date().toLocaleString()
      });
    }

    // Switch to dashboard
    showSection('dashboard');
    renderDashboard();

    showToast('🚀 Study plan generated successfully!', 'success');
  });
}

function showLoading(callback) {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');

  const agents = ['la-planner', 'la-tracker', 'la-motivation', 'la-doubt'];
  const texts = [
    'Analyzing your exam schedule...',
    'Building study timetable...',
    'Calibrating tracker...',
    'Preparing motivation engine...',
    'Initializing doubt solver...',
    'Finalizing your plan...'
  ];

  let textIdx = 0;
  let agentIdx = 0;

  const textInterval = setInterval(() => {
    document.getElementById('loading-text').textContent = texts[textIdx % texts.length];
    textIdx++;
  }, 500);

  const agentInterval = setInterval(() => {
    agents.forEach(id => document.getElementById(id).classList.remove('active-la'));
    document.getElementById(agents[agentIdx % agents.length]).classList.add('active-la');
    agentIdx++;
  }, 400);

  setTimeout(() => {
    clearInterval(textInterval);
    clearInterval(agentInterval);
    overlay.classList.add('hidden');
    if (callback) callback();
  }, 3000);
}

// ========== DASHBOARD RENDERING ==========
function renderDashboard() {
  renderAgentStatus();
  renderPlanTimeline();
  renderTracker();
  renderMotivation();
  renderStreakCalendar();
  renderQuickStats();
  populateDoubtSubjects();
  renderDoubtHistory();
}

function renderAgentStatus() {
  const agents = ['planner', 'tracker', 'motivation', 'doubt'];
  agents.forEach(a => {
    const el = document.getElementById(`status-${a}`);
    el.classList.add('active-agent');
    el.querySelector('.status-state').textContent = 'Active';
  });
}

function renderPlanTimeline() {
  const examDate = new Date(state.examDate);
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));

  document.getElementById('plan-title').textContent = `📅 ${state.examName} — Study Plan`;
  document.getElementById('plan-subtitle').textContent = `${daysLeft} days remaining`;
  document.getElementById('stat-days').textContent = daysLeft;
  document.getElementById('stat-subjects').textContent = state.subjects.length;
  document.getElementById('stat-hours').textContent = state.dailyHours;

  const container = document.getElementById('plan-timeline');
  const todayStr = new Date().toDateString();

  container.innerHTML = state.plan.map((day, idx) => {
    const dayDate = new Date(day.date);
    const isToday = dayDate.toDateString() === todayStr;
    const isPast = dayDate < new Date(todayStr);

    let dayClass = 'plan-day';
    if (day.isRevision) dayClass += ' revision';
    if (isToday) dayClass += ' today';
    if (isPast) dayClass += ' past';

    const tasksHtml = day.tasks.map(task => {
      let cls = 'day-task';
      if (task.isWeak) cls += ' weak-task';
      if (task.type === 'revision') cls += ' revision-badge';

      const statusIcon = task.status === 'completed' ? '✅' : task.status === 'missed' ? '❌' : '';

      return `
        <div class="${cls}">
          ${statusIcon} ${task.subject}
          <span class="task-time">${planner.formatDuration(task.duration)}</span>
          ${task.type === 'revision' ? '<span class="task-time">📖 Rev</span>' : ''}
          ${task.type === 'rescheduled' ? '<span class="task-time">🔄</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="${dayClass}">
        <div class="day-label">
          <span class="day-num">Day ${day.dayNum}</span>
          <span class="day-name">${day.dayOfWeek}</span>
          <span class="day-date">${day.dateStr}</span>
          ${isToday ? '<span style="color:var(--accent-planner);font-size:0.7rem;font-weight:700">TODAY</span>' : ''}
        </div>
        <div class="day-tasks">
          ${day.isRevision ? '<div class="day-task revision-badge">📖 Revision Day</div>' : ''}
          ${tasksHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderTracker() {
  const stats = tracker.getStats(state.plan);
  const todayData = tracker.getTodaysTasks(state.plan);
  const upcoming = tracker.getUpcomingTasks(state.plan);

  // Update progress ring
  const circle = document.getElementById('progress-circle');
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (stats.completionRate / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  document.getElementById('progress-percent').textContent = `${stats.completionRate}%`;
  document.getElementById('completed-count').textContent = stats.completed;
  document.getElementById('missed-count').textContent = stats.missed;
  document.getElementById('pending-count').textContent = stats.pending;

  // Today's tasks
  const todayContainer = document.getElementById('today-tasks');
  if (todayData && todayData.tasks.length > 0) {
    todayContainer.innerHTML = todayData.tasks.map((task, idx) => {
      const checkboxCls = task.status === 'completed' ? 'completed' : task.status === 'missed' ? 'missed' : '';
      const textCls = task.status === 'completed' ? 'completed-text' : '';

      return `
        <div class="task-item">
          <div class="task-checkbox ${checkboxCls}" onclick="toggleTask(${todayData.dayNum - 1}, ${idx})">
            ${task.status === 'completed' ? '✓' : task.status === 'missed' ? '✗' : ''}
          </div>
          <div class="task-info">
            <div class="task-subject ${textCls}">${task.subject}${task.type === 'revision' ? ' (Revision)' : ''}${task.type === 'rescheduled' ? ' 🔄' : ''}</div>
            <div class="task-duration">${planner.formatDuration(task.duration)}</div>
          </div>
          <div class="task-actions">
            ${task.status === 'pending' ? `
              <button class="task-action-btn complete-btn" onclick="markTask(${todayData.dayNum - 1}, ${idx}, 'completed')">✓ Done</button>
              <button class="task-action-btn miss-btn" onclick="markTask(${todayData.dayNum - 1}, ${idx}, 'missed')">✗ Miss</button>
            ` : `
              <button class="task-action-btn" onclick="markTask(${todayData.dayNum - 1}, ${idx}, 'pending')">↩ Undo</button>
            `}
          </div>
        </div>
      `;
    }).join('');
  } else {
    todayContainer.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center">No tasks for today</p>';
  }

  // Upcoming tasks
  const upcomingContainer = document.getElementById('upcoming-tasks');
  if (upcoming.length > 0) {
    upcomingContainer.innerHTML = upcoming.map(day => {
      return day.tasks.map(task => `
        <div class="task-item">
          <div class="task-checkbox"></div>
          <div class="task-info">
            <div class="task-subject">${task.subject}${task.type === 'revision' ? ' (Rev)' : ''}</div>
            <div class="task-duration">Day ${day.dayNum} · ${day.dateStr} · ${planner.formatDuration(task.duration)}</div>
          </div>
        </div>
      `).join('');
    }).join('');
  } else {
    upcomingContainer.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center">No upcoming tasks</p>';
  }
}

function markTask(dayIdx, taskIdx, status) {
  if (state.plan[dayIdx] && state.plan[dayIdx].tasks[taskIdx]) {
    state.plan[dayIdx].tasks[taskIdx].status = status;
    updateStreak();
    saveState();
    renderTracker();
    renderPlanTimeline();
    renderMotivation();
    renderQuickStats();

    if (status === 'completed') {
      showToast('✅ Task completed! Great work!', 'success');
      // Activate tracker agent
      flashAgent('tracker');
    } else if (status === 'missed') {
      showToast('Task marked as missed — we\'ll reschedule it', 'info');
      flashAgent('tracker');
    }
  }
}

function toggleTask(dayIdx, taskIdx) {
  const task = state.plan[dayIdx]?.tasks[taskIdx];
  if (!task) return;

  if (task.status === 'pending') markTask(dayIdx, taskIdx, 'completed');
  else if (task.status === 'completed') markTask(dayIdx, taskIdx, 'pending');
  else if (task.status === 'missed') markTask(dayIdx, taskIdx, 'pending');
}

function reschedule() {
  flashAgent('tracker');
  state.plan = tracker.reschedule([...state.plan], state.dailyHours);
  saveState();
  renderPlanTimeline();
  renderTracker();
  showToast('🔄 Plan rescheduled! Missed tasks redistributed.', 'success');
}

function resetProgress() {
  const todayData = tracker.getTodaysTasks(state.plan);
  if (todayData) {
    todayData.tasks.forEach(t => t.status = 'pending');
    saveState();
    renderTracker();
    renderPlanTimeline();
    showToast('Today\'s progress reset', 'info');
  }
}

// ========== STREAK ==========
function updateStreak() {
  const todayData = tracker.getTodaysTasks(state.plan);
  if (!todayData) return;

  const allCompleted = todayData.tasks.every(t => t.status === 'completed');
  const anyMissed = todayData.tasks.some(t => t.status === 'missed');

  const todayStr = new Date().toDateString();
  const existing = state.streakHistory.find(h => h.date === todayStr);

  if (allCompleted && todayData.tasks.length > 0) {
    if (!existing) {
      state.streakHistory.push({ date: todayStr, status: 'completed' });
      state.streak++;
    } else {
      existing.status = 'completed';
    }
  } else if (anyMissed) {
    if (!existing) {
      state.streakHistory.push({ date: todayStr, status: 'partial' });
    }
  }

  renderStreakCalendar();
}

function renderStreakCalendar() {
  document.getElementById('streak-count').textContent = state.streak;

  const container = document.getElementById('streak-calendar');
  const days = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toDateString();
    const history = state.streakHistory.find(h => h.date === dateStr);

    let cls = 'streak-day';
    if (history?.status === 'completed') cls += ' active-day';
    else if (history?.status === 'partial') cls += ' missed-day';

    days.push(`<div class="${cls}" title="${d.toLocaleDateString()}"></div>`);
  }

  container.innerHTML = days.join('');
}

// ========== MOTIVATION ==========
function renderMotivation() {
  const stats = tracker.getStats(state.plan);
  const examDate = new Date(state.examDate);
  const daysLeft = Math.max(0, Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24)));

  const message = motivation.getMessage(stats, daysLeft, state.streak);
  document.getElementById('motivation-message').innerHTML = `<p>${message.replace(/\n/g, '<br>')}</p>`;
  flashAgent('motivation');
}

function refreshMotivation() {
  renderMotivation();
  showToast('💬 New motivation generated!', 'info');
}

// ========== QUICK STATS ==========
function renderQuickStats() {
  const stats = tracker.getStats(state.plan);
  const { strongest, weakest } = tracker.getStrongestAndWeakest(state.plan);

  const totalHours = state.plan.reduce((sum, day) => {
    return sum + day.tasks.reduce((s, t) => s + (t.status === 'completed' ? t.duration : 0), 0);
  }, 0);

  document.getElementById('total-study-hours').textContent = `${Math.round(totalHours / 60)}h`;
  document.getElementById('completion-rate').textContent = `${stats.completionRate}%`;
  document.getElementById('strongest-subject').textContent = strongest;
  document.getElementById('weakest-subject').textContent = weakest;
}

// ========== TABS ==========
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
}

// ========== DOUBT SOLVER ==========
function populateDoubtSubjects() {
  const select = document.getElementById('doubt-subject');
  select.innerHTML = state.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  select.innerHTML += '<option value="General">General</option>';
}

function solveDoubt() {
  const subject = document.getElementById('doubt-subject').value;
  const question = document.getElementById('doubt-question').value.trim();
  const mode = document.querySelector('input[name="doubt-mode"]:checked').value;

  if (!question) {
    showToast('Please type your question', 'error');
    return;
  }

  flashAgent('doubt');

  const result = doubtSolver.solve(subject, question, mode);

  // Save to history
  state.doubtHistory.unshift({
    question,
    subject,
    mode,
    response: result,
    time: new Date().toLocaleString()
  });
  saveState();

  // Render response
  const container = document.getElementById('doubt-response');
  container.classList.remove('hidden');

  let html = `<h3>${result.title}</h3>`;
  result.sections.forEach(section => {
    html += '<div class="answer-section">';
    if (section.heading) html += `<h4>${section.heading}</h4>`;
    if (section.content) html += `<p>${section.content}</p>`;
    if (section.points) {
      html += '<ul>';
      section.points.forEach(p => html += `<li>${p}</li>`);
      html += '</ul>';
    }
    html += '</div>';
  });

  container.innerHTML = html;

  // Clear input
  document.getElementById('doubt-question').value = '';

  // Render history
  renderDoubtHistory();

  showToast('🧠 Doubt solved!', 'success');
}

function renderDoubtHistory() {
  const container = document.getElementById('doubt-history');
  if (state.doubtHistory.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<h3 style="margin:16px 0 8px;font-size:0.9rem;color:var(--text-secondary)">📜 Previous Questions</h3>' +
    state.doubtHistory.slice(0, 10).map((item, idx) => `
      <div class="history-item" onclick="showHistoryDoubt(${idx})">
        <div class="history-question">${item.question.substring(0, 80)}${item.question.length > 80 ? '...' : ''}</div>
        <div class="history-meta">${item.subject} · ${item.mode} mode · ${item.time}</div>
      </div>
    `).join('');
}

function showHistoryDoubt(idx) {
  const item = state.doubtHistory[idx];
  if (!item) return;

  const container = document.getElementById('doubt-response');
  container.classList.remove('hidden');

  let html = `<h3>${item.response.title}</h3>`;
  item.response.sections.forEach(section => {
    html += '<div class="answer-section">';
    if (section.heading) html += `<h4>${section.heading}</h4>`;
    if (section.content) html += `<p>${section.content}</p>`;
    if (section.points) {
      html += '<ul>';
      section.points.forEach(p => html += `<li>${p}</li>`);
      html += '</ul>';
    }
    html += '</div>';
  });

  container.innerHTML = html;
}

// ========== AGENT FLASH ==========
function flashAgent(agentName) {
  const el = document.getElementById(`status-${agentName}`);
  el.style.transform = 'scale(1.05)';
  el.style.boxShadow = `0 0 20px var(--accent-${agentName === 'doubt' ? 'doubt' : agentName === 'motivation' ? 'motivation' : agentName === 'tracker' ? 'tracker' : 'planner'}-glow)`;
  setTimeout(() => {
    el.style.transform = '';
    el.style.boxShadow = '';
  }, 1000);
}

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== PERSISTENCE ==========
function saveState() {
  try {
    const toSave = {
      examName: state.examName,
      examDate: state.examDate,
      dailyHours: state.dailyHours,
      subjects: state.subjects,
      weakSubjects: state.weakSubjects,
      plan: state.plan,
      streak: state.streak,
      streakHistory: state.streakHistory,
      doubtHistory: state.doubtHistory
    };
    localStorage.setItem('studyAI_state', JSON.stringify(toSave));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem('studyAI_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);

      // Restore dates in plan
      if (state.plan) {
        state.plan.forEach(day => {
          if (day.date) day.date = new Date(day.date);
        });
      }
    }
  } catch (e) {
    console.warn('Could not load state:', e);
  }
}

// ========== RESET ==========
function resetAll() {
  if (!confirm('Are you sure you want to reset everything? This will delete your study plan and progress.')) return;

  localStorage.removeItem('studyAI_state');
  state = {
    examName: '',
    examDate: '',
    dailyHours: 4,
    subjects: [],
    weakSubjects: [],
    plan: [],
    streak: 0,
    streakHistory: [],
    doubtHistory: [],
    currentStep: 1
  };

  showSection('hero');
  showToast('Everything reset. Start fresh!', 'info');
}

// ========== MODE TOGGLE (Doubt form) ==========
document.addEventListener('click', (e) => {
  const modeOption = e.target.closest('.mode-option');
  if (modeOption) {
    document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
    modeOption.classList.add('active');
  }
});
