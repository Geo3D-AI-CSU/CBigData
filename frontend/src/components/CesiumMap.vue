<template>
  <div id="cesiumContainer"></div>
  <!-- 添加大标题 -->
  <h1 class="main-title">碳中和时空大数据平台</h1>
  
  <!-- 主要按钮组 -->
  <div class="button-group">
    <BasicDataButton @flyToHunan="flyToHunan" />
    <PointCloudButton @switchToOCO="switchToOCO" />
    <StreetTreeButton @flyToStreetTrees="flyToStreetTrees" />
    <GEDIButton @switchToGEDI2D="switchToGEDI2D" />
    <SatelliteButton @toggleSatellite="toggleSatellite" />
    <BackButton @back="back" />
  </div> 

  <!-- 其他功能按钮，只在点击街道树后显示 -->
  <template v-if="showLeftButtons">
    <!-- 显示/隐藏查询框按钮 -->
    <button v-if="isCesiumLoaded" class="toggle-button" @click="toggleQueryPanel">
      {{ showQueryPanel ? "关闭" : "打开" }}查询面板
    </button>

    <!-- 左侧按钮 -->
    <button v-if="isCesiumLoaded" class="left-panel" @click="toggleImageBox">
      {{ showImages ? "关闭" : "显示" }}图像
    </button>

    <!-- 图像选择下拉框 -->
    <div v-if="isCesiumLoaded" class="image-selector">
      <h4>选择图像</h4>
      <select v-model="selectedImage" @change="toggleImageDisplay">
        <option value="1">DBH/碳</option>
        <option value="2">DBH/生物量</option>
        <option value="3">碳/生物量</option>
      </select>
    </div>

    <!-- 查询面板 -->
    <transition name="slide-panel">
      <div v-if="showQueryPanel" class="query-panel">
        <h4>树木查询</h4>
        <div>
          <select v-model="queryType">
            <option value="id">按ID查询</option>
          </select>
        </div>

        <!-- 按 ID 查询输入框 -->
        <div v-if="queryType === 'id'">
          <input v-model="searchId" placeholder="输入树木ID" />
          <button @click="searchById">查询</button>
        </div>
      </div>
    </transition>

    <!-- 查询结果弹窗 -->
    <transition name="slide-result">
      <div v-if="showResultPanel" class="result-panel">
        <h4>查询结果</h4>
        <ul>
          <li v-for="tree in searchResults" :key="tree.id">
            <p>ID: {{ tree.id }}</p>
            <p>经度: {{ tree.longitude }}</p>
            <p>纬度: {{ tree.latitude }}</p>
          </li>
        </ul>
        <button @click="closeResultPanel">关闭</button>
      </div>
    </transition>

    <!-- 右侧图像框 -->
    <transition name="slide-right">
      <div class="right-panel" v-if="showImages">
        <div class="image-box">
          <img src="@/assets/DBH.png" alt="DBH分布" />
        </div>
        <div class="image-box">
          <img src="@/assets/Biomass.png" alt="生物量分布" />
        </div>
        <div class="image-box">
          <img src="@/assets/Carbon.png" alt="碳分布" />
        </div>
      </div>
    </transition>

    <!-- 左侧滑出的图像 -->
    <transition name="slide-image">
      <div v-if="showImage" class="sliding-image">
        <button class="close-button" @click="closeImage">×</button>
        <div v-if="selectedImage === '1'" class="image-box box1">
          <img src="@/assets/DBH.png" alt="DBH分布" />
        </div>
        <div v-if="selectedImage === '2'" class="image-box box2">
          <img src="@/assets/Biomass.png" alt="生物量分布" />
        </div>
        <div v-if="selectedImage === '3'" class="image-box box3">
          <img src="@/assets/Carbon.png" alt="碳分布" />
        </div>
      </div>
    </transition>
  </template>

  <template v-if="showSTButton">
    <div class="data-selector">
      <h4>数据展示</h4>
      <select v-model="selectedData" @change="handleDataChange">
        <option value="">请选择数据类型</option>
        <option value="gpp">总初级生产力</option>
        <option value="npp">净初级生产力</option>
        <option value="ndvi">归一化植被指数</option>
        <option value="pre">降水量</option>
        <option value="temp1">一月平均气温</option>
        <option value="temp7">七月平均气温</option>
        <option value="population">人口密度</option>
        <option value="gdp">GDP</option>
        <option value="tudi">土地利用</option>
        <option value="zhibei">植被覆盖</option>
      </select>
    </div>
  </template>

  <!-- 树信息弹窗 -->
  <transition name="slide">
    <div v-if="showPopup" class="popup">
      <h3>树木信息</h3>
      <div v-for="(value, key) in selectedTree" :key="key">
        <p>
          <strong>{{ key }}:</strong> {{ value }}
        </p>
      </div>
      <button @click="closePopup">关闭</button>
    </div>
  </transition>

  <!-- 图例展示面板 -->
  <transition name="fade">
    <div v-if="showLegend" class="legend-panel">
      <h3 class="legend-title">{{ legendTitle }}</h3>
      <div class="legend-content">
        <img :src="currentLegend" :alt="legendTitle" class="legend-image"/>
        <p class="legend-unit">{{ legendUnit }}</p>
      </div>
    </div>
  </transition>

  <!-- 卫星选择菜单，仅在点击卫星实体按钮后显示 -->
  <template v-if="showSatelliteMenu">
    <div class="data-selector satellite-selector">
      <h4>卫星选择</h4>
      <select v-model="selectedSatellite" @change="handleSatelliteChange">
        <option value="">请选择卫星</option>
        <option value="all">显示所有卫星</option>
        <option value="oco2">OCO-2</option>
        <option value="gosat">GOSAT</option>
        <option value="gedi">GEDI</option>
        <option value="icesat2">ICESat-2</option>
      </select>
    </div>
  </template>

  <!-- 修改时间轴控件 -->
  <div class="timeline-panel" v-show="showTimeline">
    <div class="timeline-controls">
      <button class="play-button" @click="toggleTimelinePlay">
        {{ isPlaying ? '暂停' : '播放' }}
      </button>
      <div class="year-display">{{ currentYear }}年</div>
    </div>
    <div class="timeline-slider-container">
      <input 
        type="range" 
        v-model="currentYear" 
        :min="2000" 
        :max="2020" 
        step="1" 
        class="year-slider"
        @input="handleYearChange"
      >
      <div class="timeline-ticks">
        <div 
          v-for="year in years" 
          :key="year" 
          class="tick"
          @click="jumpToYear(year)"
        >
          <div class="tick-mark"></div>
          <div class="tick-label">{{ year }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 在template部分添加OCO2控制面板 -->
  <template v-if="showOCO2Controls">
    <div class="oco2-controls">
      <h4>OCO-2数据显示控制</h4>      
      <!-- 添加图例组件 -->
      <Legend class="oco2-legend" />     
    </div>
  </template>

  <!-- 数据点信息弹窗 -->
  <div v-if="showDataPointPopup" class="data-popup">
    <div class="popup-header">
      <h3>数据点信息</h3>
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
      <p><strong>发射日期：</strong>{{ satelliteInfo.launch_date }}</p>
      <p><strong>主要任务：</strong>{{ satelliteInfo.mission }}</p>
      
      <h4>规格参数：</h4>
      <ul>
        <li v-for="(value, key) in satelliteInfo.specifications" :key="key">
          {{ translateSpecKey(key) }}: {{ value }}
        </li>
      </ul>
      
      <h4>搭载仪器：</h4>
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

  <!-- 常规图例 (使用图片) -->
  <div v-if="showLegend && !['tudi', 'zhibei'].includes(selectedData)" class="legend-panel">
    <h3 class="legend-title">{{ legendTitle }}</h3>
    <div class="legend-content">
      <img :src="currentLegend" :alt="legendTitle" class="legend-image"/>
      <p class="legend-unit">{{ legendUnit }}</p>
    </div>
  </div>

  <!-- 土地利用图例 (使用组件) -->
  <div v-if="selectedData === 'tudi'" class="tudi-legend">
    <h3>{{ legendTitle }}<span v-if="legendUnit">({{ legendUnit }})</span></h3>
    <TudiLegend />
  </div>

  <!-- 植被覆盖图例 (使用组件) -->
  <div v-if="selectedData === 'zhibei'" class="zhibei-legend">
    <h3>{{ legendTitle }}<span v-if="legendUnit">({{ legendUnit }})</span></h3>
    <ZhibeiLegend />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { hunan_boundary, gpp_layer, npp_layer, ndvi_layer, pre_layer, 
  temp1_layer, temp7_layer, gedi_layer, tudi_layer, zhibei_layer, timeSeriesLayers } from './LayerConfig.js';
import Legend from './Legend.vue';
import BasicDataButton from './BasicDataButton.vue';
import PointCloudButton from './PointCloudButton.vue';
import StreetTreeButton from './StreetTreeButton.vue';
import GEDIButton from './GEDIButton.vue';
import SatelliteButton from './SatelliteButton.vue';
import BackButton from './BackButton.vue';
import satelliteData from '@/assets/satellites/info.json';
import GEDILegend from './GEDILegend.vue';
import TudiLegend from './TudiLegend.vue';
import ZhibeiLegend from './ZhibeiLegend.vue';
//import { ElMessage } from 'element-plus';

// 定义各个响应式状态变量
const showPopup = ref(false); // 控制树木信息弹窗的显示
const showResultPanel = ref(false); // 控制查询结果面板的显示
const selectedTree = ref({}); // 存储选中的树木信息
const searchResults = ref([]); // 存储查询结果
const selectedImage = ref(""); // 当前在下拉框中选中的图像
const previousImage = ref(""); // 存储上一次选择的图像以进行比较
const showImage = ref(false); // 控制滑动图像的显示
const showImages = ref(false); // 控制图像面板的显示
const isCesiumLoaded = ref(false); // 判断 Cesium 是否加载成功
const showLeftButtons = ref(false); // 控制左侧按钮的显示
const showSTButton = ref(false); // 控制生态系统按钮的显示

// 与查询功能相关的状态
const queryType = ref("id"); // 默认查询类型设置为 'id'
const searchId = ref(""); // 存储输入的树木 ID
const showQueryPanel = ref(false); // 控制查询面板的显示

let highlightedModel = null; // 存储当前高亮显示的模型
let viewer; // Cesium Viewer 实例
let modelDataMapping = {}; // 存储树木模型和其数据的映射关系

let hunandata; 
let gppdata;
let nppdata;
let ndvidata;
let predata;
let temp1data;
let temp7data;
let gedidata;
let tudidata;
let zhibeidata;
let satellites = {}; // 存储所有卫星实体
// 添加选中的数据类型状态
const selectedData = ref('');

// 图例相关的响应式变量
const showLegend = ref(false);
const currentLegend = ref('');
const legendTitle = ref('');
const legendUnit = ref('');

// 图例配置对象
const legendConfig = {
  gpp: {
    image: new URL('@/assets/gpp_picture.png', import.meta.url).href,
    title: '总初级生产力',
    unit: '单位: gC/m²/year'
  },
  npp: {
    image: new URL('@/assets/npp_picture.png', import.meta.url).href,
    title: '净初级生产力',
    unit: '单位: gC/m²/year'
  },
  ndvi: {
    image: new URL('@/assets/ndvi_picture.png', import.meta.url).href,
    title: '归一化植被指数',
    unit: '单位: 无量纲'
  },
  pre: {
    image: new URL('@/assets/pre_picture.png', import.meta.url).href,
    title: '降水量',
    unit: '单位: mm'
  },
  temp1: {
    image: new URL('@/assets/temp1_picture.png', import.meta.url).href,
    title: '一月平均气温',
    unit: '单位: ℃'
  },
  temp7: {
    image: new URL('@/assets/temp7_picture.png', import.meta.url).href,
    title: '七月平均气温',
    unit: '单位: ℃'
  },
  population: {
    image: new URL('@/assets/population_picture.png', import.meta.url).href,
    title: '人口密度',
    unit: '人/km²'   
  },
  gdp: {
    image: new URL('@/assets/gdp_picture.png', import.meta.url).href,
    title: 'GDP',
    unit: '亿元'
  }
};

// 添加卫星相关的响应式变量
const showSatelliteMenu = ref(false);
const selectedSatellite = ref('oco2');

// 添加时间轴相关的响应式变量
const showTimeline = ref(false);
const currentYear = ref(2000);
const isPlaying = ref(false);
let playInterval = null;
let currentTimeLayer = null;

// 添加年份数组
const years = Array.from({length: 21}, (_, i) => 2000 + i);

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
          // 清除其他图层
          hideAllLayers();
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
            console.warn('没有获取到数据');
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
                  '经度': longitude.toFixed(4) + '°',
                  '纬度': latitude.toFixed(4) + '°',
                  'CO2浓度': props.xco2.getValue().toFixed(2) + ' ppm',
                  '观测时间': timestamp.toLocaleString('zh-CN', {
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

// 切换查询面板的显示/隐藏
const toggleQueryPanel = () => {
  showQueryPanel.value = !showQueryPanel.value;
};

// 切换图像框的显示/隐藏
const toggleImageBox = () => {
  showImages.value = !showImages.value;
};

// 切换图片显示/隐藏
const toggleImageDisplay = () => {
  if (selectedImage.value === previousImage.value) {
    // 如果选择的是相同的图片，切换显示/隐藏
    showImage.value = !showImage.value;
  } else {
    // 如果选择了不同的图片，始终显示
    showImage.value = true;
  }
  // 更新 previousImage 为当前选择的图片
  previousImage.value = selectedImage.value;
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
      
      // 确保查询面板和图像选择器可见
      showQueryPanel.value = false; // 初始状态设为隐藏
      showImages.value = false; // 初始状态设为隐藏
      
      // 重置图像相关状态
      selectedImage.value = "";
      showImage.value = false;
      
      // 显示图像选择器
      document.querySelector('.image-selector')?.classList.remove('hidden');
      
      // 显示左侧面板按钮
      document.querySelector('.left-panel')?.classList.remove('hidden');
      
      // 显示查询按钮
      document.querySelector('.toggle-button')?.classList.remove('hidden');
    }
  });
};

const flyToHunan = () => {
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
      showTimeline.value = true; // 显示时间轴
    }
  });
};

// 修改数据选择处理函数
const handleDataChange = () => {
  // 隐藏所有固定图层
  hideAllLayers();
  
  // 清除时间序列图层
  if (currentTimeLayer) {
    viewer.imageryLayers.remove(currentTimeLayer);
    currentTimeLayer = null;
  }
  
  if (selectedData.value) {
    // 检查是否是静态图层（土地利用和植被覆盖）
    if (selectedData.value === 'tudi' || selectedData.value === 'zhibei') {
      // 静态图层不显示时间轴
      showTimeline.value = false;
      
      // 直接显示对应图层
      if (selectedData.value === 'tudi') {
        tudidata.show = true;
        console.log('显示土地利用图层');
        
        // 设置土地利用图例标题
        legendTitle.value = '土地利用类型';
        legendUnit.value = '';
      } else {
        zhibeidata.show = true;
        console.log('显示植被覆盖图层');
        
        // 设置植被覆盖图例标题
        legendTitle.value = '植被覆盖度';
        legendUnit.value = '%';
      }
      
      // 显示图例 - 只显示组件图例，不显示图片图例
      showLegend.value = false; // 关闭常规图例
      currentLegend.value = ''; // 清空图例图片
    } else {
      // 其他数据类型显示时间轴
      showTimeline.value = true;
      // 更新图层显示
      updateLayerByYear();
      
      // 显示对应图例
      const legend = legendConfig[selectedData.value];
      if (legend) {
        currentLegend.value = legend.image;
        legendTitle.value = legend.title;
        legendUnit.value = legend.unit;
        showLegend.value = true;
      }
    }
  } else {
    showLegend.value = false;
    showTimeline.value = false;
  }
};

// 添加更新图层的函数
const updateLayerByYear = () => {
  if (!selectedData.value) return;

  try {
    // 移除当前时间序列图层
    if (currentTimeLayer) {
      viewer.imageryLayers.remove(currentTimeLayer);
    }

    // 获取对应年份的图层
    const layerProvider = timeSeriesLayers[selectedData.value][currentYear.value];
    
    if (layerProvider) {
      // 添加新图层
      currentTimeLayer = viewer.imageryLayers.addImageryProvider(layerProvider);
    }
  } catch (error) {
    console.error(`加载 ${currentYear.value} 年数据失败:`, error);
  }
};

// 添加年份变化处理函数
const handleYearChange = () => {
  updateLayerByYear();
};

// 添加播放控制函数
const toggleTimelinePlay = () => {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    playInterval = setInterval(() => {
      if (currentYear.value < 2020) {
        currentYear.value++;
      } else {
        currentYear.value = 2000;
      }
      handleYearChange();
    }, 1000); // 每秒更新一次
  } else {
    clearInterval(playInterval);
  }
};

// 隐藏所有图层的辅助函数
const hideAllLayers = () => {
  gppdata.show = false;
  nppdata.show = false;
  ndvidata.show = false;
  predata.show = false;
  temp1data.show = false;
  temp7data.show = false;
  tudidata.show = false;
  zhibeidata.show = false;
};

// 修改 back 函数，确保正确重置所有状态
const back = async () => {
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
    showQueryPanel.value = false;
    showImages.value = false;
    showImage.value = false;
    selectedImage.value = "";
    selectedData.value = '';
    showTimeline.value = false;
    isPlaying.value = false;
    showLegend.value = false;
    showOCO2Controls.value = false; // 隐藏 OCO-2 控制面板
    
    if (playInterval) {
      clearInterval(playInterval);
    }
    currentYear.value = 2000;
    
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

// 添加跳转到指定年份的函数
const jumpToYear = (year) => {
  currentYear.value = year;
  handleYearChange();
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
  temp1data = viewer.imageryLayers.addImageryProvider(temp1_layer); // 添加Temp1图层
  temp1data.show = false; // 隐藏Temp1图层
  temp7data = viewer.imageryLayers.addImageryProvider(temp7_layer); // 添加Temp7图层
  temp7data.show = false; // 隐藏Temp7图层
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

      // 显示弹窗并更新所选树的信息
      selectedTree.value = tree;
      showPopup.value = true;

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
  showQueryPanel.value = false;
  showImages.value = false;
  showImage.value = false;

  // 设置时钟
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // 循环播放
  viewer.clock.multiplier = 10; // 时间流速
  viewer.clock.shouldAnimate = false; // 初始时不播放

  // 添加所有卫星
  addSatellites();
});

// 关闭树信息弹窗
const closePopup = () => {
  showPopup.value = false;

  // 关闭弹窗时恢复高亮颜色
  if (highlightedModel) {
    highlightedModel.color = Cesium.Color.WHITE; // 还原默认颜色
    highlightedModel = null;
  }
};

// 定义闪烁效果的函数
let flashState = 0; //全局变量，用来控制闪烁效果的进度
const flashEffect = () => {
  if (highlightedModel) {
    flashState += 0.1; //控制模型的透明度变化
    //计算闪烁强度
    const intensity = Math.abs(Math.sin(flashState)); //范围变为 0 到 1
    highlightedModel.color =
      Cesium.Color.fromCssColorString("#ADD8E6").withAlpha(intensity); // 闪烁效果
  }
};

// 按ID查询树并高亮
const searchById = () => {
  const treeId = parseInt(searchId.value); //获取用户输入的树木 ID
  if (modelDataMapping[treeId]) {
    const { tree, model } = modelDataMapping[treeId]; 

    if (tree) {
      // 更新搜索结果并显示
      searchResults.value = [
        {
          id: tree.id,
          longitude: tree.Longitude || tree.longitude,
          latitude: tree.Latitude || tree.latitude,
        },
      ];

      showResultPanel.value = true;

      // 恢复之前高亮的模型颜色和大小
      if (highlightedModel) {
        highlightedModel.color = Cesium.Color.WHITE.withAlpha(1.0); // 还原默认颜色
        highlightedModel.scale = 5.0; // 恢复默认大小
        viewer.clock.onTick.removeEventListener(flashEffect); // 停止闪烁效果
      }

      // 高亮当前选中的模型
      model.color = Cesium.Color.fromCssColorString("#ADD8E6").withAlpha(1.0); // 设置为浅蓝色
      model.scale = 20.0; // 放大模型

      // 启动闪烁效果
      viewer.clock.onTick.addEventListener(flashEffect);

      highlightedModel = model; // 保存当前高亮的模型
    } else {
      alert("无效的树木数据。");
    }
  } else {
    alert("树木ID未找到。");
  }
};

// 关闭结果弹窗并恢复模型状态
const closeResultPanel = () => {
  if (highlightedModel) {
    // 停止闪烁效果
    viewer.clock.onTick.removeEventListener(flashEffect);

    // 启动模型缩小动画，将模型逐渐缩小到原来的大小
    const startScale = highlightedModel.scale; // 当前放大的大小
    const endScale = 4.0; // 最终恢复的默认大小

    //启动缩小动画
    viewer.scene.tweens.add({
      duration: 1.0, // 动画持续时间（秒）
      easingFunction: Cesium.EasingFunction.QUADRACTIC_IN_OUT, // 动画插值函数，提供平滑过渡
      //动画的起始和结束状态
      startObject: { scale: startScale }, //当前模型的大小
      stopObject: { scale: endScale }, //目标大小
      update: (value) => {
        highlightedModel.scale = value.scale; // 动态更新模型的缩放比例
      },
      complete: () => {
        // 动画结束后，恢复模型的默认颜色
        highlightedModel.color = Cesium.Color.WHITE.withAlpha(1.0); // 恢复为默认颜色
        highlightedModel = null; // 清除高亮模型引用
      },
    });
  }
  // 隐藏结果弹窗
  showResultPanel.value = false;
};

// 组件卸载时清理
onUnmounted(() => {
  if (playInterval) {
    clearInterval(playInterval);
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
  const translations = {
    'orbit_height': '轨道高度',
    'orbit_inclination': '轨道倾角',
    'orbit_period': '轨道周期',
    'orbit_type': '轨道类型',
    'mass': '质量',
    'size': '尺寸',
    'power': '功率',
    'laser_power': '激光功率',
    'footprint': '足迹尺寸'
  };
  return translations[key] || key;
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

/* 查询面板样式 */
.query-panel {
  position: fixed;
  left: 20px;
  top: 250px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 15px;
  color: #000000;
  z-index: 1002;
  min-width: 200px;
}

/* 结果面板样式 */
.result-panel {
  position: fixed;
  right: 20px;
  top: 100px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 15px;
  color: #000000;
  z-index: 999;
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

/* 修改图例面板样式 */
.legend-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 120px; /* 减小面板宽度 */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  padding: 10px; /* 减小内边距 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.legend-title {
  color: #000000;
  font-size: 14px; /* 减小标题字体大小 */
  font-weight: 500;
  margin-bottom: 8px;
  text-align: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 6px;
}

.legend-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.legend-image {
  width: 100px; /* 设置固定宽度 */
  height: auto; /* 保持宽高比 */
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.legend-unit {
  color: #666;
  font-size: 11px; /* 减小单位字体大小 */
  text-align: center;
  margin-top: 3px;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(20px) translateY(-50%);
}

/* 确保左侧功能按钮的样式正确 */
.toggle-button,
.left-panel {
  position: fixed;
  left: 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #000000;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1001;
  transition: all 0.3s ease;
}

.toggle-button {
  top: 180px;
}

.left-panel {
  top: 240px;
}

.image-selector {
  position: fixed;
  left: 20px;
  top: 300px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 15px;
  border-radius: 8px;
  z-index: 1001;
}

/* 添加显示/隐藏过渡效果 */
.hidden {
  display: none;
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

/* 修改右侧图像面板样式 */
.right-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 15px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-box {
  width: 450px; /* 从 300px 增加到 450px */
  height: auto;
  border-radius: 8px;
  overflow: hidden;
}

.image-box img {
  width: 100%;
  height: auto;
  display: block;
}

/* 修改滑出图像样式 */
.sliding-image {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 15px;
  z-index: 1000;
}

.sliding-image .image-box {
  width: 450px; /* 从 300px 增加到 450px */
  height: auto;
  border-radius: 8px;
  overflow: hidden;
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

/* 修改时间轴面板样式 */
.timeline-panel {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  width: 800px; /* 增加宽度 */
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.timeline-slider-container {
  position: relative;
  padding: 20px 10px 25px; /* 为刻度留出空间 */
}

.year-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: #e4e7ed;
  border-radius: 3px;
  outline: none;
  position: relative;
  z-index: 2;
}

.year-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #409eff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  z-index: 3;
}

.year-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.year-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #409eff;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.3s;
  position: relative;
  z-index: 3;
}

.year-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

/* 刻度样式 */
.timeline-ticks {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  pointer-events: none; /* 防止刻度干扰滑块操作 */
}

.tick {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  pointer-events: auto; /* 允许点击刻度 */
}

.tick-mark {
  width: 2px;
  height: 8px;
  background-color: #909399;
  margin-bottom: 5px;
}

.tick-label {
  font-size: 12px;
  color: #606266;
  transform: rotate(-45deg); /* 斜着显示年份，防止重叠 */
  transform-origin: top left;
  margin-top: 5px;
}

.tick:hover .tick-mark {
  background-color: #409eff;
}

.tick:hover .tick-label {
  color: #409eff;
}

.play-button {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  min-width: 60px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.play-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

.year-display {
  min-width: 70px;
  text-align: center;
  font-size: 14px;
  color: #000000;
  font-weight: 500;
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

/* 土地利用图例 (使用组件) */
.tudi-legend {
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%); /* 添加垂直居中 */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  padding: 20px;
  z-index: 1000;
  width: 300px; /* 设置固定宽度 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.tudi-legend h3 {
  margin-bottom: 15px;
  color: #333;
  text-align: center;
  font-size: 20px; /* 增加标题字体大小 */
  font-weight: bold;
}

/* 植被覆盖图例 (使用组件) */
.zhibei-legend {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%); /* 添加水平居中 */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  padding: 15px;
  z-index: 1000;
  width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.zhibei-legend h3 {
  margin-bottom: 15px;
  color: #333;
  text-align: center;
  font-size: 16px;
}
</style>
