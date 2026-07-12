# CBigData — 碳中和时空大数据平台

> 中南大学张课题组 · 湖南省碳汇与环境数据可视化系统

基于 **Cesium** 三维地球引擎，集成 **Google Earth Engine** 遥感数据源与 **GeoServer** 瓦片缓存，为湖南省 2000–2020 年提供 10 类环境数据的时空可视化分析。

---

## 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  前端  Vue 3 + Cesium (:8081)                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ CesiumMap   │  │ LayerConfig  │  │ 图例/时间轴/菜单 │  │
│  │ WMS + GeoJSON│  │ 色阶 + 数据源 │  │                │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────┘  │
│         │                │                                │
├─────────┼────────────────┼────────────────────────────────┤
│         ▼                ▼                                │
│  后端  Express (:3002) + Express (:3000)                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │  dataservice.js  数据服务 (Provider 优先级链)     │    │
│  │  GeoServer 缓存 → GEE → Copernicus → Demo        │    │
│  │  /api/data  /api/cache  /api/datasets  /api/health│    │
│  └──────┬───────────────────────────────────────────┘    │
│         │                                                 │
├─────────┼─────────────────────────────────────────────────┤
│         ▼                                                 │
│  数据层                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ GeoServer│  │  GEE Python  │  │  PostgreSQL        │   │
│  │ :8080    │  │  ee-bridge   │  │  :5432 (用户系统)  │   │
│  │ WMS 缓存 │  │  + V2Ray代理 │  │                    │   │
│  └──────────┘  └──────┬───────┘  └───────────────────┘   │
│                       │                                    │
│                       ▼ (V2Ray :10809)                    │
│               Google Earth Engine                         │
│               MODIS / ERA5 / WorldPop                     │
└──────────────────────────────────────────────────────────┘
```

---

## 功能特性

- **10 类环境数据图层**: NDVI、GPP、NPP、土地利用、1月/7月气温、降水、人口、GDP、植被覆盖
- **2000–2020 年时间轴**: 年份滑块 + 自动播放，逐帧切换栅格数据
- **三维地球可视化**: Cesium 地球引擎，相机飞行、缩放、旋转
- **多源数据优先级链**: GeoServer 缓存 → Google Earth Engine → Copernicus → Demo 模拟
- **智能缓存**: 首次从 GEE 获取数据后自动保存为 GeoTIFF 并发布到 GeoServer，后续请求秒开 WMS
- **OCO-2 卫星数据**: 大气 CO₂ 浓度三维点云与热力图
- **GEDI 激光雷达**: 森林冠层高度与碳储量
- **街道树查询**: 三维树木模型 + 属性面板
- **中英文双语**: Vue I18n 国际化

---

## 数据集一览

| ID | 名称 | GEE 数据源 | 分辨率 | 单位 |
|----|------|-----------|--------|------|
| `ndvi` | 植被指数 | MODIS MOD13Q1.061 | 250m | dimensionless |
| `gpp` | 总初级生产力 | MODIS MOD17A2H.061/006 | 500m | gC/m²/yr |
| `npp` | 净初级生产力 | MODIS MOD17A3HGF.061 | 500m | gC/m²/yr |
| `tudi` | 土地利用 | MODIS MCD12Q1.061 | 500m | 1–17 类别 |
| `temp1` | 1月均温 | ERA5-Land Monthly | 9km | ℃ |
| `temp7` | 7月均温 | ERA5-Land Monthly | 9km | ℃ |
| `pre` | 年降水量 | ERA5-Land Monthly | 9km | mm |
| `population` | 人口密度 | WorldPop/GP/100m | 100m | people/km² |
| `gdp` | GDP 密度 | 仅 Demo 模拟 | — | 亿元/km² |
| `zhibei` | 植被覆盖度 | MODIS MOD44B.061 | 250m | % |

---

## 技术栈

| 层 | 技术 |
|----|------|
| **前端** | Vue 3, CesiumJS 1.122, Element Plus, ECharts 5, Three.js, Vue Router, Axios |
| **后端** | Node.js, Express 4, google-auth-library v10, node-fetch, pg |
| **数据处理** | Python 3, earthengine-api, NumPy |
| **地图服务** | GeoServer 2.25 (Docker), WMS 1.3.0 |
| **数据库** | PostgreSQL + PostGIS |
| **代理** | V2Ray (绕过校园防火墙访问 GEE) |

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 用途 |
|------|------|------|
| Node.js | ≥ 18 | 前后端运行时 |
| Python | ≥ 3.9 | GEE SDK 桥接 |
| Docker Desktop | 最新 | GeoServer 容器 |
| V2Ray | — | 代理隧道（需配置为开机自启） |
| PostgreSQL | ≥ 14 | 用户系统（可选） |

### 1. 克隆并安装依赖

```bash
cd CBigData

# 后端
cd backend
npm install
pip install earthengine-api numpy

# 前端
cd ../frontend
npm install
```

### 2. 配置 GEE 服务账号

将 GEE 服务账号 JSON 密钥放置到 `backend/cbigdata-gee-605ad04eea1d.json`（此文件已在 `.gitignore` 中排除，不会入库）。

编辑 `backend/providers.config.json`:

```json
{
  "providers": {
    "gee": {
      "enabled": true,
      "credentials": {
        "serviceAccountKey": "cbigdata-gee-605ad04eea1d.json"
      }
    }
  },
  "network": {
    "proxy": {
      "enabled": true,
      "host": "127.0.0.1",
      "port": 10809
    }
  }
}
```

### 3. 启动 GeoServer（Docker）

```bash
# 启动 GeoServer 容器（后台运行）
docker compose up -d

# 首次初始化（创建工作区、验证服务）
bash scripts/geoserver-setup.sh
```

访问 `http://localhost:8080/geoserver` → admin / geoserver 登录管理面板。

### 4. 启动后端

```bash
cd backend

# 数据服务 (:3002) — 环境数据 API
node dataservice.js

# 用户系统 (:3000) — 认证 API（可选）
node server.js
```

### 5. 启动前端

```bash
cd frontend
npm run serve
```

访问 `http://localhost:8081` → 点击 "基础数据可视化" → 选择数据集 → 地图渲染。

---

## API 端点

### 数据服务 (`:3002`)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查，返回所有 Provider 状态 |
| `/api/datasets` | GET | 列出 10 类可用数据集及元数据 |
| `/api/providers` | GET | 各数据源可用性状态 |
| `/api/data/:dataset/:year` | GET | **核心** — 获取 GeoJSON 栅格数据 |
| `/api/data/:dataset/:year/range` | GET | 值域范围（图例着色用） |
| `/api/cache/:dataset/:year` | GET | 检查 GeoServer 缓存状态 |

**示例**:

```bash
# 获取 2018 年全湖南省 NDVI
curl "http://localhost:3002/api/data/ndvi/2018"

# 小范围区域查询（更快）
curl "http://localhost:3002/api/data/gpp/2019?minLon=112.8&maxLon=113.0&minLat=28.1&maxLat=28.3"

# 检查缓存
curl "http://localhost:3002/api/cache/ndvi/2018"
# → {"success":true,"exists":true,"wmsLayer":"hunan:NDVI_2018_color"}
```

### 用户系统 (`:3000`)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/login` | POST | 用户登录 |
| `/api/register` | POST | 用户注册 |
| `/api/data` | GET | 获取所有数据库表数据 |

---

## 数据流说明

### 缓存优先模式（默认）

```
用户选择数据集 + 年份
  │
  ├─ [1] 前端调 /api/cache/:dataset/:year
  │       └─ GeoServer 有缓存? ──YES─→ WMS 瓦片渲染 (高性能)
  │
  └─ [2] 无缓存 → /api/data/:dataset/:year
          ├─ GEE Python 桥 → GeoJSON 点渲染 (即时响应)
          └─ 后台异步: GEE → GeoTIFF → GeoServer 发布 → 下次秒开
```

### Provider 降级链

```
GeoServer (缓存) → GEE (实时) → Copernicus (未配置) → Demo (模拟)
```

---

## 项目结构

```
CBigData/
├── README.md                         ← 本文件
├── HANDOFF.md                        ← 开发者交接文档
├── docker-compose.yml                ★ GeoServer Docker 部署
├── scripts/
│   └── geoserver-setup.sh            GeoServer 初始化脚本
├── backend/
│   ├── dataservice.js                ★ 数据服务主入口 (:3002)
│   ├── server.js                     用户认证系统 (:3000)
│   ├── app.js                        OCO-2 数据 API
│   ├── providers.config.json         ★ 数据源/代理/缓存配置
│   ├── .env.template                 环境变量模板
│   ├── .gitignore
│   ├── providers/
│   │   ├── gee-provider.js           ★ GEE Node.js 桥
│   │   ├── gee-bridge.py             ★ GEE Python SDK 桥
│   │   ├── geoserver-cache.js        ★ GeoServer REST API 管理
│   │   ├── copernicus-provider.js    占位（未配置）
│   │   └── demo-provider.js          数学模拟数据
│   ├── routes/
│   │   └── oco2.js                   OCO-2 CO₂ 路由
│   └── cache/
│       └── geotiff/                  GeoTIFF 缓存目录
│
└── frontend/
    ├── package.json                  Vue 3 + Cesium 依赖
    ├── src/
    │   ├── main.js                   入口
    │   ├── App.vue
    │   ├── router/index.js           路由
    │   ├── i18n/index.js             中英文
    │   └── components/
    │       ├── CesiumMap.vue          ★ 主视图 — 地球引擎 + 数据加载
    │       ├── LayerConfig.js         ★ 数据源/WMS/色阶配置
    │       ├── SidebarMenu.vue        左侧功能菜单
    │       ├── BasicDataButton.vue    基础数据入口
    │       ├── SatelliteButton.vue    卫星可视化
    │       ├── GEDIButton.vue         GEDI 激光雷达
    │       ├── PointCloudButton.vue   OCO-2 点云
    │       ├── StreetTreeButton.vue   街道树查询
    │       ├── Legend.vue             CO₂ 图例
    │       ├── TudiLegend.vue         土地利用图例
    │       ├── ZhibeiLegend.vue       植被覆盖图例
    │       ├── LoginPage.vue          登录/注册
    │       ├── HomePage.vue           首页
    │       └── LocaleSwitcher.vue     语言切换
    └── public/
        └── Assets/                   纹理、模型、图例图片
```

---

## 开发注意事项

### ⚠️ 关键踩坑记录

1. **GEE REST API v1 不接受裸代码字符串** — 必须通过 Python `ee` SDK 序列化计算图为 protobuf，再调用 `ee.data.computePixels()`
2. **`fileFormat: "GEO_JSON"` 在 v1 不存在** — 用 `NUMPY_NDARRAY`（GeoJSON 模式）或 `GEO_TIFF`（缓存模式）
3. **google-auth-library v10 代理不兼容** — 不能用 `transporter: {agent}`，必须设 `https.globalAgent`
4. **MOD17A2H.061 从 2021 年开始** — 2018 年数据在已弃用的 .006 版本，需版本切换
5. **服务账号需要 `roles/serviceusage.serviceUsageConsumer`** — 否则 GEE API 返回 `Caller does not have required permission`
6. **校园防火墙封锁 Google OAuth2** — 后端和 Python 子进程必须走 V2Ray 代理 (`:10809`)

详见 [HANDOFF.md](./HANDOFF.md) §6 完整踩坑记录。

### 环境变量

Python 子进程需要 `HTTPS_PROXY` 指向 V2Ray 代理。`gee-provider.js` 的 `_runPythonBridge()` 已自动处理。

### GeoServer 样式

首次发布 GeoTIFF 时，`geoserver-cache.js` 会自动根据 `datasetColorMaps`（定义在 `LayerConfig.js`）生成 SLD 色阶样式并应用到图层。样式名格式: `{dataset}_colormap`。

---

## 许可证

内部科研项目，归属中南大学张课题组。
