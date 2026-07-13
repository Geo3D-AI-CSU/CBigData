#!/bin/sh
# CBigData Backend — 启动所有服务
# 在 Docker 容器中同时运行认证服务 (3000) 和数据服务 (3002)

set -e

echo "=== CBigData Backend Services ==="
echo "Waiting for PostgreSQL..."
# 等待数据库就绪
for i in $(seq 1 30); do
  if pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "  ...waiting ($i/30)"
  sleep 2
done

echo "Starting auth service on :3000..."
node /app/server.js &
AUTH_PID=$!

echo "Starting data service on :3002..."
node /app/dataservice.js &
DATA_PID=$!

echo "Both services running."
echo "  Auth API:   http://0.0.0.0:3000"
echo "  Data API:   http://0.0.0.0:3002"

# 等待任意子进程退出
wait -n $AUTH_PID $DATA_PID
