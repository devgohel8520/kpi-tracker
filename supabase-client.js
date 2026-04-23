// KPI Tracker - Supabase Client
// For deployment on Vercel with Supabase backend

// ═══════════════════════════════════════════════════════
//  CONFIG - Update these for your Supabase project
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = 'Rest API: https://tnbrhufwngacjecnybnm.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuYnJodWZ3bmdhY2plY255Ym5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTYyNzcsImV4cCI6MjA5MjUzMjI3N30.WRPutgx1Q8uN4MyF7w6xwEPbUoUDroE-6_qQBq-BSBM';

// Note: Get these from your Supabase dashboard:
// Settings > API > Project URL
// Settings > API > anon public key

// ═══════════════════════════════════════════════
//  SUPABASE CLIENT
// ═══════════════════════════════════════════════════════
const createClient = () => {
  const token = localStorage.getItem('kpit_token');
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
};

const getClient = () => {
  if (!window.supabase) {
    console.error('Supabase client not initialized');
    return null;
  }
  return createClient();
};

// ═══════════════════════════════════════════════════════
//  DATA LAYER
// ═══════════════════════════════════════════════════════
const App = {
  _kpis: [],
  _records: [],

  get kpis() { return this._kpis; },
  set kpis(v) { this._kpis = v; },
  get records() { return this._records; },
  set records(v) { this._records = v; },
  get currentUser() {
    const id = localStorage.getItem('kpit_user_id');
    const name = localStorage.getItem('kpit_user_name');
    const email = localStorage.getItem('kpit_user_email');
    return id ? { id, name, email } : null;
  },
  get rememberedEmail() { return localStorage.getItem('kpit_rememberEmail') || ''; },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  async loadAll() {
    if (!this.currentUser) return;
    try {
      const client = getClient();
      const userId = localStorage.getItem('kpit_user_id');

      // Load KPIs
      const { data: kpis, error: kpiError } = await client
        .from('kpis')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (kpiError) throw kpiError;
      this.kpis = kpis || [];

      // Load Records for user's KPIs
      const kpiIds = this.kpis.map(k => k.id);
      if (kpiIds.length > 0) {
        const { data: records, error: recError } = await client
          .from('records')
          .select('*')
          .in('kpi_id', kpiIds)
          .order('date', { ascending: false });

        if (recError) throw recError;
        this.records = records || [];
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      this.kpis = [];
      this.records = [];
    }
  },

  async saveKPI(data) {
    const client = getClient();
    const userId = localStorage.getItem('kpit_user_id');

    if (data.id && this.kpis.find(k => k.id === data.id)) {
      // Update existing KPI
      const updateData = {
        title: data.title,
        description: data.description,
        data_type: data.dataType || data.data_type,
        has_target: data.hasTarget || data.has_target,
        target: data.hasTarget ? data.target : null,
        has_remarks: data.hasRemarks || data.has_remarks,
        repeat_on: data.repeatOn || data.repeat_on,
        repeat_day: data.repeatDay || data.repeat_day,
        is_active: data.isActive !== undefined ? data.is_active : true
      };

      const { error } = await client
        .from('kpis')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;
      this.updateKPI(data.id, data);
      return data;
    } else {
      // Create new KPI
      const newKpi = {
        id: this.uid(),
        user_id: userId,
        title: data.title,
        description: data.description || '',
        data_type: data.dataType || 'number',
        has_target: data.hasTarget || false,
        target: data.hasTarget ? data.target : null,
        has_remarks: data.hasRemarks || false,
        repeat_on: data.repeatOn || 'daily',
        repeat_day: data.repeatDay,
        is_active: true
      };

      const { error } = await client.from('kpis').insert(newKpi);
      if (error) throw error;

      const kpiWithDate = { ...newKpi, created_at: new Date().toISOString() };
      this.kpis = [...this.kpis, kpiWithDate];
      return kpiWithDate;
    }
  },

  updateKPI(id, data) {
    this.kpis = this.kpis.map(k => k.id === id ? { ...k, ...data } : k);
    return this.kpis.find(k => k.id === id);
  },

  async deleteKPI(id) {
    const client = getClient();
    const { error } = await client.from('kpis').delete().eq('id', id);
    if (error) throw error;
    this.kpis = this.kpis.filter(k => k.id !== id);
    this.records = this.records.filter(r => r.kpi_id !== id);
  },

  async saveRecord(data) {
    const client = getClient();
    const newRecord = {
      id: this.uid(),
      kpi_id: data.kpiId,
      value: data.value,
      date: data.date || this.todayStr(),
      remarks: data.remarks || null
    };

    const { error } = await client.from('records').insert(newRecord);
    if (error) throw error;

    const recordWithDate = { ...newRecord, created_at: new Date().toISOString() };
    this.records = [...this.records, recordWithDate];
    return recordWithDate;
  },

  async deleteRecord(id) {
    const client = getClient();
    const { error } = await client.from('records').delete().eq('id', id);
    if (error) throw error;
    this.records = this.records.filter(r => r.id !== id);
  },

  getKPIById(id) { return this.kpis.find(k => k.id === id); },
  getRecordsByKPI(id) { return this.records.filter(r => r.kpi_id === id).sort((a, b) => new Date(a.date) - new Date(b.date)); },
  getLatestRecord(id) { const r = this.getRecordsByKPI(id); return r.length ? r[r.length - 1] : null; },
  todayStr() { return new Date().toISOString().slice(0, 10); },
  hasRecordToday(kpiId) { return this.records.some(r => r.kpi_id === kpiId && r.date === this.todayStr()); },

  async signup(name, email, password) {
    const client = getClient();
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });

      if (error) return { success: false, error: error.message };
      if (data.user) {
        this.setSession({ id: data.user.id, name, email });
        return { success: true };
      }
      return { success: false, error: 'Signup failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async login(email, password, remember = false) {
    const client = getClient();
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) return { success: false, error: error.message };
      if (data.user) {
        const name = data.user.user_metadata?.name || email.split('@')[0];
        this.setSession({ id: data.user.id, name, email });
        if (remember) localStorage.setItem('kpit_rememberEmail', email);
        else localStorage.removeItem('kpit_rememberEmail');
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
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
    const client = getClient();
    if (client) client.auth.signOut();
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

// ═══════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function esc(s) { if (!s && s !== 0) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtVal(kpi, val) {
  if (kpi.data_type === 'yes_no') return val ? 'Yes' : 'No';
  if (kpi.data_type === 'percentage') return parseFloat(val).toFixed(1) + '%';
  return Number(val).toLocaleString();
}

function repeatLabel(kpi) {
  const map = { daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-Yearly', yearly: 'Yearly' };
  let s = map[kpi.repeat_on] || map[kpi.repeatOn] || kpi.repeat_on;
  const day = kpi.repeatDay || kpi.repeat_day;
  if (kpi.repeat_on === 'weekly' || kpi.repeat_on === 'fortnightly') s += ' (' + DAYS[parseInt(day)] + ')';
  else if (kpi.repeat_on === 'monthly') s += ' (Day ' + day + ')';
  else if (kpi.repeat_on === 'quarterly' || kpi.repeat_on === 'half_yearly') s += ' (Day ' + day + ')';
  else if (kpi.repeat_on === 'yearly' && day) {
    const [m, d] = day.split('-');
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
  const day = kpi.repeatDay || kpi.repeat_day;
  switch (kpi.repeat_on) {
    case 'daily': return true;
    case 'weekly': return parseInt(day) === dow;
    case 'fortnightly': return parseInt(day) === dow;
    case 'monthly': return parseInt(day) === dom;
    case 'quarterly': return [0, 3, 6, 9].includes(mo) && dom === parseInt(day);
    case 'half_yearly': return (mo === 0 || mo === 6) && dom === parseInt(day);
    case 'yearly': if (!day) return false; const [m, d] = day.split('-'); return parseInt(m) - 1 === mo && parseInt(d) === dom;
    default: return false;
  }
}

function getDueKPIs() {
  return App.kpis.filter(k => k.is_active && isDueToday(k) && !App.hasRecordToday(k.id));
}

function getDateRange(period) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (period) {
    case 'daily': return { start: new Date(y, m, d), end: new Date(y, m, d) };
    case 'weekly': { const ws = new Date(y, m, d - now.getDay()); return { start: ws, end: new Date(ws.getTime() + 6 * 86400000) }; }
    case 'monthly': return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'quarterly': { const q = Math.floor(m / 3); return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0) }; }
    case 'yearly': return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  }
}

function getRecordsInRange(kpiId, start, end) {
  return App.getRecordsByKPI(kpiId).filter(r => new Date(r.date) >= start && new Date(r.date) <= end);
}

function achievementPct(kpi, val) {
  const target = kpi.target;
  if (!kpi.has_target || !target) return null;
  if (kpi.data_type === 'yes_no') return val ? 100 : 0;
  return Math.min((parseFloat(val) / parseFloat(target)) * 100, 150);
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

function showToast(msg, type = 'success') { toast(msg, type); }

// Auto-initialize Supabase on page load
window.addEventListener('DOMContentLoaded', () => {
  // Supabase JS library is loaded via script tag in HTML
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded');
  }
});