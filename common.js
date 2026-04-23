// Bridge neon-client to app.html
// Already defined in neon-client.js, just ensure window.App exists
if (typeof window.App === 'undefined') {
  window.App = {
    get kpis() { return [] },
    set kpis(v) { },
    get records() { return [] },
    set records(v) { },
    get currentUser() { return null },
    get rememberedEmail() { return '' },
    loadAll() { return Promise.resolve([]); },
    saveKPI(data) { return Promise.resolve(data); },
    deleteKPI(id) { return Promise.resolve(); },
    saveRecord(data) { return Promise.resolve(data); },
    deleteRecord(id) { return Promise.resolve(); },
    getKPIById(id) { return null; },
    getRecordsByKPI(id) { return []; },
    getLatestRecord(id) { return null; },
    todayStr() { return new Date().toISOString().slice(0, 10); },
    hasRecordToday(kpiId) { return false; },
    logout() { window.location.href = 'index.html'; }
  };
}

// ─────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtVal(kpi, val) {
  if (kpi.dataType === 'yes_no') return val ? 'Yes' : 'No';
  if (kpi.dataType === 'percentage') return parseFloat(val).toFixed(1) + '%';
  return Number(val).toLocaleString();
}
function repeatLabel(kpi) {
  const map = { daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-Yearly', yearly: 'Yearly' };
  let s = map[kpi.repeatOn] || kpi.repeatOn;
  if (kpi.repeatOn === 'weekly' || kpi.repeatOn === 'fortnightly') {
    s += ' (' + DAYS[parseInt(kpi.repeatDay)] + ')';
  } else if (kpi.repeatOn === 'monthly') {
    s += ' (Day ' + kpi.repeatDay + ')';
  } else if (kpi.repeatOn === 'quarterly' || kpi.repeatOn === 'half_yearly') {
    s += ' (Day ' + kpi.repeatDay + ')';
  } else if (kpi.repeatOn === 'yearly' && kpi.repeatDay) {
    const [m, d] = kpi.repeatDay.split('-');
    s += ' (' + SHORT_MONTHS[parseInt(m) - 1] + ' ' + d + ')';
  }
  return s;
}
function typeLabel(t) { return { number: 'Number', percentage: 'Percentage', yes_no: 'Yes / No' }[t] || t; }
function typeBadgeClass(t) { return { number: 'bg-blue-100 text-blue-700', percentage: 'bg-purple-100 text-purple-700', yes_no: 'bg-amber-100 text-amber-700' }[t] || 'bg-gray-100 text-gray-700'; }

function isDueToday(kpi) {
  const today = new Date();
  const dow = today.getDay();
  const dom = today.getDate();
  const mo = today.getMonth();
  switch (kpi.frequency) {
    case 'daily': return true;
    case 'weekly': return parseInt(kpi.repeatDay) === dow;
    case 'monthly': return parseInt(kpi.repeatDay) === dom;
    default: return true;
  }
}
function getDueKPIs() {
  return App.kpis.filter(k => (k.isActive !== false) && isDueToday(k) && !App.hasRecordToday(k.id));
}

function getDateRange(period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (period) {
    case 'daily': return { start: new Date(y, m, d), end: new Date(y, m, d) };
    case 'weekly': { const ws = new Date(y, m, d - now.getDay()); const we = new Date(ws); we.setDate(ws.getDate() + 6); return { start: ws, end: we }; }
    case 'monthly': return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'quarterly': { const q = Math.floor(m / 3); return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0) }; }
    case 'yearly': return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  }
}

function getRecordsInRange(kpiId, start, end) {
  return App.getRecordsByKPI(kpiId).filter(r => {
    const d = new Date(r.recorded_at || r.date + 'T00:00:00');
    return d >= start && d <= end;
  });
}

function achievementPct(kpi, val) {
  if (!kpi.target) return null;
  if (kpi.dataType === 'yes_no') return val ? 100 : 0;
  const pct = (parseFloat(val) / parseFloat(kpi.target)) * 100;
  return Math.min(pct, 150);
}

function pctColor(pct) {
  if (pct === null) return '#94a3b8';
  if (pct >= 100) return '#16a34a';
  if (pct >= 75) return '#2563eb';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}
function statusLabel(pct) {
  if (pct === null) return { label: 'No Target', cls: 'bg-slate-100 text-slate-600' };
  if (pct >= 100) return { label: 'On Target', cls: 'bg-green-100 text-green-700' };
  if (pct >= 75) return { label: 'Near Target', cls: 'bg-blue-100 text-blue-700' };
  if (pct >= 50) return { label: 'Below Target', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Off Target', cls: 'bg-red-100 text-red-700' };
}

function esc(s) { if (!s && s !== 0) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function destroyChart(id) {
  if (window.chartInstances && window.chartInstances[id]) { try { window.chartInstances[id].destroy(); } catch (e) { } delete window.chartInstances[id]; }
}

function toast(msg, type = 'success') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none'; document.body.appendChild(c); }
  const el = document.createElement('div');
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  el.className = `toast-enter pointer-events-auto text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${colors[type] || colors.info}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}