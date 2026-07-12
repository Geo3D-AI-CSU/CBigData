/**
 * GeeProvider — Google Earth Engine 数据提供者
 *
 * 通过 GEE REST API (High-Volume Compute) 获取遥感/环境数据。
 * 使用服务账号 JSON 密钥进行 OAuth2 认证。
 *
 * GEE 数据源对照:
 * - NDVI   → MODIS/061/MOD13Q1 (250m, 16-day, 年度均值)
 * - GPP    → MODIS/061/MOD17A2H (500m, 8-day, 年度累计)
 * - NPP    → MODIS/061/MOD17A3HGF (500m, annual)
 * - 土地利用 → MODIS/061/MCD12Q1 (500m, annual)
 * - 气温   → ECMWF/ERA5_LAND/HOURLY (9km, 年度均值)
 * - 降水   → ECMWF/ERA5_LAND/HOURLY (9km, 年度累计)
 * - 人口   → WorldPop/GP/100m/pop (100m)
 * - GDP    → 暂无 GEE 直接数据源，降级到 Demo
 *
 * 启用条件: providers.config.json 中 gee.enabled = true
 *           + 有效的服务账号 JSON 密钥
 *
 * 依赖: google-auth-library (OAuth2), node-fetch (HTTP)
 */

const path = require('path');
const fs = require('fs');
const { JWT } = require('google-auth-library');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const GeoServerCache = require('./geoserver-cache');

// 配置文件
const CONFIG_PATH = path.join(__dirname, '..', 'providers.config.json');

// GeoTIFF 缓存目录
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'geotiff');

// GEE Earth Engine REST API 基础 URL
const EE_API_BASE = 'https://earthengine.googleapis.com/v1';

// 湖南省边界 (用于 GEE 几何对象)
const HUNAN_GEOMETRY = {
  type: 'Polygon',
  coordinates: [[
    [108.8, 24.6], [114.3, 24.6], [114.3, 30.1], [108.8, 30.1], [108.8, 24.6],
  ]],
};

// 数据集 → GEE ImageCollection 映射
const GEE_DATASET_MAP = {
  ndvi: {
    collection: 'MODIS/061/MOD13Q1',
    band: 'NDVI',
    reducer: 'mean',
    scale: 250,
    range: [0, 1],
    unit: 'dimensionless',
  },
  gpp: {
    collection: 'MODIS/061/MOD17A2H',
    band: 'Gpp',
    reducer: 'sum',
    scale: 500,
    range: [0, 3000],
    unit: 'gC/m²/year',
  },
  npp: {
    collection: 'MODIS/061/MOD17A3HGF',
    band: 'Npp',
    reducer: 'mean',
    scale: 500,
    range: [0, 2000],
    unit: 'gC/m²/year',
  },
  tudi: {
    collection: 'MODIS/061/MCD12Q1',
    band: 'LC_Type1',
    reducer: 'mode',
    scale: 500,
    range: [1, 17],
    unit: 'class',
  },
  temp1: {
    collection: 'ECMWF/ERA5_LAND/MONTHLY_AGGR',
    band: 'temperature_2m',
    reducer: 'mean', // 1月均值
    scale: 11132,
    range: [-30, 40],
    unit: '℃',
  },
  temp7: {
    collection: 'ECMWF/ERA5_LAND/MONTHLY_AGGR',
    band: 'temperature_2m',
    reducer: 'mean', // 7月均值
    scale: 11132,
    range: [-10, 50],
    unit: '℃',
  },
  pre: {
    collection: 'ECMWF/ERA5_LAND/MONTHLY_AGGR',
    band: 'total_precipitation_sum',
    reducer: 'sum',
    scale: 11132,
    range: [0, 3000],
    unit: 'mm',
  },
  population: {
    collection: 'WorldPop/GP/100m/pop',
    band: 'population',
    reducer: 'mean',
    scale: 100,
    range: [0, 50000],
    unit: 'people/km²',
  },
  gdp: {
    // GDP 在 GEE 中无直接数据源，降级到 Demo
    collection: null,
    band: null,
    reducer: null,
    scale: null,
    range: [0, 100],
    unit: '100 million CNY',
  },
  zhibei: {
    collection: 'MODIS/061/MOD44B',
    band: 'Percent_Tree_Cover',
    reducer: 'mean',
    scale: 250,
    range: [0, 100],
    unit: '%',
  },
};

class GeeProvider {
  constructor() {
    this.name = 'gee';
    this.displayName = 'Google Earth Engine';
    this.authClient = null;
    this.enabled = false;
    this.initialized = false;
    this.initError = null;
    this.geoServerCache = null; // 延迟初始化（需要 config 加载完毕）

    this._loadConfig();
  }

  /**
   * 从 providers.config.json 加载配置
   */
  _loadConfig() {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);
      this.config = config;
      this.enabled = config.providers?.gee?.enabled === true;
      // 初始化 GeoServer 缓存管理器
      if (config.geoserver?.enabled) {
        this.geoServerCache = new GeoServerCache(config);
      }
    } catch (err) {
      console.warn('[GEE] 无法加载 providers.config.json:', err.message);
      this.enabled = false;
    }
  }

  /**
   * 获取代理 Agent（如果已配置）
   */
  _getProxyAgent() {
    const proxyConfig = this.config?.network?.proxy;
    if (!proxyConfig?.enabled) return null;

    const { host, port, protocol } = proxyConfig;
    const proxyUrl = `${protocol || 'http'}://${host}:${port}`;
    console.log(`[GEE] 使用代理: ${proxyUrl}`);
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * 初始化 GEE 认证 (使用服务账号 JWT)
   */
  async _initialize() {
    if (this.initialized) return;
    if (!this.enabled) throw new Error('GEE provider is disabled in config');

    const keyPath = this.config?.providers?.gee?.credentials?.serviceAccountKey;
    if (!keyPath) {
      throw new Error('No serviceAccountKey configured');
    }

    const fullPath = path.resolve(__dirname, '..', keyPath);

    try {
      // 读取服务账号密钥文件
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Service account key file not found: ${fullPath}`);
      }

      const keyData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

      // 设置代理（通过 Node.js globalAgent，兼容 google-auth-library v10 的 gaxios）
      const proxyAgent = this._getProxyAgent();
      if (proxyAgent) {
        const https = require('https');
        https.globalAgent = proxyAgent;
      }
      this.proxyAgent = proxyAgent;

      // 创建 JWT 客户端
      const jwtOptions = {
        email: keyData.client_email,
        key: keyData.private_key,
        scopes: ['https://www.googleapis.com/auth/earthengine'],
      };

      this.authClient = new JWT(jwtOptions);

      // 验证凭据
      const creds = await this.authClient.authorize();
      this.projectId = keyData.project_id;
      this.clientEmail = keyData.client_email;
      this.initialized = true;
      this.initError = null;

      console.log(`[GEE] 认证成功: ${keyData.client_email} → project=${keyData.project_id}`);
    } catch (err) {
      this.initError = err.message;
      this.initialized = false;
      throw new Error(`GEE authentication failed: ${err.message}`);
    }
  }

  /**
   * 检查 Provider 是否可用
   * 使用缓存避免重复超时等待
   */
  async isAvailable() {
    if (!this.enabled) return false;

    // 如果之前初始化失败过，在 5 分钟内不重试
    if (this.initError && this._lastInitAttempt) {
      const elapsed = Date.now() - this._lastInitAttempt;
      if (elapsed < 5 * 60 * 1000) {
        console.log(`[GEE] 跳过重试（上次失败于 ${Math.round(elapsed / 1000)}s 前: ${this.initError}）`);
        return false;
      }
    }

    this._lastInitAttempt = Date.now();

    try {
      if (!this.initialized) {
        await this._initialize();
      }
      return true;
    } catch (err) {
      console.warn(`[GEE] 不可用: ${err.message}`);
      this.initError = err.message;
      return false;
    }
  }

  /**
   * 获取 OAuth2 访问令牌
   */
  async _getAccessToken() {
    if (!this.authClient) await this._initialize();
    const creds = await this.authClient.authorize();
    return creds.access_token;
  }

  /**
   * 构建 GEE 栅格计算的表达式
   * 返回年度聚合后的 Image
   *
   * @param {object} dsMeta - GEE_DATASET_MAP 中的条目
   * @param {number} year - 年份
   * @returns {object} GEE Expression 对象
   */
  _buildImageExpression(dsMeta, year) {
    const { collection, band, reducer } = dsMeta;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 构建 GEE 表达式: 从 ImageCollection 按年份过滤、选择波段、reduce
    // 使用 Earth Engine REST API 的 value:compute 功能
    const expression = {
      expression: `
        (function() {
          var col = ee.ImageCollection('${collection}')
            .filterDate('${startDate}', '${endDate}')
            .select('${band}');

          // 特殊处理：某些数据集需要月份过滤
          ${dsMeta === GEE_DATASET_MAP.temp1 ? "col = col.filter(ee.Filter.calendarRange(1, 1, 'month'));" : ''}
          ${dsMeta === GEE_DATASET_MAP.temp7 ? "col = col.filter(ee.Filter.calendarRange(7, 7, 'month'));" : ''}

          var result = col.${reducer === 'mode' ? 'mode()' : `${reducer}()`};
          return result.clip(geometry);
        })()
      `,
    };

    return expression;
  }

  /**
   * 获取栅格数据 — 通过 Python EE SDK 桥接调用 computePixels
   *
   * @param {string} dataset - 数据集 ID
   * @param {number} year - 年份
   * @param {object} bbox - { minLat, maxLat, minLon, maxLon }
   * @returns {object|null} GeoJSON FeatureCollection 或 null (降级信号)
   */
  async fetchRasterData(dataset, year, bbox) {
    if (!this.enabled) {
      console.log(`[GEE] Provider disabled, returning null for fallback`);
      return null;
    }

    const dsMeta = GEE_DATASET_MAP[dataset];
    if (!dsMeta || !dsMeta.collection) {
      console.log(`[GEE] ${dataset} 在 GEE 中无对应数据源，降级`);
      return null;
    }

    try {
      if (!this.initialized) {
        await this._initialize();
      }

      const scriptPath = path.join(__dirname, 'gee-bridge.py');
      const keyPath = path.resolve(__dirname, '..', this.config?.providers?.gee?.credentials?.serviceAccountKey || '');

      console.log(`[GEE] 请求 ${dataset}/${year} (${dsMeta.collection}/${dsMeta.band}) via Python bridge...`);

      const result = await this._runPythonBridge(scriptPath, dataset, year, bbox, keyPath);

      if (!result || result.error) {
        throw new Error(result?.error || 'Python bridge returned empty result');
      }

      console.log(`[GEE] ✓ ${dataset}/${year} 返回 ${result.features?.length || 0} features`);

      // 异步缓存到 GeoServer（不阻塞当前响应）
      this._saveAndPublish(dataset, year, bbox).catch(err => {
        console.warn(`[GEE] 后台缓存 ${dataset}/${year} 失败: ${err.message}`);
      });

      return result;

    } catch (err) {
      console.warn(`[GEE] ${dataset}/${year} 获取失败: ${err.message}`);
      console.warn('[GEE] 降级到下一个数据源...');
      return null;
    }
  }

  /**
   * 检查数据集+年份是否已在 GeoServer 中缓存
   * @param {string} dataset
   * @param {number|string} year
   * @returns {Promise<boolean>}
   */
  async isCachedInGeoserver(dataset, year) {
    if (!this.geoServerCache) return false;
    try {
      return await this.geoServerCache.checkLayerExists(dataset, year);
    } catch {
      return false;
    }
  }

  /**
   * 获取 GeoServer WMS 图层名（如果已缓存）
   * @param {string} dataset
   * @param {number|string} year
   * @returns {string|null}
   */
  getWmsLayerNameIfCached(dataset, year) {
    if (!this.geoServerCache) return null;
    return this.geoServerCache.getWmsLayerName(dataset, year);
  }

  /**
   * 后台任务：从 GEE 获取 GeoTIFF 并发布到 GeoServer
   *
   * 此方法在 fetchRasterData 返回 GeoJSON 后异步调用，
   * 不阻塞用户响应。
   *
   * @param {string} dataset
   * @param {number} year
   * @param {object} bbox
   */
  async _saveAndPublish(dataset, year, bbox) {
    // 跳过无法缓存的 dataset
    const dsMeta = GEE_DATASET_MAP[dataset];
    if (!dsMeta || !dsMeta.collection) return;

    // GeoServer 缓存未启用
    if (!this.geoServerCache) {
      return;
    }

    // 检查 GeoServer 是否可达
    const gsAvailable = await this.geoServerCache.isAvailable();
    if (!gsAvailable) {
      console.log(`[GEE] GeoServer 不可达，跳过缓存`);
      return;
    }

    // 检查是否已有缓存
    const alreadyCached = await this.geoServerCache.checkLayerExists(dataset, year);
    if (alreadyCached) {
      console.log(`[GEE] ${dataset}/${year} 已缓存，跳过`);
      return;
    }

    if (!this.initialized) {
      try {
        await this._initialize();
      } catch (err) {
        console.warn(`[GEE] 缓存初始化认证失败: ${err.message}`);
        return;
      }
    }

    // 构建 GeoTIFF 输出路径
    const datasetDir = path.join(CACHE_DIR, dataset);
    if (!fs.existsSync(datasetDir)) {
      fs.mkdirSync(datasetDir, { recursive: true });
    }
    const tiffPath = path.join(datasetDir, `${dataset}_${year}.tif`);

    console.log(`[GEE] 后台缓存 ${dataset}/${year} → ${tiffPath}`);

    try {
      const scriptPath = path.join(__dirname, 'gee-bridge.py');
      const keyPath = path.resolve(
        __dirname, '..',
        this.config?.providers?.gee?.credentials?.serviceAccountKey || ''
      );

      // 调用 Python 桥输出 GeoTIFF
      const result = await this._runPythonBridge(
        scriptPath, dataset, year, bbox, keyPath, 'geotiff', tiffPath
      );

      if (!result || !result.success) {
        console.warn(`[GEE] GeoTIFF 生成失败: ${JSON.stringify(result)}`);
        return;
      }

      console.log(`[GEE] GeoTIFF 已保存: ${tiffPath} (${result.width}x${result.height})`);

      // 发布到 GeoServer
      const pubResult = await this.geoServerCache.publishGeoTIFF(tiffPath, dataset, year);
      console.log(`[GEE] ✓ ${dataset}/${year} 已缓存到 GeoServer: ${pubResult.layerName}`);

    } catch (err) {
      console.warn(`[GEE] 缓存 ${dataset}/${year} 失败: ${err.message}`);
    }
  }

  /**
   * 调用 Python 桥接脚本
   *
   * @param {string} scriptPath — gee-bridge.py 路径
   * @param {string} dataset
   * @param {number} year
   * @param {object} bbox
   * @param {string} keyPath — 服务账号密钥路径
   * @param {string} format — 'geojson' (默认) | 'geotiff'
   * @param {string} outputPath — GeoTIFF 输出路径 (format='geotiff' 时必需)
   */
  _runPythonBridge(scriptPath, dataset, year, bbox, keyPath, format = 'geojson', outputPath = null) {
    const { execFile } = require('child_process');

    const args = [
      scriptPath,
      dataset,
      String(year),
      String(bbox.minLon),
      String(bbox.minLat),
      String(bbox.maxLon),
      String(bbox.maxLat),
      '--key', keyPath,
      '--format', format,
    ];

    if (format === 'geotiff' && outputPath) {
      args.push('--output', outputPath);
    }

    const env = { ...process.env };
    // 传递代理配置给 Python 子进程
    if (this.proxyAgent) {
      const proxyConfig = this.config?.network?.proxy;
      if (proxyConfig?.enabled) {
        env.HTTPS_PROXY = `http://${proxyConfig.host}:${proxyConfig.port}`;
      }
    }

    // GeoTIFF 模式可能需要更长的超时（大文件上传）
    const timeout = format === 'geotiff' ? 300000 : 120000;
    const maxBuffer = format === 'geotiff' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

    return new Promise((resolve, reject) => {
      execFile('python', args, {
        env,
        timeout,
        maxBuffer,
      }, (error, stdout, stderr) => {
        if (stderr) {
          console.log(`[GEE-Python] ${stderr.trim()}`);
        }

        if (error) {
          // Try to parse JSON error from stdout anyway
          if (stdout) {
            try {
              const parsed = JSON.parse(stdout.trim());
              if (parsed.error) {
                reject(new Error(parsed.error));
                return;
              }
            } catch (_) { /* fall through */ }
          }
          reject(new Error(error.message || 'Python bridge failed'));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        } catch (parseErr) {
          reject(new Error(`Failed to parse bridge output: ${parseErr.message}`));
        }
      });
    });
  }

  /**
   * 构建 computePixels 的 Earth Engine 表达式
   */
  _buildPixelExpression(dsMeta, startDate, endDate) {
    const { collection, band, reducer } = dsMeta;

    let monthFilter = '';
    if (dsMeta === GEE_DATASET_MAP.temp1) {
      monthFilter = ".filter(ee.Filter.calendarRange(1, 1, 'month'))";
    } else if (dsMeta === GEE_DATASET_MAP.temp7) {
      monthFilter = ".filter(ee.Filter.calendarRange(7, 7, 'month'))";
    }

    let reduceOp = `${reducer}()`;
    if (reducer === 'mode') reduceOp = 'mode()';
    if (reducer === 'mean') reduceOp = 'mean()';

    return `
      var col = ee.ImageCollection('${collection}')
        .filterDate('${startDate}', '${endDate}')${monthFilter}
        .select('${band}');

      // 处理 scale factor (K → ℃)
      var result = col.${reduceOp};
      ${dsMeta === GEE_DATASET_MAP.temp1 || dsMeta === GEE_DATASET_MAP.temp7 ? 'result = result.subtract(273.15);' : ''}
      ${dsMeta === GEE_DATASET_MAP.ndvi ? 'result = result.multiply(0.0001);' : ''}
      ${dsMeta === GEE_DATASET_MAP.gpp ? 'result = result.multiply(0.0001);' : ''}
      ${dsMeta === GEE_DATASET_MAP.npp ? 'result = result.multiply(0.0001);' : ''}
      ${dsMeta === GEE_DATASET_MAP.pre ? 'result = result.multiply(1000);' : ''}

      return result;
    `;
  }

  /**
   * 构建 GEE Geometry 对象
   */
  _buildGeometry(bbox) {
    return {
      type: 'Polygon',
      coordinates: [[
        [bbox.minLon, bbox.minLat],
        [bbox.maxLon, bbox.minLat],
        [bbox.maxLon, bbox.maxLat],
        [bbox.minLon, bbox.maxLat],
        [bbox.minLon, bbox.minLat],
      ]],
    };
  }

  /**
   * 将 GEE computePixels 响应转换为 GeoJSON FeatureCollection
   */
  _convertToGeoJSON(geeResponse, dataset, year, dsMeta) {
    // GEE GEO_JSON 格式返回包含 features 的 GeoJSON
    // 或者包含 data 数组 (list of lists)
    if (geeResponse && geeResponse.features) {
      // 已经是 GeoJSON
      return {
        type: 'FeatureCollection',
        features: geeResponse.features.map((f) => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            value: f.properties?.[dsMeta.band] ?? f.properties?.value ?? 0,
            dataset,
            year,
            band: dsMeta.band,
          },
        })),
        metadata: {
          dataset,
          year,
          provider: 'gee',
          collection: dsMeta.collection,
          band: dsMeta.band,
          unit: dsMeta.unit,
          range: dsMeta.range,
        },
      };
    }

    // 如果是纯数据数组格式
    if (geeResponse && geeResponse.data && Array.isArray(geeResponse.data)) {
      const features = [];
      const data = geeResponse.data;
      for (let i = 0; i < data.length; i++) {
        if (Array.isArray(data[i])) {
          for (let j = 0; j < data[i].length; j++) {
            // 像素坐标转换为经纬度 (简化: 假设均匀网格)
            const lat = 24.6 + (data.length - 1 - i) * (5.5 / data.length);
            const lon = 108.8 + j * (5.5 / (data[i].length || 1));
            if (data[i][j] !== null && data[i][j] !== undefined) {
              features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lon, lat] },
                properties: {
                  value: data[i][j],
                  dataset,
                  year,
                  band: dsMeta.band,
                },
              });
            }
          }
        }
      }

      return {
        type: 'FeatureCollection',
        features,
        metadata: {
          dataset,
          year,
          provider: 'gee',
          collection: dsMeta.collection,
          band: dsMeta.band,
          unit: dsMeta.unit,
          range: dsMeta.range,
        },
      };
    }

    console.warn('[GEE] 无法解析的响应格式:', Object.keys(geeResponse || {}));
    return null;
  }
}

module.exports = new GeeProvider();
