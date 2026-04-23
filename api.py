# KPI Tracker API - Flask Serverless Compatible
# Can be deployed to AWS Lambda, Vercel, or any Python hosting

import os
import json
import uuid
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, g
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# Database configuration from environment variables
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    """Get database connection from Flask g object or create new one"""
    if 'db' not in g:
        g.db = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    """Close database connection at end of request"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Initialize database tables"""
    db = get_db()
    with app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf-8'))

def uid():
    """Generate unique ID"""
    return uuid.uuid4().hex[:12] + datetime.now().strftime('%y%m%d%H%M%S')

# ─────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """Register a new user"""
    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([name, email, password]):
        return jsonify({'success': False, 'error': 'All fields required'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    cur = db.cursor()

    # Check if email exists
    cur.execute('SELECT id FROM users WHERE email = %s', (email,))
    if cur.fetchone():
        return jsonify({'success': False, 'error': 'Email already registered'}), 409

    # Create user
    user_id = uid()
    cur.execute(
        'INSERT INTO users (id, name, email, password) VALUES (%s, %s, %s, %s)',
        (user_id, name, email, password)
    )
    db.commit()

    return jsonify({
        'success': True,
        'user': {'id': user_id, 'name': name, 'email': email}
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([email, password]):
        return jsonify({'success': False, 'error': 'Email and password required'}), 400

    db = get_db()
    cur = db.cursor()

    cur.execute('SELECT id, name, email FROM users WHERE email = %s AND password = %s', (email, password))
    user = cur.fetchone()

    if not user:
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    return jsonify({
        'success': True,
        'user': {'id': user['id'], 'name': user['name'], 'email': user['email']}
    })

# ─────────────────────────────────────────────────────
# MIDDLEWARE - Auth Check
# ─────────────────────────────────────────────────────

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        token = auth_header[7:]
        # In production, validate JWT token here
        # For now, we'll pass user_id in header
        g.user_id = request.headers.get('X-User-Id', '')
        if not g.user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────────────────────────────────
# KPI ROUTES
# ─────────────────────────────────────────────────────

@app.route('/api/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """Get all KPIs for user"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        'SELECT * FROM kpis WHERE user_id = %s ORDER BY created_at DESC',
        (g.user_id,)
    )
    kpis = cur.fetchall()
    # Convert Decimal to float for JSON serialization
    for kpi in kpis:
        if kpi.get('target'):
            kpi['target'] = float(kpi['target'])
    return jsonify(kpis)

@app.route('/api/kpis', methods=['POST'])
@require_auth
def create_kpi():
    """Create new KPI"""
    data = request.get_json()
    kpi_id = uid()

    db = get_db()
    cur = db.cursor()
    cur.execute('''
        INSERT INTO kpis (id, user_id, title, description, data_type, has_target, target, has_remarks, repeat_on, repeat_day)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    ''', (
        kpi_id,
        g.user_id,
        data.get('title', ''),
        data.get('description', ''),
        data.get('dataType', 'number'),
        data.get('hasTarget', False),
        data.get('target'),
        data.get('hasRemarks', False),
        data.get('repeatOn', 'daily'),
        data.get('repeatDay')
    ))
    kpi = cur.fetchone()
    db.commit()

    if kpi.get('target'):
        kpi['target'] = float(kpi['target'])

    return jsonify(kpi), 201

@app.route('/api/kpis/<kpi_id>', methods=['PUT'])
@require_auth
def update_kpi(kpi_id):
    """Update KPI"""
    data = request.get_json()

    db = get_db()
    cur = db.cursor()
    cur.execute('''
        UPDATE kpis SET
            title = %s, description = %s, data_type = %s, has_target = %s,
            target = %s, has_remarks = %s, repeat_on = %s, repeat_day = %s, is_active = %s
        WHERE id = %s AND user_id = %s
        RETURNING *
    ''', (
        data.get('title'),
        data.get('description'),
        data.get('dataType'),
        data.get('hasTarget'),
        data.get('target'),
        data.get('hasRemarks'),
        data.get('repeatOn'),
        data.get('repeatDay'),
        data.get('isActive', True),
        kpi_id,
        g.user_id
    ))
    kpi = cur.fetchone()
    db.commit()

    if not kpi:
        return jsonify({'error': 'KPI not found'}), 404

    if kpi.get('target'):
        kpi['target'] = float(kpi['target'])

    return jsonify(kpi)

@app.route('/api/kpis/<kpi_id>', methods=['DELETE'])
@require_auth
def delete_kpi(kpi_id):
    """Delete KPI"""
    db = get_db()
    cur = db.cursor()
    cur.execute('DELETE FROM kpis WHERE id = %s AND user_id = %s RETURNING id', (kpi_id, g.user_id))
    result = cur.fetchone()
    db.commit()

    if not result:
        return jsonify({'error': 'KPI not found'}), 404

    return jsonify({'success': True})

# ─────────────────────────────────────────────────────
# RECORD ROUTES
# ─────────────────────────────────────────────────────

@app.route('/api/kpis/<kpi_id>/records', methods=['GET'])
@require_auth
def get_records(kpi_id):
    """Get all records for a KPI"""
    db = get_db()
    cur = db.cursor()
    cur.execute('''
        SELECT * FROM records WHERE kpi_id = %s AND kpi_id IN (SELECT id FROM kpis WHERE user_id = %s)
        ORDER BY date ASC
    ''', (kpi_id, g.user_id))
    records = cur.fetchall()
    for record in records:
        if record.get('value'):
            record['value'] = float(record['value'])
        if record.get('created_at'):
            record['created_at'] = record['created_at'].isoformat()
        if record.get('date'):
            record['date'] = str(record['date'])
    return jsonify(records)

@app.route('/api/records/all', methods=['GET'])
@require_auth
def get_all_records():
    """Get all records for current user"""
    db = get_db()
    cur = db.cursor()
    cur.execute('''
        SELECT r.* FROM records r
        INNER JOIN kpis k ON r.kpi_id = k.id
        WHERE k.user_id = %s
        ORDER BY r.date DESC
    ''', (g.user_id,))
    records = cur.fetchall()
    for record in records:
        if record.get('value'):
            record['value'] = float(record['value'])
        if record.get('created_at'):
            record['created_at'] = record['created_at'].isoformat()
        if record.get('date'):
            record['date'] = str(record['date'])
    return jsonify(records)

@app.route('/api/records', methods=['POST'])
@require_auth
def create_record():
    """Create new record"""
    data = request.get_json()
    kpi_id = data.get('kpiId')
    record_id = uid()

    db = get_db()
    cur = db.cursor()

    # Verify KPI belongs to user
    cur.execute('SELECT id FROM kpis WHERE id = %s AND user_id = %s', (kpi_id, g.user_id))
    if not cur.fetchone():
        return jsonify({'error': 'KPI not found'}), 404

    cur.execute('''
        INSERT INTO records (id, kpi_id, value, date, remarks)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
    ''', (
        record_id,
        kpi_id,
        data.get('value'),
        data.get('date'),
        data.get('remarks')
    ))
    record = cur.fetchone()
    db.commit()

    if record.get('value'):
        record['value'] = float(record['value'])
    if record.get('created_at'):
        record['created_at'] = record['created_at'].isoformat()
    if record.get('date'):
        record['date'] = str(record['date'])

    return jsonify(record), 201

@app.route('/api/records/<record_id>', methods=['DELETE'])
@require_auth
def delete_record(record_id):
    """Delete record"""
    db = get_db()
    cur = db.cursor()
    cur.execute('''
        DELETE FROM records WHERE id = %s AND kpi_id IN (SELECT id FROM kpis WHERE user_id = %s)
        RETURNING id
    ''', (record_id, g.user_id))
    result = cur.fetchone()
    db.commit()

    if not result:
        return jsonify({'error': 'Record not found'}), 404

    return jsonify({'success': True})

# ─────────────────────────────────────────────────────
# CORS & ERROR HANDLING
# ─────────────────────────────────────────────────────

@app.after_request
def add_cors(response):
    """Add CORS headers"""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-User-Id'
    return response

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Server error'}), 500

# For local development
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)