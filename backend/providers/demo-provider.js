/**
 * DemoProvider — 模拟环境数据生成器
 *
 * 使用数学函数（正弦波、高斯分布、噪声）为湖南省生成具有真实空间分布特征的
 * 模拟栅格数据。当 GEE/Copernicus API 凭据未配置时使用此 Provider。
 *
 * 空间范围: 湖南省 (25°N-30°N, 109°E-114°E)
 * 时间范围: 2000-2020
 * 栅格分辨率: 0.05° (约 5km)
 */

const DEFAULT_BBOX = {
  minLat: 25,
  maxLat: 30,
  minLon: 109,
  maxLon: 114,
};

const RESOLUTION = 0.05; // 栅格分辨率（度）

/**
 * 简单伪随机数生成器（确保同一年份/数据集结果一致）
 */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * 二维高斯函数
 */
function gaussian(x, y, cx, cy, sigmaX, sigmaY) {
  const dx = (x - cx) / sigmaX;
  const dy = (y - cy) / sigmaY;
  return Math.exp(-0.5 * (dx * dx + dy * dy));
}

/**
 * 生成湖南省 NDVI 模拟数据
 * 特征: 西部山区高植被(0.7-0.85)，中部丘陵中等(0.4-0.6)，东北部湖区(0.3-0.5)，
 *       长株潭城市群低值(0.2-0.4)，夏季高于冬季
 */
function generateNDVI(lat, lon, year) {
  const rand = seededRandom(year * 1000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));
  // 基础值 — 纬度梯度（南部略高）
  let value = 0.55 + (lat - 27.5) * 0.02;

  // 西部武陵山脉高值
  value += 0.15 * gaussian(lon, lat, 110.0, 29.0, 1.5, 0.8);
  value += 0.10 * gaussian(lon, lat, 109.8, 28.0, 1.2, 0.7);

  // 长株潭城市群低值
  value -= 0.20 * gaussian(lon, lat, 112.95, 28.1, 0.5, 0.5);
  value -= 0.10 * gaussian(lon, lat, 113.0, 27.85, 0.4, 0.4);

  // 洞庭湖区降低
  value -= 0.08 * gaussian(lon, lat, 112.5, 29.2, 0.8, 0.4);

  // 年变化趋势（模拟绿化增加）
  value += (year - 2000) * 0.002;

  // 随机噪声
  value += (rand() - 0.5) * 0.06;

  return clamp(value, 0, 1);
}

/**
 * 生成 GPP (总初级生产力) 模拟数据，单位 gC/m²/year
 */
function generateGPP(lat, lon, year) {
  const ndvi = generateNDVI(lat, lon, year);
  const rand = seededRandom(year * 2000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  // GPP 与 NDVI 强相关，基准值转换
  let value = ndvi * 2500; // 0 → 0, 1 → 2500

  // 南部略高（更温暖湿润）
  value += (lat - 27.5) * 80;

  // 年变化
  value += (year - 2000) * 5;

  // 噪声
  value += (rand() - 0.5) * 200;

  return clamp(value, 200, 3500);
}

/**
 * 生成 NPP (净初级生产力) 模拟数据，单位 gC/m²/year
 */
function generateNPP(lat, lon, year) {
  const gpp = generateGPP(lat, lon, year);
  const rand = seededRandom(year * 3000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  // NPP 约为 GPP 的 45-55%
  let value = gpp * (0.47 + (rand() - 0.5) * 0.1);

  return clamp(value, 50, 1800);
}

/**
 * 生成年降水量模拟数据，单位 mm
 */
function generatePrecipitation(lat, lon, year) {
  const rand = seededRandom(year * 4000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  // 基准值
  let value = 1400;

  // 南部和东部降水更多
  value += (lat - 27.5) * 60;
  value += (lon - 111.5) * 30;

  // 山区地形雨效应
  value += 300 * gaussian(lon, lat, 110.0, 28.5, 1.0, 0.6);
  value += 200 * gaussian(lon, lat, 113.5, 26.5, 0.8, 0.8);

  // 年变化
  value += (year - 2000) * 3;

  // 随机变化（年降水波动大）
  value += (rand() - 0.5) * 400;

  return clamp(value, 800, 2200);
}

/**
 * 生成 1 月平均气温模拟数据，单位 °C
 */
function generateTemp1(lat, lon, year) {
  const rand = seededRandom(year * 5000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  // 纬度梯度主导
  let value = 8 - (lat - 25) * 1.5;

  // 海拔效应（西部山区更冷）
  value -= 3 * gaussian(lon, lat, 110.0, 29.0, 1.5, 0.8);

  // 城市热岛
  value += 1.5 * gaussian(lon, lat, 112.95, 28.1, 0.3, 0.3);

  // 年变化（变暖趋势）
  value += (year - 2000) * 0.03;

  value += (rand() - 0.5) * 2;

  return clamp(value, -2, 12);
}

/**
 * 生成 7 月平均气温模拟数据，单位 °C
 */
function generateTemp7(lat, lon, year) {
  const rand = seededRandom(year * 6000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  let value = 29 - (lat - 25) * 0.8;

  // 西部山区凉爽
  value -= 4 * gaussian(lon, lat, 110.0, 29.0, 1.5, 0.8);

  // 城市热岛
  value += 2 * gaussian(lon, lat, 112.95, 28.1, 0.3, 0.3);

  // 年变化
  value += (year - 2000) * 0.04;

  value += (rand() - 0.5) * 3;

  return clamp(value, 18, 36);
}

/**
 * 生成人口密度模拟数据，单位 人/km²
 */
function generatePopulation(lat, lon, year) {
  const rand = seededRandom(year * 7000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  // 指数衰减背景
  let value = 200;

  // 长株潭核心
  value += 5000 * gaussian(lon, lat, 112.95, 28.18, 0.3, 0.3); // 长沙
  value += 1500 * gaussian(lon, lat, 113.08, 27.85, 0.2, 0.2); // 株洲
  value += 1200 * gaussian(lon, lat, 112.55, 27.85, 0.2, 0.2); // 湘潭

  // 其他城市
  value += 800 * gaussian(lon, lat, 113.0, 29.35, 0.15, 0.15);  // 岳阳
  value += 600 * gaussian(lon, lat, 111.5, 29.05, 0.15, 0.15);  // 常德
  value += 500 * gaussian(lon, lat, 111.7, 27.25, 0.15, 0.15);  // 邵阳
  value += 400 * gaussian(lon, lat, 112.15, 26.9, 0.15, 0.15);  // 衡阳
  value += 400 * gaussian(lon, lat, 113.55, 27.55, 0.15, 0.15); // 娄底
  value += 300 * gaussian(lon, lat, 110.0, 27.55, 0.15, 0.15);  // 怀化

  // 年增长
  value *= 1 + (year - 2000) * 0.012;

  value += (rand() - 0.5) * value * 0.1;

  return clamp(value, 10, 10000);
}

/**
 * 生成 GDP 模拟数据，单位 亿元/km²
 */
function generateGDP(lat, lon, year) {
  const rand = seededRandom(year * 8000 + Math.floor(lat * 100) * 10 + Math.floor(lon * 100));

  let value = 1;

  // 核心城市群
  value += 30 * gaussian(lon, lat, 112.95, 28.18, 0.3, 0.3);  // 长沙
  value += 10 * gaussian(lon, lat, 113.08, 27.85, 0.2, 0.2);   // 株洲
  value += 8 * gaussian(lon, lat, 112.55, 27.85, 0.2, 0.2);    // 湘潭

  // 年增长（GDP增长快）
  value *= 1 + (year - 2000) * 0.10;

  value += (rand() - 0.5) * value * 0.15;

  return clamp(value, 0.05, 100);
}

/**
 * 生成土地利用分类，返回值 1-8
 */
function generateLandUse(lat, lon) {
  const pop = generatePopulation(lat, lon, 2020);

  if (pop > 2000) return 6; // 人造地表
  if (pop > 500) return 1;  // 耕地

  // 根据位置与地形判定
  const mountainEffect =
    gaussian(lon, lat, 110.0, 29.0, 1.5, 0.8) +
    gaussian(lon, lat, 109.8, 28.0, 1.2, 0.7);

  if (mountainEffect > 0.3) return 2; // 森林
  if (mountainEffect > 0.1) return 3; // 草地

  // 水体（洞庭湖）
  const waterEffect = gaussian(lon, lat, 112.5, 29.2, 0.8, 0.4);
  if (waterEffect > 0.5) return 5; // 水体

  const wetlandEffect = gaussian(lon, lat, 112.6, 29.1, 0.6, 0.3);
  if (wetlandEffect > 0.3) return 4; // 湿地

  return 1; // 默认耕地
}

/**
 * 生成植被覆盖度，值域 0-100%
 */
function generateVegetationCover(lat, lon, year) {
  const ndvi = generateNDVI(lat, lon, year);
  return clamp(ndvi * 100, 0, 100);
}

// 数据集生成器映射
const GENERATORS = {
  ndvi: generateNDVI,
  gpp: generateGPP,
  npp: generateNPP,
  pre: generatePrecipitation,
  temp1: generateTemp1,
  temp7: generateTemp7,
  population: generatePopulation,
  gdp: generateGDP,
  tudi: generateLandUse,
  zhibei: generateVegetationCover,
};

// 数据集元数据
const DATASET_META = {
  ndvi: { name: 'NDVI 植被指数', unit: '', range: [0, 1] },
  gpp: { name: 'GPP 总初级生产力', unit: 'gC/m²/yr', range: [200, 3500] },
  npp: { name: 'NPP 净初级生产力', unit: 'gC/m²/yr', range: [50, 1800] },
  pre: { name: '年降水量', unit: 'mm', range: [800, 2200] },
  temp1: { name: '1月平均气温', unit: '°C', range: [-2, 12] },
  temp7: { name: '7月平均气温', unit: '°C', range: [18, 36] },
  population: { name: '人口密度', unit: '人/km²', range: [10, 10000] },
  gdp: { name: 'GDP密度', unit: '亿元/km²', range: [0.05, 100] },
  tudi: { name: '土地利用分类', unit: 'category', range: [1, 8] },
  zhibei: { name: '植被覆盖度', unit: '%', range: [0, 100] },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 生成栅格 GeoJSON FeatureCollection
 * @param {string} dataset - 数据集 ID
 * @param {number} year - 年份
 * @param {object} bbox - 边界框 { minLat, maxLat, minLon, maxLon }
 * @returns {object} GeoJSON FeatureCollection
 */
function generateRasterGeoJSON(dataset, year, bbox = DEFAULT_BBOX) {
  const generator = GENERATORS[dataset];
  if (!generator) {
    throw new Error(`Unknown dataset: ${dataset}. Available: ${Object.keys(GENERATORS).join(', ')}`);
  }

  const { minLat, maxLat, minLon, maxLon } = bbox;
  const features = [];
  let id = 0;

  for (let lat = minLat; lat <= maxLat; lat += RESOLUTION) {
    for (let lon = minLon; lon <= maxLon; lon += RESOLUTION) {
      const value = generator(lat, lon, year);
      const roundedValue = Math.round(value * 1000) / 1000;

      features.push({
        type: 'Feature',
        id: id++,
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: {
          value: roundedValue,
          year: year,
          dataset: dataset,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      dataset: dataset,
      datasetName: DATASET_META[dataset]?.name || dataset,
      unit: DATASET_META[dataset]?.unit || '',
      year: year,
      resolution: RESOLUTION,
      bbox: bbox,
      totalFeatures: features.length,
      provider: 'demo',
      range: DATASET_META[dataset]?.range || [0, 1],
    },
    features: features,
  };
}

/**
 * 获取可用的数据集列表
 */
function getAvailableDatasets() {
  return Object.keys(GENERATORS).map((key) => ({
    id: key,
    ...DATASET_META[key],
  }));
}

module.exports = {
  generateRasterGeoJSON,
  getAvailableDatasets,
  DEFAULT_BBOX,
  DATASET_META,
};
