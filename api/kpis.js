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
      res.json(result.rows);
    } catch (error) {
      console.error('KPI GET error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else if (req.method === 'POST') {
    const { name, target, unit, frequency, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO kpis (user_id, name, target, unit, frequency, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userId, name, target || 0, unit || '', frequency || 'daily', color || '#3b82f6']
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('KPI POST error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'PUT') {
    const { id, name, target, unit, frequency, color } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      const result = await pool.query(
        'UPDATE kpis SET name = COALESCE($1, name), target = COALESCE($2, target), unit = COALESCE($3, unit), frequency = COALESCE($4, frequency), color = COALESCE($5, color) WHERE id = $6 AND user_id = $7 RETURNING *',
        [name, target, unit, frequency, color, id, userId]
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