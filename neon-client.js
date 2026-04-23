// KPI Tracker - Neon PostgreSQL API Client
const API_BASE = '/api';

const Api = {
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
      response = await fetch(`${API_BASE}${path}`, {...options, headers});
    } catch (e) {
      throw new Error('API unavailable');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');
    return data;
  },

  async loadAll() {
    const kpis = await this._request('/kpis');
    this._kpis = (kpis || []).map(k => ({
      id: k.id,
      title: k.name || '',
      name: k.name || '',
      description: k.description || '',
      dataType: 'number',
      hasTarget: !!k.target,
      target: Number(k.target) || 0,
      repeatOn: 'daily',
      repeatDay: null,
      isActive: true,
      hasRemarks: false,
      createdAt: k.created_at
    }));
    
    this._records = [];
    if (this._kpis.length > 0) {
      for (const kpi of this._kpis) {
        try {
          const recs = await this._request(`/records?kpi_id=${kpi.id}`);
          if (recs && recs.length > 0) {
            for (const r of recs) {
              this._records.push({
                id: r.id,
                kpiId: Number(r.kpi_id),
                value: Number(r.value),
                date: r.recorded_at ? r.recorded_at.slice(0, 10) : null,
                recordedAt: r.recorded_at,
                remarks: r.remarks || ''
              });
            }
          }
        } catch (e) { }
      }
    }
    return this._kpis;
  },

  createKPI(data) {
    const kpi = {
      title: data.title || data.name || '',
      name: data.title || data.name || '',
      dataType: data.dataType || 'number',
      hasTarget: data.hasTarget === true,
      target: Number(data.target) || 0,
      repeatOn: data.repeatOn || 'daily',
      hasRemarks: data.hasRemarks === true,
      isActive: true
    };
    return this.saveKPI(kpi).then(result => {
      if (result) {
        this._kpis.push({
          id: Number(result.id),
          title: result.name,
          name: result.name,
          dataType: 'number',
          hasTarget: !!result.target,
          target: Number(result.target) || 0,
          repeatOn: 'daily',
          isActive: true,
          hasRemarks: false,
          createdAt: result.created_at
        });
      }
      return result;
    });
  },

  async saveKPI(data) {
    if (data.id) {
      return this._request('/kpis', {method: 'PUT', body: JSON.stringify(data)});
    }
    return this._request('/kpis', {method: 'POST', body: JSON.stringify(data)});
  },

  updateKPI(id, data) {
    return this.saveKPI({...data, id}).then(result => {
      if (result) {
        const idx = this._kpis.findIndex(k => Number(k.id) === Number(id));
        if (idx >= 0) this._kpis[idx] = {...this._kpis[idx], ...result, title: result.name, id: Number(result.id)};
      }
      return result;
    });
  },

  async deleteKPI(id) {
    const numId = Number(id);
    const result = await this._request(`/kpis?id=${numId}`, {method: 'DELETE'});
    this._kpis = this._kpis.filter(k => Number(k.id) !== numId);
    this._records = this._records.filter(r => Number(r.kpiId) !== numId);
    return result;
  },

  createRecord(data) {
    return this.saveRecord(data);
  },

  async saveRecord(data) {
    const recData = {
      kpi_id: data.kpiId,
      value: data.value,
      recorded_at: data.date,
      remarks: data.remarks || ''
    };
    return this._request('/records', {method: 'POST', body: JSON.stringify(recData)}).then(result => {
      if (result) {
        this._records.push({
          id: result.id,
          kpiId: result.kpi_id,
          value: Number(result.value),
          date: result.recorded_at ? result.recorded_at.slice(0, 10) : null,
          recordedAt: result.recorded_at,
          remarks: result.remarks
        });
      }
      return result;
    });
  },

  async deleteRecord(id) {
    const numId = Number(id);
    const result = await this._request(`/records?id=${numId}`, {method: 'DELETE'});
    this._records = this._records.filter(r => Number(r.id) !== numId);
    return result;
  },

  getKPIById(id) {
    // Handle both string and number id
    const numId = Number(id);
    return this._kpis.find(k => k.id === id || k.id === numId);
  },

  getRecordsByKPI(kpiId) {
    const numId = Number(kpiId);
    return this._records.filter(r => r.kpiId === kpiId || r.kpiId === numId).sort((a, b) => {
      const da = a.date || a.recordedAt || '';
      const db = b.date || b.recordedAt || '';
      return new Date(da) - new Date(db);
    });
  },

  getLatestRecord(kpiId) {
    const recs = this.getRecordsByKPI(kpiId);
    return recs.length > 0 ? recs[recs.length - 1] : null;
  },

  todayStr() { return new Date().toISOString().slice(0, 10); },

  hasRecordToday(kpiId) {
    const today = this.todayStr();
    const numId = Number(kpiId);
    return this._records.some(r => (r.kpiId === kpiId || r.kpiId === numId) && r.date === today);
  },

  async login(email, password, remember = false) {
    const data = await this._request('/login', {method: 'POST', body: JSON.stringify({email, password})});
    localStorage.setItem('kpit_token', data.token);
    localStorage.setItem('kpit_user_id', data.user.id);
    localStorage.setItem('kpit_user_name', data.user.name);
    localStorage.setItem('kpit_user_email', data.user.email);
    if (remember) localStorage.setItem('kpit_rememberEmail', email);
    else localStorage.removeItem('kpit_rememberEmail');
    return data;
  },

  async signup(name, email, password) {
    const data = await this._request('/signup', {method: 'POST', body: JSON.stringify({name, email, password})});
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
    return id ? {id, name, email} : null;
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