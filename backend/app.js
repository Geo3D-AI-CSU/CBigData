const express = require('express');
const cors = require('cors');
const oco2Routes = require('./routes/oco2');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// 使用OCO-2路由
app.use('/', oco2Routes);

// 添加错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误', details: err.message });
});

// 添加端口占用检查
const server = app.listen(port, () => {
  console.log(`服务器正在端口 ${port} 上运行`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，请尝试其他端口`);
  } else {
    console.error('服务器启动错误:', err);
  }
}); 