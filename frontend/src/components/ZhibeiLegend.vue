<template>
  <div class="zhibei-legend-content">
    <div class="gradient-bar"></div>
    <div class="legend-labels">
      <span>0%</span>
      <span>25%</span>
      <span>50%</span>
      <span>75%</span>
      <span>100%</span>
    </div>
  </div>
</template>

<style scoped>
.zhibei-legend-content {
  width: 100%;
}

.gradient-bar {
  height: 20px;
  width: 100%;
  margin: 10px 0;
  background: linear-gradient(to right, 
    #FFFFE0, #ADFF2F, #32CD32, #228B22, #006400);
  border-radius: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 14px;
  color: #333;
}
</style> 