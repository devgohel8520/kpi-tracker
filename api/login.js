const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1 AND password = $2',
      [email, hashedPassword]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO sessions (user_id, token) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET token = $2',
      [result.rows[0].id, token]
    );

    res.json({ 
      token, 
      user: { id: result.rows[0].id, email: result.rows[0].email, name: result.rows[0].name } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}