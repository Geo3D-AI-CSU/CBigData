import * as Cesium from "cesium";

// 基础 URL 配置
const geoserverUrl = 'http://localhost:8080/geoserver/wms';
const workspace = 'hunan';
const workspace2 = 'hunangis';

// 懒加载 WMS Provider 缓存
const _layerCache = {};

/**
 * 根据 dataset + key 获取或创建 WMS imagery provider
 * key 格式: "2018" (年度) 或 "2018_06" (月度)
 */
function _getOrCreateProvider(dataset, key) {
  if (!_layerCache[dataset]) _layerCache[dataset] = {};
  if (!_layerCache[dataset][key]) {
    const upper = dataset.toUpperCase();
    const layerName = `${workspace}:${upper}_${key}_color`;
    _layerCache[dataset][key] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: layerName,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false,
    });
  }
  return _layerCache[dataset][key];
}

/** 向后兼容: 保持 timeSeriesLayers[dataset][year] 访问模式，改为懒加载 */
export const timeSeriesLayers = new Proxy({}, {
  get(_target, dataset) {
    if (typeof dataset === 'symbol') return undefined;
    if (!_layerCache[dataset]) _layerCache[dataset] = {};
    return new Proxy(_layerCache[dataset], {
      get(_inner, key) {
        if (typeof key === 'symbol') return undefined;
        return _getOrCreateProvider(dataset, String(key));
      },
    });
  },
});

// 时间序列数据配置
export const timeSeriesConfig = {
  gpp: {
    name: 'GPP',
    startYear: 2000,
    endYear: 2020,
    unit: 'gC/m²/year',
    layerPrefix: 'gpp_'
  },
  npp: {
    name: 'NPP',
    startYear: 2000,
    endYear: 2020,
    unit: 'gC/m²/year',
    layerPrefix: 'npp_'
  },
  ndvi: {
    name: 'NDVI',
    startYear: 2000,
    endYear: 2020,
    unit: '',
    layerPrefix: 'ndvi_'
  },
  pre: {
    name: '降水量',
    startYear: 2000,
    endYear: 2020,
    unit: 'mm',
    layerPrefix: 'pre_'
  },
  temp: {
    name: '月平均气温',
    startYear: 2000,
    endYear: 2020,
    unit: '℃',
    layerPrefix: 'temp_'
  },
  // 添加人口密度配置
  population: {
    name: '人口密度',
    startYear: 2000,
    endYear: 2020,
    unit: '人/km²',
    layerPrefix: 'population_'
  },
  // 添加GDP配置
  gdp: {
    name: 'GDP',
    startYear: 2000,
    endYear: 2020,
    unit: '亿元',
    layerPrefix: 'gdp_'
  }
};

// 保持原有的图层配置不变
export const hunan_boundary = new Cesium.WebMapServiceImageryProvider({
  url: geoserverUrl,
  layers: `test:hunan_boundary`,
  parameters: {
    format: 'image/png',
    transparent: true,
  },
  enablePickFeatures: false
});

export const gpp_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:GPP_2000',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

export const npp_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:NPP_2000_color',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

export const ndvi_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:NDVI_2000_color',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

export const pre_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:pre_2000_color',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

export const temp_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:temp_2000_color',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

// GEDI图层
export const gedi_layer = new Cesium.WebMapServiceImageryProvider({
  url: 'http://localhost:8080/geoserver/hunan/wms',
  layers: 'hunan:merged_gedi',
  parameters: {
    service: 'WMS',
    format: 'image/png',
    transparent: true
  }
});

// 土地利用图层
export const tudi_layer = new Cesium.WebMapServiceImageryProvider({
  url: 'http://localhost:8080/geoserver/hunangis/wms',
  layers: 'hunangis:tudi_color',
  parameters: {
    service: 'WMS',
    format: 'image/png',
    transparent: true
  }
});

// 植被覆盖图层
export const zhibei_layer = new Cesium.WebMapServiceImageryProvider({
  url: 'http://localhost:8080/geoserver/hunangis/wms',
  layers: 'hunangis:zhibei_color',
  parameters: {
    service: 'WMS',
    format: 'image/png',
    transparent: true
  }
});

// OCO-2数据配置
export const oco2Config = {
  heatmap: {
    name: 'OCO-2 热力图',
    unit: 'ppm',
    description: 'OCO-2卫星观测的大气CO2浓度热力图'
  },
  pointcloud: {
    name: 'OCO-2 点云',
    unit: 'ppm',
    description: 'OCO-2卫星观测的大气CO2浓度点云图'
  }
};

// 创建OCO-2点云数据源
export const createOCO2PointCloudDataSource = async (viewer) => {
  const dataSource = new Cesium.CustomDataSource('OCO2-Points');
  
  try {
    const response = await fetch('/api/oco2-data');  // 这里需要创建对应的后端API
    const data = await response.json();
    
    data.forEach(point => {
      const entity = dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude),
        point: {
          pixelSize: 3,
          color: getColorFromXCO2(point.xco2),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: {
          xco2: point.xco2,
          timestamp: point.timestamp
        }
      });
    });
    
    return dataSource;
  } catch (error) {
    console.error('Failed to load OCO-2 data:', error);
    return null;
  }
};

// 辅助函数：根据XCO2值获取颜色
function getColorFromXCO2(xco2) {
  // XCO2范围通常在380-420 ppm之间
  const min = 380;
  const max = 420;
  const normalized = (xco2 - min) / (max - min);
  
  // 使用从蓝色到红色的渐变
  return Cesium.Color.fromHsl(
    (1.0 - normalized) * 0.7,  // 色相：从蓝色到红色
    1.0,                       // 饱和度
    0.5                        // 亮度
  );
}

/** 支持月度变化的数据集 (其他数据集即使按月请求也降级为年聚合) */
export const MONTHLY_DATASETS = new Set(['ndvi', 'gpp', 'pre', 'temp']);

/** 构建月度 key: "2018_06" */
export function formatMonthKey(year, month) {
  return `${year}_${String(month).padStart(2, '0')}`;
}

/**
 * 获取指定 year+month 对应的 WMS layer provider (懒加载)
 * @param {string} dataType — 数据集 ID
 * @param {string} key — "2018" (年度) 或 "2018_06" (月度)
 */
export function getMonthLayer(dataType, key) {
  return _getOrCreateProvider(dataType, key);
}

// 辅助函数：获取指定年份的图层
export const getYearLayer = (dataType, year) => {
  return _getOrCreateProvider(dataType, String(year));
};

// 辅助函数：检查数据类型是否支持时间序列
export const hasTimeSeriesData = (dataType) => {
  return ['gpp', 'npp', 'ndvi', 'pre', 'temp', 'population', 'gdp'].includes(dataType);
};

// ============================================================
// 新版 API 数据源配置 (GEE / Copernicus / Demo)
// 替代 GeoServer WMS，优先从数据服务 :3002 获取数据
// ============================================================

/** 数据服务地址 */
export const API_DATA_URL = 'http://localhost:3002';

/** 各数据集的数据源优先级 (优先 GeoServer 缓存, 降级 API → WMS) */
export const DATA_SOURCE_MODE = 'cache-first'; // 'cache-first' | 'api-first' | 'wms-only'

/** 各数据集的色阶配置 (用于将数值映射到颜色) */
export const datasetColorMaps = {
  ndvi: {
    stops: [
      { value: 0.0, color: [139, 69, 19, 200] },    // 裸地 — 棕色
      { value: 0.2, color: [255, 235, 190, 200] },   // 稀疏 — 浅黄
      { value: 0.4, color: [170, 220, 120, 200] },   // 中等 — 浅绿
      { value: 0.6, color: [50, 180, 50, 200] },     // 较高 — 绿色
      { value: 0.8, color: [0, 120, 0, 200] },       // 高 — 深绿
      { value: 1.0, color: [0, 60, 0, 220] },        // 极高 — 墨绿
    ],
  },
  gpp: {
    stops: [
      { value: 200, color: [255, 245, 200, 200] },
      { value: 800, color: [180, 220, 100, 200] },
      { value: 1500, color: [50, 180, 60, 200] },
      { value: 2200, color: [0, 130, 30, 210] },
      { value: 3500, color: [0, 70, 0, 220] },
    ],
  },
  npp: {
    stops: [
      { value: 50, color: [240, 230, 180, 200] },
      { value: 400, color: [150, 200, 100, 200] },
      { value: 800, color: [40, 160, 50, 210] },
      { value: 1200, color: [0, 110, 20, 215] },
      { value: 1800, color: [0, 60, 0, 225] },
    ],
  },
  pre: {
    stops: [
      { value: 800, color: [255, 200, 150, 200] },
      { value: 1100, color: [200, 220, 240, 200] },
      { value: 1400, color: [100, 180, 255, 200] },
      { value: 1700, color: [30, 120, 240, 210] },
      { value: 2200, color: [10, 50, 180, 220] },
    ],
  },
  temp: {
    stops: [
      { value: -20, color: [180, 200, 255, 200] },
      { value: 0, color: [140, 180, 250, 200] },
      { value: 10, color: [255, 250, 160, 200] },
      { value: 20, color: [255, 200, 80, 200] },
      { value: 30, color: [255, 100, 30, 210] },
      { value: 40, color: [255, 30, 10, 220] },
    ],
  },
  population: {
    stops: [
      { value: 10, color: [240, 245, 200, 180] },
      { value: 200, color: [255, 230, 150, 200] },
      { value: 500, color: [255, 180, 80, 210] },
      { value: 1500, color: [240, 100, 50, 215] },
      { value: 10000, color: [180, 20, 20, 225] },
    ],
  },
  gdp: {
    stops: [
      { value: 0.05, color: [240, 245, 200, 180] },
      { value: 1, color: [255, 230, 120, 200] },
      { value: 5, color: [255, 170, 60, 210] },
      { value: 20, color: [240, 80, 30, 215] },
      { value: 100, color: [160, 15, 15, 225] },
    ],
  },
  tudi: {
    stops: [
      { value: 1, color: [255, 192, 203, 220], label: '耕地' },   // 粉色
      { value: 2, color: [128, 0, 128, 220],   label: '森林' },   // 紫色
      { value: 3, color: [0, 0, 255, 220],     label: '草地' },   // 蓝色
      { value: 4, color: [255, 0, 0, 220],     label: '湿地' },   // 红色
      { value: 5, color: [0, 255, 255, 220],   label: '水体' },   // 青色
      { value: 6, color: [210, 180, 140, 220], label: '人造地表' }, // 棕褐色
      { value: 7, color: [144, 238, 144, 220], label: '裸地' },   // 浅绿
      { value: 8, color: [128, 128, 128, 220], label: '其他' },   // 灰色
    ],
  },
  zhibei: {
    stops: [
      { value: 0, color: [255, 235, 180, 200] },
      { value: 25, color: [200, 220, 120, 210] },
      { value: 50, color: [100, 190, 60, 215] },
      { value: 75, color: [30, 140, 30, 220] },
      { value: 100, color: [0, 80, 0, 225] },
    ],
  },
};

/**
 * 根据数据值和色阶配置计算 RGBA 颜色
 * @param {number} value — 数据值
 * @param {Array} stops — 色阶停止点 [{value, color: [r,g,b,a]}]
 * @returns {string} 'rgba(r, g, b, a)'
 */
export function getColorForValue(value, stops) {
  if (!stops || stops.length === 0) return 'rgba(128,128,128,200)';
  if (stops.length === 1) {
    const c = stops[0].color;
    return `rgba(${c[0]},${c[1]},${c[2]},${c[3] || 200})`;
  }

  // 低于最小停止点
  if (value <= stops[0].value) {
    const c = stops[0].color;
    return `rgba(${c[0]},${c[1]},${c[2]},${c[3] || 200})`;
  }

  // 高于最大停止点
  const last = stops[stops.length - 1];
  if (value >= last.value) {
    return `rgba(${last.color[0]},${last.color[1]},${last.color[2]},${last.color[3] || 200})`;
  }

  // 线性插值
  for (let i = 0; i < stops.length - 1; i++) {
    const lower = stops[i];
    const upper = stops[i + 1];
    if (value >= lower.value && value <= upper.value) {
      const t = (value - lower.value) / (upper.value - lower.value);
      const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * t);
      const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * t);
      const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * t);
      const a = Math.round((lower.color[3] || 200) + ((upper.color[3] || 200) - (lower.color[3] || 200)) * t);
      return `rgba(${r},${g},${b},${a})`;
    }
  }

  return 'rgba(128,128,128,200)';
}

/**
 * 构建 API 数据 URL
 * @param {string} dataset — 数据集 ID
 * @param {number} year — 年份
 * @param {number|null} month — 可选月份 (1-12)
 * @returns {string}
 */
export function getApiDataUrl(dataset, year, month = null) {
  if (month != null) {
    const mm = String(month).padStart(2, '0');
    return `${API_DATA_URL}/api/data/${dataset}/${year}/${mm}`;
  }
  return `${API_DATA_URL}/api/data/${dataset}/${year}`;
}

/**
 * 构建缓存检查 API URL
 * @param {string} dataset — 数据集 ID
 * @param {number} year — 年份
 * @param {number|null} month — 可选月份 (1-12)
 * @returns {string}
 */
export function getCacheCheckUrl(dataset, year, month = null) {
  if (month != null) {
    const mm = String(month).padStart(2, '0');
    return `${API_DATA_URL}/api/cache/${dataset}/${year}/${mm}`;
  }
  return `${API_DATA_URL}/api/cache/${dataset}/${year}`;
}

/**
 * 获取数据集的色阶
 * @param {string} dataset
 * @returns {Array|null}
 */
export function getColorStops(dataset) {
  return datasetColorMaps[dataset]?.stops || null;
}
