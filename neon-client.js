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

  // Data storage
  _kpis: [],
  _records: [],

  get kpis() { return this._kpis || []; },
  set kpis(v) { this._kpis = v; },
  get records() { return this._records || []; },
  set records(v) { this._records = v; },

  async loadAll() {
    const kpis = await this._request('/kpis');
    // Map API fields to client expected fields
    this._kpis = (kpis || []).map(k => ({
      id: k.id,
      title: k.name || k.title,
      name: k.name,
      description: '',
      dataType: k.data_type || k.dataType || 'number',
      hasTarget: k.has_target || k.hasTarget || false,
      target: k.target || 0,
      repeatOn: k.repeat_on || k.repeatOn || 'daily',
      repeatDay: k.repeat_day || k.repeatDay,
      isActive: k.is_active !== false && k.isActive !== false,
      hasRemarks: k.has_remarks || k.hasRemarks || false,
      createdAt: k.created_at || k.createdAt
    }));
    
    // Load all records
    this._records = [];
    return this._kpis;
  },

  // For app.html compatibility
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

  createKPI(data) {
    const kpi = { 
      ...data, 
      isActive: true, 
      createdAt: new Date().toISOString() 
    };
    return this.saveKPI(kpi).then(result => {
      if (result) this._kpis.push(result);
      return result;
    });
  },

  updateKPI(id, data) {
    return this.saveKPI({ ...data, id }).then(result => {
      if (result) {
        const idx = this._kpis.findIndex(k => k.id === id);
        if (idx >= 0) this._kpis[idx] = result;
      }
      return result;
    });
  },

  async deleteKPI(id) {
    return this._request(`/kpis?id=${id}`, {
      method: 'DELETE'
    });
  },

  // Create/save record
  createRecord(data) {
    return this.saveRecord(data);
  },

  async saveRecord(data) {
    const recData = {
      kpi_id: data.kpiId || data.kpi_id,
      value: data.value,
      recorded_at: data.date || data.recorded_at,
      remarks: data.remarks || ''
    };
    return this._request('/records', {
      method: 'POST',
      body: JSON.stringify(recData)
    }).then(result => {
      if (result) {
        this._records.push({
          id: result.id,
          kpiId: result.kpi_id,
          value: result.value,
          date: result.recorded_at?.slice(0, 10),
          recordedAt: result.recorded_at,
          remarks: result.remarks
        });
      }
      return result;
    });
  },

  async deleteRecord(id) {
    return this._request(`/records?id=${id}`, {
      method: 'DELETE'
    });
  },

  // For app.html compatibility
  todayStr() { return new Date().toISOString().slice(0, 10); },

  hasRecordToday(kpiId) {
    const today = this.todayStr();
    return this._records.some(r => (r.kpi_id || r.kpiId) === kpiId && r.recorded_at && r.recorded_at.slice(0, 10) === today);
  },

  getRecordsByKPI(kpiId) {
    return this._records.filter(r => (r.kpi_id || r.kpiId) === kpiId).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  },

  getLatestRecord(kpiId) {
    const recs = this.getRecordsByKPI(kpiId);
    return recs.length ? recs[recs.length - 1] : null;
  },

  getKPIById(id) {
    return this._kpis.find(k => k.id === id);
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
    // Map API fields to client expected fields
    this._kpis = (kpis || []).map(k => ({
      id: k.id,
      title: k.name,  // API returns 'name', app expects 'title'
      name: k.name,
      description: '',
      dataType: k.dataType || k.data_type || 'number',
      hasTarget: k.hasTarget || k.has_target || false,
      target: k.target || 0,
      repeatOn: k.repeatOn || k.repeat_on || 'daily',
      repeatDay: k.repeatDay || k.repeat_day,
      isActive: k.isActive !== false && k.is_active !== false,
      hasRemarks: k.hasRemarks || k.has_remarks || false,
      createdAt: k.createdAt || k.created_at
    }));
    
    // Load all records for user
    this._records = [];
    return this._kpis;
  },

  async getRecordsForKPI(kpiId) {
    const recs = await this._request(`/records?kpi_id=${kpiId}`);
    return recs || [];
  },

  // Map records fields
  _mapRecords(recs) {
    return (recs || []).map(r => ({
      id: r.id,
      kpiId: r.kpi_id || r.kpiId,
      value: r.value,
      date: r.recorded_at?.slice(0, 10) || r.recordedAt?.slice(0, 10) || r.date,
      recordedAt: r.recorded_at || r.recordedAt,
      remarks: r.remarks
    }));
  },

  getRecordsByKPI(kpiId) {
    const allRecords = this._records || [];
    return allRecords.filter(r => r.kpiId === kpiId).sort((a, b) => new Date(a.date || a.recordedAt) - new Date(b.date || b.recordedAt));
  },

  getLatestRecord(kpiId) {
    const r = this.getRecordsByKPI(kpiId);
    return r.length ? r[r.length - 1] : null;
  },

  hasRecordToday(kpiId) {
    const today = this.todayStr();
    const allRecords = this._records || [];
    return allRecords.some(r => r.kpiId === kpiId && r.date === today);
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