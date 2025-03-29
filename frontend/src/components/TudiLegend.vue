<template>
  <div class="tudi-legend-content">
    <div class="legend-item" v-for="(item, index) in legendItems" :key="index">
      <div class="color-box" :style="{ backgroundColor: item.color }"></div>
      <span class="item-label">{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup>
const legendItems = [
  { color: '#FFC0CB', label: '耕地' },
  { color: '#800080', label: '森林' },
  { color: '#0000FF', label: '草地' },
  { color: '#FF0000', label: '湿地' },
  { color: '#00FFFF', label: '水体' },
  { color: '#D2B48C', label: '人造地表' },
  { color: '#90EE90', label: '裸地' },
  { color: '#808080', label: '其他' }
];
</script>

<style scoped>
.tudi-legend-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-box {
  width: 24px;
  height: 24px;
  border: 1px solid #ccc;
  flex-shrink: 0;
}

.item-label {
  font-size: 16px;
  color: #333;
}
</style> 