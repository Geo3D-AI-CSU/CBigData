const crypto = require('crypto');

const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keyLength: 64 });
const TOKEN_ISSUER = 'cbigdata-auth';
const TOKEN_AUDIENCE = 'cbigdata-web';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

function scryptAsync(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string' || !storedPassword.startsWith('scrypt$')) {
    const supplied = Buffer.from(String(password));
    const stored = Buffer.from(String(storedPassword || ''));
    return supplied.length === stored.length && crypto.timingSafeEqual(supplied, stored);
  }

  const parts = storedPassword.split('$');
  if (parts.length !== 6) return false;
  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (![N, r, p].every(Number.isSafeInteger) || N < 16384 || r < 1 || p < 1) return false;

  try {
    const salt = Buffer.from(rawSalt, 'base64url');
    const expected = Buffer.from(rawHash, 'base64url');
    const actual = await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(user, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub: String(user.id),
    username: user.username,
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
  });
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsedHeader.alg !== 'HS256' || parsedPayload.iss !== TOKEN_ISSUER) return null;
    if (parsedPayload.aud !== TOKEN_AUDIENCE || parsedPayload.exp <= nowSeconds) return null;
    if (!parsedPayload.sub || !parsedPayload.username) return null;
    return parsedPayload;
  } catch {
    return null;
  }
}

function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return '用户名和密码不能为空';
  }
  if (!/^[\p{L}\p{N}_.-]{3,50}$/u.test(username)) {
    return '用户名须为 3—50 个字母、数字、下划线、点或连字符';
  }
  if (password.length < 1 || password.length > 128) {
    return '密码不能为空且不能超过 128 个字符';
  }
  return null;
}

function validateRegistration(body) {
  const credentialsError = validateCredentials(body?.username, body?.password);
  if (credentialsError) return credentialsError;
  if (body.password.length < 10) return '密码长度须为 10—128 个字符';
  if (typeof body.email !== 'string' || body.email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return '请输入有效的电子邮箱';
  }
  if (typeof body.phone_number !== 'string' || !/^\d{10,15}$/.test(body.phone_number)) {
    return '手机号码须为 10—15 位数字';
  }
  return null;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  validateCredentials,
  validateRegistration,
};
