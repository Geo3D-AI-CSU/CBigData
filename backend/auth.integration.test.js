const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

const baseUrl = process.env.AUTH_BASE_URL || 'http://localhost:3000';
const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres', password: process.env.DB_PASSWORD || '123456',
  port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
}

test('registration, hashing, token authorization and rate limiting', async () => {
  const username = `node_sec_${Date.now()}`;
  const email = `${username}@example.test`;
  try {
    const unauthorized = await request('/api/data');
    assert.equal(unauthorized.status, 401);

    const registration = await request('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password: 'SecurePass123!', email, phone_number: '13800000000' }),
    });
    assert.equal(registration.status, 201);

    const stored = await pool.query('SELECT password FROM users WHERE username = $1', [username]);
    assert.equal(stored.rowCount, 1);
    assert.match(stored.rows[0].password, /^scrypt\$/);
    assert.equal(stored.rows[0].password.includes('SecurePass123!'), false);

    const login = await request('/api/login', {
      method: 'POST', body: JSON.stringify({ username, password: 'SecurePass123!' }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(loginBody.tokenType, 'Bearer');

    const me = await request('/api/me', { headers: { authorization: `Bearer ${loginBody.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.username, username);

    const protectedData = await request('/api/data', { headers: { authorization: `Bearer ${loginBody.token}` } });
    assert.equal(protectedData.status, 200);

    const rateLimitUsername = `missing_${Date.now()}`;
    const statuses = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await request('/api/login', {
        method: 'POST', body: JSON.stringify({ username: rateLimitUsername, password: 'WrongPassword123!' }),
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
  } finally {
    await pool.query("DELETE FROM users WHERE username = $1 OR username LIKE 'codex_sec_%'", [username]);
    await pool.end();
  }
});
