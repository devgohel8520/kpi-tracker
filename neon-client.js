// KPI Tracker - Neon PostgreSQL API Client
// Uses Vercel serverless API with Neon database

const API_BASE = '/api';

const Api = {
  // Data storage
  _kpis: [],
  _records: [],

  get kpis() { return this._kpis || []; },
  set kpis(v) { this._kpis = v; },
  get records() { return this._records || []; },
  set records(v) { this._records = v; },

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

  // Load all data from server
  async loadAll() {
    const kpis = await this._request('/kpis');
    // Map API fields to app expected fields
    this._kpis = (kpis || []).map(k => ({
      id: k.id,
      title: k.name || k.title || '',
      name: k.name,
      description: k.description || '',
      dataType: k.data_type || k.dataType || 'number',
      hasTarget: k.has_target || k.hasTarget || false,
      target: k.target || 0,
      repeatOn: k.repeat_on || k.repeatOn || 'daily',
      repeatDay: k.repeat_day || k.repeatDay,
      isActive: k.is_active !== false && k.isActive !== false,
      hasRemarks: k.has_remarks || k.hasRemarks || false,
      createdAt: k.created_at || k.createdAt
    }));
    
    // Load all records for user
    this._records = [];
    if (this._kpis.length > 0) {
      for (const kpi of this._kpis) {
        try {
          const recs = await this._request(`/records?kpi_id=${kpi.id}`);
          if (recs && recs.length > 0) {
            const mapped = recs.map(r => ({
              id: r.id,
              kpiId: r.kpi_id,
              value: r.value,
              date: r.recorded_at?.slice(0, 10),
              recordedAt: r.recorded_at,
              remarks: r.remarks
            }));
            this._records.push(...mapped);
          }
        } catch (e) { console.error('Load records error:', e); }
      }
    }
    
    return this._kpis;
  },

  // Create new KPI
  createKPI(data) {
    const kpi = { 
      title: data.title || data.name,
      name: data.title || data.name,
      dataType: data.dataType || 'number',
      hasTarget: data.hasTarget ?? false,
      target: data.target ?? 0,
      repeatOn: data.repeatOn || 'daily',
      repeatDay: data.repeatDay,
      hasRemarks: data.hasRemarks ?? false,
      isActive: true
    };
    return this.saveKPI(kpi).then(result => {
      if (result) {
        this._kpis.push({
          id: result.id,
          title: result.name,
          name: result.name,
          dataType: result.data_type || 'number',
          hasTarget: result.has_target || false,
          target: result.target || 0,
          repeatOn: result.repeat_on || 'daily',
          repeatDay: result.repeat_day,
          isActive: true,
          hasRemarks: result.has_remarks || false,
          createdAt: result.created_at
        });
      }
      return result;
    });
  },

  // Save KPI (create or update)
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

  // Update existing KPI
  updateKPI(id, data) {
    return this.saveKPI({ ...data, id }).then(result => {
      if (result) {
        const idx = this._kpis.findIndex(k => k.id === id);
        if (idx >= 0) {
          this._kpis[idx] = {
            ...this._kpis[idx],
            ...result,
            title: result.name,
            name: result.name
          };
        }
      }
      return result;
    });
  },

  // Delete KPI
  async deleteKPI(id) {
    const result = await this._request(`/kpis?id=${id}`, {
      method: 'DELETE'
    });
    this._kpis = this._kpis.filter(k => k.id !== id);
    this._records = this._records.filter(r => r.kpiId !== id);
    return result;
  },

  // Create new record
  createRecord(data) {
    return this.saveRecord(data);
  },

  // Save record
  async saveRecord(data) {
    const recData = {
      kpi_id: data.kpiId,
      value: data.value,
      recorded_at: data.date,
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

  // Delete record
  async deleteRecord(id) {
    const result = await this._request(`/records?id=${id}`, {
      method: 'DELETE'
    });
    this._records = this._records.filter(r => r.id !== id);
    return result;
  },

  // Helper methods
  getKPIById(id) {
    return this._kpis.find(k => k.id === id);
  },

  getRecordsByKPI(kpiId) {
    return this._records.filter(r => r.kpiId === kpiId).sort((a, b) => new Date(a.date || a.recordedAt) - new Date(b.date || b.recordedAt));
  },

  getLatestRecord(kpiId) {
    const recs = this.getRecordsByKPI(kpiId);
    return recs.length > 0 ? recs[recs.length - 1] : null;
  },

  todayStr() { return new Date().toISOString().slice(0, 10); },

  hasRecordToday(kpiId) {
    const today = this.todayStr();
    return this._records.some(r => r.kpiId === kpiId && r.date === today);
  },

  // Auth
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

  logout() {
    localStorage.removeItem('kpit_token');
    localStorage.removeItem('kpit_user_id');
    localStorage.removeItem('kpit_user_name');
    localStorage.removeItem('kpit_user_email');
  }
};

window.App = Api;