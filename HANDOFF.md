# CBigData 项目交接文档

> **目标读者**: 完全没有上下文的新会话 / 新开发者
> **最后更新**: 2026-07-12
> **项目路径**: `e:\Resume\软件著作权\2025SR0987305\CBigData\`

---

## 1. 我们在做什么

为中南大学张课题组开发 **CBigData 碳汇/环境数据可视化平台**。核心功能：在 Cesium 地球引擎上以湖南省为空间范围，可视化 10 类环境数据图层（NDVI、GPP、NPP、土地利用、1月气温、7月气温、降水、人口、植被覆盖、GDP），支持 2000–2020 年时间轴切换。

**整体架构**:
```
前端 Vue (CesiumMap.vue, :8081)
  → 后端 Express dataservice.js (:3002)       ← 数据层（优先级链: GEE → Copernicus → Demo）
    → PostgreSQL (:5432)                       ← 用户系统（server.js :3000）
```

---

## 2. 项目文件结构

```
CBigData/
├── HANDOFF.md                          ← 你正在读的文件
├── backend/
│   ├── dataservice.js                  ★ 主数据服务 (端口 3002)，Provider 优先级链
│   ├── server.js                       独立用户系统 (端口 3000)，PostgreSQL 连接
│   ├── app.js                          未使用（Express 入口备选）
│   ├── providers.config.json           ★ 数据源配置 — 开关、代理、凭据路径
│   ├── .env.template                   环境变量模板
│   ├── .gitignore                      已排除 JSON 密钥 + .env
│   ├── package.json / package-lock.json
│   ├── cbigdata-gee-605ad04eea1d.json  GEE 服务账号密钥 (已在 .gitignore 中)
│   ├── providers/
│   │   ├── gee-provider.js              ★ GEE 数据源 — Node.js 端，通过 execFile 调 Python 桥
│   │   ├── gee-bridge.py                ★ GEE Python 桥 — 用 earthengine-api SDK 调用 computePixels
│   │   ├── copernicus-provider.js      占位 — 未配置凭据，始终返回 null 降级
│   │   └── demo-provider.js            模拟数据生成器 — 用数学函数生成湖南省栅格数据
│   └── routes/
│       └── oco2.js                      CO2 数据路由（未集成到主数据服务）
└── frontend/
    └── src/
        └── components/
            ├── CesiumMap.vue           ★ Cesium 地球主视图
            └── LayerConfig.js          图层配置（数据源、着色方案等）
```

---

## 3. 已完成的工作

### 3.1 后端数据服务 (`dataservice.js` :3002)

| 端点 | 功能 |
|------|------|
| `GET /api/health` | 健康检查，返回所有 Provider 状态 |
| `GET /api/datasets` | 列出 10 类可用数据集及其元数据 |
| `GET /api/providers` | 返回各 Provider 可用性状态 |
| `GET /api/data/:dataset/:year` | **核心 API** — 按优先级链获取 GeoJSON 栅格数据 |
| `GET /api/data/:dataset/:year/range` | 返回数据集值域范围（图例着色用） |

**Provider 优先级链**: `gee → copernicus → demo`（定义在 `providers.config.json` → `providers.priority`）

### 3.2 GEE 数据源 ✅ 已打通（关键成果）

**完整数据流**:
```
HTTP API (:3002)
  → gee-provider.js (Node.js)
    → execFile('python', 'gee-bridge.py')  ← 核心桥接
      → Python earthengine-api (ee.data.computePixels)
        → V2Ray HTTP 代理 (127.0.0.1:10809)
          → Google Earth Engine REST API
            → 真实 MODIS / ERA5 / WorldPop 数据
              → NUMPY_NDARRAY → GeoJSON FeatureCollection
```

**已验证的数据集**:
- ✅ NDVI (MOD13Q1.061) — 250,000 点，值范围 0.56–0.63
- ✅ GPP (MOD17A2H.061/006) — 82,503 点，值范围 1.32–1.45 gC/m²/yr（含版本自动切换）

**GEE 服务账号信息**:
- 账号: `cbigdata-fetcher@cbigdata-gee.iam.gserviceaccount.com`
- 项目: `cbigdata-gee`
- 密钥文件: `backend/cbigdata-gee-605ad04eea1d.json`（已在 .gitignore 中，切勿提交）
- IAM 角色: 已添加 `roles/serviceusage.serviceUsageConsumer`（否则 API 403）

### 3.3 Python EE 桥 (`gee-bridge.py`)
- 9 个数据集的 GEE 映射表 (`DATASET_MAP`)，含集合版本、波段、reducer、scale factor、偏移量
- 自动处理 MODIS 版本切换（如 MOD17A2H: 2021+ → v061, <2021 → v006）
- `NUMPY_NDARRAY` 格式 → 2D 结构化数组 → GeoJSON FeatureCollection 转换
- 通过 `HTTPS_PROXY` 环境变量走代理

### 3.4 V2Ray 代理配置
- 代理地址: `127.0.0.1:10809`（HTTP 协议）
- 原因: CSU 校园防火墙封锁 `oauth2.googleapis.com` 和 `earthengine.googleapis.com`
- 配置位置: `providers.config.json` → `network.proxy`

### 3.5 安全修复
- `.gitignore` 排除所有 JSON 密钥文件和 `.env`
- `dataservice.js` 错误响应使用通用消息（不暴露 `err.message`）

---

## 4. 未测试的数据集

以下数据集已在 Python 桥的 `DATASET_MAP` 和 Node.js 的 `GEE_DATASET_MAP` 中定义，但**未实际验证**能否从 GEE 正确获取：

| 数据集 | GEE 集合 | 波段 | 注意事项 |
|--------|----------|------|----------|
| NPP | MODIS/061/MOD17A3HGF | Npp | 年尺度数据，reducer=mean |
| 土地利用 (tudi) | MODIS/061/MCD12Q1 | LC_Type1 | reducer=mode，值为类别 1-17 |
| 1月气温 (temp1) | ECMWF/ERA5_LAND/MONTHLY_AGGR | temperature_2m | K→℃ 偏移 -273.15，month=1 |
| 7月气温 (temp7) | 同上 | temperature_2m | month=7 |
| 降水 (pre) | 同上 | total_precipitation_sum | m→mm ×1000 |
| 人口 (population) | WorldPop/GP/100m/pop | population | 100m 分辨率 |
| 植被覆盖 (zhibei) | MODIS/061/MOD44B | Percent_Tree_Cover | |

---

## 5. 待办事项 & 下一步

### 高优先级
- [ ] **测试剩余 7 个数据集** — 用 curl 逐个验证每个数据集至少返回一个年份的数据
- [ ] **清理 `gee-provider.js` 死代码** — 以下方法已被 Python 桥替代，不再被调用：
  - `_buildPixelExpression()` (L410-438)
  - `_buildImageExpression()` (L269-293)
  - `_buildGeometry()` (L444-455)
  - `_convertToGeoJSON()` (L460-532)
  - `_getAccessToken()` (L255-258)
  - 同步清理或同步 `GEE_DATASET_MAP`（Node.js 版本缺少 `collection_alt`、`version_year` 等字段）

### 中优先级
- [ ] **响应体积优化** — 全湖南省 NDVI 返回 250K 个 feature（~50MB GeoJSON），可能需要：
  - 降低默认网格密度（Python 桥中 max 500×500）
  - 改为 WMS/Tile 方式而非全量 FeatureCollection
  - 在后端添加简化/抽稀逻辑
- [ ] **Copernicus Provider** — 目前是纯占位，`isAvailable()` 始终返回 `false`

### 低优先级
- [ ] 前端 `CesiumMap.vue` 确认是否已接入新的 API 数据加载逻辑
- [ ] 考虑将 `server.js` (:3000) 用户系统与 `dataservice.js` (:3002) 数据服务合并
- [ ] `backend/routes/oco2.js` 未集成到主数据服务

---

## 6. 踩过的坑 ⚠️ 绝对不能重复

### 坑 #1: GEE REST API v1 的 Expression 必须是序列化的 protobuf
> **症状**: `400: Invalid value at 'expression' (type.googleapis.com/google.earthengine.v1.Expression)`
> **原因**: 直接把 EE JavaScript 代码字符串传给 REST API — API 需要的是序列化的计算图，不是源文本
> **解决**: 通过 Python `earthengine-api` SDK 的 `ee.data.computePixels()` 调用，SDK 自动处理序列化
> **教训**: **永远不要绕过 Python SDK 直接调 REST API**。Node.js 端必须通过 Python 桥

### 坑 #2: fileFormat "GEO_JSON" 在 v1 API 不存在
> **症状**: `Invalid value at 'file_format' (type.googleapis.com/google.earthengine.v1.ImageFileFormat), "GEO_JSON"`
> **原因**: GEO_JSON 是 v1beta 的格式，v1 只支持 NUMPY_NDARRAY
> **解决**: 使用 `NUMPY_NDARRAY` 格式，Python 端手动转换为 GeoJSON
> **教训**: GEE API 的 v1 和 v1beta 差异很大，文档需要仔细对照

### 坑 #3: google-auth-library v10 的 transporter 参数不兼容
> **症状**: `Cannot read properties of undefined (reading 'request')`
> **原因**: v10 使用 gaxios 内部传输层，`{transporter: {agent: proxyAgent}}` 的写法只对旧版有效
> **解决**: 在创建 JWT 客户端前设置 `https.globalAgent = proxyAgent`
> **教训**: google-auth-library v10 的代理配置方式与 v8/v9 不同，不能用 `transporter` 参数

### 坑 #4: MOD17A2H.061 从 2021 年才开始有数据
> **症状**: 请求 GPP 2018 返回 0 images → `Image.multiply: If one image has no bands, the other must also have no bands. Got 0 and 1`
> **原因**: MOD17A2H.061 数据从 2021-01-01 开始；2018 年数据在已弃用的 .006 版本中
> **解决**: Python 桥中添加 `collection_alt` + `version_year` 逻辑，<2021 自动切换到 MODIS/006/MOD17A2H
> **教训**: **每个 MODIS 数据集都必须检查时间覆盖范围**，不止 MOD17A2H

### 坑 #5: GCP IAM 缺少 Service Usage Consumer
> **症状**: `Caller does not have required permission`
> **原因**: 服务账号即使有 Earth Engine 读写权限，缺少 `roles/serviceusage.serviceUsageConsumer` 仍无法调 API
> **解决**: 在 GCP 控制台 IAM 页面手动添加角色
> **教训**: GEE 服务账号至少需要两个 IAM 角色：Earth Engine 相关 + Service Usage Consumer

### 坑 #6: 校园防火墙直连 OAuth2 超时
> **症状**: `oauth2.googleapis.com:443` 连接超时 (ETIMEDOUT)
> **原因**: CSU 校园防火墙封锁 Google OAuth2 服务
> **解决**: 通过 V2Ray SOCKS/HTTP 代理 (:10809) 隧道出站
> **教训**: **后端服务器必须走代理**才能连 Google 服务。Python 子进程也需要 `HTTPS_PROXY` 环境变量

---

## 7. 如何启动/验证

### 前置条件
1. **V2Ray 代理运行中**: `127.0.0.1:10809`（否则 GEE 不可用）
2. **Python 环境**: 已安装 `earthengine-api` 和 `numpy`
3. **Node.js**: `backend/` 已 `npm install`
4. **PostgreSQL**: 如果要用 `server.js` (:3000)，需要 PG 运行在 `localhost:5432`

### 启动数据服务
```bash
cd e:\Resume\软件著作权\2025SR0987305\CBigData\backend
node dataservice.js
# 输出应显示:
#   [dataservice] CBigData 数据服务已启动: http://localhost:3002
#   [GEE] 使用代理: http://127.0.0.1:10809
#   [GEE] 认证成功: cbigdata-fetcher@...
```

### 快速验证
```bash
# 测试健康检查
curl http://localhost:3002/api/health

# 测试 GEE NDVI (全湖南，250K 点)
curl "http://localhost:3002/api/data/ndvi/2018" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['features']))"

# 测试 GEE GPP (含版本切换)
curl "http://localhost:3002/api/data/gpp/2018" | python -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"features\"])} features, sample: {d[\"features\"][:3]}')"

# 测试小范围（更快）
curl "http://localhost:3002/api/data/ndvi/2019?minLon=112.8&maxLon=113.0&minLat=28.1&maxLat=28.3"
```

### 直接测试 Python 桥（跳过 Node.js）
```bash
cd backend
set HTTPS_PROXY=http://127.0.0.1:10809
python providers/gee-bridge.py ndvi 2018 112.8 28.1 113.0 28.3 --key cbigdata-gee-605ad04eea1d.json
```

### 关掉 GEE 用 Demo 验证降级链
编辑 `providers.config.json`，将 `providers.gee.enabled` 设为 `false`，重启服务。
Demo Provider 会用数学函数生成模拟数据。

---

## 8. 关键外部依赖

| 依赖 | 用途 | 状态 |
|------|------|------|
| V2Ray (:10809) | 代理隧道，绕过校园防火墙 | ⚠️ 必须保持运行 |
| GEE 服务账号密钥 | OAuth2 JWT 认证 | ✅ 已配置，勿提交 Git |
| Python `earthengine-api` | EE SDK 序列化 + computePixels | ✅ 已安装 |
| Google Earth Engine API | MODIS/ERA5/WorldPop 遥感数据 | ✅ 已可用 |
| PostgreSQL (:5432) | server.js 用户系统 | ⚠️ 仅 server.js 需要 |
| Copernicus CDS / Sentinel Hub | 备用遥感数据源 | ❌ 未配置凭据 |

---

## 9. 快速参考：数据集 ID 速查

| ID | 中文名 | 来源 | 单位 |
|----|--------|------|------|
| ndvi | 植被指数 NDVI | MODIS MOD13Q1 | dimensionless |
| gpp | 总初级生产力 GPP | MODIS MOD17A2H | gC/m²/yr |
| npp | 净初级生产力 NPP | MODIS MOD17A3HGF | gC/m²/yr |
| tudi | 土地利用 | MODIS MCD12Q1 | class (1-17) |
| temp1 | 1月均温 | ERA5-Land | ℃ |
| temp7 | 7月均温 | ERA5-Land | ℃ |
| pre | 年降水量 | ERA5-Land | mm |
| population | 人口密度 | WorldPop | people/km² |
| gdp | GDP | **仅 Demo 可用** | 亿元 |
| zhibei | 植被覆盖度 | MODIS MOD44B | % |
