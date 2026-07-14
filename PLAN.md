# CBigData 程序改进计划

## 一、计划目标

本计划基于对 CBigData 项目源码、服务配置和实际运行结果的检查制定，目标是优先修复影响核心功能的问题，再逐步提升安全性、可维护性、部署一致性、测试覆盖率和运行可观测性。

当前系统由 Vue 3 + Cesium 前端、认证服务、OCO-2 数据服务、环境数据服务、PostgreSQL/PostGIS 和 GeoServer 组成。前端、数据库、GeoServer 及三个 Node.js 后端均可启动；基础环境数据菜单、NDVI WMS 图层和 Demo Provider 查询已经验证可用。当前最明显的功能问题是从 NDVI 等基础图层切换到 OCO-2 模式时出现 Cesium `ImageryLayer RuntimeError`，并残留上一图层状态。

## 二、优先级概览

| 优先级 | 工作项 | 主要目标 |
|---|---|---|
| P0 | 修复地图图层切换 | 消除 OCO-2 切换错误和旧图层残留 |
| P0 | 加固认证安全 | 禁止明文密码、敏感日志和宽松输入 |
| P1 | 配置与密钥外置 | 清除源码中的密码、地址和环境耦合 |
| P1 | 统一后端启动与部署 | 保证所有后端在本机和 Docker 中行为一致 |
| P1 | 统一 OCO-2 数据模型 | 解决表名、接口和空数据处理不一致 |
| P2 | 拆分 CesiumMap 组件 | 降低核心组件复杂度和状态污染风险 |
| P2 | 建立自动化测试 | 覆盖 API、数据源降级和核心界面交互 |
| P2 | 完善错误反馈与监控 | 让用户和维护人员明确知道故障来源 |
| P3 | 优化构建与资源管理 | 缩短构建时间并减少冗余静态资源 |

## 三、分阶段实施计划

> 实施状态（2026-07-14）：P0“加固认证安全”已完成。已实现 scrypt 密码哈希、旧账号登录后升级、Bearer 令牌、受保护接口、登录限流、输入校验、并发注册查重和敏感日志清理，并通过单元测试、真实数据库集成测试及前端生产构建。

### 第一阶段：恢复核心功能稳定性

#### 1. 修复 Cesium 图层生命周期

主要涉及 `frontend/src/components/CesiumMap.vue` 和 `frontend/src/components/LayerConfig.js`。

- 建立统一的图层注册表，记录当前环境 WMS、GeoJSON、OCO-2、GEDI、卫星实体和行道树数据源。
- 在模式切换前执行统一清理，移除旧 `ImageryLayer`、`DataSource`、primitive、entity 和事件监听器。
- 禁止重复向 Cesium Viewer 添加同一个图层实例。
- 加载 WMS 前检查 URL、图层名称和 provider 是否有效，失败时保持当前稳定视图。
- 将“当前模式”“当前数据集”“当前时间”和“正在加载”设置为互斥状态，防止连续点击造成并发覆盖。
- OCO-2、GEDI 和基础环境数据切换失败时显示可理解的界面提示，而不是只向控制台输出错误。

验收标准：

- NDVI、OCO-2、GEDI 和卫星实体之间连续往返切换不少于 20 次，不出现 `ImageryLayer RuntimeError`。
- 切换后地图中不存在上一模式的残留图层、图例或时间控件。
- 重复点击同一菜单不会重复添加数据源。
- 接口失败时界面显示错误原因，并可继续切换到其他功能。

#### 2. 修复 OCO-2 数据访问一致性

主要涉及 `backend/app.js`、`backend/routes/oco2.js` 和数据库初始化脚本。

- 明确采用统一表、PostgreSQL 分区表或按日表中的一种存储方案。
- 取消在业务代码中固定拼接 `oco2_240316` 至 `oco2_240331` 表名的做法。
- 增加允许查询的日期范围和表名白名单，避免动态 SQL 风险。
- 统一 `/api/oco2-data` 与 `/api/oco2-heatmap` 的数据来源和字段定义。
- 对缺表、空数据、非法日期和数据库不可用分别返回明确的 HTTP 状态与错误码。
- 为常用的时间、经纬度和网格聚合字段建立索引。

验收标准：

- 点云和热力图接口使用同一套数据定义。
- 数据为空时返回 HTTP 200 和空数组及元数据，不抛出数据库异常。
- 非法查询返回 HTTP 400；数据库故障返回 HTTP 503。
- 接口文档中的表结构、参数和实际响应一致。

### 第二阶段：安全与配置治理

#### 3. 加固登录和注册服务

主要涉及 `backend/server.js` 和 `frontend/src/components/LoginPage.vue`。

- 使用 Argon2id 或 bcrypt 对密码进行带盐哈希，禁止存储和比较明文密码。
- 为现有用户设计一次性密码迁移策略。
- 登录成功后使用短期访问令牌或服务端会话，不再以用户名作为唯一登录状态。
- 对用户名、密码、邮箱和手机号码进行长度、格式和必填校验。
- 增加登录失败限流、统一错误提示和必要的审计日志。
- 删除登录请求体、密码和完整用户记录的控制台日志。
- 限制 `/api/data` 等数据库读取接口的访问权限和返回字段。
- 使用参数化查询并为注册过程增加用户名、邮箱唯一性处理。

验收标准：

- 数据库中不存在新增的明文密码。
- 日志中不出现密码、完整用户对象或令牌。
- 未认证用户不能访问受保护数据。
- 连续失败登录会受到限流，且不会泄露用户是否存在。

#### 4. 外置配置和密钥

主要涉及 `docker-compose.yml`、`backend/providers.config.json`、后端数据库连接和前端 API 配置。

- 将 PostgreSQL、GeoServer 和 GEE 凭据迁移到 `.env` 或部署环境的 Secret。
- 提供不包含真实凭据的 `.env.example`。
- 将前端的 3000、3001、3002 和 8080 地址改为环境变量或统一反向代理路径。
- 按开发、测试和生产环境分别设置 CORS 白名单。
- 启动时校验必要配置；生产环境检测到默认密码时拒绝启动。
- 确认 GEE 服务账户文件始终被 `.gitignore` 排除，并避免在 Docker 配置中引用不存在的文件名。

验收标准：

- 源码和受版本控制的配置中不包含真实密码或服务账户密钥。
- 修改环境变量即可切换 API、数据库和 GeoServer 地址，无需修改源码。
- 缺少必需配置时，服务给出明确提示并安全退出。

### 第三阶段：架构与部署一致性

#### 5. 统一后端服务边界和启动方式

当前项目包含认证服务 3000、OCO-2 服务 3001 和环境数据服务 3002，但 Docker 启动脚本只明确启动其中两个。

- 决定采用“单一 Express 网关”或“明确的三个独立服务”。
- 如果保留独立服务，为每个服务增加独立入口、健康检查、日志标识和 Docker service。
- 如果统一网关，将认证、OCO-2 和环境数据挂载到清晰的 `/api/auth`、`/api/oco2`、`/api/environment` 路径。
- 修正 `docker-compose.yml` 中 GEE 凭据文件名与实际配置不一致的问题。
- 增加统一的开发启动、停止和状态检查命令。
- 为 PostgreSQL、GeoServer 和后端增加可靠的依赖等待与健康检查。

验收标准：

- 一条命令可启动全部服务，一条命令可停止全部服务。
- 本机开发和 Docker 部署暴露相同的 API 行为。
- 任一子服务启动失败时，状态检查能明确指出失败组件。

#### 6. 拆分前端核心组件

将 `CesiumMap.vue` 逐步拆分为以下模块：

- `useCesiumViewer`：Viewer 创建、销毁和基础相机控制。
- `useLayerManager`：图层注册、互斥切换和资源释放。
- `useEnvironmentData`：环境数据、时间轴和图例。
- `useOco2`：OCO-2 点云、热力图和查询状态。
- `useGedi`：GEDI 数据加载和图例。
- `useStreetTrees`：行道树模型、搜索和属性面板。
- `useSatellites`：卫星实体与轨道动画。
- `services/api`：统一请求客户端、超时、取消和错误转换。

同时统一菜单配置和国际化文本，避免同一个功能名称分别硬编码在 JSON、Vue 模板和 JavaScript 中。

验收标准：

- `CesiumMap.vue` 主要负责页面组合，不再直接包含所有业务实现。
- 每个业务模块能够独立初始化、清理和测试。
- 页面卸载后不存在未释放的定时器、事件监听器和 Cesium 对象。

### 第四阶段：质量保障和可观测性

#### 7. 建立自动化测试体系

- 后端使用 Jest/Vitest + Supertest 测试认证、OCO-2 和环境数据接口。
- 为 GEE、GeoServer 和 Demo Provider 建立 mock，测试优先级与降级行为。
- 测试数据集、年份、月份和边界框的输入校验。
- 前端对图层管理 composable 和 API service 进行单元测试。
- 使用 Playwright 建立首页、登录页、地图加载、基础数据展开、NDVI 加载和 OCO-2 切换的端到端测试。
- 在持续集成中执行 lint、单元测试、生产构建和关键端到端测试。

建议最低覆盖目标：核心后端语句覆盖率 80%，核心图层管理模块分支覆盖率 75%。

#### 8. 完善错误处理、日志和监控

- 后端采用结构化日志，包含请求 ID、服务名、接口、耗时、Provider 和响应状态。
- 区分业务错误、外部数据源错误、数据库错误和程序错误。
- 记录 Provider 请求成功率、响应耗时、缓存命中率和降级次数。
- 前端集中处理网络超时、取消请求、空数据和后端错误码。
- 在界面中明确显示“GeoServer 缓存”“GEE 实时数据”或“Demo 模拟数据”，避免用户误判数据真实性。
- 为健康检查增加数据库、GeoServer 和 GEE 的细分状态，同时避免暴露敏感信息。

验收标准：

- 一次失败请求可以通过请求 ID 在前后端日志中完整追踪。
- 用户能够区分真实数据、缓存数据和模拟数据。
- 外部 Provider 不可用时，系统能够降级且给出明确提示。

### 第五阶段：性能和工程体验优化

#### 9. 优化前端构建与运行性能

- 配置 Vue 编译特性标志，消除 `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 警告。
- 检查并清理重复复制的 Cesium Widgets 静态资源。
- 对 Cesium、ECharts、Three.js 和非首页业务模块进行按需加载或代码分包。
- 为环境数据请求增加取消控制，快速切换年份时取消过期请求。
- 为 GeoJSON 大数据量渲染设置抽样、聚合或分块策略。
- 对 WMS 图层启用合理的浏览器与服务端缓存策略。
- 建立生产构建体积和首屏耗时基线。

验收标准：

- 生产构建无 Vue 特性标志警告。
- 首次进入地图和切换常用图层的耗时具有可重复的度量结果。
- 快速连续切换数据集不会产生过期响应覆盖当前状态的问题。

## 四、建议里程碑

| 里程碑 | 建议周期 | 交付结果 |
|---|---:|---|
| M1 核心稳定性 | 1 周 | 修复 OCO-2 切换、统一图层清理、规范空数据响应 |
| M2 安全整改 | 1 周 | 密码哈希、认证授权、配置与密钥外置 |
| M3 架构整理 | 1～2 周 | 后端启动一致、CesiumMap 初步拆分、统一 API 客户端 |
| M4 测试与监控 | 1～2 周 | API 测试、核心 E2E、结构化日志和数据源状态展示 |
| M5 性能优化 | 1 周 | 分包、资源清理、请求取消和性能基线 |

## 五、实施原则

- 每个阶段先补充能够复现问题的测试，再修改实现。
- 不在同一次提交中混合大规模重构与业务功能修改。
- 所有数据源都必须显式标注真实、缓存或模拟状态。
- 涉及数据库结构的修改必须提供迁移和回滚脚本。
- 涉及接口变更时，应同步更新 README、示例请求和前端调用。
- 每个里程碑结束后，在 Docker 和本机开发环境中各执行一次完整验收。

## 六、首批建议任务清单

1. 为 NDVI → OCO-2 切换编写可重复的端到端测试。
2. 在 `CesiumMap.vue` 中列出全部图层、数据源、primitive、entity 和事件监听器的创建及销毁位置。
3. 实现统一 `LayerManager`，首先迁移基础环境图层和 OCO-2 图层。
4. 统一 OCO-2 表结构并处理当前空数据场景。
5. 删除认证服务中的敏感日志，加入密码哈希和输入校验。
6. 建立 `.env.example`，迁移数据库、GeoServer 和 API 地址。
7. 修正 Docker 后端未覆盖 3001 服务和 GEE 凭据文件名不一致的问题。
8. 为 `/api/health`、`/api/datasets`、Provider 降级和 OCO-2 空数据补充集成测试。

---

## 七、OCO-2 / OCO-3 数据下载执行计划

> 状态（2026-07-14）：数据表已创建（oco2_240316 ~ oco2_240331 + oco_data），但所有表为空。需从 NASA GES DISC 下载真实 XCO₂ 全球数据。

### 7.1 数据源概述

支持两颗卫星的数据集：

| 卫星 | 数据集 ID | 版本 | 表名前缀 | 时间覆盖 |
| --- | --- | --- | --- | --- |
| OCO-2 | `OCO2_L2_Lite_FP` | 11.1r | `oco2` | 2019-11 ~ 2024-04 |
| OCO-3 | `OCO3_L2_Lite_FP` | 11.1r | `oco3` | 2019-08 ~ 2024-04 |

| 属性 | 说明 |
| --- | --- |
| 分发中心 | NASA GES DISC |
| 数据格式 | netCDF-4 (.nc4) |
| 空间覆盖 | **全球** (默认无过滤) |
| 空间分辨率 | 2.25 km × 1.29 km (足迹采样) |
| 时间分辨率 | 16天重访周期 |
| 关键变量 | longitude, latitude, xco2, time |
| 认证方式 | NASA Earthdata Login (免费注册) |

### 7.2 OCO-2 数据获取方式对比

| 方式 | 难度 | 适用场景 | 工具 |
| --- | --- | --- | --- |
| **A. earthaccess (推荐)** | ★☆☆ | Python 脚本自动化下载 | `pip install earthaccess` |
| B. 直接 HTTP 下载 | ★★☆ | 手动下载少量文件 | `wget` + `.netrc` |
| C. CMR API 查询 | ★★★ | 需要精确的 granule 检索 | NASA CMR REST API |
| D. OPeNDAP 远程子集 | ★★☆ | 无需下载完整文件即可按区域/变量提取 | Python `xarray` + OPeNDAP URL |
| E. XCODEX 专用工具 | ★★☆ | OCO-2 专用提取和结构化 | `pip install xcodex` |

#### 方式 A：earthaccess（推荐）

```python
import earthaccess
auth = earthaccess.login(strategy="interactive")
# 全球范围搜索 (不加 bounding_box 或使用全球范围)
results = earthaccess.search_data(
    short_name="OCO2_L2_Lite_FP",
    version="11.1r",
    temporal=("2024-03-16", "2024-03-31"),
    bounding_box=(-180, -90, 180, 90),  # 全球范围
)
files = earthaccess.download(results, "./data")
```

#### 方式 D：OPeNDAP（无需完整下载）

```python
import xarray as xr
url = "https://oco2.gesdisc.eosdis.nasa.gov/opendap/OCO2_L2_Lite_FP.11.1r/2024/075/oco2_LtCO2_240316_B11014Ar.nc4"
ds = xr.open_dataset(url, group="RetrievalResults")
# 全球数据；如需区域子集，使用 .sel() 按需筛选
```

### 7.3 执行步骤

#### 步骤 1：获取 NASA Earthdata 账号

1. 访问 <https://urs.earthdata.nasa.gov/> 注册免费账号
2. 在用户 Profile → Applications → Authorized Apps 中确认 "NASA GESDISC DATA ARCHIVE" 已授权
3. 创建 `~/.netrc` 文件：

   ```text
   machine urs.earthdata.nasa.gov login 你的用户名 password 你的密码
   ```

#### 步骤 2：安装 Python 依赖

```bash
pip install earthaccess psycopg2-binary netCDF4 xarray pandas
```

#### 步骤 3：运行下载脚本

脚本位置：`backend/scripts/download_oco2.py`

```bash
# 预览可用文件（不下载）
python backend/scripts/download_oco2.py --dry-run

# 下载全部 16 天 OCO-2 全球数据并入库 (默认)
python backend/scripts/download_oco2.py

# 下载 OCO-3 全球数据
python backend/scripts/download_oco2.py --satellite oco3

# 仅下载指定日期
python backend/scripts/download_oco2.py --days 16,17,18

# 按需限定空间范围 (可选，默认全球无过滤)
python backend/scripts/download_oco2.py --bbox 70 15 140 55   # 中国区域
python backend/scripts/download_oco2.py --bbox 109 24 115 31  # 湖南周边
```

#### 步骤 4：验证数据

```bash
PGPASSWORD=123456 psql -U postgres -h localhost -d postgres -c "
  SELECT 'oco2_240316' as tbl, COUNT(*) FROM oco2_240316
  UNION ALL SELECT 'oco2_240317', COUNT(*) FROM oco2_240317
  -- ...
  UNION ALL SELECT 'oco2_240331', COUNT(*) FROM oco2_240331
  UNION ALL SELECT 'oco_data', COUNT(*) FROM oco_data;
"
```

### 7.4 脚本工作流程

```text
┌──────────────────────────────────────────┐
│  ① NASA Earthdata 认证                    │
│     ~/.netrc 或 earthaccess.login()       │
├──────────────────────────────────────────┤
│  ② 搜索 granule (CMR API)                 │
│     按时间过滤 (默认全球，可加 --bbox)      │
├──────────────────────────────────────────┤
│  ③ 下载 netCDF-4 文件                     │
│     缓存至 backend/scripts/.oco2_cache/   │
├──────────────────────────────────────────┤
│  ④ 解析 netCDF (xarray)                   │
│     提取 longitude/latitude/xco2/time     │
├──────────────────────────────────────────┤
│  ⑤ 可选空间过滤 (--bbox)                  │
│     全球默认不过滤；传 --bbox 则按范围筛选   │
├──────────────────────────────────────────┤
│  ⑥ 按日期写入日表 + 汇总表                 │
│     TRUNCATE + INSERT 批量写入             │
├──────────────────────────────────────────┤
│  ⑦ 验证行数                               │
│     每张表输出记录数                        │
└──────────────────────────────────────────┘
```

### 7.5 注意事项

1. **认证**：Earthdata 需要用户名/密码或 Bearer Token。若长时间未登录，Token 会过期，需重新认证。
2. **文件大小**：每个 OCO-2 Lite granule 约 30–50 MB（压缩），16 天全球数据约有 200+ 个 granule，总下载量约 6–10 GB。
3. **存储压力**：全球范围数据量较大，建议 PostgreSQL 所在磁盘预留 20+ GB 空间。若磁盘紧张，可通过 `--bbox` 限定研究区域。
4. **网络**：GES DISC 服务器在美国，建议使用稳定的网络连接。若下载中断，可加 `--skip-download` 复用已缓存文件。
5. **Lite vs Standard**：Lite 文件已做偏差校正且体积更小（约 1/5），适合可视化。如需完整科学分析数据，应使用 Standard 产品 (`OCO2_L2_Standard`)。
6. **时间匹配**：OCO-2 轨道文件不严格按自然日切分。脚本通过文件名中的日期码 (`240316` 等) 匹配到对应日表；同时也会写入汇总表 (`oco_data` / `oco3_data`) 供热力图查询使用。
7. **OPeNDAP 备选**：若网络不稳定，可改用 OPeNDAP 远程子集方式（方式 D），避免下载完整文件。
8. **OCO-2 vs OCO-3**：OCO-3 搭载于国际空间站 (ISS)，轨道覆盖范围与 OCO-2 不同（ISS 轨道倾角约 51.6°）。OCO-2 是极轨卫星，覆盖全球。默认使用 OCO-2，可通过 `--satellite oco3` 切换。

### 7.6 验收标准

- [ ] `oco2_240316` ~ `oco2_240331` 共 16 张表，每张表至少包含 10,000 行全球 XCO₂ 数据
- [ ] `oco_data` 汇总表包含全部 16 天的汇总数据
- [ ] OCO-2 点云接口 `/api/oco2-data` 返回非空数组
- [ ] OCO-2 热力图接口 `/api/oco2-heatmap` 返回非空数组
- [ ] 前端 OCO-2 图层正常渲染全球点云，不再显示空数据状态
- [ ] 支持通过 `--satellite oco3` 下载 OCO-3 数据，写入 `oco3_*` 系列表
- [ ] SQL 注入防护保持有效（表名白名单校验）
