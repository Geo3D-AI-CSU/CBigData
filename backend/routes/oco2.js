const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// 创建PostgreSQL连接池
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT) || 5432,
});

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('数据库连接测试失败:', err);
  } else {
    console.log('数据库连接成功，当前时间:', res.rows[0].now);
    // 测试oco_data表是否存在
    pool.query('SELECT COUNT(*) FROM oco_data', (err, res) => {
      if (err) {
        console.error('oco_data表访问失败:', err);
      } else {
        console.log('oco_data表中的数据总数:', res.rows[0].count);
      }
    });
  }
});

// 获取OCO-2数据
router.get('/api/oco2-data', async (req, res) => {
  console.log('收到OCO-2数据请求，参数:', req.query);
  try {
    // 构建UNION ALL查询，合并所有表的数据并进行网格采样
    const tables = Array.from({ length: 16 }, (_, i) => i + 16)  // 生成16-31的数组
      .map(day => `oco2_2403${day}`);
    
    // 使用窗口函数按经纬度网格分组并取每组的平均值
    const query = `
      WITH grid_data AS (
        SELECT 
          ROUND(longitude::numeric / 1) * 1 as lon_grid,  -- 将经度分成20个区间（360/18=20）
          ROUND(latitude::numeric / 1) * 1 as lat_grid,   -- 将纬度分成10个区间（180/18=10）
          AVG(longitude) as longitude,
          AVG(latitude) as latitude,
          AVG(xco2) as xco2,
          MAX(time) as timestamp
        FROM (${tables.map(table => `SELECT longitude, latitude, xco2, time FROM ${table}`).join(' UNION ALL ')}) AS combined_data
        GROUP BY 
          ROUND(longitude::numeric / 1) * 1,
          ROUND(latitude::numeric / 1) * 1
      )
      SELECT 
        longitude,
        latitude,
        xco2,
        timestamp
      FROM grid_data
      WHERE longitude IS NOT NULL 
        AND latitude IS NOT NULL 
        AND xco2 IS NOT NULL
      ORDER BY longitude, latitude
    `;
    
    console.log('执行查询:', query);
    
    const result = await pool.query(query);
    console.log(`查询成功，返回 ${result.rows.length} 条数据`);
    
    if (result.rows.length === 0) {
      console.log('警告: 没有找到符合条件的数据');
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取OCO-2数据失败:', error);
    res.status(500).json({ 
      error: '获取OCO-2数据失败',
      details: error.message,
      query: req.query
    });
  }
});

// 获取OCO-2热力图数据
router.get('/api/oco2-heatmap', async (req, res) => {
  console.log('收到OCO-2热力图数据请求，参数:', req.query);
  try {
    const { startTime, endTime } = req.query;
    
    const query = `
      SELECT 
        longitude, 
        latitude, 
        AVG(xco2) as xco2
      FROM oco_data
      WHERE time BETWEEN $1 AND $2
      GROUP BY 
        ROUND(longitude::numeric, 2),
        ROUND(latitude::numeric, 2)
    `;
    
    console.log('执行查询:', query);
    console.log('查询参数:', [startTime, endTime]);
    
    const result = await pool.query(query, [startTime, endTime]);
    console.log(`查询成功，返回 ${result.rows.length} 条数据`);
    
    if (result.rows.length === 0) {
      console.log('警告: 没有找到符合条件的数据');
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取OCO-2热力图数据失败:', error);
    res.status(500).json({ 
      error: '获取OCO-2热力图数据失败',
      details: error.message,
      query: req.query
    });
  }
});

module.exports = router; 