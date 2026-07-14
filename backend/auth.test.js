const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashPassword, verifyPassword, signToken, verifyToken,
  validateCredentials, validateRegistration,
} = require('./auth');

test('scrypt password hashes verify without storing plaintext', async () => {
  const hash = await hashPassword('SecurePass123!');
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes('SecurePass123!'), false);
  assert.equal(await verifyPassword('SecurePass123!', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('legacy plaintext comparison supports one-time migration', async () => {
  assert.equal(await verifyPassword('123456', '123456'), true);
  assert.equal(await verifyPassword('123457', '123456'), false);
});

test('signed tokens reject tampering and expiry', () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const token = signToken({ id: 7, username: 'tester' }, secret, 1000);
  assert.equal(verifyToken(token, secret, 1001).username, 'tester');
  assert.equal(verifyToken(`${token}x`, secret, 1001), null);
  assert.equal(verifyToken(token, secret, 1000 + 7201), null);
});

test('registration validation enforces strong bounded input', () => {
  assert.equal(validateCredentials('valid_user', 'x'), null);
  assert.match(validateRegistration({ username: 'ab', password: 'SecurePass123!', email: 'a@b.com', phone_number: '13800000000' }), /用户名/);
  assert.match(validateRegistration({ username: 'valid_user', password: 'short', email: 'a@b.com', phone_number: '13800000000' }), /密码/);
  assert.equal(validateRegistration({ username: 'valid_user', password: 'SecurePass123!', email: 'a@b.com', phone_number: '13800000000' }), null);
});
