<template>
  <div class="tudi-legend-content">
    <div class="legend-item" v-for="(item, index) in legendItems" :key="index">
      <div class="color-box" :style="{ backgroundColor: item.color }"></div>
      <span class="item-label">{{ $t(item.i18nKey) }}</span>
    </div>
  </div>
</template>

<script setup>
const legendItems = [
  { color: '#FFC0CB', i18nKey: 'tudiLegend.farmland' },
  { color: '#800080', i18nKey: 'tudiLegend.forest' },
  { color: '#0000FF', i18nKey: 'tudiLegend.grassland' },
  { color: '#FF0000', i18nKey: 'tudiLegend.wetland' },
  { color: '#00FFFF', i18nKey: 'tudiLegend.waterBody' },
  { color: '#D2B48C', i18nKey: 'tudiLegend.builtUp' },
  { color: '#90EE90', i18nKey: 'tudiLegend.bareLand' },
  { color: '#808080', i18nKey: 'tudiLegend.other' }
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