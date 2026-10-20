const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./db');
const { verifyPassword } = require('./password');
const {
  COMPATIBILITY_THRESHOLD,
  preferenceCompatibility,
  buildRoomGroups,
} = require('./matching');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:3002')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

const PORT = Number(process.env.PORT || 5000);
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const ML_REQUEST_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS || 5000);
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE = 'hostel_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_ROOMMATE_PREFERENCES = {
  q1_bedtime: 2,
  q2_wakeup: 2,
  q3_tidiness: 3,
  q4_study_style: 'library',
  q5_study_hours: 2,
  q6_food: 'veg',
  q7_noise_tolerance: 3,
  q8_visitors_social: 3,
  q9_weekends: 'hostel',
  q10_share_belongings: 3,
};

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySession(value) {
  if (!SESSION_SECRET || typeof value !== 'string') return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.id) || !['admin', 'student'].includes(payload.role) ||
        !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.role === 'admin' && (
      !['WARDEN', 'SUPER_ADMIN'].includes(payload.admin_role) ||
      !['all', 'mens', 'ladies', 'unassigned'].includes(payload.hostel_type) ||
      (payload.admin_role === 'SUPER_ADMIN' && payload.hostel_type !== 'all')
    )) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return '';
  }
}

function authenticate(req, res, next) {
  const session = verifySession(readCookie(req, SESSION_COOKIE));
  if (!session) return res.status(401).json({ error: 'Please sign in to continue' });
  if (session.role !== 'admin') {
    req.session = session;
    return next();
  }
  db.query(
    'SELECT role AS admin_role, hostel_type FROM Admin WHERE admin_id = $1',
    [session.id],
  ).then((result) => {
    const admin = result.rows[0];
    if (!admin || admin.admin_role !== session.admin_role ||
        admin.hostel_type !== session.hostel_type) {
      return res.status(401).json({ error: 'Admin access changed; please sign in again' });
    }
    req.session = session;
    next();
  }).catch(next);
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.session || !roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.session?.role !== 'admin' || req.session.admin_role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only the main administrator can manage admin accounts' });
  }
  next();
}

function adminGenderScope(session) {
  if (session.hostel_type === 'mens') return 'M';
  if (session.hostel_type === 'ladies') return 'F';
  if (session.hostel_type === 'all') return null;
  return 'X';
}

function validateAdminStudentScope(req, student) {
  const genderScope = adminGenderScope(req.session);
  if (genderScope && genderScope !== student.gender) {
    throw requestError('You can only manage students assigned to your hostel', 403);
  }
}

function issueSession(res, role, user) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = signSession({
    id: user.id,
    role,
    name: user.name,
    ...(role === 'admin' ? {
      admin_role: user.admin_role,
      hostel_type: user.hostel_type,
    } : {}),
    exp: expiresAt,
  });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

function preferenceValues(preferences) {
  return [
    preferences.q1_bedtime, preferences.q2_wakeup, preferences.q3_tidiness,
    preferences.q4_study_style, preferences.q5_study_hours, preferences.q6_food,
    preferences.q7_noise_tolerance, preferences.q8_visitors_social,
    preferences.q9_weekends, preferences.q10_share_belongings,
  ];
}

function preferenceIsValid(preferences) {
  if (!preferences || typeof preferences !== 'object') return false;
  const numbers = [
    ['q1_bedtime', 1, 4], ['q2_wakeup', 1, 4], ['q3_tidiness', 1, 5],
    ['q5_study_hours', 1, 4], ['q7_noise_tolerance', 1, 5],
    ['q8_visitors_social', 1, 5], ['q10_share_belongings', 1, 5],
  ];
  return numbers.every(([key, minimum, maximum]) =>
    Number.isInteger(preferences[key]) && preferences[key] >= minimum && preferences[key] <= maximum) &&
    ['silent', 'music', 'group', 'library'].includes(preferences.q4_study_style) &&
    ['veg', 'nonveg', 'egg'].includes(preferences.q6_food) &&
    ['hostel', 'home', 'out'].includes(preferences.q9_weekends);
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function matchingConflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredText(value, field, maximumLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximumLength) {
    throw requestError(`${field} is required and must be no more than ${maximumLength} characters`);
  }
  return value.trim();
}

function accountPassword(value) {
  if (typeof value !== 'string' || value.trim().length < 8 || value.length > 255) {
    throw requestError('Password must be between 8 and 255 characters');
  }
  return value;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function studentAccount(body) {
  const name = requiredText(body.full_name || body.name, 'Name', 100);
  const email = requiredText(body.email, 'Email', 100).toLowerCase();
  if (!validEmail(email)) throw requestError('Provide a valid email address');

  const genderValue = requiredText(body.gender, 'Gender', 10).toUpperCase();
  const gender = genderValue === 'MALE' ? 'M' : genderValue === 'FEMALE' ? 'F' : genderValue;
  if (!['M', 'F'].includes(gender)) throw requestError('Gender must be M or F');

  const blockNumber = requiredText(body.block_number, 'Block number', 1).toUpperCase();
  const allowedBlock = gender === 'M'
    ? /^[A-T]$/.test(blockNumber)
    : /^(?:[A-I]|S)$/.test(blockNumber);
  if (!allowedBlock) throw requestError('Block number is not valid for the selected gender');

  const rollNumber = requiredText(body.roll_number, 'Roll number', 50);
  const roomPreference = body.room_preference;
  if (!Number.isInteger(roomPreference) || ![1, 2, 3, 4, 6, 8].includes(roomPreference)) {
    throw requestError('Room preference must be a supported room capacity');
  }

  return {
    name,
    email,
    gender,
    blockNumber,
    rollNumber,
    roomPreference,
    password: accountPassword(body.password),
  };
}

async function insertStudent(body) {
  const student = studentAccount(body);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO Student
        (full_name, email, gender, block_number, roll_number, room_preference, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING student_id AS id, full_name AS name, email`,
      [
        student.name,
        student.email,
        student.gender,
        student.blockNumber,
        student.rollNumber,
        student.roomPreference,
        student.password,
      ],
    );
    const createdStudent = result.rows[0];
    await client.query(
      `INSERT INTO RoommatePreference (
         student_id, q1_bedtime, q2_wakeup, q3_tidiness, q4_study_style,
         q5_study_hours, q6_food, q7_noise_tolerance, q8_visitors_social,
         q9_weekends, q10_share_belongings
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [createdStudent.id, ...preferenceValues(DEFAULT_ROOMMATE_PREFERENCES)],
    );
    await client.query('COMMIT');
    return createdStudent;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Student creation rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

function adminAccount(body) {
  const username = requiredText(body.username, 'Username', 50);
  const email = requiredText(body.email, 'Email', 100).toLowerCase();
  if (!validEmail(email)) throw requestError('Provide a valid email address');
  const name = requiredText(body.full_name || body.name, 'Name', 100);
  const role = requiredText(body.role, 'Role', 20).toUpperCase();
  if (!['WARDEN', 'SUPER_ADMIN'].includes(role)) {
    throw requestError('Role must be WARDEN or SUPER_ADMIN');
  }
  const hostelType = requiredText(body.hostel_type, 'Hostel assignment', 12).toLowerCase();
  if ((role === 'SUPER_ADMIN' && hostelType !== 'all') ||
      (role === 'WARDEN' && !['mens', 'ladies'].includes(hostelType))) {
    throw requestError('Super admins must have full access; sub-admins must be assigned to mens or ladies');
  }
  return { username, email, name, role, hostelType, password: accountPassword(body.password) };
}

async function insertAdmin(body) {
  const admin = adminAccount(body);
  const result = await db.query(
    `INSERT INTO Admin (username, email, password_hash, full_name, role, hostel_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING admin_id AS id, username, email, full_name AS name, role, hostel_type`,
    [admin.username, admin.email, admin.password, admin.name, admin.role, admin.hostelType],
  );
  return result.rows[0];
}

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

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { role, password } = req.body || {};
  if (!['admin', 'student'].includes(role) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Provide a role and password' });
  }

  const identifier = role === 'admin' ? req.body.username : req.body.email;
  if (typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({ error: role === 'admin' ? 'Provide a username' : 'Provide an email address' });
  }
  const result = role === 'admin'
    ? await db.query(
      `SELECT admin_id AS id, COALESCE(email, username) AS email, full_name AS name,
              password_hash, role AS admin_role, hostel_type
       FROM Admin
       WHERE username = $1 OR lower(email) = lower($1)
       ORDER BY (username = $1) DESC
       LIMIT 1`,
      [identifier.trim()],
    )
    : await db.query(
      'SELECT student_id AS id, email, full_name AS name, password_hash FROM Student WHERE lower(email) = lower($1)',
      [identifier.trim()],
    );
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  issueSession(res, role, user);
  res.json({
    user: {
      id: user.id,
      role,
      name: user.name,
      email: user.email,
      ...(role === 'admin'
        ? { admin_role: user.admin_role, hostel_type: user.hostel_type }
        : {}),
    },
    expires_in: SESSION_TTL_SECONDS,
  });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const user = await insertStudent(req.body || {});
  issueSession(res, 'student', user);
  res.status(201).json({
    user: { id: user.id, role: 'student', name: user.name, email: user.email },
    expires_in: SESSION_TTL_SECONDS,
  });
}));

app.post('/api/students', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const body = req.body || {};
  validateAdminStudentScope(req, studentAccount(body));
  const student = await insertStudent(body);
  res.status(201).json({ student });
}));

app.get('/api/students', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT s.student_id, s.full_name, s.email, s.roll_number, s.gender,
            s.block_number, s.room_preference,
            a.allocation_id, a.allocated_at, b.bed_id, b.bed_label,
            r.room_id, r.room_number, r.block_number AS room_block_number,
            r.capacity AS room_capacity,
            CASE WHEN a.allocation_id IS NULL THEN 'pending' ELSE 'completed' END AS allocation_status
     FROM Student s
     LEFT JOIN Allocation a ON a.student_id = s.student_id
     LEFT JOIN Bed b ON b.bed_id = a.bed_id
     LEFT JOIN Room r ON r.room_id = b.room_id
     WHERE ($1::char IS NULL OR s.gender = $1)
     ORDER BY s.full_name, s.student_id`,
    [adminGenderScope(req.session)],
  );
  res.json({ students: result.rows });
}));

app.get('/api/allocations', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const studentId = req.query.student_id === undefined ? null : Number(req.query.student_id);
  if (studentId !== null && (!Number.isInteger(studentId) || studentId < 1)) {
    return res.status(400).json({ error: 'student_id must be a positive integer' });
  }
  const genderScope = adminGenderScope(req.session);
  const result = await db.query(
    `SELECT b.bed_id, b.bed_label, r.room_id, r.room_number, r.block_number,
            r.capacity, r.gender,
            (SELECT COUNT(*)::int
             FROM Bed occupant_bed
             WHERE occupant_bed.room_id = r.room_id
               AND (occupant_bed.is_occupied OR EXISTS (
                 SELECT 1 FROM Allocation occupant_allocation
                 WHERE occupant_allocation.bed_id = occupant_bed.bed_id
               ))) AS occupied_beds
     FROM Bed b
     JOIN Room r ON r.room_id = b.room_id
     WHERE b.is_occupied = FALSE
       AND NOT EXISTS (SELECT 1 FROM Allocation a WHERE a.bed_id = b.bed_id)
       AND ($1::int IS NULL OR EXISTS (
         SELECT 1 FROM Student s
         WHERE s.student_id = $1
           AND s.gender = r.gender
           AND upper(btrim(s.block_number)) = upper(btrim(r.block_number))
           AND s.room_preference = r.capacity
       ))
       AND ($2::char IS NULL OR r.gender = $2)
       AND (SELECT COUNT(*) FROM Bed room_bed WHERE room_bed.room_id = r.room_id) = r.capacity
       AND NOT EXISTS (
         SELECT 1 FROM MatchGroup mg
         WHERE mg.room_id = r.room_id AND mg.status = 'pending'
       )
       AND (SELECT COUNT(*)
            FROM Bed occupied_bed
            WHERE occupied_bed.room_id = r.room_id
              AND (occupied_bed.is_occupied OR EXISTS (
                SELECT 1 FROM Allocation occupant_allocation
                WHERE occupant_allocation.bed_id = occupied_bed.bed_id
              ))) < r.capacity
     ORDER BY r.gender, r.block_number, r.room_number, b.bed_label`,
    [studentId, genderScope],
  );
  if (studentId !== null) {
    const studentExists = await db.query(
      `SELECT 1 FROM Student s
       WHERE s.student_id = $1
         AND ($2::char IS NULL OR s.gender = $2)`,
      [studentId, genderScope],
    );
    if (!studentExists.rows.length) {
      return res.status(404).json({ error: 'Student does not exist' });
    }
  }
  res.json({ available_beds: result.rows });
}));

app.post('/api/allocations', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const studentId = Number(req.body?.student_id);
  const bedId = Number(req.body?.bed_id);
  if (!Number.isInteger(studentId) || studentId < 1 ||
      !Number.isInteger(bedId) || bedId < 1) {
    return res.status(400).json({ error: 'Provide valid student_id and bed_id values' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const bedCheck = await client.query(
      `SELECT b.is_occupied, r.room_id, r.capacity, r.block_number AS room_block_number,
              s.student_id, s.gender AS student_gender, s.block_number AS student_block_number,
              s.room_preference AS student_room_preference, r.gender AS room_gender
       FROM Bed b
       JOIN Room r ON r.room_id = b.room_id
       JOIN Student s ON s.student_id = $2
       WHERE b.bed_id = $1
       FOR UPDATE OF r, b, s`,
      [bedId, studentId],
    );
    if (!bedCheck.rows[0]) {
      const exists = await client.query(
        `SELECT EXISTS (SELECT 1 FROM Student WHERE student_id = $1) AS student_exists,
                EXISTS (SELECT 1 FROM Bed WHERE bed_id = $2) AS bed_exists`,
        [studentId, bedId],
      );
      await client.query('ROLLBACK');
      if (!exists.rows[0].student_exists) {
        return res.status(404).json({ error: 'Student does not exist' });
      }
      return res.status(404).json({ error: 'Bed does not exist' });
    }

    const bed = bedCheck.rows[0];
    const genderScope = adminGenderScope(req.session);
    if (genderScope && genderScope !== bed.student_gender) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only allocate beds to students assigned to your hostel' });
    }
    const alreadyAllocated = await client.query(
      'SELECT 1 FROM Allocation WHERE student_id = $1',
      [studentId],
    );
    if (alreadyAllocated.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student already has an allocation' });
    }
    if (bed.student_gender !== bed.room_gender) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student gender does not match room gender' });
    }
    if (bed.student_block_number !== bed.room_block_number) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student block does not match the room block' });
    }
    if (bed.student_room_preference !== bed.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Room capacity does not match the student preference' });
    }
    const pendingMatch = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM MatchGroup mg
         WHERE mg.status = 'pending'
           AND (mg.room_id = $1 OR EXISTS (
             SELECT 1 FROM MatchGroupMember member
             WHERE member.group_id = mg.group_id AND member.student_id = $2
           ))
       ) AS has_pending_match`,
      [bed.room_id, studentId],
    );
    if (pendingMatch.rows[0].has_pending_match) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This student or room is part of a pending matching review' });
    }
    if (bed.is_occupied) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Bed is already occupied' });
    }

    const roomInventory = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.is_occupied OR EXISTS (
                SELECT 1 FROM Allocation a WHERE a.bed_id = b.bed_id
              ))::int AS occupied
       FROM Bed b WHERE b.room_id = $1`,
      [bed.room_id],
    );
    if (roomInventory.rows[0].total !== bed.capacity ||
        roomInventory.rows[0].occupied >= bed.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Room bed inventory is incomplete or full' });
    }

    const residents = await client.query(
      `SELECT s.student_id, rp.q1_bedtime, rp.q2_wakeup, rp.q3_tidiness,
              rp.q4_study_style, rp.q5_study_hours, rp.q6_food,
              rp.q7_noise_tolerance, rp.q8_visitors_social, rp.q9_weekends,
              rp.q10_share_belongings
       FROM Student s
       LEFT JOIN RoommatePreference rp ON rp.student_id = s.student_id
       WHERE s.student_id = $1
          OR EXISTS (
            SELECT 1 FROM Allocation a
            JOIN Bed occupied_bed ON occupied_bed.bed_id = a.bed_id
            WHERE a.student_id = s.student_id AND occupied_bed.room_id = $2
          )
       ORDER BY s.student_id
       FOR UPDATE OF s`,
      [studentId, bed.room_id],
    );
    if (residents.rows.some((resident) => resident.q1_bedtime === null)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Every room resident must have roommate preferences before allocation' });
    }
    const candidatePreferences = residents.rows.find((resident) => resident.student_id === studentId);
    const incompatible = residents.rows
      .filter((resident) => resident.student_id !== studentId)
      .some((resident) =>
        preferenceCompatibility(candidatePreferences, resident) < COMPATIBILITY_THRESHOLD);
    if (incompatible) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student preferences are not compatible with the room residents' });
    }

    const allocation = await client.query(
      `INSERT INTO Allocation (student_id, bed_id)
       VALUES ($1, $2)
       RETURNING allocation_id, student_id, bed_id, allocated_at`,
      [studentId, bedId],
    );
    await client.query('UPDATE Bed SET is_occupied = TRUE WHERE bed_id = $1', [bedId]);
    await client.query('COMMIT');
    res.status(201).json({ allocation: allocation.rows[0] });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Admin allocation rollback failed:', rollbackError.message);
    }
    const status = error.statusCode || (error.code === '23505' ? 409 : 500);
    console.error('Could not create admin allocation:', error.message);
    res.status(status).json({
      error: error.statusCode
        ? error.message
        : status === 409
        ? 'Student or bed already has an allocation'
        : 'Could not create the allocation',
    });
  } finally {
    client.release();
  }
}));

app.post('/api/admins', authenticate, allowRoles('admin'), requireSuperAdmin, asyncRoute(async (req, res) => {
  const admin = await insertAdmin(req.body || {});
  res.status(201).json({ admin });
}));

app.get('/api/admins', authenticate, allowRoles('admin'), requireSuperAdmin, asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT admin_id, username, email, full_name, role, hostel_type
     FROM Admin
     ORDER BY CASE WHEN role = 'SUPER_ADMIN' THEN 0 ELSE 1 END, full_name`,
  );
  res.json({ admins: result.rows });
}));

app.patch('/api/admins/:adminId/hostel-type', authenticate, allowRoles('admin'), requireSuperAdmin, asyncRoute(async (req, res) => {
  const adminId = Number(req.params.adminId);
  const hostelType = typeof req.body?.hostel_type === 'string'
    ? req.body.hostel_type.toLowerCase()
    : '';
  if (!Number.isInteger(adminId) || adminId < 1 ||
      !['mens', 'ladies', 'unassigned'].includes(hostelType)) {
    return res.status(400).json({ error: 'Provide a valid admin ID and hostel assignment' });
  }
  const result = await db.query(
    `UPDATE Admin
     SET hostel_type = $1
     WHERE admin_id = $2 AND role = 'WARDEN'
     RETURNING admin_id, username, email, full_name, role, hostel_type`,
    [hostelType, adminId],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Sub-admin does not exist' });
  res.json({ admin: result.rows[0] });
}));

app.get('/api/auth/session', authenticate, asyncRoute(async (req, res) => {
  const result = req.session.role === 'admin'
    ? await db.query('SELECT admin_id AS id, COALESCE(email, username) AS email, full_name AS name FROM Admin WHERE admin_id = $1', [req.session.id])
    : await db.query('SELECT student_id AS id, email, full_name AS name FROM Student WHERE student_id = $1', [req.session.id]);
  if (!result.rows[0]) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return res.status(401).json({ error: 'Account no longer exists; please sign in again' });
  }
  res.json({
    user: {
      ...result.rows[0],
      role: req.session.role,
      ...(req.session.role === 'admin'
        ? { admin_role: req.session.admin_role, hostel_type: req.session.hostel_type }
        : {}),
    },
  });
}));

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.status(204).end();
});

app.get('/api/students/me/records', authenticate, allowRoles('student'), asyncRoute(async (req, res) => {
  const studentId = req.session.id;
  const [studentResult, complaints, fines, gateLogs] = await Promise.all([
    db.query(
      `SELECT s.student_id, s.full_name, s.email, s.block_number, r.room_number,
              r.capacity, b.bed_label
       FROM Student s
       LEFT JOIN Allocation a ON a.student_id = s.student_id
       LEFT JOIN Bed b ON b.bed_id = a.bed_id
       LEFT JOIN Room r ON r.room_id = b.room_id
       WHERE s.student_id = $1`,
      [studentId],
    ),
    db.query(
      'SELECT complaint_id, room_number, block_number, description, category, priority, status, created_at FROM Complaint WHERE student_id = $1 ORDER BY created_at DESC',
      [studentId],
    ),
    db.query(
      `SELECT f.fine_id, f.amount, f.reason, f.issued_on, f.due_date, f.status,
              ft.name AS fine_type,
              COALESCE(json_agg(json_build_object(
                'payment_id', fp.payment_id, 'amount', fp.amount,
                'paid_on', fp.paid_on, 'mode', fp.mode
              )) FILTER (WHERE fp.payment_id IS NOT NULL), '[]'::json) AS payments
       FROM Fine f
       JOIN FineType ft ON ft.fine_type_id = f.fine_type_id
       LEFT JOIN FinePayment fp ON fp.fine_id = f.fine_id
       WHERE f.student_id = $1
       GROUP BY f.fine_id, ft.name
       ORDER BY f.issued_on DESC`,
      [studentId],
    ),
    db.query('SELECT log_id, direction, logged_at FROM GateLog WHERE student_id = $1 ORDER BY logged_at DESC LIMIT 100', [studentId]),
  ]);
  if (!studentResult.rows[0]) return res.status(404).json({ error: 'Student does not exist' });
  res.json({
    student: studentResult.rows[0],
    complaints: complaints.rows,
    fines: fines.rows,
    gate_logs: gateLogs.rows,
  });
}));

app.get('/api/students/me/preferences', authenticate, allowRoles('student'), asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT q1_bedtime, q2_wakeup, q3_tidiness, q4_study_style, q5_study_hours,
            q6_food, q7_noise_tolerance, q8_visitors_social, q9_weekends,
            q10_share_belongings, submitted_at
     FROM RoommatePreference WHERE student_id = $1`,
    [req.session.id],
  );
  res.json({ preferences: result.rows[0] || null });
}));

app.put('/api/students/me/preferences', authenticate, allowRoles('student'), asyncRoute(async (req, res) => {
  const preferences = req.body || {};
  if (!preferenceIsValid(preferences)) {
    return res.status(400).json({ error: 'Complete all roommate preferences using the allowed values' });
  }
  const result = await db.query(
    `INSERT INTO RoommatePreference (
       student_id, q1_bedtime, q2_wakeup, q3_tidiness, q4_study_style,
       q5_study_hours, q6_food, q7_noise_tolerance, q8_visitors_social,
       q9_weekends, q10_share_belongings
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (student_id) DO UPDATE SET
       q1_bedtime = EXCLUDED.q1_bedtime,
       q2_wakeup = EXCLUDED.q2_wakeup,
       q3_tidiness = EXCLUDED.q3_tidiness,
       q4_study_style = EXCLUDED.q4_study_style,
       q5_study_hours = EXCLUDED.q5_study_hours,
       q6_food = EXCLUDED.q6_food,
       q7_noise_tolerance = EXCLUDED.q7_noise_tolerance,
       q8_visitors_social = EXCLUDED.q8_visitors_social,
       q9_weekends = EXCLUDED.q9_weekends,
       q10_share_belongings = EXCLUDED.q10_share_belongings,
       submitted_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.session.id, ...preferenceValues(preferences)],
  );
  res.json({ preferences: result.rows[0] });
}));

app.post('/api/complaints', authenticate, allowRoles('student'), asyncRoute(async (req, res) => {
  const { description } = req.body || {};
  const cleanDescription = typeof description === 'string' ? description.trim() : '';
  if (!cleanDescription || cleanDescription.length > 5000) {
    return res.status(400).json({ error: 'Provide a complaint description of 1 to 5000 characters' });
  }

  let category = 'General';
  let confidence = 0.500;
  let autoTagged = false;
  try {
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/ml/classify-complaint`,
      { description: cleanDescription },
      { timeout: ML_REQUEST_TIMEOUT_MS },
    );
    category = mlResponse.data.category;
    confidence = mlResponse.data.confidence;
    autoTagged = true;
  } catch (error) {
    console.warn('Complaint classification ML service unavailable; using General category:', error.message);
  }

  const priority = /sparking|hazard|exposed wire/i.test(cleanDescription) ? 'high' : 'medium';
  const result = await db.query(
    `INSERT INTO Complaint (
       student_id, room_number, block_number, description, category,
       priority, confidence, auto_tagged
     )
     SELECT $1, COALESCE(r.room_number, 'Unassigned'), s.block_number, $2, $3, $4, $5, $6
     FROM Student s
     LEFT JOIN Allocation a ON a.student_id = s.student_id
     LEFT JOIN Bed b ON b.bed_id = a.bed_id
     LEFT JOIN Room r ON r.room_id = b.room_id
     WHERE s.student_id = $1
     RETURNING *`,
    [req.session.id, cleanDescription, category, priority, confidence, autoTagged],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Student does not exist' });
  res.status(201).json({ complaint: result.rows[0] });
}));

app.get('/api/admin/complaints', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid complaint status filter' });
  }

  const limitParam = req.query.limit;
  const isAll = limitParam === 'all';
  const limit = isAll ? null : Math.min(Math.max(Number(limitParam || 50), 1), 200);
  const page = Math.max(Number(req.query.page || 1), 1);
  const offset = isAll ? 0 : (page - 1) * limit;
  const genderScope = adminGenderScope(req.session);

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM Complaint c JOIN Student s ON s.student_id = c.student_id
     WHERE ($1 = '' OR c.status = $1)
       AND ($2::char IS NULL OR s.gender = $2)`,
    [status, genderScope],
  );
  const total = countResult.rows[0]?.total || 0;
  const totalPages = isAll ? 1 : Math.ceil(total / limit) || 1;

  const result = isAll
    ? await db.query(
        `SELECT c.complaint_id, c.student_id, s.full_name, s.email,
                c.room_number, c.block_number, c.description, c.category,
                c.priority, c.confidence, c.status, c.created_at
         FROM Complaint c
         JOIN Student s ON s.student_id = c.student_id
         WHERE ($1 = '' OR c.status = $1)
           AND ($2::char IS NULL OR s.gender = $2)
         ORDER BY CASE c.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  c.created_at DESC`,
        [status, genderScope],
      )
    : await db.query(
        `SELECT c.complaint_id, c.student_id, s.full_name, s.email,
                c.room_number, c.block_number, c.description, c.category,
                c.priority, c.confidence, c.status, c.created_at
         FROM Complaint c
         JOIN Student s ON s.student_id = c.student_id
         WHERE ($1 = '' OR c.status = $1)
           AND ($4::char IS NULL OR s.gender = $4)
         ORDER BY CASE c.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset, genderScope],
      );

  res.json({
    complaints: result.rows,
    total,
    page,
    limit: isAll ? total : limit,
    total_pages: totalPages,
  });
}));

app.patch('/api/admin/complaints/:complaintId/status', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const complaintId = Number(req.params.complaintId);
  const { status } = req.body || {};
  if (!Number.isInteger(complaintId) || complaintId < 1 ||
      !['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Provide a valid complaint ID and status' });
  }
  const result = await db.query(
    `UPDATE Complaint c SET status = $1
     WHERE c.complaint_id = $2
       AND EXISTS (
         SELECT 1 FROM Student s
         WHERE s.student_id = c.student_id
           AND ($3::char IS NULL OR s.gender = $3)
       )
     RETURNING c.complaint_id, c.status`,
    [status, complaintId, adminGenderScope(req.session)],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Complaint does not exist' });
  res.json({ complaint: result.rows[0] });
}));

app.get('/api/admin/summary', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const genderScope = adminGenderScope(req.session);
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM Student s
        WHERE ($1::char IS NULL OR s.gender = $1)) AS students,
       (SELECT COUNT(*)::int FROM Allocation a JOIN Student s ON s.student_id = a.student_id
        WHERE ($1::char IS NULL OR s.gender = $1)) AS allocated_students,
       (SELECT COUNT(*)::int FROM Bed b JOIN Room r ON r.room_id = b.room_id
        WHERE ($1::char IS NULL OR r.gender = $1)) AS beds,
       (SELECT COUNT(*)::int FROM Complaint c JOIN Student s ON s.student_id = c.student_id
        WHERE c.status IN ('pending', 'in_progress')
          AND ($1::char IS NULL OR s.gender = $1)) AS open_complaints,
       (SELECT COALESCE(SUM(p.amount), 0)::float
        FROM FinePayment p JOIN Fine f ON f.fine_id = p.fine_id
        JOIN Student s ON s.student_id = f.student_id
        WHERE ($1::char IS NULL OR s.gender = $1)) AS paid_amount`,
    [genderScope],
  );
  res.json({ summary: result.rows[0] });
}));

app.get('/api/admin/records', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const requestedStudentId = req.query.student_id ? Number(req.query.student_id) : null;
  if (requestedStudentId !== null && (!Number.isInteger(requestedStudentId) || requestedStudentId < 1)) {
    return res.status(400).json({ error: 'student_id must be a positive integer' });
  }

  const limitParam = req.query.limit;
  const isAll = limitParam === 'all';
  const limit = isAll ? null : Math.min(Math.max(Number(limitParam || 100), 1), 500);
  const page = Math.max(Number(req.query.page || 1), 1);
  const offset = isAll ? 0 : (page - 1) * limit;
  const genderScope = adminGenderScope(req.session);

  const [fines, gateLogs, payments, counts] = await Promise.all([
    isAll
      ? db.query(
          `SELECT f.fine_id, f.student_id, s.full_name, f.amount, f.reason, f.issued_on,
                  f.due_date, f.status, ft.name AS fine_type
           FROM Fine f JOIN Student s ON s.student_id = f.student_id
           JOIN FineType ft ON ft.fine_type_id = f.fine_type_id
           WHERE ($1::int IS NULL OR f.student_id = $1)
             AND ($2::char IS NULL OR s.gender = $2)
           ORDER BY f.issued_on DESC`,
          [requestedStudentId, genderScope],
        )
      : db.query(
          `SELECT f.fine_id, f.student_id, s.full_name, f.amount, f.reason, f.issued_on,
                  f.due_date, f.status, ft.name AS fine_type
           FROM Fine f JOIN Student s ON s.student_id = f.student_id
           JOIN FineType ft ON ft.fine_type_id = f.fine_type_id
           WHERE ($1::int IS NULL OR f.student_id = $1)
             AND ($4::char IS NULL OR s.gender = $4)
           ORDER BY f.issued_on DESC
           LIMIT $2 OFFSET $3`,
          [requestedStudentId, limit, offset, genderScope],
        ),
    isAll
      ? db.query(
          `SELECT g.log_id, g.student_id, s.full_name, g.direction, g.logged_at
           FROM GateLog g JOIN Student s ON s.student_id = g.student_id
           WHERE ($1::int IS NULL OR g.student_id = $1)
             AND ($2::char IS NULL OR s.gender = $2)
           ORDER BY g.logged_at DESC`,
          [requestedStudentId, genderScope],
        )
      : db.query(
          `SELECT g.log_id, g.student_id, s.full_name, g.direction, g.logged_at
           FROM GateLog g JOIN Student s ON s.student_id = g.student_id
           WHERE ($1::int IS NULL OR g.student_id = $1)
             AND ($4::char IS NULL OR s.gender = $4)
           ORDER BY g.logged_at DESC
           LIMIT $2 OFFSET $3`,
          [requestedStudentId, limit, offset, genderScope],
        ),
    isAll
      ? db.query(
          `SELECT p.payment_id, f.student_id, s.full_name, p.fine_id, p.amount,
                  p.paid_on, p.mode, f.reason
           FROM FinePayment p JOIN Fine f ON f.fine_id = p.fine_id
           JOIN Student s ON s.student_id = f.student_id
           WHERE ($1::int IS NULL OR f.student_id = $1)
             AND ($2::char IS NULL OR s.gender = $2)
           ORDER BY p.paid_on DESC`,
          [requestedStudentId, genderScope],
        )
      : db.query(
          `SELECT p.payment_id, f.student_id, s.full_name, p.fine_id, p.amount,
                  p.paid_on, p.mode, f.reason
           FROM FinePayment p JOIN Fine f ON f.fine_id = p.fine_id
           JOIN Student s ON s.student_id = f.student_id
           WHERE ($1::int IS NULL OR f.student_id = $1)
             AND ($4::char IS NULL OR s.gender = $4)
           ORDER BY p.paid_on DESC
           LIMIT $2 OFFSET $3`,
          [requestedStudentId, limit, offset, genderScope],
        ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM Fine f JOIN Student s ON s.student_id = f.student_id
          WHERE ($1::int IS NULL OR f.student_id = $1)
            AND ($2::char IS NULL OR s.gender = $2)) AS total_fines,
         (SELECT COUNT(*)::int FROM GateLog g JOIN Student s ON s.student_id = g.student_id
          WHERE ($1::int IS NULL OR g.student_id = $1)
            AND ($2::char IS NULL OR s.gender = $2)) AS total_gate_logs,
         (SELECT COUNT(*)::int FROM FinePayment fp JOIN Fine f ON f.fine_id = fp.fine_id
          JOIN Student s ON s.student_id = f.student_id
          WHERE ($1::int IS NULL OR f.student_id = $1)
            AND ($2::char IS NULL OR s.gender = $2)) AS total_payments`,
      [requestedStudentId, genderScope],
    ),
  ]);

  res.json({
    fines: fines.rows,
    gate_logs: gateLogs.rows,
    payments: payments.rows,
    counts: counts.rows[0],
    page,
    limit: isAll ? null : limit,
  });
}));

app.get('/api/admin/fine-risk', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const genderScope = adminGenderScope(req.session);
  const students = await db.query(
    `SELECT s.student_id, s.full_name, s.email, s.block_number,
            COUNT(f.fine_id) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS fines_3m,
            COALESCE(SUM(f.amount) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS amount_3m,
            COUNT(DISTINCT f.fine_type_id) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS distinct_types_3m,
            COUNT(f.fine_id) FILTER (WHERE f.status = 'unpaid' AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS unpaid_count,
            COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'unpaid' AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS unpaid_amount,
            COALESCE(AVG(payment.paid_on - f.issued_on) FILTER (WHERE f.status = 'paid' AND payment.paid_on IS NOT NULL AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS avg_days_to_pay
     FROM Student s
     LEFT JOIN Fine f ON f.student_id = s.student_id
     LEFT JOIN LATERAL (
       SELECT MIN(fp.paid_on)::date AS paid_on FROM FinePayment fp WHERE fp.fine_id = f.fine_id
     ) payment ON true
     WHERE ($1::char IS NULL OR s.gender = $1)
     GROUP BY s.student_id
     ORDER BY s.full_name`,
    [genderScope],
  );
  if (students.rows.length === 0) return res.json({ reports: [] });
  const features = students.rows.map((student) => ({
    fines_3m: student.fines_3m,
    amount_3m: student.amount_3m,
    distinct_types_3m: student.distinct_types_3m,
    unpaid_count: student.unpaid_count,
    unpaid_amount: student.unpaid_amount,
    avg_days_to_pay: student.avg_days_to_pay,
  }));

  // Chunk bulk predictions into batches of 500 to scale across thousands of student records seamlessly
  const CHUNK_SIZE = 500;
  let allPredictions = [];
  try {
    for (let i = 0; i < features.length; i += CHUNK_SIZE) {
      const chunk = features.slice(i, i + CHUNK_SIZE);
      const predictionResponse = await axios.post(
        `${ML_SERVICE_URL}/ml/predict-fine-risk/batch`,
        { items: chunk },
        { timeout: ML_REQUEST_TIMEOUT_MS },
      );
      if (!Array.isArray(predictionResponse.data.predictions)) {
        throw new Error('Fine-risk service returned an invalid batch format');
      }
      allPredictions = allPredictions.concat(predictionResponse.data.predictions);
    }
  } catch (error) {
    console.error('Fine-risk batch prediction failed:', error.message);
    return res.status(503).json({ error: 'Fine-risk prediction service is unavailable or timed out' });
  }

  if (allPredictions.length !== students.rows.length) {
    throw new Error('Fine-risk service returned an incomplete report');
  }
  const predictions = students.rows.map((student, index) => ({
    ...student,
    ...allPredictions[index],
    features: features[index],
  }));
  res.json({ reports: predictions, total: predictions.length });
}));

app.get('/api/students/:studentId/fine-risk', authenticate, asyncRoute(async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: 'studentId must be a positive integer' });
  }
  if (req.session.role !== 'admin' && req.session.id !== studentId) {
    return res.status(403).json({ error: 'You may only view your own fine-risk report' });
  }
  const genderScope = req.session.role === 'admin' ? adminGenderScope(req.session) : null;
  const result = await db.query(
    `SELECT
       COUNT(f.fine_id) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS fines_3m,
       COALESCE(SUM(f.amount) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS amount_3m,
       COUNT(DISTINCT f.fine_type_id) FILTER (WHERE f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS distinct_types_3m,
       COUNT(f.fine_id) FILTER (WHERE f.status = 'unpaid' AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months')::int AS unpaid_count,
       COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'unpaid' AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS unpaid_amount,
       COALESCE(AVG(payment.paid_on - f.issued_on) FILTER (WHERE f.status = 'paid' AND payment.paid_on IS NOT NULL AND f.issued_on >= CURRENT_DATE - INTERVAL '3 months'), 0)::float AS avg_days_to_pay
     FROM Student s LEFT JOIN Fine f ON f.student_id = s.student_id
     LEFT JOIN LATERAL (SELECT MIN(fp.paid_on)::date AS paid_on FROM FinePayment fp WHERE fp.fine_id = f.fine_id) payment ON true
     WHERE s.student_id = $1
       AND ($2::char IS NULL OR s.gender = $2)
     GROUP BY s.student_id`,
    [studentId, genderScope],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Student does not exist' });
  const features = result.rows[0];
  const prediction = await axios.post(`${ML_SERVICE_URL}/ml/predict-fine-risk`, features, {
    timeout: ML_REQUEST_TIMEOUT_MS,
  });
  res.json({ student_id: studentId, ...prediction.data, features });
}));

app.post('/api/admin/matching/run', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const genderScope = adminGenderScope(req.session);
  const eligible = await db.query(
    `SELECT s.student_id, s.full_name, s.gender, s.block_number,
            rp.q1_bedtime, rp.q2_wakeup, rp.q3_tidiness, rp.q4_study_style,
            rp.q5_study_hours, rp.q6_food, rp.q7_noise_tolerance,
            rp.q8_visitors_social, rp.q9_weekends, rp.q10_share_belongings
     FROM Student s
     JOIN RoommatePreference rp ON rp.student_id = s.student_id
     WHERE NOT EXISTS (
       SELECT 1 FROM Allocation a WHERE a.student_id = s.student_id
     )
       AND ($1::char IS NULL OR s.gender = $1)
     ORDER BY s.student_id`,
    [genderScope],
  );
  if (eligible.rows.length === 0) {
    return res.status(409).json({ error: 'No students with submitted preferences are awaiting allocation' });
  }

  const roomResult = await db.query(
    `SELECT r.room_id, r.room_number, r.block_number, r.capacity, r.gender,
            COALESCE(json_agg(json_build_object(
              'bed_id', b.bed_id, 'bed_label', b.bed_label
            ) ORDER BY b.bed_id) FILTER (WHERE b.bed_id IS NOT NULL), '[]'::json) AS beds
     FROM Room r
     LEFT JOIN Bed b ON b.room_id = r.room_id
     WHERE ($1::char IS NULL OR r.gender = $1)
       AND NOT EXISTS (
         SELECT 1 FROM MatchGroup mg
         WHERE mg.room_id = r.room_id AND mg.status = 'pending'
       )
       AND NOT EXISTS (
       SELECT 1 FROM Allocation a JOIN Bed occupied_bed ON occupied_bed.bed_id = a.bed_id
       WHERE occupied_bed.room_id = r.room_id
     )
     GROUP BY r.room_id
     HAVING COUNT(b.bed_id) = r.capacity
        AND COUNT(b.bed_id) FILTER (WHERE b.is_occupied) = 0
     ORDER BY r.capacity DESC, r.room_id`,
    [genderScope],
  );
  if (roomResult.rows.length === 0) {
    return res.status(409).json({ error: 'No empty rooms with a complete set of beds are available' });
  }

  const mlResponse = await axios.post(
    `${ML_SERVICE_URL}/ml/match-roommates`,
    {
      students: eligible.rows.map((student) => ({
        student_id: student.student_id,
        gender: student.gender,
        ...Object.fromEntries(Object.entries(student).filter(([key]) => key.startsWith('q'))),
      })),
    },
    { timeout: ML_REQUEST_TIMEOUT_MS },
  );
  const clusterByStudent = new Map(
    mlResponse.data.clusters.map((cluster) => [cluster.student_id, cluster.cluster_id]),
  );
  const students = eligible.rows.map((student) => ({
    ...student,
    cluster_id: clusterByStudent.get(student.student_id),
    preferences: Object.fromEntries(Object.entries(student).filter(([key]) => key.startsWith('q'))),
  }));
  const { groups, unmatched_student_ids } = buildRoomGroups(students, roomResult.rows);

  const client = await db.pool.connect();
  let runId;
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE MatchGroup mg SET status = 'rejected'
       FROM Room r
       WHERE mg.room_id = r.room_id AND mg.status = 'pending'
         AND ($1::char IS NULL OR r.gender = $1)`,
      [genderScope],
    );
    await client.query(
      `UPDATE MatchSuggestion suggestion SET status = 'rejected'
       WHERE suggestion.status = 'pending'
         AND EXISTS (
           SELECT 1 FROM MatchGroup mg
           JOIN Room r ON r.room_id = mg.room_id
           WHERE mg.run_id = suggestion.run_id
             AND mg.status = 'rejected'
             AND ($1::char IS NULL OR r.gender = $1)
         )`,
      [genderScope],
    );
    const run = await client.query(
      'INSERT INTO MatchRun (k, silhouette) VALUES ($1, NULL) RETURNING run_id',
      [mlResponse.data.cluster_count],
    );
    runId = run.rows[0].run_id;
    for (const student of students) {
      await client.query(
        'INSERT INTO StudentCluster (student_id, run_id, cluster_id) VALUES ($1, $2, $3)',
        [student.student_id, runId, student.cluster_id],
      );
    }
    for (const group of groups) {
      const groupResult = await client.query(
        `INSERT INTO MatchGroup (run_id, room_id, cluster_id, capacity)
         VALUES ($1, $2, $3, $4) RETURNING group_id`,
        [runId, group.room_id, group.cluster_id, group.capacity],
      );
      const groupId = groupResult.rows[0].group_id;
      const room = roomResult.rows.find((candidate) => candidate.room_id === group.room_id);
      for (const [index, student] of group.students.entries()) {
        await client.query(
          'INSERT INTO MatchGroupMember (group_id, student_id, bed_id) VALUES ($1, $2, $3)',
          [groupId, student.student_id, room.beds[index].bed_id],
        );
      }
      for (let left = 0; left < group.students.length; left += 1) {
        for (let right = left + 1; right < group.students.length; right += 1) {
          const leftStudent = students.find((student) => student.student_id === group.students[left].student_id);
          const rightStudent = students.find((student) => student.student_id === group.students[right].student_id);
          await client.query(
            `INSERT INTO MatchSuggestion (run_id, student_a, student_b, similarity)
             VALUES ($1, $2, $3, $4)`,
            [
              runId,
              leftStudent.student_id,
              rightStudent.student_id,
              preferenceCompatibility(leftStudent.preferences, rightStudent.preferences),
            ],
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Matching rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json({
    run_id: runId,
    cluster_count: mlResponse.data.cluster_count,
    compatibility_threshold: COMPATIBILITY_THRESHOLD,
    groups,
    unmatched_student_ids,
  });
}));

app.get('/api/admin/matching/latest', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const genderScope = adminGenderScope(req.session);
  const runResult = await db.query(
    `SELECT run_id, run_at, k, silhouette FROM MatchRun run
     WHERE ($1::char IS NULL OR EXISTS (
       SELECT 1 FROM MatchGroup mg JOIN Room r ON r.room_id = mg.room_id
       WHERE mg.run_id = run.run_id AND r.gender = $1
     ))
     ORDER BY run_at DESC, run_id DESC LIMIT 1`,
    [genderScope],
  );
  if (!runResult.rows[0]) {
    return res.json({ run: null, groups: [], compatibility_threshold: COMPATIBILITY_THRESHOLD });
  }
  const run = runResult.rows[0];
  const groupResult = await db.query(
    `SELECT mg.group_id, mg.cluster_id, mg.capacity, mg.status,
            r.room_id, r.room_number, r.block_number, r.gender,
            COALESCE(json_agg(json_build_object(
              'student_id', s.student_id, 'full_name', s.full_name,
              'bed_id', m.bed_id, 'bed_label', b.bed_label
            ) ORDER BY s.full_name) FILTER (WHERE s.student_id IS NOT NULL), '[]'::json) AS students,
            COALESCE((
              SELECT json_agg(json_build_object(
                'student_a', student_a.full_name,
                'student_b', student_b.full_name,
                'similarity', suggestion.similarity
              ) ORDER BY student_a.full_name, student_b.full_name)
              FROM MatchSuggestion suggestion
              JOIN Student student_a ON student_a.student_id = suggestion.student_a
              JOIN Student student_b ON student_b.student_id = suggestion.student_b
              WHERE suggestion.run_id = mg.run_id
                AND suggestion.student_a IN (
                  SELECT member.student_id FROM MatchGroupMember member WHERE member.group_id = mg.group_id
                )
                AND suggestion.student_b IN (
                  SELECT member.student_id FROM MatchGroupMember member WHERE member.group_id = mg.group_id
                )
            ), '[]'::json) AS compatibility
     FROM MatchGroup mg
     JOIN Room r ON r.room_id = mg.room_id
     LEFT JOIN MatchGroupMember m ON m.group_id = mg.group_id
     LEFT JOIN Student s ON s.student_id = m.student_id
     LEFT JOIN Bed b ON b.bed_id = m.bed_id
     WHERE mg.run_id = $1
       AND ($2::char IS NULL OR r.gender = $2)
     GROUP BY mg.group_id, r.room_id
     ORDER BY r.block_number, r.room_number`,
    [run.run_id, genderScope],
  );
  res.json({
    run,
    groups: groupResult.rows,
    compatibility_threshold: COMPATIBILITY_THRESHOLD,
  });
}));

app.post('/api/admin/matching/:runId/confirm', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const runId = Number(req.params.runId);
  if (!Number.isInteger(runId) || runId < 1) return res.status(400).json({ error: 'Invalid matching run ID' });
  const genderScope = adminGenderScope(req.session);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      `SELECT mg.group_id, mg.room_id, mg.capacity,
              r.capacity AS room_capacity, r.gender, r.block_number AS room_block_number
       FROM MatchGroup mg JOIN Room r ON r.room_id = mg.room_id
       WHERE mg.run_id = $1 AND mg.status = 'pending'
         AND ($2::char IS NULL OR r.gender = $2)
       FOR UPDATE OF mg, r`,
      [runId, genderScope],
    );
    if (!groupResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'There are no pending groups to confirm for this run' });
    }
    let allocationsCreated = 0;
    for (const group of groupResult.rows) {
      const members = await client.query(
        `SELECT m.student_id, m.bed_id, s.gender, s.block_number,
                rp.q1_bedtime, rp.q2_wakeup, rp.q3_tidiness, rp.q4_study_style,
                rp.q5_study_hours, rp.q6_food, rp.q7_noise_tolerance,
                rp.q8_visitors_social, rp.q9_weekends, rp.q10_share_belongings
         FROM MatchGroupMember m
         JOIN Student s ON s.student_id = m.student_id
         JOIN RoommatePreference rp ON rp.student_id = s.student_id
         WHERE m.group_id = $1
         ORDER BY m.student_id
         FOR UPDATE OF m, s, rp`,
        [group.group_id],
      );
      if (!members.rows.length || members.rows.length > group.capacity ||
          group.capacity !== group.room_capacity ||
          members.rows.some((student) =>
            student.gender !== group.gender || student.block_number !== group.room_block_number)) {
        throw matchingConflict(`Invalid occupants or capacity for match group ${group.group_id}`);
      }
      for (let left = 0; left < members.rows.length; left += 1) {
        for (let right = left + 1; right < members.rows.length; right += 1) {
          const leftPreferences = Object.fromEntries(
            Object.entries(members.rows[left]).filter(([key]) => key.startsWith('q')),
          );
          const rightPreferences = Object.fromEntries(
            Object.entries(members.rows[right]).filter(([key]) => key.startsWith('q')),
          );
          if (preferenceCompatibility(leftPreferences, rightPreferences) < COMPATIBILITY_THRESHOLD) {
            throw matchingConflict(`Compatibility check failed for match group ${group.group_id}`);
          }
        }
      }
      const beds = await client.query(
        `SELECT b.bed_id FROM Bed b
         WHERE b.room_id = $1 AND b.is_occupied = FALSE
           AND NOT EXISTS (SELECT 1 FROM Allocation a WHERE a.bed_id = b.bed_id)
         ORDER BY b.bed_id
         FOR UPDATE`,
        [group.room_id],
      );
      if (beds.rows.length !== group.capacity || beds.rows.length < members.rows.length) {
        throw matchingConflict(`Room capacity or availability changed for match group ${group.group_id}`);
      }
      for (const [index, student] of members.rows.entries()) {
        const bedId = beds.rows[index].bed_id;
        await client.query('INSERT INTO Allocation (student_id, bed_id) VALUES ($1, $2)', [student.student_id, bedId]);
        await client.query('UPDATE Bed SET is_occupied = TRUE WHERE bed_id = $1', [bedId]);
        await client.query(
          'UPDATE MatchGroupMember SET bed_id = $1 WHERE group_id = $2 AND student_id = $3',
          [bedId, group.group_id, student.student_id],
        );
        allocationsCreated += 1;
      }
      await client.query('UPDATE MatchGroup SET status = $1 WHERE group_id = $2', ['confirmed', group.group_id]);
      await client.query(
        `UPDATE MatchSuggestion SET status = 'confirmed'
         WHERE run_id = $1 AND student_a IN (
           SELECT student_id FROM MatchGroupMember WHERE group_id = $2
         ) AND student_b IN (
           SELECT student_id FROM MatchGroupMember WHERE group_id = $2
         )`,
        [runId, group.group_id],
      );
    }
    await client.query('COMMIT');
    res.json({ run_id: runId, allocations_created: allocationsCreated });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Allocation confirmation rollback failed:', rollbackError.message);
    }
    console.error('Could not confirm matching allocation:', error.message);
    const status = error.statusCode || (error.code === '23505' ? 409 : 500);
    res.status(status).json({
      error: status === 409
        ? 'The proposed group changed or was allocated concurrently. Run matching again and review its new suggestions.'
        : 'Could not confirm the matching allocation',
    });
  } finally {
    client.release();
  }
}));

app.post('/api/bookings', authenticate, allowRoles('student'), asyncRoute(async (req, res) => {
  const { bed_id } = req.body || {};
  const studentId = req.session.id;
  const bedId = Number(bed_id);

  if (!Number.isInteger(bedId) || bedId < 1) {
    return res.status(400).json({ success: false, error: 'Provide a valid bed_id value' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const bedCheck = await client.query(
      `SELECT b.is_occupied, r.room_id, r.capacity, r.block_number AS room_block_number,
              s.block_number AS student_block_number,
              r.gender AS room_gender, s.gender AS student_gender
       FROM Bed b
       JOIN Room r ON r.room_id = b.room_id
       LEFT JOIN Student s ON s.student_id = $2
       WHERE b.bed_id = $1
       FOR UPDATE OF r, b`,
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
    if (bed.room_block_number !== bed.student_block_number) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Student block does not match the room block' });
    }
    if (bed.capacity > 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Shared rooms must be assigned through the compatible roommate matching workflow',
      });
    }
    if (bed.is_occupied) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Bed is already occupied' });
    }

    const roomBeds = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.is_occupied OR EXISTS (
                SELECT 1 FROM Allocation a WHERE a.bed_id = b.bed_id
              ))::int AS occupied
       FROM Bed b WHERE b.room_id = $1`,
      [bed.room_id],
    );
    if (roomBeds.rows[0].total !== bed.capacity || roomBeds.rows[0].occupied >= bed.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Room bed inventory does not match its configured capacity' });
    }

    const studentPreferences = await client.query(
      `SELECT q1_bedtime, q2_wakeup, q3_tidiness, q4_study_style, q5_study_hours,
              q6_food, q7_noise_tolerance, q8_visitors_social, q9_weekends,
              q10_share_belongings
       FROM RoommatePreference WHERE student_id = $1`,
      [studentId],
    );
    if (!studentPreferences.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Submit roommate preferences before booking a room' });
    }
    const currentOccupants = await client.query(
      `SELECT a.student_id, rp.q1_bedtime, rp.q2_wakeup, rp.q3_tidiness, rp.q4_study_style,
              rp.q5_study_hours, rp.q6_food, rp.q7_noise_tolerance,
              rp.q8_visitors_social, rp.q9_weekends, rp.q10_share_belongings
       FROM Allocation a
       JOIN Bed b ON b.bed_id = a.bed_id
       JOIN RoommatePreference rp ON rp.student_id = a.student_id
       WHERE b.room_id = $1
       ORDER BY a.student_id`,
      [bed.room_id],
    );
    const allPreferences = [studentPreferences.rows[0], ...currentOccupants.rows];
    let incompatible = false;
    for (let left = 0; left < allPreferences.length; left += 1) {
      for (let right = left + 1; right < allPreferences.length; right += 1) {
        incompatible = incompatible ||
          preferenceCompatibility(allPreferences[left], allPreferences[right]) < COMPATIBILITY_THRESHOLD;
      }
    }
    if (currentOccupants.rows.length >= bed.capacity || incompatible) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Room is full or the student is not compatible with its occupants' });
    }
    const occupantsWithoutPreferences = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM Allocation a
       JOIN Bed b ON b.bed_id = a.bed_id
       LEFT JOIN RoommatePreference rp ON rp.student_id = a.student_id
       WHERE b.room_id = $1 AND rp.student_id IS NULL`,
      [bed.room_id],
    );
    if (occupantsWithoutPreferences.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Every room occupant must submit roommate preferences' });
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
}));

app.get('/api/warden/trends', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const genderScope = adminGenderScope(req.session);
  const trends = await db.query(
    `WITH monthly_complaints AS (
       SELECT c.block_number, c.category,
              DATE_TRUNC('month', c.created_at) AS complaint_month,
              COUNT(c.complaint_id) AS current_month_count
       FROM Complaint c
       JOIN Student s ON s.student_id = c.student_id
       WHERE ($1::char IS NULL OR s.gender = $1)
       GROUP BY c.block_number, c.category, DATE_TRUNC('month', c.created_at)
     )
     SELECT block_number, category, complaint_month, current_month_count,
            LAG(current_month_count, 1, 0) OVER (
              PARTITION BY block_number, category ORDER BY complaint_month
            ) AS previous_month_count,
            current_month_count - LAG(current_month_count, 1, 0) OVER (
              PARTITION BY block_number, category ORDER BY complaint_month
            ) AS month_over_month_change
     FROM monthly_complaints
     ORDER BY complaint_month DESC, block_number, category`,
    [genderScope],
  );
  res.json(trends.rows);
}));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error.message);
  if (res.headersSent) return next(error);
  const status = error.code === '23505'
    ? 409
    : error.statusCode || (axios.isAxiosError(error) ? 503 : 500);
  res.status(status).json({
    error: status === 503
      ? 'A dependent service is unavailable'
      : status === 409
        ? 'An account with those details already exists'
        : status < 500
          ? error.message
          : 'The request could not be completed',
  });
});

let serverInstance;

async function ensureAdminUser() {
  try {
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const result = await db.query(
      `INSERT INTO Admin (username, email, password_hash, full_name, role, hostel_type)
       VALUES ('admin', 'admin@example.edu', $1, 'System Administrator', 'SUPER_ADMIN', 'all')
       ON CONFLICT (username) DO UPDATE SET
         role = 'SUPER_ADMIN',
         hostel_type = 'all'
       RETURNING admin_id`,
      [adminPassword],
    );
    if (result.rowCount) console.log("Admin user 'admin' initialized successfully.");
  } catch (error) {
    console.warn("Could not auto-seed admin account:", error.message);
  }
}

async function ensureStudentPasswords() {
  try {
    const studentDefaultPassword = process.env.STUDENT_DEFAULT_PASSWORD || 'StudentPass123';
    await db.query(
      "UPDATE Student SET password_hash = $1 WHERE password_hash IS NULL",
      [studentDefaultPassword],
    );
  } catch (error) {
    console.warn("Could not ensure student default passwords:", error.message);
  }
}

async function start() {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters');
  }
  await db.query('SELECT 1');
  await ensureAdminUser();
  await ensureStudentPasswords();
  serverInstance = app.listen(PORT, () => {
    console.log(`Express backend running on port ${PORT}`);
  });
}

async function gracefulShutdown(signal) {
  console.log(`${signal} received: closing HTTP server and PostgreSQL pool`);
  if (serverInstance) {
    serverInstance.close(async () => {
      await db.closePool();
      process.exit(0);
    });
  } else {
    await db.closePool();
    process.exit(0);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

start().catch((error) => {
  console.error('Could not start backend; verify PostgreSQL configuration and availability:', error.message);
  process.exitCode = 1;
});