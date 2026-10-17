const express = require('express');
const cors = require('cors');
const axios = require('axios');
const db = require('./db');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:3002')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const PORT = Number(process.env.PORT || 5000);
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const ML_REQUEST_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS || 5000);

app.get('/health', async (req, res) => {
  try {
    const [, mlResponse] = await Promise.all([
      db.query('SELECT 1'),
      axios.get(`${ML_SERVICE_URL}/health`, { timeout: ML_REQUEST_TIMEOUT_MS }),
    ]);
    res.json({ status: 'ok', database: 'connected', ml_service: mlResponse.data.status });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ status: 'unavailable', error: 'Database or ML service is unavailable' });
  }
});

app.post('/api/complaints', async (req, res) => {
  const { student_id, description, room_number, block_number } = req.body || {};
  const studentId = Number(student_id);
  const cleanDescription = typeof description === 'string' ? description.trim() : '';

  if (!Number.isInteger(studentId) || studentId < 1 ||
      !cleanDescription || cleanDescription.length > 5000 ||
      typeof room_number !== 'string' || !room_number.trim() ||
      typeof block_number !== 'string' || !/^[A-T]$/.test(block_number)) {
    return res.status(400).json({ error: 'Provide a valid student_id, description, room_number, and block_number' });
  }

  let category;
  let confidence;
  try {
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/ml/classify-complaint`,
      { description: cleanDescription },
      { timeout: ML_REQUEST_TIMEOUT_MS },
    );
    ({ category, confidence } = mlResponse.data);
  } catch (error) {
    console.error('Complaint classification failed:', error.message);
    return res.status(503).json({ error: 'Complaint classification service is unavailable' });
  }

  const priority = /sparking|hazard|exposed wire/i.test(cleanDescription) ? 'high' : 'medium';
  try {
    const query = `
      INSERT INTO Complaint (student_id, room_number, block_number, description, category, priority, confidence, auto_tagged)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *;
    `;
    const values = [studentId, room_number.trim(), block_number, cleanDescription, category, priority, confidence];
    const newComplaint = await db.query(query, values);
    res.status(201).json({ success: true, complaint: newComplaint.rows[0] });
  } catch (error) {
    console.error('Could not save complaint:', error.message);
    res.status(500).json({ error: 'Could not save complaint' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { student_id, bed_id } = req.body || {};
  const studentId = Number(student_id);
  const bedId = Number(bed_id);

  if (!Number.isInteger(studentId) || studentId < 1 || !Number.isInteger(bedId) || bedId < 1) {
    return res.status(400).json({ success: false, error: 'Provide valid student_id and bed_id values' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const bedCheck = await client.query(
      `SELECT b.is_occupied, r.gender AS room_gender, s.gender AS student_gender
       FROM Bed b
       JOIN Room r ON r.room_id = b.room_id
       LEFT JOIN Student s ON s.student_id = $2
       WHERE b.bed_id = $1
       FOR UPDATE OF b`,
      [bedId, studentId],
    );

    if (bedCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Bed does not exist' });
    }
    const bed = bedCheck.rows[0];
    if (!bed.student_gender) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Student does not exist' });
    }
    if (bed.room_gender !== bed.student_gender) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Student gender does not match room gender' });
    }
    if (bed.is_occupied) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Bed is already occupied' });
    }

    await client.query('UPDATE Bed SET is_occupied = TRUE WHERE bed_id = $1', [bedId]);
    const allocationQuery = `
      INSERT INTO Allocation (student_id, bed_id)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const allocation = await client.query(allocationQuery, [studentId, bedId]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, allocation: allocation.rows[0] });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Booking rollback failed:', rollbackError.message);
      }
    }
    console.error('Booking failed:', error.message);
    const status = error.code === '23505' ? 409 : 500;
    res.status(status).json({
      success: false,
      error: status === 409 ? 'Student or bed already has an allocation' : 'Could not create booking',
    });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/students/:studentId/fine-risk', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: 'studentId must be a positive integer' });
  }

  try {
    const result = await db.query(
      `SELECT
         COUNT(f.fine_id) FILTER (
           WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         )::int AS fines_3m,
         COALESCE(SUM(f.amount) FILTER (
           WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         ), 0)::float AS amount_3m,
         COUNT(DISTINCT f.fine_type_id) FILTER (
           WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         )::int AS distinct_types_3m,
         COUNT(f.fine_id) FILTER (
           WHERE f.status = 'unpaid'
             AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         )::int AS unpaid_count,
         COALESCE(SUM(f.amount) FILTER (
           WHERE f.status = 'unpaid'
             AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         ), 0)::float AS unpaid_amount,
         COALESCE(AVG(payment.paid_on - f.issued_on) FILTER (
           WHERE f.status = 'paid'
             AND payment.paid_on IS NOT NULL
             AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'
         ), 0)::float AS avg_days_to_pay
       FROM Student s
       LEFT JOIN Fine f ON f.student_id = s.student_id
       LEFT JOIN LATERAL (
         SELECT MIN(fp.paid_on)::date AS paid_on
         FROM FinePayment fp
         WHERE fp.fine_id = f.fine_id
       ) payment ON true
       WHERE s.student_id = $1
       GROUP BY s.student_id`,
      [studentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student does not exist' });
    }

    const features = result.rows[0];
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/ml/predict-fine-risk`,
      features,
      { timeout: ML_REQUEST_TIMEOUT_MS },
    );
    res.json({ student_id: studentId, ...mlResponse.data, features });
  } catch (error) {
    console.error('Fine-risk prediction failed:', error.message);
    const status = axios.isAxiosError(error) ? 503 : 500;
    res.status(status).json({
      error: status === 503 ? 'Fine-risk prediction service is unavailable' : 'Could not calculate fine-risk prediction',
    });
  }
});

app.get('/api/warden/trends', async (req, res) => {
  try {
    const trends = await db.query('SELECT * FROM view_warden_complaint_trends');
    res.json(trends.rows);
  } catch (error) {
    console.error('Could not load complaint trends:', error.message);
    res.status(500).json({ error: 'Could not load complaint trends' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function start() {
  await db.query('SELECT 1');
  app.listen(PORT, () => {
    console.log(`Express backend running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Could not start backend; verify PostgreSQL configuration and availability:', error.message);
  process.exitCode = 1;
});