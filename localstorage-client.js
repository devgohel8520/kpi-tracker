// KPI Tracker - LocalStorage Version (for testing without database)
// Switch back to Supabase/Neon when ready

// ═════════════════════════════════════════════════════
//  DATA LAYER - Uses localStorage
// ═════════════════════════════════════════════════════
const App = {
  _kpis: [],
  _records: [],

  get kpis() { 
    const stored = localStorage.getItem('kpit_kpis');
    return stored ? JSON.parse(stored) : [];
  },
  set kpis(v) { 
    this._kpis = v;
    localStorage.setItem('kpit_kpis', JSON.stringify(v));
  },
  get records() { 
    const stored = localStorage.getItem('kpit_records');
    return stored ? JSON.parse(stored) : [];
  },
  set records(v) { 
    this._records = v;
    localStorage.setItem('kpit_records', JSON.stringify(v));
  },
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

  loadAll() {
    // Data already loaded from localStorage via getters
    return Promise.resolve();
  },

  saveKPI(data) {
    if (data.id) {
      // Update existing
      this.kpis = this.kpis.map(k => k.id === data.id ? { ...k, ...data } : k);
    } else {
      // Create new
      const newKPI = { 
        ...data, 
        id: this.uid(), 
        isActive: true, 
        createdAt: new Date().toISOString() 
      };
      this.kpis = [...this.kpis, newKPI];
    }
    return Promise.resolve(data);
  },

  updateKPI(id, data) {
    this.kpis = this.kpis.map(k => k.id === id ? { ...k, ...data } : k);
    return this.kpis.find(k => k.id === id);
  },

  async deleteKPI(id) {
    this.kpis = this.kpis.filter(k => k.id !== id);
    this.records = this.records.filter(r => r.kpiId !== id);
  },

  saveRecord(data) {
    const newRecord = { 
      ...data, 
      id: this.uid(), 
      createdAt: new Date().toISOString() 
    };
    this.records = [...this.records, newRecord];
    return Promise.resolve(newRecord);
  },

  deleteRecord(id) {
    this.records = this.records.filter(r => r.id !== id);
  },

  getKPIById(id) { return this.kpis.find(k => k.id === id); },
  getRecordsByKPI(id) { return this.records.filter(r => r.kpiId === id).sort((a, b) => new Date(a.date) - new Date(b.date)); },
  getLatestRecord(id) { const r = this.getRecordsByKPI(id); return r.length ? r[r.length - 1] : null; },
  todayStr() { return new Date().toISOString().slice(0, 10); },
  hasRecordToday(kpiId) { return this.records.some(r => r.kpiId === kpiId && r.date === this.todayStr()); },

  signup(name, email, password) {
    // Simple local signup (demo only)
    const user = { id: this.uid(), name, email };
    localStorage.setItem('kpit_user_id', user.id);
    localStorage.setItem('kpit_user_name', user.name);
    localStorage.setItem('kpit_user_email', user.email);
    return Promise.resolve({ success: true, user });
  },

  login(email, password, remember = false) {
    // Simple local login (demo only)
    const user = { 
      id: localStorage.getItem('kpit_user_id') || this.uid(), 
      name: email.split('@')[0], 
      email 
    };
    localStorage.setItem('kpit_user_id', user.id);
    localStorage.setItem('kpit_user_name', user.name);
    localStorage.setItem('kpit_user_email', user.email);
    if (remember) localStorage.setItem('kpit_rememberEmail', email);
    else localStorage.removeItem('kpit_rememberEmail');
    return Promise.resolve({ success: true });
  },

  logout() {
    // Keep user info but clear session
    this.kpis = [];
    this.records = [];
  },

  setRememberEmail(email) {
    if (email) localStorage.setItem('kpit_rememberEmail', email);
    else localStorage.removeItem('kpit_rememberEmail');
  }
};

// Load existing data on init
const savedKPIs = localStorage.getItem('kpit_kpis');
const savedRecords = localStorage.getItem('kpit_records');
if (savedKPIs) App._kpis = JSON.parse(savedKPIs);
if (savedRecords) App._records = JSON.parse(savedRecords);

// Set current user if exists
if (!App.currentUser && localStorage.getItem('kpit_user_email')) {
  localStorage.setItem('kpit_user_id', App.uid());
}