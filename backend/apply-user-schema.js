const db = require('./db');
const { resetPasswords } = require('./reset-passwords');

async function run() {
  await db.query(`
    ALTER TABLE Admin
    ADD COLUMN IF NOT EXISTS hostel_type VARCHAR(12) NOT NULL DEFAULT 'unassigned';
  `);
  await db.query(`
    UPDATE Admin
    SET hostel_type = CASE WHEN role = 'SUPER_ADMIN' THEN 'all' ELSE 'unassigned' END
    WHERE hostel_type IS NULL
       OR (role = 'SUPER_ADMIN' AND hostel_type <> 'all')
       OR (role = 'WARDEN' AND hostel_type NOT IN ('mens', 'ladies', 'unassigned'));
  `);
  await db.query('ALTER TABLE Admin DROP CONSTRAINT IF EXISTS admin_hostel_type_check;');
  await db.query('ALTER TABLE Admin DROP CONSTRAINT IF EXISTS check_admin_hostel_type;');
  await db.query(`
    ALTER TABLE Admin
    ADD CONSTRAINT check_admin_hostel_type
    CHECK (
      (role = 'SUPER_ADMIN' AND hostel_type = 'all') OR
      (role = 'WARDEN' AND hostel_type IN ('mens', 'ladies', 'unassigned'))
    );
  `);
  await db.query('ALTER TABLE Student ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50);');
  await db.query('ALTER TABLE Student ADD COLUMN IF NOT EXISTS room_preference INTEGER;');
  await db.query(`
    ALTER TABLE Student
    ALTER COLUMN room_preference TYPE INTEGER
    USING CASE
      WHEN lower(btrim(room_preference::text)) = 'single' THEN 1
      WHEN btrim(room_preference::text) ~ '^(1|2|3|4|6|8)$' THEN btrim(room_preference::text)::integer
      ELSE NULL
    END;
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_student_room_preference'
      ) THEN
        ALTER TABLE Student
          ADD CONSTRAINT check_student_room_preference
          CHECK (room_preference IN (1, 2, 3, 4, 6, 8));
      END IF;
    END;
    $$;
  `);

  // Ensure the default admin exists before assigning development passwords.
  await db.query("INSERT INTO Admin (username, password_hash, full_name, role, hostel_type) VALUES ('admin', 'admin123', 'System Administrator', 'SUPER_ADMIN', 'all') ON CONFLICT (username) DO UPDATE SET password_hash = 'admin123', role = 'SUPER_ADMIN', hostel_type = 'all';");
  const resetCounts = await resetPasswords(db);
  console.log(`Reset ${resetCounts.students} student password(s) and ${resetCounts.admins} admin password(s).`);

  const studentCols = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'student' ORDER BY ordinal_position;"
  );
  console.log('Student columns:', studentCols.rows.map(r => r.column_name));

  const adminUsers = await db.query('SELECT admin_id, username, role FROM Admin;');
  console.log('Admin users in DB:', adminUsers.rows);

  const studentUsers = await db.query('SELECT student_id, email, block_number FROM Student LIMIT 3;');
  console.log('Sample students in DB:', studentUsers.rows);

  await db.closePool();
}

run().catch((e) => {
  console.error('Error applying user schema:', e);
  process.exit(1);
});
