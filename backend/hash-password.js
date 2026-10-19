const crypto = require('crypto');

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  console.error('Run this utility directly in an interactive terminal.');
  process.exit(1);
}

let password = '';
process.stdout.write('Password (input hidden): ');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (input) => {
  for (const character of input) {
    if (character === '\u0003') {
      process.stdout.write('\nCancelled.\n');
      process.exit(1);
    }
    if (character === '\r' || character === '\n') {
      if (password.length < 12) {
        process.stdout.write('\nUse a password with at least 12 characters: ');
        password = '';
        continue;
      }
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(password, salt, 64);
      password = '';
      process.stdout.write(`\nscrypt$${salt.toString('base64url')}$${key.toString('base64url')}\n`);
      process.exit(0);
    }
    if (character === '\u007f' || character === '\b') {
      password = password.slice(0, -1);
    } else if (character >= ' ') {
      password += character;
    }
  }
});
