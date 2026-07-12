/**
 * CopernicusProvider — 哥白尼计划数据提供者
 *
 * 通过 Copernicus CDS API / Sentinel Hub API 获取环境数据。
 * 当前为占位实现（API 凭据待配置），自动降级到 DemoProvider。
 *
 * Copernicus 数据源对照:
 * - NDVI       → Sentinel-2 L2A (10m) 或 PROBA-V
 * - 土地利用     → CLMS CORINE Land Cover (100m) 或 CGLS-LC100
 * - 植被覆盖     → CLMS FCOVER (Fraction of green Vegetation Cover)
 * - GPP/NPP    → CLMS Dry Matter Productivity
 * - 气温/降水    → C3S ERA5 (0.25°)
 * - CO2 浓度    → CAMS Global GHG reanalysis
 *
 * 启用条件: 在 providers.config.json 中设置 copernicus.enabled = true
 *           并填写 CDS API URL + key 或 Sentinel Hub credentials
 */

const config = require('../providers.config.json');

class CopernicusProvider {
  constructor() {
    this.enabled = config.copernicus?.enabled || false;
    this.name = 'copernicus';
    this.displayName = 'Copernicus Programme';
  }

  /**
   * 检查 Provider 是否可用
   */
  async isAvailable() {
    if (!this.enabled) return false;
    // TODO: 验证 CDS API key
    return false;
  }

  /**
   * 获取栅格数据
   * @param {string} dataset - 数据集 ID
   * @param {number} year - 年份
   * @param {object} bbox - 边界框
   * @returns {object|null} GeoJSON FeatureCollection 或 null (降级信号)
   */
  async fetchRasterData(dataset, year, bbox) {
    if (!this.enabled) return null;

    // TODO: 实现 Copernicus 数据获取
    // Sentinel Hub OGC WMS/WFS:
    //   https://services.sentinel-hub.com/ogc/wms/<instance-id>
    // CDS API (ERA5):
    //   https://cds.climate.copernicus.eu/api
    // CAMS:
    //   https://ads.atmosphere.copernicus.eu/api

    console.log(`[Copernicus] ${dataset} ${year} — provider disabled, returning null for fallback`);
    return null;
  }
}

module.exports = new CopernicusProvider();
