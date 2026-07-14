const secureServer = require('./secure-server');
if (require.main === module) {
  secureServer.startServer().catch(error => {
    console.error('[auth] 服务启动失败:', error.message);
    process.exitCode = 1;
  });
}
module.exports = secureServer;

/* Legacy implementation retained temporarily for history; it is not executed.
const express = require('express'); // 引入 express 模块用于创建服务器
const cors = require('cors'); // 引入 cors 模块
const { Pool } = require('pg'); // 引入 pg 模块中的 Pool，用于连接和查询 PostgreSQL 数据库
const app = express(); // 创建 express 应用实例
const port = 3000; // 定义服务器运行的端口

// 配置 PostgreSQL 连接池
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT) || 5432,
});

// 使用 cors 中间件
app.use(cors({ origin: 'http://localhost:8081' }));

// 使用中间件来解析 JSON 数据
app.use(express.json());

// 获取数据库中所有表的数据
app.get('/api/data', async (req, res) => {
  try {
    // 获取数据库中所有表的名称
    const tablesResult = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );

    // 用于存储所有表数据的对象
    const allData = {};

    // 遍历每个表并查询其数据
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      try {
        const tableData = await pool.query(`SELECT * FROM ${tableName}`);
        allData[tableName] = tableData.rows; // 将查询结果添加到 allData 对象中
      } catch (err) {
        console.error(`Error querying table ${tableName}:`, err);
      }
    }

    // 将所有表的数据返回给客户端
    res.json(allData);
  } catch (err) {
    console.error('Error fetching table names:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


// 用户登录接口
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body; // 获取请求中的用户名和密码
  console.log('Received POST request to /api/login with:', req.body); // 添加日志以调试请求数据

  try {
    // 在数据库中查找匹配的用户名和密码
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const values = [username, password];
    const result = await pool.query(query, values);

    // 检查查询结果，如果找到匹配的用户
    if (result.rows.length > 0) {
      console.log('User found:', result.rows[0]); // 日志输出匹配的用户信息
      res.json({ success: true, message: '登录成功' });
    } else {
      console.log('No matching user found'); // 日志输出未找到匹配用户
      res.json({ success: false, message: '用户名或密码错误' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ success: false, message: '服务器错误，请稍后再试' });
  }
});

// 用户注册接口
app.post('/api/register', async (req, res) => {
  const { username, password, email, phone_number } = req.body; // 获取请求体中的数据

  try {
    // 检查用户名是否已经存在
    const userCheckQuery = 'SELECT * FROM users WHERE username = $1';
    const userCheckResult = await pool.query(userCheckQuery, [username]);

    if (userCheckResult.rows.length > 0) {
      return res.json({ success: false, message: '用户名已存在，请选择其他用户名' });
    }

    // 插入用户信息到数据库
    const insertQuery = `
      INSERT INTO users (username, password, email, phone_number, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    await pool.query(insertQuery, [username, password, email, phone_number]);

    res.json({ success: true, message: '注册成功' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ success: false, message: '服务器错误，请稍后再试' });
  }
});

// 启动服务器并监听指定的端口
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
*/
