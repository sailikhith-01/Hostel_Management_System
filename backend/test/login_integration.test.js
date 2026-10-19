const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const db = require('../db');

test('integration: admin and student login against real database', async (t) => {
  // Ensure DB connection is active
  await db.query('SELECT 1');

  // Verify 'admin' exists in database
  const adminRes = await db.query("SELECT * FROM Admin WHERE username = 'admin'");
  assert.ok(adminRes.rows.length > 0, "Admin 'admin' must exist in DB");

  // Spin up temporary backend server on an open port
  delete require.cache[require.resolve('../server')];
  process.env.PORT = '5099';
  process.env.SESSION_SECRET = 'super_secret_session_key_hostel_management_2026_xyz';

  // Import server module (starts listening on 5099)
  require('../server');

  // Wait 500ms for server to bind
  await new Promise((r) => setTimeout(r, 600));

  async function postJson(path, body, cookie = '') {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 5099,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            ...(cookie ? { Cookie: cookie } : {}),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (c) => (chunks += c));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(chunks);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json || chunks,
            });
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async function getJson(path, cookie = '') {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 5099,
          path,
          method: 'GET',
          headers: {
            ...(cookie ? { Cookie: cookie } : {}),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (c) => (chunks += c));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(chunks);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json || chunks,
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  // 1. Test Admin login with 'admin123'
  const adminLogin1 = await postJson('/api/auth/login', {
    role: 'admin',
    username: 'admin',
    password: 'admin123',
  });
  assert.equal(adminLogin1.status, 200, `Expected 200, got ${adminLogin1.status}: ${JSON.stringify(adminLogin1.body)}`);
  assert.equal(adminLogin1.body.user.role, 'admin');
  assert.equal(adminLogin1.body.user.name, 'System Administrator');
  assert.ok(adminLogin1.headers['set-cookie'], 'Set-Cookie header must be present');
  const cookie1 = adminLogin1.headers['set-cookie'][0];
  assert.ok(cookie1.includes('hostel_session='), 'hostel_session cookie must be set');

  // Verify session endpoint with this cookie
  const sessionRes = await getJson('/api/auth/session', cookie1.split(';')[0]);
  assert.equal(sessionRes.status, 200);
  assert.equal(sessionRes.body.user.role, 'admin');

  // 2. Test Admin login with 'AdminSecure123!'
  const adminLogin2 = await postJson('/api/auth/login', {
    role: 'admin',
    username: 'admin',
    password: 'AdminSecure123!',
  });
  assert.equal(adminLogin2.status, 200, `Expected 200 for AdminSecure123!, got ${adminLogin2.status}`);

  // 3. Test Student login with 'student123'
  const studentLogin = await postJson('/api/auth/login', {
    role: 'student',
    email: 'arun.kumar@example.edu',
    password: 'student123',
  });
  assert.equal(studentLogin.status, 200, `Expected 200 for student, got ${studentLogin.status}`);
  assert.equal(studentLogin.body.user.role, 'student');
  assert.equal(studentLogin.body.user.name, 'Arun Kumar');

  // 4. Test invalid password
  const badLogin = await postJson('/api/auth/login', {
    role: 'admin',
    username: 'admin',
    password: 'WrongPassword!',
  });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error, 'Invalid username/email or password');

  console.log('[PASS] All authentication login scenarios verified successfully!');
});
