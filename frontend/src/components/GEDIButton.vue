<template>
  <button class="right-btn" @click="switchToGEDI2D">GEDI卫星</button>
</template>

<script setup>
import { ref } from 'vue';
import * as Cesium from 'cesium';

const emit = defineEmits(['switchToGEDI2D']);

const switchToGEDI2D = () => {
  emit('switchToGEDI2D');
};
</script>

<style scoped>
.right-btn {
  position: absolute;
  top: 100px;
  left: 55%;
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

.right-btn:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.right-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
</style> 