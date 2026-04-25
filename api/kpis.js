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
        data_type: r.data_type || 'number',
        has_target: r.has_target || false,
        has_remarks: r.has_remarks || false,
        repeat_on: r.repeat_on || 'daily',
        repeat_day: r.repeat_day,
        is_active: r.is_active !== false,
        created_at: r.created_at
      }));
      res.json(rows);
    } catch (error) {
      console.error('KPI GET error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else if (req.method === 'POST') {
    const { name, title, description, target, dataType, hasTarget, hasRemarks, repeatOn, repeatDay } = req.body;
    const kpiName = name || title;
    if (!kpiName) {
      return res.status(400).json({ error: 'Name required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO kpis (user_id, name, description, target, data_type, has_target, has_remarks) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, kpiName, description || '', target || 0, dataType || 'number', hasTarget || false, hasRemarks || false]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('KPI POST error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'PUT') {
    const { id, name, title, description, target, dataType, hasTarget, hasRemarks, repeatOn, repeatDay } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      const result = await pool.query(
        'UPDATE kpis SET name = $1, description = $2, target = $3, data_type = $4, has_target = $5, has_remarks = $6, repeat_on = $7, repeat_day = $8 WHERE id = $9 AND user_id = $10 RETURNING *',
        [name || title, description || '', target || 0, dataType || 'number', hasTarget || false, hasRemarks || false, repeatOn || 'daily', repeatDay || null, id, userId]
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