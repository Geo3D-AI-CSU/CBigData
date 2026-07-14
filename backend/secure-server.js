const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const auth = require('./auth');

const port = Number.parseInt(process.env.AUTH_PORT, 10) || 3000;
const developmentSecret = 'cbigdata-development-only-token-secret-change-me';
const tokenSecret = process.env.AUTH_TOKEN_SECRET || developmentSecret;
if (process.env.NODE_ENV === 'production' && tokenSecret === developmentSecret) {
  throw new Error('生产环境必须设置 AUTH_TOKEN_SECRET');
}
if (process.env.NODE_ENV !== 'production' && tokenSecret === developmentSecret) {
  console.warn('[auth] 使用仅限本机开发的令牌密钥；部署前请设置 AUTH_TOKEN_SECRET');
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres', password: process.env.DB_PASSWORD || '123456',
  port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
});
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8081' }));
app.use(express.json({ limit: '16kb' }));

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attemptKey = req => `${req.ip}|${typeof req.body?.username === 'string' ? req.body.username.toLowerCase() : ''}`;
function rateLimit(req, res, next) {
  const key = attemptKey(req), now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(key, entry);
  }
  if (entry.count >= MAX_ATTEMPTS) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, message: '登录尝试过多，请稍后再试' });
  }
  return next();
}
function failed(req) { attempts.get(attemptKey(req)).count += 1; }
function requireAuth(req, res, next) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  const claims = match ? auth.verifyToken(match[1], tokenSecret) : null;
  if (!claims) return res.status(401).json({ success: false, message: '需要有效的登录凭据' });
  req.user = { id: Number(claims.sub), username: claims.username };
  return next();
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'CBigData Auth Service' });
  } catch (error) {
    console.error('[auth] 数据库健康检查失败:', error.message);
    res.status(503).json({ status: 'unavailable', service: 'CBigData Auth Service' });
  }
});
app.get('/api/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));

// 该兼容接口只返回已知业务表，绝不暴露 users 表或认证字段。
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND (table_name IN ('oco_data','gedi_data') OR table_name ~ '^oco2_[0-9]{6}$')
      ORDER BY table_name`);
    const data = {};
    for (const { table_name: name } of result.rows) {
      const identifier = `"${name.replace(/"/g, '""')}"`;
      data[name] = (await pool.query(`SELECT * FROM ${identifier} LIMIT 10000`)).rows;
    }
    res.json(data);
  } catch (error) {
    console.error('[auth] 业务数据读取失败:', error.message);
    res.status(500).json({ success: false, message: '数据读取失败' });
  }
});

app.post('/api/login', rateLimit, async (req, res) => {
  const { username, password } = req.body || {};
  const invalid = auth.validateCredentials(username, password);
  if (invalid) { failed(req); return res.status(400).json({ success: false, message: invalid }); }
  try {
    const user = (await pool.query('SELECT id,username,password FROM users WHERE username=$1 LIMIT 1', [username])).rows[0];
    if (!user || !(await auth.verifyPassword(password, user.password))) {
      failed(req);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    if (!user.password.startsWith('scrypt$')) {
      await pool.query('UPDATE users SET password=$1 WHERE id=$2', [await auth.hashPassword(password), user.id]);
    }
    attempts.delete(attemptKey(req));
    return res.json({ success: true, message: '登录成功', token: auth.signToken(user, tokenSecret),
      tokenType: 'Bearer', expiresIn: auth.TOKEN_TTL_SECONDS, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('[auth] 登录处理失败:', error.message);
    return res.status(500).json({ success: false, message: '服务器暂时不可用，请稍后再试' });
  }
});

app.post('/api/register', async (req, res) => {
  const body = req.body || {};
  const invalid = auth.validateRegistration(body);
  if (invalid) return res.status(400).json({ success: false, message: invalid });
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`registration:${username.toLowerCase()}:${email}`]);
    const duplicate = await client.query(
      'SELECT 1 FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2) LIMIT 1',
      [username, email]
    );
    if (duplicate.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: '用户名或邮箱已存在' });
    }
    const result = await client.query(`INSERT INTO users (username,password,email,phone_number,created_at)
      VALUES ($1,$2,$3,$4,NOW()) RETURNING id,username`,
      [username, await auth.hashPassword(body.password), email, body.phone_number]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: '注册成功，请登录', user: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ success: false, message: '用户名或邮箱已存在' });
    console.error('[auth] 注册处理失败:', error.message);
    return res.status(500).json({ success: false, message: '服务器暂时不可用，请稍后再试' });
  } finally { client.release(); }
});

let server;
async function ensureAuthSchema() {
  await pool.query('ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255)');
}
async function startServer() {
  await ensureAuthSchema();
  if (!server) server = app.listen(port, () => console.log(`[auth] CBigData 认证服务已启动: http://localhost:${port}`));
  return server;
}
module.exports = { app, pool, requireAuth, ensureAuthSchema, startServer };
