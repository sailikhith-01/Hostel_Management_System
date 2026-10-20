const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const db = require('../db');

test('integration: admin and student login against real database', async (t) => {
  // Ensure DB connection is active
  await db.query('SELECT 1');
  const createdStudentEmails = [];
  const createdStudentIds = [];
  const createdAdminUsernames = [];
  const allocationTestRoomIds = [];
  t.after(async () => {
    await db.query(
      `UPDATE Bed SET is_occupied = FALSE
       WHERE bed_id IN (SELECT bed_id FROM Allocation WHERE student_id = ANY($1))`,
      [createdStudentIds],
    );
    await db.query('DELETE FROM Student WHERE email = ANY($1)', [createdStudentEmails]);
    await db.query('DELETE FROM Admin WHERE username = ANY($1)', [createdAdminUsernames]);
    if (allocationTestRoomIds.length) {
      await db.query('DELETE FROM Room WHERE room_id = ANY($1)', [allocationTestRoomIds]);
    }
  });

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

  async function patchJson(path, body, cookie = '') {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 5099,
          path,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            ...(cookie ? { Cookie: cookie } : {}),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (chunk) => (chunks += chunk));
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
        },
      );
      req.on('error', reject);
      req.write(data);
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

  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const managedStudent = {
    full_name: 'Integration Student',
    email: `integration-${uniqueId}@example.edu`,
    roll_number: `IT-${uniqueId}`,
    gender: 'F',
    block_number: 'S',
    room_preference: 4,
    password: 'ManagedPass123',
  };
  createdStudentEmails.push(managedStudent.email);
  const studentCreated = await postJson('/api/students', managedStudent, cookie1.split(';')[0]);
  assert.equal(studentCreated.status, 201);
  assert.equal(studentCreated.body.student.email, managedStudent.email);
  createdStudentIds.push(studentCreated.body.student.id);
  const initializedPreferences = await db.query(
    `SELECT q1_bedtime, q2_wakeup, q3_tidiness, q4_study_style, q5_study_hours,
            q6_food, q7_noise_tolerance, q8_visitors_social, q9_weekends,
            q10_share_belongings
     FROM RoommatePreference WHERE student_id = $1`,
    [studentCreated.body.student.id],
  );
  assert.equal(initializedPreferences.rows.length, 1, 'New students must be eligible for matching immediately');
  assert.deepEqual(initializedPreferences.rows[0], {
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
  });

  const roomNumber = `T${Date.now().toString().slice(-8)}`;
  const testRoom = await db.query(
    `INSERT INTO Room (room_number, block_number, capacity, gender)
     VALUES ($1, 'S', 4, 'F') RETURNING room_id`,
    [roomNumber],
  );
  allocationTestRoomIds.push(testRoom.rows[0].room_id);
  const testBed = await db.query(
    `INSERT INTO Bed (room_id, bed_label)
     SELECT $1, chr(64 + bed_number)
     FROM generate_series(1, 4) AS beds(bed_number)
     ORDER BY bed_number
     RETURNING bed_id`,
    [testRoom.rows[0].room_id],
  );
  const availableBeds = await getJson('/api/allocations', cookie1.split(';')[0]);
  assert.equal(availableBeds.status, 200);
  const studentBeds = await getJson(
    `/api/allocations?student_id=${studentCreated.body.student.id}`,
    cookie1.split(';')[0],
  );
  assert.equal(studentBeds.status, 200);
  assert.ok(studentBeds.body.available_beds.length >= 4);
  assert.ok(studentBeds.body.available_beds.every((bed) => bed.capacity === 4));
  assert.ok(testBed.rows.every((testBedRow) =>
    studentBeds.body.available_beds.some((bed) => bed.bed_id === testBedRow.bed_id)));
  const otherCapacityRoom = await db.query(
    `INSERT INTO Room (room_number, block_number, capacity, gender)
     VALUES ($1, 'S', 2, 'F') RETURNING room_id`,
    [`U${Date.now().toString().slice(-8)}`],
  );
  allocationTestRoomIds.push(otherCapacityRoom.rows[0].room_id);
  const otherCapacityBeds = await db.query(
    `INSERT INTO Bed (room_id, bed_label)
     VALUES ($1, 'A'), ($1, 'B')
     RETURNING bed_id`,
    [otherCapacityRoom.rows[0].room_id],
  );
  assert.ok(otherCapacityBeds.rows.every((otherBed) =>
    !studentBeds.body.available_beds.some((bed) => bed.bed_id === otherBed.bed_id)));
  const capacityMismatch = await postJson('/api/allocations', {
    student_id: studentCreated.body.student.id,
    bed_id: otherCapacityBeds.rows[0].bed_id,
  }, cookie1.split(';')[0]);
  assert.equal(capacityMismatch.status, 409);
  assert.ok(availableBeds.body.available_beds.some((bed) => bed.bed_id === testBed.rows[0].bed_id));
  const pendingStudents = await getJson('/api/students', cookie1.split(';')[0]);
  assert.equal(pendingStudents.status, 200);
  assert.equal(
    pendingStudents.body.students.find((student) => student.student_id === studentCreated.body.student.id).allocation_status,
    'pending',
  );
  const allocation = await postJson('/api/allocations', {
    student_id: studentCreated.body.student.id,
    bed_id: testBed.rows[0].bed_id,
  }, cookie1.split(';')[0]);
  assert.equal(allocation.status, 201);
  const studentList = await getJson('/api/students', cookie1.split(';')[0]);
  assert.equal(studentList.status, 200);
  assert.equal(
    studentList.body.students.find((student) => student.student_id === studentCreated.body.student.id).allocation_status,
    'completed',
  );
  assert.ok(studentList.body.students.some((student) => student.gender === 'M'));
  assert.ok(studentList.body.students.some((student) => student.gender === 'F'));
  const managedMaleStudent = {
    ...managedStudent,
    full_name: 'Integration Male Student',
    email: `integration-male-${uniqueId}@example.edu`,
    roll_number: `IM-${uniqueId}`,
    gender: 'M',
    block_number: 'A',
  };
  createdStudentEmails.push(managedMaleStudent.email);
  const maleStudentCreated = await postJson('/api/students', managedMaleStudent, cookie1.split(';')[0]);
  assert.equal(maleStudentCreated.status, 201);
  createdStudentIds.push(maleStudentCreated.body.student.id);

  const managedStudentLogin = await postJson('/api/auth/login', {
    role: 'student',
    email: managedStudent.email,
    password: managedStudent.password,
  });
  assert.equal(managedStudentLogin.status, 200);

  const managedAdmin = {
    full_name: 'Integration Warden',
    username: `integration-${uniqueId}`,
    email: `integration-admin-${uniqueId}@example.edu`,
    role: 'WARDEN',
    hostel_type: 'ladies',
    password: 'ManagedAdmin123',
  };
  createdAdminUsernames.push(managedAdmin.username);
  const adminCreated = await postJson('/api/admins', managedAdmin, cookie1.split(';')[0]);
  assert.equal(adminCreated.status, 201);
  assert.equal(adminCreated.body.admin.email, managedAdmin.email);
  const managedAdminLogin = await postJson('/api/auth/login', {
    role: 'admin',
    username: managedAdmin.email,
    password: managedAdmin.password,
  });
  assert.equal(managedAdminLogin.status, 200);
  assert.equal(managedAdminLogin.body.user.hostel_type, 'ladies');
  const ladiesSession = managedAdminLogin.headers['set-cookie'][0].split(';')[0];
  const ladiesStudents = await getJson('/api/students', ladiesSession);
  assert.equal(ladiesStudents.status, 200);
  assert.ok(ladiesStudents.body.students.every((student) => student.gender === 'F'));
  assert.ok(ladiesStudents.body.students.some(
    (student) => student.student_id === studentCreated.body.student.id,
  ));
  const ladiesCannotQueryMaleBeds = await getJson(
    `/api/allocations?student_id=${maleStudentCreated.body.student.id}`,
    ladiesSession,
  );
  assert.equal(ladiesCannotQueryMaleBeds.status, 404);
  const ladiesBeds = await getJson('/api/allocations', ladiesSession);
  assert.equal(ladiesBeds.status, 200);
  assert.ok(ladiesBeds.body.available_beds.every((bed) => bed.gender === 'F'));
  const maleBeds = await getJson(
    `/api/allocations?student_id=${maleStudentCreated.body.student.id}`,
    cookie1.split(';')[0],
  );
  assert.equal(maleBeds.status, 200);
  assert.ok(maleBeds.body.available_beds.length > 0);
  const ladiesCannotAllocateMaleStudent = await postJson('/api/allocations', {
    student_id: maleStudentCreated.body.student.id,
    bed_id: maleBeds.body.available_beds[0].bed_id,
  }, ladiesSession);
  assert.equal(ladiesCannotAllocateMaleStudent.status, 403);
  const ladiesCannotCreateMaleStudent = await postJson('/api/students', {
    ...managedStudent,
    full_name: 'Out of Scope Student',
    email: `out-of-scope-${uniqueId}@example.edu`,
    roll_number: `OOS-${uniqueId}`,
    gender: 'M',
  }, ladiesSession);
  assert.equal(ladiesCannotCreateMaleStudent.status, 403);
  const wardenCannotListAdmins = await getJson('/api/admins', ladiesSession);
  assert.equal(wardenCannotListAdmins.status, 403);

  const reassignment = await patchJson(
    `/api/admins/${adminCreated.body.admin.id}/hostel-type`,
    { hostel_type: 'mens' },
    cookie1.split(';')[0],
  );
  assert.equal(reassignment.status, 200);
  assert.equal(reassignment.body.admin.hostel_type, 'mens');
  const staleAdminSession = await getJson('/api/students', ladiesSession);
  assert.equal(staleAdminSession.status, 401);
  const mensAdminLogin = await postJson('/api/auth/login', {
    role: 'admin',
    username: managedAdmin.email,
    password: managedAdmin.password,
  });
  assert.equal(mensAdminLogin.status, 200);
  const mensSession = mensAdminLogin.headers['set-cookie'][0].split(';')[0];
  const mensStudents = await getJson('/api/students', mensSession);
  assert.equal(mensStudents.status, 200);
  assert.ok(mensStudents.body.students.every((student) => student.gender === 'M'));
  assert.ok(!mensStudents.body.students.some(
    (student) => student.student_id === studentCreated.body.student.id,
  ));

  const registeredStudent = {
    ...managedStudent,
    full_name: 'Self Registered Student',
    email: `registration-${uniqueId}@example.edu`,
    roll_number: `REG-${uniqueId}`,
  };
  createdStudentEmails.push(registeredStudent.email);
  const registration = await postJson('/api/auth/register', registeredStudent);
  assert.equal(registration.status, 201);
  assert.ok(registration.headers['set-cookie'], 'Registration must start a student session');
  const registrationSession = await getJson(
    '/api/auth/session',
    registration.headers['set-cookie'][0].split(';')[0],
  );
  assert.equal(registrationSession.status, 200);
  assert.equal(registrationSession.body.user.role, 'student');

  // Verify session endpoint with this cookie
  const sessionRes = await getJson('/api/auth/session', cookie1.split(';')[0]);
  assert.equal(sessionRes.status, 200);
  assert.equal(sessionRes.body.user.role, 'admin');

  // 2. Test Student login with the sample seed password
  const studentLogin = await postJson('/api/auth/login', {
    role: 'student',
    email: 'arun.kumar@example.edu',
    password: 'StudentPass123',
  });
  assert.equal(studentLogin.status, 200, `Expected 200 for student, got ${studentLogin.status}`);
  assert.equal(studentLogin.body.user.role, 'student');
  assert.equal(studentLogin.body.user.name, 'Arun Kumar');

  // 3. Test invalid password
  const badLogin = await postJson('/api/auth/login', {
    role: 'admin',
    username: 'admin',
    password: 'WrongPassword!',
  });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error, 'Invalid username/email or password');

  console.log('[PASS] All authentication login scenarios verified successfully!');
});
