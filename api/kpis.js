const { Pool } = require('pg');

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured. Add in Vercel dashboard.' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT * FROM kpis WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      const rows = result.rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        description: r.description || '',
        target: r.target || 0,
        unit: r.unit || '',
        frequency: r.frequency || 'daily',
        color: r.color || '#3b82f6',
        dataType: r.data_type || 'number',
        hasTarget: r.has_target || false,
        hasRemarks: r.has_remarks || false,
        repeatOn: r.repeat_on || 'daily',
        repeatDay: r.repeat_day,
        isActive: r.is_active !== false,
        createdAt: r.created_at
      }));
      res.json(rows);
    } catch (error) {
      console.error('KPI GET error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else if (req.method === 'POST') {
    const { name, title, description, target, unit, frequency, color, dataType, hasTarget, hasRemarks, repeatOn, repeatDay } = req.body;
    const kpiName = name || title;
    if (!kpiName) {
      return res.status(400).json({ error: 'Name required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO kpis (user_id, name, description, target, unit, frequency, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, kpiName, description || '', target || 0, unit || '', frequency || 'daily', color || '#3b82f6']
      );
      const row = result.rows[0];
      row.dataType = dataType || 'number';
      row.hasTarget = hasTarget || false;
      row.hasRemarks = hasRemarks || false;
      row.repeatOn = repeatOn || 'daily';
      row.repeatDay = repeatDay || null;
      row.isActive = true;
      res.status(201).json(row);
    } catch (error) {
      console.error('KPI POST error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'PUT') {
    const { id, name, title, description, target, unit, frequency, color } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      const kpiName = name || title;
      const result = await pool.query(
        'UPDATE kpis SET name = $1, description = $2, target = COALESCE($3, target), unit = COALESCE($4, unit), frequency = COALESCE($5, frequency), color = COALESCE($6, color) WHERE id = $7 AND user_id = $8 RETURNING *',
        [kpiName, description || '', target, unit, frequency, color, id, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'KPI not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('KPI PUT error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  else if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      await pool.query('DELETE FROM records WHERE kpi_id = $1 AND user_id = $2', [id, userId]);
      await pool.query('DELETE FROM kpis WHERE id = $1 AND user_id = $2', [id, userId]);
      res.json({ success: true });
    } catch (error) {
      console.error('KPI DELETE error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

function getUserId(req) {
  const auth = req.headers.authorization;
  return auth?.split(':')[0];
}