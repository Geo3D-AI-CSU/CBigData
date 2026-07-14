<template>
  <div id="cesiumContainer"></div>
  <!-- 添加大标题 -->
  <div class="cesium-locale-bar">
    <LocaleSwitcher />
  </div>
  <h1 class="main-title">{{ $t('common.appTitle') }}</h1>
  
  <!-- 左侧可折叠功能菜单 -->
  <SidebarMenu
    @flyToHunan="flyToHunan"
    @switchToOCO="switchToOCO"
    @flyToStreetTrees="flyToStreetTrees"
    @switchToGEDI2D="switchToGEDI2D"
    @toggleSatellite="toggleSatellite"
    @back="back"
    @selectDataset="onDatasetSelected"
    @treeSearch="onTreeSearch"
    @treeSelectHistogram="onTreeSelectHistogram"
  />

  <!-- 其他功能按钮，只在点击街道树后显示 -->
  <template v-if="showLeftButtons">
    <!-- 直方图面板（Canvas 动态生成，透明背景） -->
    <transition name="slide-image">
      <div v-if="showImage" class="sliding-image">
        <button class="close-button" @click="closeImage">×</button>
        <canvas ref="histogramCanvas" width="480" height="360"></canvas>
      </div>
    </transition>
  </template>


  <!-- 图例面板 (可折叠/停靠右侧，Canvas 动态生成) -->
  <transition name="legend-slide">
    <div
      v-if="showLegend"
      class="legend-panel"
      :class="{ 'legend-collapsed': legendCollapsed }"
    >
      <!-- 折叠状态: 仅显示竖排标签 -->
      <div v-if="legendCollapsed" class="legend-tab" @click="legendCollapsed = false" title="展开图例">
        <span class="legend-tab-text">图例</span>
        <span class="legend-tab-icon">◀</span>
      </div>
      <!-- 展开状态: 动态 Canvas 图例 -->
      <div v-else class="legend-body">
        <button class="legend-toggle-btn" @click="legendCollapsed = true" title="折叠到右侧">▶</button>
        <DynamicLegend
          :dataset="selectedData"
          :title="legendTitle"
          :unit="legendUnit"
        />
      </div>
    </div>
  </transition>

  <!-- 卫星选择菜单，仅在点击卫星实体按钮后显示 -->
  <template v-if="showSatelliteMenu">
    <div class="data-selector satellite-selector">
      <h4>{{ $t('cesium.satelliteSelection') }}</h4>
      <select v-model="selectedSatellite" @change="handleSatelliteChange">
        <option value="">{{ $t('cesium.pleaseSelectSatellite') }}</option>
        <option value="all">{{ $t('cesium.showAllSatellites') }}</option>
        <option value="oco2">OCO-2</option>
        <option value="gosat">GOSAT</option>
        <option value="gedi">GEDI</option>
        <option value="icesat2">ICESat-2</option>
      </select>
    </div>
  </template>

  <!-- 数据源指示器 -->
  <div v-if="dataProviderUsed" class="provider-badge" :class="'provider-' + dataProviderUsed">
    📡 {{ $t('cesium.dataSource') }}: {{ dataProviderUsed === 'demo' ? $t('cesium.simulatedData') : dataProviderUsed === 'gee' ? 'Google Earth Engine' : dataProviderUsed === 'copernicus' ? 'Copernicus' : dataProviderUsed === 'geoserver' ? 'GeoServer WMS' : dataProviderUsed }}
  </div>

  <!-- 月份显示 + 时间轴年范围导航 -->
  <div class="month-display" v-if="dataProviderUsed && lastDisplayedMonth">
    <button class="timeline-nav-btn" @click="shiftTimelineView(-1)" title="上一年">◀</button>
    📅 {{ lastDisplayedMonth }}
    <button class="timeline-nav-btn" @click="shiftTimelineView(1)" title="下一年">▶</button>
  </div>

  <!-- 在template部分添加OCO2控制面板 -->
  <template v-if="showOCO2Controls">
    <div class="oco2-controls">
      <h4>{{ $t('cesium.oco2ControlTitle') }}</h4>
      <!-- 添加图例组件 -->
      <Legend class="oco2-legend" />     
    </div>
  </template>

  <!-- 数据点信息弹窗 -->
  <div v-if="showDataPointPopup" class="data-popup">
    <div class="popup-header">
      <h3>{{ $t('cesium.dataPointInfo') }}</h3>
      <button class="close-btn" @click="closeDataPointPopup">×</button>
    </div>
    <div class="popup-content">
      <div v-for="(value, key) in selectedDataPoint" :key="key" class="data-item">
        <span class="data-label">{{ key }}:</span>
        <span class="data-value">{{ value }}</span>
      </div>
    </div>
  </div>

  <!-- 卫星信息面板 -->
  <div v-if="showSatelliteInfo" class="satellite-info-panel">
    <div class="info-header">
      <h3>{{ satelliteInfo.name }}</h3>
      <button class="close-btn" @click="showSatelliteInfo = false">×</button>
    </div>
    <div class="info-content">
      <p><strong>{{ $t('cesium.launchDate') }}</strong>{{ satelliteInfo.launch_date }}</p>
      <p><strong>{{ $t('cesium.primaryMission') }}</strong>{{ satelliteInfo.mission }}</p>

      <h4>{{ $t('cesium.specifications') }}</h4>
      <ul>
        <li v-for="(value, key) in satelliteInfo.specifications" :key="key">
          {{ translateSpecKey(key) }}: {{ value }}
        </li>
      </ul>

      <h4>{{ $t('cesium.instruments') }}</h4>
      <ul>
        <li v-for="(instrument, index) in satelliteInfo.instruments" :key="index">
          {{ instrument }}
        </li>
      </ul>
    </div>
  </div>

  <!-- GEDI 图例 -->
  <GEDILegend
    :visible="showGEDILegend"
    @close="showGEDILegend = false"
  />

  <!-- 行道树查询 Tip（底部时间轴上方） -->
  <transition name="tip-fade">
    <div v-if="showTreeTip" class="tree-tip" :class="treeTipType">
      {{ treeTipText }}
    </div>
  </transition>

</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { hunan_boundary, gpp_layer, npp_layer, ndvi_layer, pre_layer,
  temp_layer, gedi_layer, tudi_layer, zhibei_layer,
  API_DATA_URL, getApiDataUrl, getCacheCheckUrl, getColorForValue, getColorStops,
  datasetColorMaps, DATA_SOURCE_MODE, MONTHLY_DATASETS, getMonthLayer, formatMonthKey } from './LayerConfig.js';
import Legend from './Legend.vue';
import SidebarMenu from './SidebarMenu.vue';
import satelliteData from '@/assets/satellites/info.json';
import GEDILegend from './GEDILegend.vue';
import DynamicLegend from './DynamicLegend.vue';
import { useI18n } from '@/i18n';
import LocaleSwitcher from './LocaleSwitcher.vue';
//import { ElMessage } from 'element-plus';

const { t } = useI18n();

// 定义各个响应式状态变量
const selectedImage = ref(""); // 当前在下拉框中选中的图像
const showImage = ref(false); // 控制滑动图像的显示
const histogramCanvas = ref(null); // 直方图 Canvas
const isCesiumLoaded = ref(false); // 判断 Cesium 是否加载成功
const showLeftButtons = ref(false); // 控制左侧按钮的显示
const showSTButton = ref(false); // 控制生态系统按钮的显示

// 与查询功能相关的状态
const queryType = ref("id"); // 默认查询类型设置为 'id'
const searchId = ref(""); // 存储输入的树木 ID

// 底部 tip 通知
const showTreeTip = ref(false);
const treeTipText = ref('');
const treeTipType = ref('tip-info');  // 'tip-info' | 'tip-error'
let treeTipTimer = null;

let highlightedModel = null; // 存储当前高亮显示的模型
let viewer; // Cesium Viewer 实例
let modelDataMapping = {}; // 存储树木模型和其数据的映射关系
const treeRawData = ref([]); // 原始树木数据（供直方图使用）

let hunandata; 
let gppdata;
let nppdata;
let ndvidata;
let predata;
let tempdata;
let gedidata;
let tudidata;
let zhibeidata;
let satellites = {}; // 存储所有卫星实体
// 添加选中的数据类型状态
const selectedData = ref('');

// 图例相关的响应式变量
const showLegend = ref(false);
const legendCollapsed = ref(false);
const legendTitle = ref('');
const legendUnit = ref('');

/** 从 i18n 获取数据集的图例标题 */
function getLegendTitle(dataType) {
  return t(`cesium.legendTitles.${dataType}`) || dataType;
}
/** 从 i18n 获取数据集的图例单位 */
function getLegendUnit(dataType) {
  return t(`cesium.legendUnits.${dataType}`) || '';
}

// 添加卫星相关的响应式变量
const showSatelliteMenu = ref(false);
const selectedSatellite = ref('oco2');

// === Cesium 原生时间轴状态 ===
const lastDisplayedMonth = ref('2000-01');  // 当前显示的月份标签
let lastFetchedKey = null;                   // 上次加载的 key，防重复
let currentTimeLayer = null;

// === API 数据源状态 ===
let apiImageryLayer = null;  // 当前 API 数据图层 (Cesium.ImageryLayer)，以图像方式渲染
const apiDataLoaded = ref(false);  // API 数据是否已加载
const dataProviderUsed = ref('');  // 当前使用的数据提供者名称

// 在script setup部分添加OCO-2相关的状态和函数
const showOCO2Controls = ref(false);
let oco2DataSource = null;

const switchToOCO = async () => {
  console.log('开始切换到OCO-2数据可视化...');
  
  try {
    // 直接切换到2D模式
    viewer.scene.morphTo2D(0); // 0表示立即切换，不使用动画
    
    // 调整相机位置以获得更好的2D视角
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      duration: 2.0,
      complete: async () => {
        try {
          console.log('相机位置调整完成，开始加载OCO-2数据...');
          // 清除基础数据图层和图例
          hideAllLayers();
          if (currentTimeLayer) {
            viewer.imageryLayers.remove(currentTimeLayer);
            currentTimeLayer = null;
          }
          showLegend.value = false;
          showGEDILegend.value = false;
          selectedData.value = '';
          dataProviderUsed.value = '';
          lastDisplayedMonth.value = '';
          console.log('已清除其他图层');
          
          // 创建数据源
          const dataSource = new Cesium.CustomDataSource('OCO2-Points');
          console.log('已创建新的数据源');
          
          // 构建请求URL
          const params = new URLSearchParams({
            startTime: '2014-01-01',
            endTime: '2024-12-31',
            minLat: '-90',
            maxLat: '90',
            minLon: '-180',
            maxLon: '180'
          });
          const url = `http://localhost:3001/api/oco2-data?${params}`;
          console.log('准备发送请求到:', url);
          
          // 获取数据
          const response = await fetch(url);
          console.log('收到响应:', response.status, response.statusText);
          
          if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}, 信息: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('成功解析数据，获取到', data.length, '条记录');
          
          if (!data || data.length === 0) {
            console.warn(t('cesium.noDataObtained'));
            return;
          }

          // 添加点实体
          let validPoints = 0;
          let skippedPoints = 0;
          
          data.forEach(point => {
            if (!point.longitude || !point.latitude || !point.xco2) {
              console.warn('跳过无效数据点:', point);
              skippedPoints++;
              return;
            }
            
            try {
              // 创建并添加新的点实体到数据源
              const entity = dataSource.entities.add({
                // 将经纬度坐标转换为Cesium的笛卡尔坐标系，设置固定高度1000米
                position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 1000),
                // 点的可视化属性
                point: {
                  pixelSize: 5,                    // 点的大小（像素）
                  color: getColorFromXCO2(point.xco2),  // 根据CO2浓度设置点的颜色
                  outlineColor: Cesium.Color.WHITE,     // 点的轮廓颜色
                  outlineWidth: 1,                      // 轮廓宽度                 
                  disableDepthTestDistance: 0           // 启用深度测试，确保点被地球遮挡
                },
                // 存储点的属性数据，用于后续查询和显示
                properties: {
                  xco2: point.xco2,        // CO2浓度值
                  timestamp: point.timestamp  // 观测时间戳
                }
              });
              validPoints++;  // 有效点计数加1
            } catch (error) {
              console.error('添加点实体时出错:', error);  // 记录错误信息
              skippedPoints++;  // 跳过的点计数加1
            }
          });
          
          console.log(`数据点添加完成: ${validPoints} 个有效点, ${skippedPoints} 个无效点`);
          
          // 添加到viewer
          console.log('正在将数据源添加到viewer...');
          await viewer.dataSources.add(dataSource);
          console.log('数据源已成功添加到viewer');
          
          // 保存数据源引用以便后续清除
          if (oco2DataSource) {
            console.log('移除旧的数据源');
            viewer.dataSources.remove(oco2DataSource);
          }
          oco2DataSource = dataSource;
          
          // 显示控制面板
          showOCO2Controls.value = true;
          
          console.log('OCO-2数据加载完成');

          // 添加点击事件处理器
          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
          handler.setInputAction((click) => {
            const pickedObject = viewer.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && pickedObject.id) {
              const entity = pickedObject.id;
              if (entity.properties && entity.properties.xco2) {
                const props = entity.properties;
                const timestamp = new Date(props.timestamp.getValue());
                
                // 获取实体的位置
                const position = entity.position.getValue(viewer.clock.currentTime);
                const cartographic = Cesium.Cartographic.fromCartesian(position);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                
                // 先隐藏弹窗（如果之前有显示）
                showDataPointPopup.value = false;
                
                // 更新选中点的信息
                selectedDataPoint.value = {
                  [t('cesium.longitude')]: longitude.toFixed(4) + '°',
                  [t('cesium.latitude')]: latitude.toFixed(4) + '°',
                  [t('cesium.co2Concentration')]: props.xco2.getValue().toFixed(2) + ' ppm',
                  [t('cesium.observationTime')]: timestamp.toLocaleString(navigator.language || 'zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                };
                
                // 显示弹窗
                nextTick(() => {
                  showDataPointPopup.value = true;
                });
                
                // 点击高亮效果
                const originalColor = entity.point.color;
                entity.point.color = Cesium.Color.YELLOW;
                
                // 3秒后恢复原色
                setTimeout(() => {
                  entity.point.color = originalColor;
                }, 3000);
              }
            } else {
              // 点击空白处时隐藏弹窗
              showDataPointPopup.value = false;
            }
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        } catch (error) {
          console.error('在相机调整完成后处理中发生错误:', error);
        }
      }
    });
  } catch (error) {
    console.error('切换到OCO-2数据可视化时发生错误:', error);
  }
};

// 关闭图片容器
const closeImage = () => {
  showImage.value = false; // 隐藏图片容器
};

// Cesium Ion access token
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5ZmE0MTVkMi1jYzU0LTQwNmQtYjY3MC03NmI4NGRlMDgzY2QiLCJpZCI6MjI0NzY4LCJpYXQiOjE3Mjg0NzI1Mjh9.HPDgXt9T7Vx9kn2BLWToGEk0yJ-lL4yXNXt3ivUArR0";

  // 飞到街道树视角的函数
const flyToStreetTrees = () => {
  if (!viewer) return;
  // 清除基础数据图层和图例
  hideAllLayers();
  showLegend.value = false;
  selectedData.value = '';
  dataProviderUsed.value = '';
  lastDisplayedMonth.value = '';
  showGEDILegend.value = false;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      112.9379579, // 经度
      28.17196147, // 纬度 
      2700 // 高度
    ),
    orientation: {
      heading: Cesium.Math.toRadians(240.0),
      pitch: Cesium.Math.toRadians(-78.0),
      roll: 0.0
    },
    duration: 2.0,
    complete: () => {
      // 显示所有相关按钮
      showLeftButtons.value = true;

      // 重置图像相关状态
      selectedImage.value = "";
      showImage.value = false;
    }
  });
};

// ---- 行道树子菜单事件处理 ----

/** 按 ID 查询行道树 */
function onTreeSearch(id) {
  if (!id || !id.trim()) {
    showTreeTipMsg(t('cesium.searchByIdPlaceholder'), 'tip-error');
    return;
  }
  searchId.value = id.trim();
  searchById();
}

/** 选择分布直方图类型 */
function onTreeSelectHistogram(type) {
  if (!type) {
    showImage.value = false;
    selectedImage.value = '';
    return;
  }
  selectedImage.value = type;
  showImage.value = true;
  // 下一帧绘制直方图（等待 canvas 渲染）
  nextTick(() => drawTreeHistogram(type));
}

/** 从行道树数据中提取指定字段的所有值 */
function getTreeValues(field) {
  return treeRawData.value
    .map(t => parseFloat(t[field]))
    .filter(v => !isNaN(v) && v > 0);
}

/** 在 Canvas 上绘制透明背景直方图 */
function drawTreeHistogram(type) {
  const canvas = histogramCanvas.value;
  if (!canvas) return;

  const fieldMap = { '1': 'Tree_DBH', '2': 'Biomass', '3': 'Carbon' };
  const titleMap = { '1': t('cesium.imageOptions.1'), '2': t('cesium.imageOptions.2'), '3': t('cesium.imageOptions.3') };
  const unitMap = { '1': 'm', '2': 'kg', '3': 'kg' };
  const colorMap = { '1': '#4FC3F7', '2': '#81C784', '3': '#FFB74D' };

  const field = fieldMap[type];
  const title = titleMap[type];
  const unit = unitMap[type];
  const barColor = colorMap[type];
  if (!field) return;

  const values = getTreeValues(field);
  if (values.length === 0) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // 计算分箱
  const binCount = Math.min(15, Math.ceil(Math.sqrt(values.length)));
  const min = Math.floor(Math.min(...values) * 100) / 100;
  const max = Math.ceil(Math.max(...values) * 100) / 100;
  const binWidth = (max - min) / binCount || 1;
  const bins = new Array(binCount).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx]++;
  }
  const maxCount = Math.max(...bins, 1);

  // 布局参数
  const padLeft = 55, padRight = 20, padTop = 30, padBottom = 45;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // --- 绘制标题 ---
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, padTop - 6);

  // --- 绘制坐标轴 ---
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft + plotW, padTop + plotH);
  ctx.stroke();

  // --- Y 轴刻度 ---
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padTop + plotH - (i / yTicks) * plotH;
    const val = Math.round((i / yTicks) * maxCount);
    ctx.fillText(String(val), padLeft - 6, y + 3);
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    }
  }

  // --- 柱子 ---
  const barGap = 2;
  const barW = Math.max(4, (plotW / binCount) - barGap);

  for (let i = 0; i < binCount; i++) {
    const x = padLeft + (i / binCount) * plotW + barGap / 2;
    const barH = (bins[i] / maxCount) * plotH;
    const y = padTop + plotH - barH;

    const grad = ctx.createLinearGradient(x, y, x, padTop + plotH);
    grad.addColorStop(0, barColor);
    grad.addColorStop(1, barColor + '44');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW, barH);

    // X 轴标签（带单位）
    const binLabel = (min + i * binWidth).toFixed(2);
    if (binCount <= 12 || i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '9px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(binLabel, x + barW / 2, padTop + plotH + 14);
    }
  }

  // --- X 轴单位 ---
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`(${unit})`, padLeft + plotW / 2, padTop + plotH + 32);

  // --- 样本数 ---
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`n = ${values.length}`, W - padRight, padTop - 6);
}

/**
 * 缓存优先加载策略：先查 GeoServer，缓存命中用 WMS，未命中走 API
 *
 * @param {string} dataType — 数据集 ID
 * @param {number} year — 年份
 * @param {number|null} month — 可选月份
 */
const loadWithCachePriority = async (dataType, year, month = null) => {
  // 静态图层 (tudi/zhibei) 不走缓存优先 — 它们没有年份维度
  if (dataType === 'tudi' || dataType === 'zhibei') {
    await loadApiDataLayer(dataType, year, month);
    return;
  }

  // cache-first 模式：先检查 GeoServer
  if (DATA_SOURCE_MODE === 'cache-first') {
    try {
      const cacheUrl = getCacheCheckUrl(dataType, year, month);
      console.log(`[CesiumMap] Checking cache: ${cacheUrl}`);
      const cacheRes = await fetch(cacheUrl);

      if (cacheRes.ok) {
        const { exists, wmsLayer } = await cacheRes.json();
        if (exists && wmsLayer) {
          console.log(`[CesiumMap] ✓ Cache hit → WMS: ${wmsLayer}`);
          loadWmsFallbackLayer(dataType, year, month);
          return;
        }
      }
    } catch (err) {
      console.warn(`[CesiumMap] Cache check failed: ${err.message}, falling through to API`);
    }
  }

  // 缓存未命中或非 cache-first 模式 → 走 API（触发后台 GeoServer 缓存）
  console.log(`[CesiumMap] Cache miss → API (will trigger background caching)`);
  await loadApiDataLayer(dataType, year, month);
};

/**
 * 从 API 数据服务加载栅格数据并渲染为 Cesium 图像图层
 *
 * 将 GeoJSON 点数据绘制到 offscreen canvas 上，
 * 再通过 SingleTileImageryProvider 转为 Cesium 图像图层，
 * 实现与 WMS 一致的栅格展示效果。
 *
 * 支持 GEE → Demo 自动降级。
 *
 * @param {string} dataType — 数据集 ID
 * @param {number} year — 年份
 * @param {number|null} month — 可选月份 (1-12)
 */
const loadApiDataLayer = async (dataType, year, month = null) => {
  // 先移除旧图层
  removeApiDataLayer();

  const url = getApiDataUrl(dataType, year, month);
  console.log(`[CesiumMap] Loading API data: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success || !result.features || result.features.length === 0) {
      throw new Error('API returned empty data');
    }

    const provider = result.metadata?.provider || 'unknown';
    dataProviderUsed.value = provider;
    console.log(`[CesiumMap] Loaded ${result.features.length} features from ${provider}, converting to imagery...`);

    // 获取 bbox (从 metadata 或默认 Hunan 范围)
    const bbox = result.metadata?.bbox || { minLon: 109, maxLon: 114, minLat: 25, maxLat: 30 };

    // 将 GeoJSON 点数据绘制到 offscreen canvas
    const canvas = geoJsonToCanvas(result.features, dataType, bbox);

    // 创建 SingleTileImageryProvider → 以图像方式渲染
    const rectangle = Cesium.Rectangle.fromDegrees(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    const monthLabel = month != null ? `-${String(month).padStart(2, '0')}` : '';
    const layerName = `api-${dataType}-${year}${monthLabel}`;

    const imageryProvider = new Cesium.SingleTileImageryProvider({
      url: canvas.toDataURL('image/png'),
      rectangle: rectangle,
      credit: new Cesium.Credit(`${result.metadata?.datasetName || dataType} · ${provider}`),
    });

    const layer = viewer.imageryLayers.addImageryProvider(imageryProvider);
    apiImageryLayer = layer;
    apiDataLoaded.value = true;

    console.log(`[CesiumMap] ✓ API imagery layer rendered (${provider}, ${canvas.width}×${canvas.height})`);
  } catch (err) {
    console.warn(`[CesiumMap] API data failed: ${err.message}, falling back to WMS...`);
    loadWmsFallbackLayer(dataType, year, month);
  }
};

/**
 * 将 GeoJSON 点数据渲染到 offscreen canvas 上
 *
 * 每个数据点对应一个网格单元 (0.05°×0.05°)，
 * 绘制为填充矩形，颜色由 datasetColorMaps 色阶决定。
 *
 * @param {Array} features — GeoJSON features 数组
 * @param {string} dataType — 数据集 ID
 * @param {object} bbox — { minLon, maxLon, minLat, maxLat }
 * @returns {HTMLCanvasElement}
 */
const geoJsonToCanvas = (features, dataType, bbox) => {
  const CANVAS_SIZE = 512; // 固定画布分辨率
  const { minLon, maxLon, minLat, maxLat } = bbox;
  const lonRange = maxLon - minLon || 1;
  const latRange = maxLat - minLat || 1;

  // 计算像素宽高比
  const aspectRatio = lonRange / latRange;
  let canvasW, canvasH;
  if (aspectRatio >= 1) {
    canvasW = CANVAS_SIZE;
    canvasH = Math.round(CANVAS_SIZE / aspectRatio);
  } else {
    canvasH = CANVAS_SIZE;
    canvasW = Math.round(CANVAS_SIZE * aspectRatio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // 透明背景
  ctx.clearRect(0, 0, canvasW, canvasH);

  // 计算每个网格单元对应的像素大小
  const RES = 0.05; // 数据点空间分辨率（度）
  const cellW = (RES / lonRange) * canvasW;
  const cellH = (RES / latRange) * canvasH;
  // 绘制时在单元间加 0.5px 间隙，避免出现缝隙
  const drawW = Math.max(cellW - 0.5, 1);
  const drawH = Math.max(cellH - 0.5, 1);

  // 获取色阶
  const colorStops = getColorStops(dataType);

  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    const value = feature.properties.value;

    // lon/lat → canvas 坐标 (图像原点在左上角，Y轴向下)
    const x = ((lon - minLon) / lonRange) * canvasW;
    const y = canvasH - ((lat - minLat) / latRange) * canvasH; // 翻转Y轴

    // 计算颜色
    const colorStr = getColorForValue(value, colorStops);
    ctx.fillStyle = colorStr;
    ctx.fillRect(x - drawW / 2, y - drawH / 2, drawW, drawH);
  }

  return canvas;
};

/** 移除 API 图像图层 */
const removeApiDataLayer = () => {
  if (apiImageryLayer) {
    viewer.imageryLayers.remove(apiImageryLayer);
    apiImageryLayer = null;
    apiDataLoaded.value = false;
    dataProviderUsed.value = '';
  }
};

/** GeoServer WMS 图层 — 缓存命中或 API 降级时使用，支持月度 */
const loadWmsFallbackLayer = (dataType, year, month = null) => {
  const key = month != null ? formatMonthKey(year, month) : String(year);
  console.log(`[CesiumMap] Using GeoServer WMS for ${dataType}/${key}`);
  if (currentTimeLayer) {
    viewer.imageryLayers.remove(currentTimeLayer);
  }
  const layerProvider = getMonthLayer(dataType, key);
  if (layerProvider) {
    currentTimeLayer = viewer.imageryLayers.addImageryProvider(layerProvider);
    dataProviderUsed.value = 'geoserver'; // 屏幕提示数据源为 GeoServer
  }
};

const flyToHunan = () => {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      112.1834, // 湖南省经度
      27.5834,  // 湖南省纬度
      1400000   // 高度(米)
    ),
    orientation: {
      heading: 0.0,
      pitch: -Cesium.Math.PI_OVER_TWO, // 垂直向下看
      roll: 0.0
    },
    complete: () => {
      showSTButton.value = true;
      hunandata.show = true; // 显示湖南省边界
    }
  });
};

/**
 * 加载指定年月的 API GeoJSON 数据 — 由 onClockTick debounce 触发
 * (WMS 叠加层已在 updateWmsOverlay() 中立即切换，此处只处理重量级 API 数据)
 */
const loadDataForMonth = async (year, month, isMonthly) => {
  const dataType = selectedData.value;
  if (!dataType) return;

  const effectiveMonth = isMonthly ? month : null;

  // 缓存优先加载 API GeoJSON 数据（点图层渲染）
  // 注意: loadWithCachePriority 内部在 cache hit 时会调用 loadWmsFallbackLayer
  // 这是冗余但无害的 — updateWmsOverlay 已经抢先设置了正确的 WMS 层
  await loadWithCachePriority(dataType, year, effectiveMonth);
};

/** 从侧边栏子菜单选择数据集后的处理 */
const onDatasetSelected = (dataset) => {
  selectedData.value = dataset;
  handleDataChange();
};

// 修改数据选择处理函数
const handleDataChange = () => {
  // 隐藏所有固定图层
  hideAllLayers();

  // 清除旧的时间序列图层和 API 数据
  if (currentTimeLayer) {
    viewer.imageryLayers.remove(currentTimeLayer);
    currentTimeLayer = null;
  }
  removeApiDataLayer();

  if (selectedData.value) {
    // 检查是否是静态图层（土地利用和植被覆盖）
    if (selectedData.value === 'tudi' || selectedData.value === 'zhibei') {
      // 静态图层：优先尝试 API, 失败则用 WMS
      loadWithCachePriority(selectedData.value, 2020).catch(() => {
        // API 失败时用 WMS 静态图层
        if (selectedData.value === 'tudi') {
          tudidata.show = true;
          console.log('[WMS] 显示土地利用图层');
        } else {
          zhibeidata.show = true;
          console.log('[WMS] 显示植被覆盖图层');
        }
      });

      // 显示动态图例 (Canvas 生成)
      legendTitle.value = getLegendTitle(selectedData.value);
      legendUnit.value = getLegendUnit(selectedData.value);
      showLegend.value = true;
      legendCollapsed.value = false;

    } else {
      // 时间序列数据：从 Cesium 当前时钟位置读取年月
      if (viewer && viewer.clock) {
        const date = Cesium.JulianDate.toDate(viewer.clock.currentTime);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const isMonthly = MONTHLY_DATASETS.has(selectedData.value);
        lastDisplayedMonth.value = `${year}-${String(month).padStart(2, '0')}`;
        loadDataForMonth(year, month, isMonthly);
      }

      // 显示对应图例 (每次切换数据集默认展开，Canvas 动态生成)
      legendTitle.value = getLegendTitle(selectedData.value);
      legendUnit.value = getLegendUnit(selectedData.value);
      showLegend.value = true;
      legendCollapsed.value = false;
    }
  } else {
    showLegend.value = false;
  }
};

// ============================================================
// Cesium 原生时间轴 onTick 监听
//
// 设计思路:
//   - WMS 影像叠加层: 始终立即切换（轻量，仅改 imagery provider 引用）
//   - API GeoJSON 点数据: 始终防抖加载（重量级 GEE 请求），等待滑块稳定 400ms
//   - lastFetchedKey 守卫: 同月子帧直接跳过，避免无意义的 debounce 重置
//
// 效果: 播放时 WMS 随月份秒级切换，GeoJSON 在进入新月后 400ms 加载；
//       拖拽时 WMS 实时跟随，GeoJSON 在松手后 400ms 加载。
// ============================================================
let clockDebounceTimer = null;
const CLOCK_DEBOUNCE_MS = 400; // 滑块稳定 400ms 后才加载 API 数据

/**
 * 立即更新 WMS 影像叠加层（轻量操作，不涉及 API 请求）
 * 由 onClockTick 在每次月份变化时同步调用
 */
const updateWmsOverlay = (year, month, isMonthly) => {
  const dataType = selectedData.value;
  if (!dataType) return;
  // 静态图层不需要按月切换
  if (dataType === 'tudi' || dataType === 'zhibei') return;

  const key = isMonthly ? formatMonthKey(year, month) : String(year);
  try {
    if (currentTimeLayer) {
      viewer.imageryLayers.remove(currentTimeLayer);
      currentTimeLayer = null;
    }
    const layerProvider = getMonthLayer(dataType, key);
    if (layerProvider) {
      currentTimeLayer = viewer.imageryLayers.addImageryProvider(layerProvider);
    }
  } catch (e) {
    console.warn(`[CesiumMap] WMS overlay update failed: ${e.message}`);
  }
};

const onClockTick = (clock) => {
  if (!selectedData.value) return;

  const date = Cesium.JulianDate.toDate(clock.currentTime);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // 限制年份范围
  if (year < 2000 || year > 2020) return;

  const isMonthly = MONTHLY_DATASETS.has(selectedData.value);
  const fetchKey = isMonthly
    ? `${year}_${String(month).padStart(2, '0')}`
    : `${year}`;

  // 月份/年份未变则跳过 — 同月子帧不重置 debounce
  if (fetchKey === lastFetchedKey) return;
  lastFetchedKey = fetchKey;

  // 立即更新月份显示（始终跟随）
  lastDisplayedMonth.value = `${year}-${String(month).padStart(2, '0')}`;

  // WMS 叠加层: 立即切换（无论播放还是拖拽）
  updateWmsOverlay(year, month, isMonthly);

  // API GeoJSON 数据: 始终防抖 — 播放或拖拽都等滑块稳定 400ms 才加载
  if (clockDebounceTimer) {
    clearTimeout(clockDebounceTimer);
    clockDebounceTimer = null;
  }
  clockDebounceTimer = setTimeout(() => {
    clockDebounceTimer = null;
    loadDataForMonth(year, month, isMonthly);
  }, CLOCK_DEBOUNCE_MS);

  // 播放时自动跟随：保持当前时间在时间轴可视范围中央
  if (clock.shouldAnimate) {
    const visibleSpan = 30 * 24 * 3600 * 6; // 6个月
    viewer.timeline.zoomTo(
      Cesium.JulianDate.addSeconds(clock.currentTime, -visibleSpan, new Cesium.JulianDate()),
      Cesium.JulianDate.addSeconds(clock.currentTime, visibleSpan, new Cesium.JulianDate())
    );
  }
};

/**
 * 手动切换时间轴可视范围 ±1 年
 * @param {number} direction — -1 上一年, +1 下一年
 */
const shiftTimelineView = (direction) => {
  if (!viewer || !viewer.timeline) return;
  const start = Cesium.JulianDate.toDate(viewer.timeline._startJulian);
  const stop = Cesium.JulianDate.toDate(viewer.timeline._endJulian);
  const span = stop.getTime() - start.getTime(); // 当前可视跨度 (ms)

  const newStart = new Date(start.getTime() + direction * span);
  const newStop = new Date(stop.getTime() + direction * span);

  // 边界保护：不超出 2000–2021
  if (newStart.getFullYear() < 2000 || newStop.getFullYear() > 2021) return;

  viewer.timeline.zoomTo(
    Cesium.JulianDate.fromDate(newStart),
    Cesium.JulianDate.fromDate(newStop)
  );
};

// 隐藏所有图层的辅助函数
const hideAllLayers = () => {
  gppdata.show = false;
  nppdata.show = false;
  ndvidata.show = false;
  predata.show = false;
  tempdata.show = false;
  tudidata.show = false;
  zhibeidata.show = false;
  // 同时移除 API 数据图层
  removeApiDataLayer();
};

// 修改 back 函数，确保正确重置所有状态
const back = async () => {
  if (!viewer) return;
  try {
    // 切换回3D视图
    viewer.scene.morphTo3D(1.0); // 1.0秒的动画时间
    
    // 隐藏图例
    if (document.querySelector('.legend-container')) {
      document.querySelector('.legend-container').style.display = 'none';
    }
    
    // 重置所有状态变量
    showSTButton.value = false;
    showLeftButtons.value = false;
    showImage.value = false;
    selectedImage.value = "";
    selectedData.value = '';
    showLegend.value = false;
    legendCollapsed.value = false;
    showOCO2Controls.value = false; // 隐藏 OCO-2 控制面板

    // 停止 Cesium 时钟播放
    if (viewer && viewer.clock) {
      viewer.clock.shouldAnimate = false;
    }

    // 切换回3D视图
    viewer.scene.mode = Cesium.SceneMode.SCENE3D;
    
    // 重置相机视角为初始视角
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        106.26667, // 中国经度
        38.46667,  // 中国纬度
        8000000   // 高度(米)
      ),
      orientation: {
        heading: 0.0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0.0
      },
      duration: 2
    });
    
    // 移除OCO2数据源
    const oco2DataSource = viewer.dataSources.getByName('OCO2-Points')[0];
    if (oco2DataSource) {
      viewer.dataSources.remove(oco2DataSource);
    }
    
    // 隐藏所有图层
    hideAllLayers();
    hunandata.show = false;
    gedidata.show = false;
    
    // 隐藏所有卫星
    Object.values(satellites).forEach(satellite => {
      satellite.show = false;
    });
    showSatelliteMenu.value = false;
    selectedSatellite.value = '';
    
    // 清理时间轴相关
    if (currentTimeLayer) {
      viewer.imageryLayers.remove(currentTimeLayer);
      currentTimeLayer = null;
    }
    
    // 隐藏GEDI图例
    showGEDILegend.value = false;
    
  } catch (error) {
    console.error('返回3D视图时出错:', error);
  }
};

// 添加切换到2D视图的函数
const switchToGEDI2D = () => {
  if (!viewer) return;
  // 清除基础数据图层和图例
  hideAllLayers();
  showLegend.value = false;
  selectedData.value = '';
  dataProviderUsed.value = '';
  lastDisplayedMonth.value = '';

  // 切换到2D视图
  viewer.scene.morphTo2D(2.0); // 2.0是动画持续时间(秒)

  // 调整相机位置以获得更好的2D视角
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(70, 10, 140, 60), // 大致覆盖中国区域
    duration: 2.0
  });
  
  // 显示GEDI数据
  gedidata.show = true;
  
  // 显示GEDI图例
  showGEDILegend.value = true;
};

// 修改卫星切换处理函数
const handleSatelliteChange = () => {
    if (!selectedSatellite.value) return;
    
    // 先隐藏所有卫星
    Object.values(satellites).forEach(satellite => {
        satellite.show = false;
    });
    
    if (selectedSatellite.value === 'all') {
        // 显示所有卫星
        Object.values(satellites).forEach(satellite => {
            satellite.show = true;
        });
    } else {
        // 显示选中的卫星
        const satellite = satellites[selectedSatellite.value];
        if (satellite) {
            satellite.show = true;
        }
    }
};

// 修改切换卫星显示的函数
const toggleSatellite = () => {
    showSatelliteMenu.value = !showSatelliteMenu.value;
    
    if (showSatelliteMenu.value) {
        // 清除基础数据图层和图例
        hideAllLayers();
        showLegend.value = false;
        selectedData.value = '';
        dataProviderUsed.value = '';
        lastDisplayedMonth.value = '';

        // 如果之前选择了卫星，显示对应的卫星
        if (selectedSatellite.value) {
            handleSatelliteChange();
        }
        // 启用时钟动画
        viewer.clock.shouldAnimate = true;
        // 调整相机位置到更高的视角以便观察所有卫星
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                106.26667,
                38.46667,
                18000000 // 增加高度以便观察所有卫星
            ),
            orientation: {
                heading: 0.0,
                pitch: -Cesium.Math.PI_OVER_TWO,
                roll: 0.0
            }
        });
    } else {
        // 隐藏所有卫星
        Object.values(satellites).forEach(satellite => {
            satellite.show = false;
        });
        // 停止动画
        viewer.clock.shouldAnimate = false;
        // 返回默认视角
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                106.26667,
                38.46667,
                8000000
            ),
            orientation: {
                heading: 0.0,
                pitch: -Cesium.Math.PI_OVER_TWO,
                roll: 0.0
            }
        });
    }
};

// 修改卫星配置，调整轨道间距以避免重叠
const addSatellites = () => {
    const satelliteConfigs = {
        oco2: {
            name: 'OCO-2',
            color: Cesium.Color.WHITE,
            scale: 500.0,
            orbitHeight: 7050000,
            period: 7200,
            pathColor: Cesium.Color.YELLOW,
            orbitTilt: 0 // 添加轨道倾角
        },
        gosat: {
            name: 'GOSAT',
            color: Cesium.Color.LIGHTBLUE,
            scale: 500.0,
            orbitHeight: 7800000,
            period: 7000,
            pathColor: Cesium.Color.CYAN,
            orbitTilt: Math.PI / 6 // 30度倾角
        },
        gedi: {
            name: 'GEDI',
            color: Cesium.Color.LIGHTGREEN,
            scale: 500.0,
            orbitHeight: 7600000,
            period: 6800,
            pathColor: Cesium.Color.GREEN,
            orbitTilt: -Math.PI / 6 // -30度倾角
        },
        icesat2: {
            name: 'ICESat-2',
            color: Cesium.Color.PINK,
            scale: 500.0,
            orbitHeight: 7400000,
            period: 6600,
            pathColor: Cesium.Color.RED,
            orbitTilt: Math.PI / 4 // 45度倾角
        }
    };

    // 为每个卫星创建实体
    Object.entries(satelliteConfigs).forEach(([key, config]) => {
        satellites[key] = viewer.entities.add({
            name: config.name,
            position: new Cesium.CallbackProperty((time) => {
                return computeOrbit(time, config.orbitHeight, config.period, config.orbitTilt);
            }, false),
            orientation: new Cesium.CallbackProperty((time) => {
                return computeOrientation(time, config.orbitHeight, config.period);
            }, false),
            model: {
                uri: '/scene.gltf',
                scale: config.scale,
                minimumPixelSize: 64,
                maximumScale: 20000,
                color: config.color,
                colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
                colorBlendAmount: 0.5
            },
            path: {
                resolution: 1,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.1,
                    color: config.pathColor
                }),
                width: 2
            },
            label: {
                text: config.name,
                font: '14px sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -30),
                fillColor: config.color,
                outlineColor: Cesium.Color.BLACK,
                showBackground: true,
                backgroundColor: new Cesium.Color(0, 0, 0, 0.7)
            },
            show: false,
            click: () => {
                satelliteInfo.value = satelliteData[key];
                showSatelliteInfo.value = true;
            }
        });
    });

    // 创建新的事件处理器
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // 添加点击事件监听
    handler.setInputAction((movement) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            const satKey = Object.keys(satellites).find(
                key => satellites[key] === entity
            );
            if (satKey) {
                satelliteInfo.value = satelliteData[satKey];
                showSatelliteInfo.value = true;
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

// 修改轨道计算函数，添加倾角支持
const computeOrbit = (time, height, period, tilt = 0) => {
    const radius = height;
    const epoch = Cesium.JulianDate.fromDate(new Date(2024, 0, 1));
    const secondsSinceEpoch = Cesium.JulianDate.secondsDifference(time, epoch);
    const angle = (secondsSinceEpoch % period) * (2 * Math.PI) / period;
    
    // 添加轨道倾角
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * Math.cos(tilt);
    const z = radius * Math.sin(angle) * Math.sin(tilt);
    
    return new Cesium.Cartesian3(x, y, z);
};

// 修改方向计算函数
const computeOrientation = (time, height, period) => {
    const position = computeOrbit(time, height, period);
    const normal = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());
    return Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(0, 0, 0)
    );
};


onMounted(async () => {
  const existingBox = document.getElementById('or');
  if (existingBox) {
    existingBox.remove();
  }
  // 初始化 Cesium Viewer
  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: true, // 显示动画控件
    homeButton: true, // 显示返回按钮
    geocoder: true, // 显示地理编码输入框
    baseLayerPicker: true, // 显示图层选择器
    timeline: true, // 显示时间轴
    fullscreenButton: true, // 全屏按钮
    infoBox: false, // 禁用默认信息框
    selectionIndicator: false, // 禁用选中对象时的指示器
    imageryProvider: new Cesium.WebMapTileServiceImageryProvider({
      //天地图url
      url: "http://t0.tianditu.com/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=7b1ab6af6bf9b334466aeee8d8a269e0",
      layer: "tdtBasicLayer",
      style: "default",
      format: "image/jpeg",
      tileMatrixSetID: "GoogleMapsCompatible",
    }),
    // 加载全球地形数据
    terrainProvider: await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true, // 请求法向量数据，用于更好的渲染效果
      requestWaterMask: true, // 请求水面数据，用于水面渲染
    }),
  });

  hunandata = viewer.imageryLayers.addImageryProvider(hunan_boundary); // 添加湖南省边界
  hunandata.show = false;  // 隐藏湖南省边界
  gppdata = viewer.imageryLayers.addImageryProvider(gpp_layer); // 添加GPP图层
  gppdata.show = false; // 隐藏GPP图层
  nppdata = viewer.imageryLayers.addImageryProvider(npp_layer); // 添加NPP图层
  nppdata.show = false; // 隐藏NPP图层
  ndvidata = viewer.imageryLayers.addImageryProvider(ndvi_layer); // 添加NDVI图层
  ndvidata.show = false; // 隐藏NDVI图层
  predata = viewer.imageryLayers.addImageryProvider(pre_layer); // 添加PRE图层
  predata.show = false; // 隐藏PRE图层
  tempdata = viewer.imageryLayers.addImageryProvider(temp_layer); // 添加月平均气温图层
  tempdata.show = false;
  gedidata = viewer.imageryLayers.addImageryProvider(gedi_layer); // 添加GEDI图层
  gedidata.show = false; // 隐藏GEDI图层
  tudidata = viewer.imageryLayers.addImageryProvider(tudi_layer); // 添加土地利用图层
  tudidata.show = false; // 隐藏土地图层
  zhibeidata = viewer.imageryLayers.addImageryProvider(zhibei_layer); // 添加土地利用图层
  zhibeidata.show = false; // 隐藏植被覆盖图层
  // 隐藏 Cesium 默认的版权信息
  viewer.cesiumWidget.creditContainer.style.display = "none";
  // 启用地形深度测试，用于遮挡处理
  viewer.scene.globe.depthTestAgainstTerrain = true;
  // 当 Cesium 完全加载后，显示相关按钮和功能
  isCesiumLoaded.value = true;
  // 设置初始视角为中国上空
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      106.26667, // 中国经度
      38.46667,  // 中国纬度
      8000000   // 高度(米)
    ),
    orientation: {
      heading: 0.0,
      pitch: -Cesium.Math.PI_OVER_TWO, // 垂直向下看
      roll: 0.0
    }
  });
  // 加载树的 JSON 数据
  const response = await fetch("/trees.json");
  const treeData = await response.json();
  treeRawData.value = treeData; // 保存原始数据供直方图使用
  const basePath = "/models/trees/";

  // 遍历加载的树数据
  treeData.forEach(async (tree) => {
    let modelNumber;
    const id = parseInt(tree.id);

    if (isNaN(id) || id == null) {
      console.error(`无效的树木ID: ${tree.id}`);
      return; // 跳过无效的 ID
    }
    if (id >= 1 && id <= 9) {
      modelNumber = `${id}`; // 1-9
    } else if (id >= 10 && id <= 99) {
      modelNumber = `${id}`; // 10-99 不加前导零
    } else if (id >= 100 && id <= 127) {
      modelNumber = `${id}`; // 100-127 不加前导零
    } else {
      console.error(`ID超出范围: ${tree.id}`);
      return; // 超出范围的 ID
    }

    // 构造模型的 URL 地址
    const modelUrl = `${basePath}${modelNumber}.glb`;

    try {
      // 提取经纬度和高度信息,创建位置对象用于地形采样
      const position = {
        longitude: parseFloat(tree.Longitude),
        latitude: parseFloat(tree.Latitude),
        height: parseFloat(tree.Height),
      };

      //  获取给定经纬度位置上最详细的地形高度数据
      const sampledPositions = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider,
        [Cesium.Cartographic.fromDegrees(position.longitude, position.latitude)]
      );

      const terrainHeight = sampledPositions[0].height; // 获取采样到的地形高度
      const finalHeight = terrainHeight; // 使用地形高度替换原始高度

      //将经纬度坐标（地理坐标系）转换为笛卡尔坐标（Cartesian坐标系）在3D空间中的位置
      const cartesianPosition = Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        finalHeight
      );

      // 创建模型矩阵，用于定位模型
      const modelMatrix =
        Cesium.Transforms.eastNorthUpToFixedFrame(cartesianPosition);

      // 从 GLTF/GLB 文件加载模型
      const model = await Cesium.Model.fromGltfAsync({
        url: modelUrl,
        modelMatrix: modelMatrix, // 模型位置矩阵
        scale: 4.0, // 模型缩放比例
      });

      model.treeId = tree.id; // 为模型添加自定义属性 treeId
      // 将模型添加到场景
      viewer.scene.primitives.add(model);

      // 存储模型与树数据的映射关系
      modelDataMapping[tree.id] = {
        model,
        tree: {
          ...tree,
        },
      };
    } catch (error) {
      console.error(
        `加载树木ID: ${tree.id} 的模型失败, URL: ${modelUrl}`,
        error
      );
    }
  });

  // 设置点击事件监听器，用于处理树的点击选中
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    //获取点击位置的对象
    const pickedObject = viewer.scene.pick(movement.position);
    //判断点击对象是否是树木模型
    if (
      Cesium.defined(pickedObject) && //检查对象是否存在且不为 null
      Cesium.defined(pickedObject.primitive) && //获取点击位置对应的 3D 模型
      pickedObject.primitive.treeId
    ) {
      //获取点击树木的信息
      const treeId = pickedObject.primitive.treeId;
      const { model, tree } = modelDataMapping[treeId];  //获取树木数据和模型

      // 底部 tip 显示树木信息
      const info = [];
      if (tree.id !== undefined) info.push(`ID: ${tree.id}`);
      const _lon = parseFloat(tree.Longitude || tree.longitude || 0);
      const _lat = parseFloat(tree.Latitude || tree.latitude || 0);
      info.push(`${t('cesium.longitude')}: ${_lon.toFixed(4)}  ${t('cesium.latitude')}: ${_lat.toFixed(4)}`);
      if (tree.Height !== undefined) info.push(`${t('cesium.treeHeight')}: ${tree.Height}`);
      if (tree.Tree_DBH !== undefined) info.push(`${t('cesium.treeDBH')}: ${tree.Tree_DBH}`);
      if (tree.Biomass !== undefined) info.push(`${t('cesium.treeBiomass')}: ${tree.Biomass}`);
      if (tree.Carbon !== undefined) info.push(`${t('cesium.treeCarbon')}: ${tree.Carbon}`);
      showTreeTipMsg(info.join('  |  '), 'tip-info');

      // 相机飞到树木位置并放大
      const treeLon = parseFloat(tree.Longitude || tree.longitude || 0);
      const treeLat = parseFloat(tree.Latitude || tree.latitude || 0);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(treeLon, treeLat, 150),
        duration: 1.0,
      });

      // 恢复之前高亮的模型颜色（如果之前有模型被高亮显示，那么当点击新的树木时，需要将上一个树木的颜色恢复为默认的白色）
      if (highlightedModel) {
        highlightedModel.color = Cesium.Color.WHITE; // 还原默认颜色
      }

      // 高亮当前模型
      model.color = Cesium.Color.fromCssColorString("#FFA500").withAlpha(1.0); // 亮橙色
      highlightedModel = model; // 保存当前高亮模型
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 初始化时隐藏所有额外按钮和功能
  showSTButton.value = false;
  showLeftButtons.value = false;
  showImage.value = false;

  // ============================================================
  // 配置 Cesium 原生时间轴 — 月度粒度，初始定位 2020年1月
  //
  //   - clockStep 默认 SYSTEM_CLOCK_MULTIPLIER:
  //     simTimeDelta = realTimeDelta × multiplier
  //     multiplier = 30天 → 每现实秒 ≈ 1模拟月
  //   - timeline.zoomTo() 将可见范围缩到 1 年左右，
  //     Cesium 自动将刻度粒度为月（范围越大刻度越粗）
  // ============================================================
  viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date('2000-01-01'));
  viewer.clock.stopTime = Cesium.JulianDate.fromDate(new Date('2021-01-01'));
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date('2020-01-15')); // 初始 → 2020年1月
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 60 * 60 * 24 * 30; // ~1月/秒 实时播放速度
  viewer.clock.shouldAnimate = false; // 初始不播放

  // 将时间轴缩放到 1 年窗口 → Cesium 渲染月刻度
  // (若不 zoomTo, 21年跨度只会显示年刻度)
  viewer.timeline.zoomTo(
    Cesium.JulianDate.fromDate(new Date('2019-10-01')),
    Cesium.JulianDate.fromDate(new Date('2020-10-01'))
  );

  // 监听时钟变化: 月份变化时 WMS 立即切换, API 数据防抖加载
  viewer.clock.onTick.addEventListener(onClockTick);

  // 添加所有卫星
  addSatellites();
});

// 按ID查询树并高亮
const searchById = () => {
  const treeId = parseInt(searchId.value);
  if (modelDataMapping[treeId]) {
    const { tree, model } = modelDataMapping[treeId];

    if (tree) {
      // 恢复之前高亮的模型
      if (highlightedModel) {
        highlightedModel.color = Cesium.Color.WHITE;
      }

      // 高亮当前模型（橙色，与鼠标点击一致）
      model.color = Cesium.Color.fromCssColorString("#FFA500").withAlpha(1.0);
      highlightedModel = model;

      // 相机飞到树木位置并放大
      const treeLon = parseFloat(tree.Longitude || tree.longitude || 0);
      const treeLat = parseFloat(tree.Latitude || tree.latitude || 0);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(treeLon, treeLat, 150),
        duration: 1.0,
      });

      // 底部 tip 显示树木属性（与鼠标点击一致）
      const info = [];
      if (tree.id !== undefined) info.push(`ID: ${tree.id}`);
      const _lon = parseFloat(tree.Longitude || tree.longitude || 0);
      const _lat = parseFloat(tree.Latitude || tree.latitude || 0);
      info.push(`${t('cesium.longitude')}: ${_lon.toFixed(4)}  ${t('cesium.latitude')}: ${_lat.toFixed(4)}`);
      if (tree.Height !== undefined) info.push(`${t('cesium.treeHeight')}: ${tree.Height}`);
      if (tree.Tree_DBH !== undefined) info.push(`${t('cesium.treeDBH')}: ${tree.Tree_DBH}`);
      if (tree.Biomass !== undefined) info.push(`${t('cesium.treeBiomass')}: ${tree.Biomass}`);
      if (tree.Carbon !== undefined) info.push(`${t('cesium.treeCarbon')}: ${tree.Carbon}`);
      showTreeTipMsg(info.join('  |  '), 'tip-info');
    } else {
      showTreeTipMsg(t('cesium.invalidTreeData'), 'tip-error');
    }
  } else {
    showTreeTipMsg(t('cesium.treeIdNotFound'), 'tip-error');
  }
};

/** 显示底部 tip 消息，3 秒后自动消失 */
function showTreeTipMsg(text, type = 'tip-info') {
  treeTipText.value = text;
  treeTipType.value = type;
  showTreeTip.value = true;
  if (treeTipTimer) clearTimeout(treeTipTimer);
  treeTipTimer = setTimeout(() => {
    showTreeTip.value = false;
  }, 3000);
}


// 组件卸载时清理
onUnmounted(() => {
  if (clockDebounceTimer) {
    clearTimeout(clockDebounceTimer);
  }
  if (viewer && viewer.clock) {
    viewer.clock.onTick.removeEventListener(onClockTick);
  }
  if (currentTimeLayer) {
    viewer.imageryLayers.remove(currentTimeLayer);
  }
});

// 修改颜色映射函数
function getColorFromXCO2(xco2) {
  // 调整XCO2范围以适应实际数据分布
  const min = 370;  // 保持最小值
  const max = 430;  // 提高最大值到430
  
  // 确保值在有效范围内
  const value = Math.max(min, Math.min(max, xco2));
  const normalized = (value - min) / (max - min);
  
  // 使用HSL颜色空间：蓝色(240°)到红色(0°)
  const hue = (1 - normalized) * 240;
  return Cesium.Color.fromHsl(
    hue / 360,  // 色相（0-1）
    1.0,        // 饱和度
    0.5,        // 亮度
    1.0         // 不透明度
  );
}

// 添加新的响应式变量
const showDataPointPopup = ref(false);
const selectedDataPoint = ref({});

// 添加关闭数据点弹窗的方法
const closeDataPointPopup = () => {
  showDataPointPopup.value = false;
};

const showSatelliteInfo = ref(false);
const satelliteInfo = ref({});

// 添加规格参数翻译函数
const translateSpecKey = (key) => {
  return t(`satellite.specs.${key}`) || key;
};

// 添加图例显示状态
const showGEDILegend = ref(false);
</script>

<style scoped>
/* 通用样式重置 */
* {
  margin: 0;
  padding: 0;
}

/* Cesium 容器样式 */
#cesiumContainer {
  width: 100vw;
  height: 100vh;
}

/* 语言切换器 */
.cesium-locale-bar {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 2000; /* 始终在最上层 */
}

/* 主标题样式 */
.main-title {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 24px;
  z-index: 1000;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

/* 数据选择器样式 */
.data-selector {
  position: fixed;
  left: 20px;
  top: 100px;
  width: 200px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  z-index: 1001;
}

.data-selector h4 {
  color: #000000;
  margin-bottom: 10px;
  font-weight: 500;
}

.data-selector select {
  width: 100%;
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  color: #000000;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.data-selector select:hover {
  background: rgba(255, 255, 255, 0.95);
}

.data-selector select:focus {
  outline: none;
  border-color: rgba(0, 0, 0, 0.4);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

/* 输入框样式 */
input {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  color: #000000;
  font-size: 14px;
  transition: all 0.3s ease;
}

input::placeholder {
  color: rgba(0, 0, 0, 0.6);
}

input:focus {
  outline: none;
  border-color: rgba(0, 0, 0, 0.4);
  background: rgba(255, 255, 255, 0.95);
}

/* 弹窗样式 */
.popup {
  position: fixed;
  right: 20px;
  top: 100px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 15px;
  color: #000000;
  z-index: 1000;
  max-width: 300px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}

/* 通用按钮样式（用于面板内的按钮） */
button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.85);
  color: #000000;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
}

button:active {
  transform: translateY(1px);
}

/* 数据源指示器 */
.provider-badge {
  position: fixed;
  left: 20px;
  bottom: 120px;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  z-index: 1000;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.provider-demo {
  background: rgba(102, 126, 234, 0.85);
}
.provider-gee {
  background: rgba(52, 168, 83, 0.85);
}
.provider-copernicus {
  background: rgba(0, 150, 199, 0.85);
}

/* ============================================================
   图例面板 — 可折叠、全透明背景、停靠右侧、不遮挡其他部件
   ============================================================ */
.legend-panel {
  position: fixed;
  right: 0;
  top: 45%;                       /* 略偏上，避开底部时间轴 */
  transform: translateY(-50%);
  z-index: 1000;
  transition: all 0.25s ease;
  max-height: 60vh;               /* 限制总高度不超过视口 60% */
}

/* 展开状态 */
.legend-panel:not(.legend-collapsed) {
  right: 8px;
}

.legend-body {
  position: relative;
  width: auto;                     /* Canvas 自适应宽度 */
  min-width: 230px;                /* 匹配 canvasWidth 220 + padding */
  background: rgba(20, 20, 30, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 8px 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

/* 折叠按钮 (展开时显示在面板右上角) */
.legend-toggle-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.3;
  transition: background 0.2s;
  z-index: 1;
}
.legend-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* ---- 折叠状态: 仅显示右侧竖排标签 ---- */
.legend-collapsed {
  right: 0;
}
.legend-collapsed .legend-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: rgba(20, 20, 30, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-right: none;
  border-radius: 6px 0 0 6px;
  padding: 6px 3px;
  cursor: pointer;
  transition: background 0.2s;
  writing-mode: vertical-lr;
}
.legend-collapsed .legend-tab:hover {
  background: rgba(64, 158, 255, 0.18);
}
.legend-tab-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
  letter-spacing: 2px;
}
.legend-tab-icon {
  color: rgba(255, 255, 255, 0.4);
  font-size: 8px;
}

/* 滑入滑出动画 */
.legend-slide-enter-active,
.legend-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.legend-slide-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(30px);
}
.legend-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(30px);
}

/* 卫星选择器样式 */
.satellite-selector {
    position: fixed;
    left: 20px;
    top: 100px;
    width: 200px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 15px;
    z-index: 1001;
}

.satellite-selector h4 {
    color: #000000;
    margin-bottom: 10px;
    font-weight: 500;
}

.satellite-selector select {
    width: 100%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    color: #000000;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.satellite-selector select option {
    padding: 8px;
}

.satellite-selector select option:hover {
    background-color: rgba(0, 0, 0, 0.1);
}

/* 直方图面板（透明背景） */
.sliding-image {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(20, 25, 40, 0.78);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 12px;
  border-radius: 12px;
  z-index: 1000;
}

.sliding-image canvas {
  display: block;
  border-radius: 6px;
}

.sliding-image .close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.85);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: #000000;
  z-index: 1;
}

.sliding-image .close-button:hover {
  background: rgba(255, 255, 255, 0.95);
}

/* 添加过渡动画 */
.slide-right-enter-active,
.slide-right-leave-active,
.slide-image-enter-active,
.slide-image-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-right-enter-from,
.slide-right-leave-to,
.slide-image-enter-from,
.slide-image-leave-to {
  transform: translateX(100%);
}

/* 月份显示指示器 — 显示 Cesium 时间轴当前位置 */
.month-display {
  position: fixed;
  bottom: 38px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.timeline-nav-btn {
  border: none;
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.timeline-nav-btn:hover {
  background: rgba(64, 158, 255, 0.25);
}

/* 在style部分添加样式 */
.oco2-controls {
  position: absolute;
  top: 200px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.oco2-controls h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.oco2-controls button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

.oco2-controls button:hover {
  background: #45a049;
}

/* 在style部分添加图例样式 */
.oco2-legend {
  margin-top: 20px;
  display: block;
}

/* 数据点弹窗样式 */
.data-popup {
  position: absolute;
  top: 200px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  z-index: 1000;
  min-width: 250px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.popup-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0 5px;
}

.data-item {
  margin: 8px 0;
}

.data-label {
  font-weight: bold;
  margin-right: 10px;
}

.satellite-info-panel {
  position: absolute;
  top: 40px;
  right: 20px;
  width: 350px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 15px;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.info-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  color: #333;
}

.info-content {
  font-size: 14px;
  line-height: 1.6;
}

.info-content h4 {
  margin: 15px 0 8px;
  color: #444;
}

.info-content ul {
  margin: 0;
  padding-left: 20px;
}

.info-content li {
  margin-bottom: 5px;
}

.info-content strong {
  color: #555;
}

/* ---- 行道树查询 Tip（底部时间轴上方）---- */
.tree-tip {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 1010;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.tree-tip.tip-info {
  background: rgba(30, 35, 50, 0.92);
  color: #e0e0e0;
  border: 1px solid rgba(100, 150, 255, 0.4);
}
.tree-tip.tip-error {
  background: rgba(60, 20, 20, 0.92);
  color: #ffaaaa;
  border: 1px solid rgba(255, 100, 100, 0.4);
}

.tip-fade-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.tip-fade-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.tip-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.tip-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

</style>
