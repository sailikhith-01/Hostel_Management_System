const db = require('./db');

const STUDENT_PASSWORD = 'StudentPass123';
const ADMIN_PASSWORD = 'admin123';

async function resetPasswords(database = db) {
  const client = await database.pool.connect();
  try {
    await client.query('BEGIN');
    const students = await client.query(
      'UPDATE Student SET password_hash = $1',
      [STUDENT_PASSWORD],
    );
    const admins = await client.query(
      'UPDATE Admin SET password_hash = $1',
      [ADMIN_PASSWORD],
    );
    await client.query('COMMIT');
    return { students: students.rowCount, admins: admins.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  resetPasswords()
    .then(({ students, admins }) => {
      console.log(`Reset ${students} student password(s) and ${admins} admin password(s).`);
      console.log('Development credentials: students use StudentPass123; admins use admin123.');
    })
    .catch((error) => {
      console.error('Could not reset account passwords:', error.message);
      process.exitCode = 1;
    })
    .finally(() => db.closePool());
}

module.exports = { resetPasswords };
