import * as Cesium from "cesium";

// 基础 URL 配置
const geoserverUrl = 'http://localhost:8080/geoserver/wms';
const workspace = 'hunan';
const workspace2 = 'hunangis';

// 创建年份数组
const years = Array.from({length: 21}, (_, i) => 2000 + i);

// 创建时间序列图层配置
export const timeSeriesLayers = {
  gpp: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:GPP_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),
  
  npp: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:NPP_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),

  ndvi: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:NDVI_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),

  pre: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:pre_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),

  temp1: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:temp1_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),

  temp7: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:temp7_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),
  
  // 添加人口密度图层
  population: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:population_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {}),
  
  // 添加GDP图层
  gdp: years.reduce((acc, year) => {
    acc[year] = new Cesium.WebMapServiceImageryProvider({
      url: geoserverUrl,
      layers: `${workspace}:gdp_${year}_color`,
      parameters: {
        format: 'image/png',
        transparent: true,
      },
      enablePickFeatures: false
    });
    return acc;
  }, {})
};

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
  temp1: {
    name: '1月气温',
    startYear: 2000,
    endYear: 2020,
    unit: '℃',
    layerPrefix: 'temp1_'
  },
  temp7: {
    name: '7月气温',
    startYear: 2000,
    endYear: 2020,
    unit: '℃',
    layerPrefix: 'temp7_'
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

export const temp1_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:temp1_2000_color',
    parameters: {
      service: 'WMS',
      format: 'image/png',
      transparent: true
    }
});

export const temp7_layer = new Cesium.WebMapServiceImageryProvider({
    url: geoserverUrl,
    layers: 'hunan:temp7_2000_color',
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

// 辅助函数：获取指定年份的图层
export const getYearLayer = (dataType, year) => {
  if (timeSeriesLayers[dataType] && timeSeriesLayers[dataType][year]) {
    return timeSeriesLayers[dataType][year];
  }
  return null;
};

// 辅助函数：检查数据类型是否支持时间序列
export const hasTimeSeriesData = (dataType) => {
  return dataType in timeSeriesLayers;
};
