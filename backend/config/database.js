const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  // App dates are UTC (toISOString); keep the session timezone UTC so that
  // created_at::date and CURRENT_DATE always match record_date
  options: '-c timezone=UTC'
});

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

module.exports = pool;
