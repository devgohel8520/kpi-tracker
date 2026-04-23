// ─────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

// ─────────────────────────────────────────────────────
//  API HELPER
// ─────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('kpit_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(localStorage.getItem('kpit_user_id') && { 'X-User-Id': localStorage.getItem('kpit_user_id') }),
    ...options.headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.error || 'Request failed');
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────
//  DATA LAYER (mirrors localStorage API)
// ─────────────────────────────────────────────────────
const App = {
  get kpis() { return this._kpis || []; },
  set kpis(v) { this._kpis = v; },
  get records() { return this._records || []; },
  set records(v) { this._records = v; },
  get users() { return this._users || []; },
  get currentUser() {
    const id = localStorage.getItem('kpit_user_id');
    const name = localStorage.getItem('kpit_user_name');
    const email = localStorage.getItem('kpit_user_email');
    const token = localStorage.getItem('kpit_token');
    return id && token ? { id, name, email } : null;
  },
  get rememberedEmail() { return localStorage.getItem('kpit_rememberEmail') || ''; },

  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  // Load all data from server
  async loadAll() {
    if (!this.currentUser) return;
    try {
      const kpis = await window.App.loadAll();
      this.kpis = kpis || [];
    } catch (err) {
      console.error('Failed to load data:', err);
      this.kpis = [];
    }
  },

  createKPI(data) {
    const kpi = { id: this.uid(), ...data, isActive: true, createdAt: new Date().toISOString() };
    this.kpis = [...this.kpis, kpi];
    return kpi;
  },

  updateKPI(id, data) {
    this.kpis = this.kpis.map(k => k.id === id ? { ...k, ...data } : k);
    return this.kpis.find(k => k.id === id);
  },

  async saveKPI(data) {
    try {
      const result = await window.App.saveKPI(data);
      const existing = this._kpis.findIndex(k => k.id === result.id);
      if (existing >= 0) {
        this._kpis[existing] = result;
      } else {
        this._kpis = [...this._kpis, result];
      }
      return result;
    } catch (err) {
      console.error('Failed to save KPI:', err);
      throw err;
    }
  },

  async deleteKPI(id) {
    try {
      await window.App.deleteKPI(id);
      this.kpis = this.kpis.filter(k => k.id !== id);
      this.records = this.records.filter(r => r.kpi_id !== id);
    } catch (err) {
      console.error('Failed to delete KPI:', err);
      throw err;
    }
  },

  createRecord(data) {
    const rec = { id: this.uid(), ...data, createdAt: new Date().toISOString() };
    this.records = [...this.records, rec];
    return rec;
  },

  async saveRecord(data) {
    try {
      const result = await window.App.saveRecord(data);
      this.records = [...this.records, result];
      return result;
    } catch (err) {
      console.error('Failed to save record:', err);
      throw err;
    }
  },

  async deleteRecord(id) {
    try {
      await window.App.deleteRecord(id);
      this.records = this.records.filter(r => r.id !== id);
    } catch (err) {
      console.error('Failed to delete record:', err);
      throw err;
    }
  },

  getKPIById(id) { return this.kpis.find(k => k.id === id); },

  getRecordsByKPI(id) {
    return this.records.filter(r => r.kpi_id === id).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  },

  getLatestRecord(id) {
    const r = this.getRecordsByKPI(id);
    return r.length ? r[r.length - 1] : null;
  },

  todayStr() { return new Date().toISOString().slice(0, 10); },

  hasRecordToday(kpiId) {
    return this.records.some(r => r.kpi_id === kpiId && r.recorded_at && r.recorded_at.slice(0, 10) === this.todayStr());
  },

  async signup(name, email, password) {
    try {
      const result = await api('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      if (result.success) {
        this.setSession(result.user);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async login(email, password, remember = false) {
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (result.success) {
        this.setSession(result.user);
        if (remember) {
          localStorage.setItem('kpit_rememberEmail', email);
        } else {
          localStorage.removeItem('kpit_rememberEmail');
        }
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  setSession(user) {
    localStorage.setItem('kpit_user_id', user.id);
    localStorage.setItem('kpit_user_name', user.name);
    localStorage.setItem('kpit_user_email', user.email);
    localStorage.setItem('kpit_token', 'token_' + user.id);
  },

  logout() {
    localStorage.removeItem('kpit_user_id');
    localStorage.removeItem('kpit_user_name');
    localStorage.removeItem('kpit_user_email');
    localStorage.removeItem('kpit_token');
    this.kpis = [];
    this.records = [];
  },

  setRememberEmail(email) {
    if (email) localStorage.setItem('kpit_rememberEmail', email);
    else localStorage.removeItem('kpit_rememberEmail');
  }
};

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
  switch (kpi.repeatOn) {
    case 'daily': return true;
    case 'weekly': return parseInt(kpi.repeatDay) === dow;
    case 'fortnightly': {
      if (parseInt(kpi.repeatDay) !== dow) return false;
      const created = new Date(kpi.createdAt);
      const diffDays = Math.floor((today - created) / (1000 * 60 * 60 * 24));
      return Math.floor(diffDays / 7) % 2 === 0;
    }
    case 'monthly': return parseInt(kpi.repeatDay) === dom;
    case 'quarterly': {
      const qMonth = [0, 3, 6, 9];
      return qMonth.includes(mo) && dom === parseInt(kpi.repeatDay);
    }
    case 'half_yearly': return (mo === 0 || mo === 6) && dom === parseInt(kpi.repeatDay);
    case 'yearly': {
      if (!kpi.repeatDay) return false;
      const [m, d] = kpi.repeatDay.split('-');
      return parseInt(m) - 1 === mo && parseInt(d) === dom;
    }
    default: return false;
  }
}
function getDueKPIs() {
  return App.kpis.filter(k => k.isActive && isDueToday(k) && !App.hasRecordToday(k.id));
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
    const d = new Date(r.date + 'T00:00:00');
    return d >= start && d <= end;
  });
}

function achievementPct(kpi, val) {
  if (!kpi.hasTarget || !kpi.target) return null;
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