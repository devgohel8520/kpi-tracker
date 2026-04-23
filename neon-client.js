// KPI Tracker - Neon PostgreSQL API Client
// Uses Vercel serverless API with Neon database

const API_BASE = '/api';

const Api = {
  // Data storage
  _kpis: [],
  _records: [],

  async _request(path, options = {}) {
    const token = localStorage.getItem('kpit_token');
    const userId = localStorage.getItem('kpit_user_id');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && userId && { 'Authorization': `${userId}:${token}` }),
      ...options.headers
    };

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
      });
    } catch (e) {
      throw new Error('API unavailable. Deploy to Vercel or run `vercel dev` locally');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API error');
    }
    
    return data;
  },

  get kpis() { return this._request('/kpis'); },
  
  async loadAll() {
    return this._request('/kpis');
  },

  async saveKPI(data) {
    if (data.id) {
      return this._request('/kpis', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
    return this._request('/kpis', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteKPI(id) {
    return this._request(`/kpis?id=${id}`, {
      method: 'DELETE'
    });
  },

  async getRecords(kpiId) {
    return this._request(`/records?kpi_id=${kpiId}`);
  },

  async saveRecord(data) {
    return this._request('/records', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteRecord(id) {
    return this._request(`/records?id=${id}`, {
      method: 'DELETE'
    });
  },

  async login(email, password, remember = false) {
    const data = await this._request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    localStorage.setItem('kpit_token', data.token);
    localStorage.setItem('kpit_user_id', data.user.id);
    localStorage.setItem('kpit_user_name', data.user.name);
    localStorage.setItem('kpit_user_email', data.user.email);
    
    if (remember) {
      localStorage.setItem('kpit_rememberEmail', email);
    } else {
      localStorage.removeItem('kpit_rememberEmail');
    }

    return data;
  },

  async signup(name, email, password) {
    const data = await this._request('/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    localStorage.setItem('kpit_token', data.token);
    localStorage.setItem('kpit_user_id', data.user.id);
    localStorage.setItem('kpit_user_name', data.user.name);
    localStorage.setItem('kpit_user_email', data.user.email);

    return data;
  },

  get currentUser() {
    const id = localStorage.getItem('kpit_user_id');
    const name = localStorage.getItem('kpit_user_name');
    const email = localStorage.getItem('kpit_user_email');
    return id ? { id, name, email } : null;
  },

  get rememberedEmail() { 
    return localStorage.getItem('kpit_rememberEmail') || ''; 
  },

  get kpis() { return this._kpis || []; },
  set kpis(v) { this._kpis = v; },
  get records() { return this._records || []; },
  set records(v) { this._records = v; },

  // Helper methods for app.html
  async loadAll() {
    const kpis = await this._request('/kpis');
    this._kpis = kpis || [];
    
    // Load all records for each KPI
    if (kpis && kpis.length > 0) {
      const allRecords = [];
      for (const kpi of kpis) {
        try {
          const recs = await this._request(`/records?kpi_id=${kpi.id}`);
          if (recs) allRecords.push(...recs);
        } catch (e) { }
      }
      this._records = allRecords;
    }
    
    return kpis;
  },

  async getRecordsForKPI(kpiId) {
    return this._request(`/records?kpi_id=${kpiId}`);
  },

  getRecordsByKPI(kpiId) {
    const allRecords = this._records || [];
    return allRecords.filter(r => r.kpi_id === kpiId).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  },

  getLatestRecord(kpiId) {
    const r = this.getRecordsByKPI(kpiId);
    return r.length ? r[r.length - 1] : null;
  },

  todayStr() { return new Date().toISOString().slice(0, 10); },

  hasRecordToday(kpiId) {
    const today = this.todayStr();
    const allRecords = this._records || [];
    return allRecords.some(r => r.kpi_id === kpiId && r.recorded_at && r.recorded_at.slice(0, 10) === today);
  },

  logout() {
    localStorage.removeItem('kpit_token');
    localStorage.removeItem('kpit_user_id');
    localStorage.removeItem('kpit_user_name');
    localStorage.removeItem('kpit_user_email');
    localStorage.removeItem('kpit_kpis');
    localStorage.removeItem('kpit_records');
  }
};

window.App = Api;