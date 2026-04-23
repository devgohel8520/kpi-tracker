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
    const { kpi_id } = req.query;
    try {
      const result = await pool.query(
        `SELECT r.*, k.name as kpi_name 
         FROM records r 
         JOIN kpis k ON r.kpi_id = k.id 
         WHERE r.user_id = $1 AND r.kpi_id = $2 
         ORDER BY r.recorded_at DESC`,
        [userId, kpi_id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Records GET error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'POST') {
    const { kpi_id, value, recorded_at } = req.body;
    if (!kpi_id || value === undefined) {
      return res.status(400).json({ error: 'kpi_id and value required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO records (user_id, kpi_id, value, recorded_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, kpi_id, value, recorded_at || new Date()]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Records POST error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  else if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    try {
      await pool.query('DELETE FROM records WHERE id = $1 AND user_id = $2', [id, userId]);
      res.json({ success: true });
    } catch (error) {
      console.error('Records DELETE error:', error);
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