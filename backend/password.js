const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

function verifyScrypt(password, storedHash) {
  const [algorithm, salt, expectedValue] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedValue) return false;
  try {
    const expected = Buffer.from(expectedValue, 'base64url');
    const saltBuffer = Buffer.from(salt, 'base64url');
    if (expected.length !== 64 || saltBuffer.length < 16) return false;
    const actual = crypto.scryptSync(password, saltBuffer, 64);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function verifyPassword(password, storedPassword) {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') return false;
  return password === storedPassword || verifyScrypt(password, storedPassword);
}

module.exports = { hashPassword, verifyPassword };
