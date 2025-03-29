<template>
  <div class="gedi-legend" v-if="visible">
    <div class="legend-header">
      <h3>GEDI 碳储量图例</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="legend-content">
      <div class="gradient-bar"></div>
      <div class="legend-labels">
        <span>低</span>
        <span>中</span>
        <span>高</span>
      </div>
      <div class="legend-values">
        <span>0 tC/ha</span>
        <span>150 tC/ha</span>
        <span>300+ tC/ha</span>
      </div>
      <div class="legend-description">
        <p>GEDI激光雷达测量的地上生物量碳储量</p>
        <p>数据分辨率: 1km × 1km</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close']);
</script>

<style scoped>
.gedi-legend {
  position: absolute;
  top: 200px;
  right: 20px;
  width: 250px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  padding: 15px;
  z-index: 1000;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.legend-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  color: #333;
}

.gradient-bar {
  height: 20px;
  width: 100%;
  margin: 10px 0;
  background: linear-gradient(to right, 
    #006400, #228B22, #32CD32, #9ACD32, #ADFF2F, 
    #FFFF00, #FFD700, #FFA500);
  border-radius: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 12px;
  color: #555;
}

.legend-values {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 12px;
  color: #555;
  font-weight: bold;
}

.legend-description {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.legend-description p {
  margin: 5px 0;
}
</style> 