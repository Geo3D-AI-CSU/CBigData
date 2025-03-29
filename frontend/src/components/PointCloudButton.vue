<template>
  <button class="left2-btn" @click="switchToOCO">点云数据可视化</button>
</template>

<script setup>
import { ref } from 'vue';
import * as Cesium from 'cesium';

const emit = defineEmits(['switchToOCO']);

const switchToOCO = () => {
  emit('switchToOCO');
};
</script>

<style scoped>
.left2-btn {
  position: absolute;
  top: 100px;
  left: 35%;
  width: 180px;
  height: 45px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  color: #000000;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  z-index: 1001;
}

.left2-btn:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.left2-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
</style> 