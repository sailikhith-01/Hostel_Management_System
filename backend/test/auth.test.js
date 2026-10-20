const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../password');

test('hashPassword creates a standard scrypt hash with 16-byte salt and 64-byte key', () => {
  const hash = hashPassword('admin123');
  assert.ok(hash.startsWith('scrypt$'));
  const parts = hash.split('$');
  assert.equal(parts.length, 3);
  assert.equal(Buffer.from(parts[1], 'base64url').length, 16);
  assert.equal(Buffer.from(parts[2], 'base64url').length, 64);
});

test('verifyPassword verifies correct scrypt password and rejects incorrect password', () => {
  const hash = hashPassword('MySecretPassword123');
  assert.equal(verifyPassword('MySecretPassword123', hash), true);
  assert.equal(verifyPassword('WrongPassword', hash), false);
});

test('verifyPassword matches readable passwords exactly', () => {
  assert.equal(verifyPassword('StudentPass123', 'StudentPass123'), true);
  assert.equal(verifyPassword('admin123', 'admin123'), true);
  assert.equal(verifyPassword('admin123 ', 'admin123'), false);
  assert.equal(verifyPassword('admin123', 'different'), false);
});

test('verifyPassword does not accept a different password for a valid scrypt hash', () => {
  const hash = hashPassword('AdminSecure123!');
  assert.equal(verifyPassword('AdminSecure123!', hash), true);
  assert.equal(verifyPassword('admin123', hash), false);
});
