/**
 * GeoServerCache — GeoServer REST API 缓存管理器
 *
 * 管理 GeoTIFF 栅格数据在 GeoServer 中的发布、检查和样式配置。
 * 通过 GeoServer REST API 交互，自动创建 coverage store、发布 coverage、
 * 设置图层样式。
 *
 * 依赖:
 *   - GeoServer 运行在 config.geoserver.baseUrl
 *   - node-fetch (HTTP 请求)
 *
 * 使用方式:
 *   const cache = new GeoServerCache(config);
 *   const exists = await cache.checkLayerExists('ndvi', 2018);
 *   if (!exists) {
 *     await cache.publishGeoTIFF('/path/to/ndvi_2018.tif', 'ndvi', 2018);
 *   }
 *   const wmsLayer = cache.getWmsLayerName('ndvi', 2018);
 *   // → 'hunan:NDVI_2018_color'
 */

const path = require('path');
const fs = require('fs');

// GeoServer REST API 基路径
const REST_PATH = '/rest';

class GeoServerCache {
  /**
   * @param {object} config — providers.config.json 完整配置对象
   */
  constructor(config) {
    const gs = config?.geoserver || {};
    this.baseUrl = (gs.baseUrl || 'http://localhost:8080/geoserver').replace(/\/+$/, '');
    this.username = gs.username || 'admin';
    this.password = gs.password || 'geoserver';
    if (!gs.username || !gs.password) {
      console.warn('[GeoServer] 使用默认凭据 admin/geoserver，生产环境请通过 config.geoserver 配置');
    }
    this.workspace = gs.workspace || 'hunan';
    if (!gs.workspace) {
      console.warn('[GeoServer] 使用默认工作区 hunan，可通过 config.geoserver.workspace 配置');
    }
    this.enabled = gs.enabled !== false; // 默认启用
    this._workspaceEnsured = false;
  }

  /**
   * 生成 Basic Auth 头
   */
  _authHeader() {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * 通用 REST API 请求
   * @param {string} method — HTTP 方法
   * @param {string} apiPath — API 路径 (如 /workspaces/hunan/coveragestores.json)
   * @param {string|Buffer|null} body — 请求体
   * @param {string} contentType — Content-Type 头
   */
  async _request(method, apiPath, body = null, contentType = null) {
    const url = `${this.baseUrl}${REST_PATH}${apiPath}`;
    const headers = {
      Authorization: this._authHeader(),
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    } else if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions = { method, headers };
    if (body) {
      fetchOptions.body = typeof body === 'object' && !Buffer.isBuffer(body)
        ? JSON.stringify(body)
        : body;
    }

    // 动态导入 node-fetch (兼容 ESM/CJS)
    const fetch = require('node-fetch');
    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // 404 是正常的"不存在"信号，不打印警告
      if (res.status !== 404) {
        console.warn(`[GeoServer] ${method} ${apiPath} → ${res.status}: ${text.substring(0, 200)}`);
      }
    }

    return res;
  }

  /**
   * 确保工作区存在
   */
  async ensureWorkspace() {
    if (this._workspaceEnsured) return;

    const check = await this._request('GET', `/workspaces/${this.workspace}.json`);
    if (check.ok) {
      this._workspaceEnsured = true;
      return;
    }

    console.log(`[GeoServer] 创建工作区: ${this.workspace}`);
    const create = await this._request('POST', '/workspaces', {
      workspace: { name: this.workspace },
    });

    if (create.ok || create.status === 409) {
      // 409 = already exists (race condition)
      this._workspaceEnsured = true;
      console.log(`[GeoServer] 工作区 ${this.workspace} 就绪`);
    } else {
      const text = await create.text().catch(() => '');
      throw new Error(`Failed to create workspace ${this.workspace}: ${create.status} ${text}`);
    }
  }

  /**
   * 检查 GeoServer 是否可连接
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (!this.enabled) return false;
    try {
      const res = await this._request('GET', '/about/version.json');
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取数据集+年份(+月份)对应的 WMS 图层名
   *
   * 命名约定:
   *   年度: {workspace}:{DATASET}_{YEAR}_color        例: hunan:NDVI_2018_color
   *   月度: {workspace}:{DATASET}_{YEAR}_{MONTH}_color 例: hunan:NDVI_2018_06_color
   *
   * @param {string} dataset — 数据集 ID (ndvi, gpp, npp, ...)
   * @param {number|string} year — 年份
   * @param {number|null} month — 可选月份 (1-12)
   * @returns {string} WMS 图层名
   */
  getWmsLayerName(dataset, year, month = null) {
    const upper = dataset.toUpperCase();
    // tudi 和 zhibei 是静态图层，不带年份
    if (dataset === 'tudi' || dataset === 'zhibei') {
      return `${this.workspace}:${upper}_color`;
    }
    if (month != null) {
      const mm = String(month).padStart(2, '0');
      return `${this.workspace}:${upper}_${year}_${mm}_color`;
    }
    return `${this.workspace}:${upper}_${year}_color`;
  }

  /**
   * 获取数据集的 coverage store 名称
   * @param {string} dataset
   * @param {number|string} year
   * @param {number|null} month
   * @returns {string}
   */
  _getStoreName(dataset, year, month = null) {
    // 用 getWmsLayerName 去掉 workspace 前缀
    return this.getWmsLayerName(dataset, year, month).replace(`${this.workspace}:`, '');
  }

  /**
   * 检查图层是否已在 GeoServer 中发布
   *
   * @param {string} dataset — 数据集 ID
   * @param {number|string} year — 年份
   * @param {number|null} month — 可选月份
   * @returns {Promise<boolean>}
   */
  async checkLayerExists(dataset, year, month = null) {
    if (!this.enabled) return false;

    try {
      const storeName = this._getStoreName(dataset, year, month);
      const res = await this._request(
        'GET',
        `/workspaces/${this.workspace}/coveragestores/${storeName}.json`
      );
      return res.ok;
    } catch (err) {
      // GeoServer 不可达，静默返回 false
      return false;
    }
  }

  /**
   * 发布 GeoTIFF 到 GeoServer
   *
   * 通过 REST API PUT 上传 GeoTIFF 文件，自动创建 coverage store、
   * coverage 和 layer。图层名遵循 WMS 命名约定。
   *
   * @param {string} geotiffPath — GeoTIFF 文件绝对路径
   * @param {string} dataset — 数据集 ID
   * @param {number|string} year — 年份
   * @returns {Promise<{layerName: string, wmsUrl: string}>}
   */
  async publishGeoTIFF(geotiffPath, dataset, year, month = null) {
    if (!this.enabled) {
      throw new Error('GeoServer cache is disabled');
    }

    if (!fs.existsSync(geotiffPath)) {
      throw new Error(`GeoTIFF file not found: ${geotiffPath}`);
    }

    // 确保工作区存在
    await this.ensureWorkspace();

    const storeName = this._getStoreName(dataset, year, month);
    const geotiffData = fs.readFileSync(geotiffPath);
    const fileSizeMB = (geotiffData.length / (1024 * 1024)).toFixed(1);

    console.log(`[GeoServer] 发布 ${storeName} (${fileSizeMB} MB)...`);

    // Step 1: 上传 GeoTIFF → 自动创建 coverage store + coverage + layer
    //
    // GeoServer REST API 约定:
    //   PUT /workspaces/{ws}/coveragestores/{name}/file.geotiff
    //   上传后自动创建:
    //     - CoverageStore: {name}
    //     - Coverage: {name}
    //     - Layer: {ws}:{name}
    //
    // 因为 store name 已包含 _color 后缀（如 NDVI_2018_color），
    // 生成的 layer name 就是 frontend 期望的 hunan:NDVI_2018_color。
    //
    const uploadPath = `/workspaces/${this.workspace}/coveragestores/${storeName}/file.geotiff`;

    let res = await this._request('PUT', uploadPath, geotiffData, 'image/tiff');

    // 409 Conflict → store 已存在，尝试更新
    if (res.status === 409) {
      console.log(`[GeoServer] ${storeName} 已存在，跳过上传`);
    } else if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to upload GeoTIFF for ${storeName}: ${res.status} ${text.substring(0, 300)}`
      );
    }

    // Step 2: 应用色阶样式（如果数据集有预定义样式）
    const styleName = await this._ensureStyleForDataset(dataset);
    if (styleName) {
      const layerName = this.getWmsLayerName(dataset, year, month);
      await this._setLayerStyle(layerName, styleName);
    }

    const wmsLayer = this.getWmsLayerName(dataset, year, month);
    console.log(`[GeoServer] ✓ ${wmsLayer} 发布完成`);

    return {
      layerName: wmsLayer,
      wmsUrl: `${this.baseUrl}/${this.workspace}/wms`,
    };
  }

  /**
   * 设置图层的默认样式
   * @param {string} fullLayerName — 如 "hunan:NDVI_2018_color"
   * @param {string} styleName — 样式名称
   */
  async _setLayerStyle(fullLayerName, styleName) {
    const layerPath = `/layers/${encodeURIComponent(fullLayerName)}.json`;
    const res = await this._request('PUT', layerPath, {
      layer: {
        defaultStyle: {
          name: styleName,
          // workspace 为 null 表示使用全局样式
        },
      },
    });

    if (res.ok) {
      console.log(`[GeoServer] 图层 ${fullLayerName} 样式 → ${styleName}`);
    }
  }

  /**
   * 确保数据集有对应的色阶样式
   *
   * 为每个数据集创建 SLD 栅格色阶样式。样式名格式: {dataset}_colormap
   * 如果样式已存在则跳过创建。
   *
   * @param {string} dataset — 数据集 ID
   * @returns {Promise<string|null>} 样式名称，失败返回 null
   */
  async _ensureStyleForDataset(dataset) {
    const styleName = `${dataset}_colormap`;

    try {
      // 检查样式是否已存在
      const checkRes = await this._request('GET', `/styles/${styleName}.json`);
      if (checkRes.ok) {
        return styleName;
      }

      // 生成 SLD 样式
      const sld = this._generateSLD(dataset);
      if (!sld) {
        // 无预定义色阶 → 用 GeoServer 默认 raster 样式
        return null;
      }

      // 创建样式
      const createRes = await this._request('POST', '/styles', {
        style: {
          name: styleName,
          filename: `${styleName}.sld`,
        },
      });

      if (!createRes.ok && createRes.status !== 409) {
        console.warn(`[GeoServer] 创建样式 ${styleName} 失败: ${createRes.status}`);
        return null;
      }

      // 上传 SLD 内容
      const uploadRes = await this._request(
        'PUT',
        `/styles/${styleName}`,
        sld,
        'application/vnd.ogc.sld+xml'
      );

      if (uploadRes.ok || uploadRes.status === 409) {
        console.log(`[GeoServer] SLD 样式 ${styleName} 就绪`);
        return styleName;
      }

      return null;
    } catch (err) {
      console.warn(`[GeoServer] 样式处理失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 根据 datasetColorMaps 生成 SLD 栅格色阶 XML
   *
   * 色阶基于 LayerConfig.js 中的 datasetColorMaps stops，
   * 使用 ColorMapEntry 将数值映射到颜色。
   *
   * @param {string} dataset
   * @returns {string|null} SLD XML 字符串
   */
  _generateSLD(dataset) {
    // 色阶定义 — 与 frontend/src/components/LayerConfig.js 的 datasetColorMaps 保持同步
    const COLOR_MAPS = {
      ndvi: {
        title: 'NDVI',
        entries: [
          { value: 0.0, color: '#8B4513', label: '裸地' },
          { value: 0.2, color: '#FFEBBE', label: '稀疏' },
          { value: 0.4, color: '#AADC78', label: '中等' },
          { value: 0.6, color: '#32B432', label: '较高' },
          { value: 0.8, color: '#007800', label: '高' },
          { value: 1.0, color: '#003C00', label: '极高' },
        ],
      },
      gpp: {
        title: 'GPP',
        entries: [
          { value: 200, color: '#FFF5C8', label: '低' },
          { value: 800, color: '#B4DC64', label: '中低' },
          { value: 1500, color: '#32B43C', label: '中' },
          { value: 2200, color: '#00821E', label: '中高' },
          { value: 3500, color: '#004600', label: '高' },
        ],
      },
      npp: {
        title: 'NPP',
        entries: [
          { value: 50, color: '#F0E6B4', label: '低' },
          { value: 400, color: '#96C864', label: '中低' },
          { value: 800, color: '#28A032', label: '中' },
          { value: 1200, color: '#006E14', label: '中高' },
          { value: 1800, color: '#003C00', label: '高' },
        ],
      },
      pre: {
        title: 'Precipitation',
        entries: [
          { value: 800, color: '#FFC896', label: '< 800mm' },
          { value: 1100, color: '#C8DCF0', label: '~1100mm' },
          { value: 1400, color: '#64B4FF', label: '~1400mm' },
          { value: 1700, color: '#1E78F0', label: '~1700mm' },
          { value: 2200, color: '#0A32B4', label: '> 2200mm' },
        ],
      },
      temp: {
        title: 'Monthly Temp',
        entries: [
          { value: -20, color: '#B4C8FF', label: '< -20℃' },
          { value: 0, color: '#8CB4FA', label: '~0℃' },
          { value: 10, color: '#FFFAA0', label: '~10℃' },
          { value: 20, color: '#FFC850', label: '~20℃' },
          { value: 30, color: '#FF641E', label: '~30℃' },
          { value: 40, color: '#FF1E0A', label: '> 40℃' },
        ],
      },
      population: {
        title: 'Population',
        entries: [
          { value: 10, color: '#F0F5C8', label: '< 10' },
          { value: 200, color: '#FFE696', label: '~200' },
          { value: 500, color: '#FFB450', label: '~500' },
          { value: 1500, color: '#F06432', label: '~1500' },
          { value: 10000, color: '#B41414', label: '> 10000' },
        ],
      },
      zhibei: {
        title: 'Tree Cover',
        entries: [
          { value: 0, color: '#FFEBB4', label: '0%' },
          { value: 25, color: '#C8DC78', label: '25%' },
          { value: 50, color: '#64BE3C', label: '50%' },
          { value: 75, color: '#1E8C1E', label: '75%' },
          { value: 100, color: '#005000', label: '100%' },
        ],
      },
    };

    const cmap = COLOR_MAPS[dataset];
    if (!cmap) return null;

    // 构建 SLD ColorMap XML
    const colorMapEntries = cmap.entries
      .map(
        (e) =>
          `          <ColorMapEntry color="${e.color}" quantity="${e.value}" label="${e.label}" opacity="1.0"/>`
      )
      .join('\n');

    const sld = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld"
                       xmlns:ogc="http://www.opengis.net/ogc"
                       xmlns:xlink="http://www.w3.org/1999/xlink"
                       version="1.0.0">
  <NamedLayer>
    <Name>${dataset}_colormap</Name>
    <UserStyle>
      <Name>${dataset}_colormap</Name>
      <Title>${cmap.title} Colormap</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>1.0</Opacity>
            <ColorMap type="interpolate" extended="false">
${colorMapEntries}
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

    return sld;
  }

  /**
   * 批量检查多个 dataset/year 组合的缓存状态
   *
   * @param {Array<{dataset: string, year: number}>} queries
   * @returns {Promise<Object>} { "ndvi_2018": true, "gpp_2019": false, ... }
   */
  async batchCheckLayers(queries) {
    const results = {};
    const checks = queries.map(async ({ dataset, year }) => {
      const key = `${dataset}_${year}`;
      results[key] = await this.checkLayerExists(dataset, year);
    });
    await Promise.allSettled(checks);
    return results;
  }

  /**
   * 获取 GeoServer 中所有已发布图层列表（指定工作区）
   * @returns {Promise<string[]>}
   */
  async listLayers() {
    try {
      const res = await this._request('GET', `/layers.json`);
      if (!res.ok) return [];
      const data = await res.json();
      const prefix = `${this.workspace}:`;
      return (data.layers?.layer || [])
        .filter((l) => l.name.startsWith(prefix))
        .map((l) => l.name);
    } catch {
      return [];
    }
  }
}

module.exports = GeoServerCache;
