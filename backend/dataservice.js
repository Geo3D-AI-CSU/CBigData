/**
 * CBigData 统一数据服务 (端口 3002)
 *
 * 为前端 Cesium 可视化提供环境数据 API。
 * 按优先级尝试数据源: GEE → Copernicus → Demo
 *
 * 端点:
 *   GET /api/data/:dataset/:year        — 获取栅格数据 (GeoJSON)
 *   GET /api/datasets                    — 列出可用数据集
 *   GET /api/providers                   — 列出数据源状态
 *   GET /api/health                      — 健康检查
 */

const express = require('express');
const cors = require('cors');
const config = require('./providers.config.json');

const geeProvider = require('./providers/gee-provider');
const copernicusProvider = require('./providers/copernicus-provider');
const demoProvider = require('./providers/demo-provider');

const app = express();
const PORT = config.server?.port || 3002;
const CORS_ORIGIN = config.server?.corsOrigin || 'http://localhost:8081';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Provider 优先级列表
const PROVIDERS = {
  gee: geeProvider,
  copernicus: copernicusProvider,
  demo: {
    name: 'demo',
    displayName: 'Demo模拟数据',
    async fetchRasterData(dataset, year, bbox) {
      return demoProvider.generateRasterGeoJSON(dataset, year, bbox);
    },
    async isAvailable() {
      return true;
    },
  },
};

const PRIORITY = config.providers?.priority || ['gee', 'copernicus', 'demo'];

/**
 * 按优先级获取数据
 */
async function fetchDataWithFallback(dataset, year, bbox) {
  for (const providerName of PRIORITY) {
    const provider = PROVIDERS[providerName];
    if (!provider) continue;

    try {
      const available = await provider.isAvailable();
      if (!available) {
        console.log(`[dataservice] ${providerName} not available, trying next...`);
        continue;
      }

      console.log(`[dataservice] Fetching ${dataset}/${year} from ${providerName}...`);
      const data = await provider.fetchRasterData(dataset, parseInt(year), bbox);

      if (data && data.features && data.features.length > 0) {
        console.log(`[dataservice] ✓ ${providerName} returned ${data.features.length} features`);
        data.metadata = data.metadata || {};
        data.metadata.provider = providerName;
        return data;
      }
    } catch (err) {
      console.warn(`[dataservice] ${providerName} failed: ${err.message}, falling back...`);
    }
  }

  throw new Error(`All providers failed for dataset=${dataset} year=${year}`);
}

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CBigData Data Service',
    version: '2.0.0',
    providers: PRIORITY.map((p) => ({
      name: p,
      available: PROVIDERS[p] ? true : false,
    })),
  });
});

/**
 * GET /api/datasets
 * 返回所有可用数据集及其元数据
 */
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = demoProvider.getAvailableDatasets();
    res.json({ success: true, datasets });
  } catch (err) {
    console.error(`[dataservice] GET /api/datasets error:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error while listing datasets' });
  }
});

/**
 * GET /api/providers
 * 返回数据源状态
 */
app.get('/api/providers', async (req, res) => {
  const statuses = {};
  for (const name of PRIORITY) {
    const provider = PROVIDERS[name];
    statuses[name] = {
      name,
      displayName: provider.displayName || name,
      available: provider.isAvailable ? await provider.isAvailable() : false,
    };
  }
  res.json({ success: true, providers: statuses, priority: PRIORITY });
});

/**
 * GET /api/data/:dataset/:year
 * 获取指定数据集和年份的栅格数据
 *
 * Query 参数:
 *   minLat, maxLat, minLon, maxLon — 边界框 (可选，默认湖南省)
 *   resolution — 栅格分辨率（度，默认 0.05）
 */
app.get('/api/data/:dataset/:year', async (req, res) => {
  try {
    const { dataset, year } = req.params;
    const yearNum = parseInt(year);

    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2020) {
      return res.status(400).json({
        success: false,
        error: 'Year must be between 2000 and 2020',
      });
    }

    const bbox = {
      minLat: parseFloat(req.query.minLat) || 24.6,
      maxLat: parseFloat(req.query.maxLat) || 30.1,
      minLon: parseFloat(req.query.minLon) || 108.8,
      maxLon: parseFloat(req.query.maxLon) || 114.3,
    };

    const data = await fetchDataWithFallback(dataset, yearNum, bbox);

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error(`[dataservice] GET /api/data error:`, err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching data',
    });
  }
});

/**
 * GET /api/data/:dataset/:year/range
 * 返回数据集的值域范围（用于图例着色）
 */
app.get('/api/data/:dataset/:year/range', (req, res) => {
  try {
    const { dataset, year } = req.params;
    const meta = demoProvider.DATASET_META[dataset];

    if (!meta) {
      return res.status(404).json({ success: false, error: `Unknown dataset: ${dataset}` });
    }

    res.json({
      success: true,
      dataset,
      year: parseInt(year),
      range: meta.range,
      unit: meta.unit,
      name: meta.name,
    });
  } catch (err) {
    console.error(`[dataservice] GET /api/data/range error:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error while fetching data range' });
  }
});

// 启动服务器
const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`[dataservice] CBigData 数据服务已启动: http://localhost:${PORT}`);
    console.log(`[dataservice] 数据源优先级: ${PRIORITY.join(' → ')}`);
    console.log(`[dataservice] CORS origin: ${CORS_ORIGIN}`);
    console.log(`[dataservice] 端点: /api/data/:dataset/:year | /api/datasets | /api/providers | /api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[dataservice] 端口 ${PORT} 已被占用`);
    } else {
      console.error('[dataservice] 启动错误:', err);
    }
    process.exit(1);
  });
};

startServer();

module.exports = app;
