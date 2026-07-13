# CBigData Backend — Node.js 数据服务 + 认证服务
#
# 构建: docker build -t cbigdata-backend -f backend/Dockerfile .
# 运行: 见 docker-compose.yml

FROM node:18-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY backend/ .
COPY docker/init-db.sql /docker-entrypoint-initdb.d/

RUN chmod +x start-services.sh

EXPOSE 3000 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3002/api/health || exit 1

CMD ["./start-services.sh"]
