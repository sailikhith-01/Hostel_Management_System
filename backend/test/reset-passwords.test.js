const test = require('node:test');
const assert = require('node:assert/strict');
const { resetPasswords } = require('../reset-passwords');

function fakeDatabase({ failAdminUpdate = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      if (failAdminUpdate && sql.startsWith('UPDATE Admin')) {
        throw new Error('admin update failed');
      }
      if (sql.startsWith('UPDATE Student')) return { rowCount: 3 };
      if (sql.startsWith('UPDATE Admin')) return { rowCount: 2 };
      return { rowCount: null };
    },
    release() {
      calls.push({ sql: 'RELEASE' });
    },
  };
  return {
    calls,
    database: { pool: { connect: async () => client } },
  };
}

test('resetPasswords updates every student and admin in one transaction', async () => {
  const { calls, database } = fakeDatabase();
  const counts = await resetPasswords(database);

  assert.deepEqual(counts, { students: 3, admins: 2 });
  assert.deepEqual(calls, [
    { sql: 'BEGIN', parameters: undefined },
    { sql: 'UPDATE Student SET password_hash = $1', parameters: ['StudentPass123'] },
    { sql: 'UPDATE Admin SET password_hash = $1', parameters: ['admin123'] },
    { sql: 'COMMIT', parameters: undefined },
    { sql: 'RELEASE' },
  ]);
});

test('resetPasswords rolls back and releases the client on failure', async () => {
  const { calls, database } = fakeDatabase({ failAdminUpdate: true });
  await assert.rejects(resetPasswords(database), /admin update failed/);
  assert.equal(calls.some(({ sql }) => sql === 'ROLLBACK'), true);
  assert.equal(calls.at(-1).sql, 'RELEASE');
});
