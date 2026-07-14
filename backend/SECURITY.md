# CBigData 认证安全说明

## 已实施措施

- 新用户密码使用 Node.js `crypto.scrypt` 加随机盐保存，不存储明文密码。
- 历史明文账号在首次成功登录后自动升级为 scrypt 哈希。
- 登录成功签发 HS256 Bearer 令牌，默认有效期为 2 小时。
- `/api/me` 和 `/api/data` 要求有效令牌；`/api/data` 不再返回 `users` 表。
- 同一 IP 与用户名在 15 分钟内最多允许 5 次失败登录，第 6 次返回 HTTP 429。
- 注册请求校验用户名、密码、邮箱和手机号码，并在数据库事务中防止并发重复注册。
- 认证日志不记录密码、令牌、请求体或完整用户对象。

## 部署要求

生产环境必须设置高熵 `AUTH_TOKEN_SECRET`。建议由密码管理器生成至少 32 字节的随机值，禁止提交到 Git。认证服务在 `NODE_ENV=production` 且未提供该变量时会拒绝启动。

```text
AUTH_TOKEN_SECRET=<高熵随机值>
AUTH_PORT=3000
CORS_ORIGIN=https://实际前端域名
```

数据库连接使用 `DB_USER`、`DB_PASSWORD`、`DB_HOST`、`DB_PORT` 和 `DB_NAME`。项目当前仍保留本机开发默认值，生产环境必须全部显式配置。

## 测试

```bash
cd backend
npm test
npm run test:integration
```

集成测试要求 PostgreSQL 和认证服务已启动。测试会创建随机临时用户，并在结束时自动删除。

## 历史数据说明

现有数据库中可能存在重复邮箱，因此运行时迁移不会强制创建邮箱唯一索引，以免擅自删除或修改历史用户。新注册使用事务级咨询锁并同时检查用户名和邮箱，可防止新增重复记录。完成历史账号清理后，可再由数据库迁移建立 `LOWER(email)` 唯一索引。
