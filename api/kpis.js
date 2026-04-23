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
    const { name, title, target, unit, frequency, color, dataType, hasTarget, hasRemarks, repeatOn, repeatDay } = req.body;
    const kpiName = name || title;
    if (!kpiName) {
      return res.status(400).json({ error: 'Name required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO kpis (user_id, name, target, unit, frequency, color, data_type, has_target, has_remarks, repeat_on, repeat_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [userId, kpiName, target || 0, unit || '', frequency || repeatOn || 'daily', color || '#3b82f6', dataType || 'number', hasTarget || false, hasRemarks || false, repeatOn || 'daily', repeatDay || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('KPI POST error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'PUT') {
    const { id, name, title, target, unit, frequency, color, dataType, hasTarget, hasRemarks, repeatOn, repeatDay } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      const kpiName = name || title;
      const result = await pool.query(
        'UPDATE kpis SET name = COALESCE($1, name), target = COALESCE($2, target), unit = COALESCE($3, unit), frequency = COALESCE($4, frequency), color = COALESCE($5, color), data_type = COALESCE($6, data_type), has_target = COALESCE($7, has_target), has_remarks = COALESCE($8, has_remarks), repeat_on = COALESCE($9, repeat_on), repeat_day = COALESCE($10, repeat_day) WHERE id = $11 AND user_id = $12 RETURNING *',
        [kpiName, target, unit, frequency || repeatOn, color, dataType, hasTarget, hasRemarks, repeatOn, repeatDay, id, userId]
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