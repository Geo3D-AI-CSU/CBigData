<template>
  <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
    <!-- 渐变定义 -->
    <defs>
      <linearGradient id="co2Gradient" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" style="stop-color:rgb(0,0,255);stop-opacity:1" />    <!-- 蓝色 -->
        <stop offset="33%" style="stop-color:rgb(0,255,0);stop-opacity:1" />   <!-- 绿色 -->
        <stop offset="66%" style="stop-color:rgb(255,255,0);stop-opacity:1" /> <!-- 黄色 -->
        <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />  <!-- 红色 -->
      </linearGradient>
    </defs>
    
    <!-- 渐变条 -->
    <rect x="40" y="20" width="30" height="200" fill="url(#co2Gradient)" />
    
    <!-- 刻度和标签 -->
    <text x="80" y="20" font-size="12" fill="black">430 ppm</text>
    <line x1="70" y1="20" x2="75" y2="20" stroke="black" />
    
    <text x="80" y="86" font-size="12" fill="black">410 ppm</text>
    <line x1="70" y1="86" x2="75" y2="86" stroke="black" />
    
    <text x="80" y="153" font-size="12" fill="black">390 ppm</text>
    <line x1="70" y1="153" x2="75" y2="153" stroke="black" />
    
    <text x="80" y="220" font-size="12" fill="black">370 ppm</text>
    <line x1="70" y1="220" x2="75" y2="220" stroke="black" />
    
    <!-- 标题 -->
    <text x="40" y="270" font-size="14" font-weight="bold" fill="black">CO₂ 浓度 (ppm)</text>
  </svg>
</template>

<script setup>
// 组件逻辑
</script>

<style scoped>
svg {
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 10px;
}

text {
  font-family: Arial, sans-serif;
}
</style> 