const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Production-ready connection pooling configuration
const poolConfig = {
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'hostel_management',
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT || 5432),
      }),
  // Scale connections for high concurrency (thousands of students/requests)
  max: Number(process.env.DB_POOL_MAX || (isProduction ? 50 : 25)),
  min: Number(process.env.DB_POOL_MIN || 4),
  // Close idle clients after 30 seconds
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  // Return an error after 5 seconds if connection cannot be established
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  // Retire connection after 7,500 queries to prevent memory fragmentation
  maxUses: Number(process.env.DB_MAX_USES || 7500),
  // Statement timeout (15s) so runaway queries do not lock connections permanently
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000),
};

const pool = new Pool(poolConfig);

pool.on('error', (error, client) => {
  console.error('Unexpected PostgreSQL pool error on client:', error.message);
});

pool.on('connect', () => {
  if (process.env.DEBUG_SQL === 'true') {
    console.log('PostgreSQL client connected to pool');
  }
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.DEBUG_SQL === 'true') {
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.slice(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('PostgreSQL query error:', { message: error.message, query: text.slice(0, 150) });
    throw error;
  }
}

async function closePool() {
  try {
    await pool.end();
    console.log('PostgreSQL pool has ended gracefully');
  } catch (error) {
    console.error('Error closing PostgreSQL pool:', error.message);
  }
}

module.exports = {
  pool,
  query,
  closePool,
};
