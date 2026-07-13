<template>
  <div class="dynamic-legend" ref="containerRef">
    <!-- 标题（含单位括号） -->
    <div class="legend-caption">{{ displayTitle }}</div>
    <!-- Canvas 色阶条 -->
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="legend-canvas"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { datasetColorMaps } from './LayerConfig.js';

const props = defineProps({
  dataset: { type: String, required: true },
  title:  { type: String, default: '' },
  unit:   { type: String, default: '' },
});

const canvasRef = ref(null);
const containerRef = ref(null);

// Canvas 宽度固定
const canvasWidth = ref(220);

/** 检测是否为分类数据（离散色块而非连续渐变） */
function isCategorical(dataset) {
  return dataset === 'tudi';
}

/** 去掉 "单位: " / "Unit: " 前缀，返回纯单位值 */
function stripUnitPrefix(unit) {
  return (unit || '').replace(/^(单位|Unit)[:：]\s*/, '');
}

/** 标题 + 单位括号合并显示，如 "总初级生产力 (gC/m²/year)" */
const displayTitle = computed(() => {
  const cleanUnit = stripUnitPrefix(props.unit);
  return cleanUnit ? `${props.title} (${cleanUnit})` : props.title;
});

/** Canvas 高度根据数据类型自适应 */
const canvasHeight = computed(() => {
  if (isCategorical(props.dataset)) {
    const stops = datasetColorMaps[props.dataset]?.stops || [];
    const rows = Math.ceil(stops.length / 2);
    return rows * 22 + 8; // 每行 22px (14px 色块 + 8px 间距) + 上下留白
  }
  return 36; // 连续渐变固定高度
});

/**
 * 在 Canvas 上绘制连续渐变色阶
 */
function drawContinuousGradient(ctx, stops, w, h) {
  const barTop = 2;
  const barHeight = h - 20; // 底部留空给标签

  // 构建线性渐变
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  const minVal = stops[0].value;
  const maxVal = stops[stops.length - 1].value;
  const range = maxVal - minVal || 1;

  for (const stop of stops) {
    const fraction = (stop.value - minVal) / range;
    const [r, g, b, a] = stop.color;
    gradient.addColorStop(fraction, `rgba(${r},${g},${b},${(a || 200) / 255})`);
  }

  // 绘制渐变条
  ctx.fillStyle = gradient;
  ctx.fillRect(0, barTop, w, barHeight);

  // 绘制刻度线和标签
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '9px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';

  for (const stop of stops) {
    const x = ((stop.value - minVal) / range) * w;
    // 刻度线
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, barTop + barHeight);
    ctx.lineTo(x, barTop + barHeight + 4);
    ctx.stroke();
    // 标签
    const label = formatValue(stop.value);
    ctx.fillText(label, x, barTop + barHeight + 14);
  }
}

/**
 * 在 Canvas 上绘制分类色块（土地利用等）
 */
function drawCategorical(ctx, stops, w, h) {
  const boxSize = 14;
  const gap = 6;
  const cols = 2;

  for (let i = 0; i < stops.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (w / cols);
    const y = row * (boxSize + gap) + 2;
    const [r, g, b, a] = stops[i].color;

    // 色块
    ctx.fillStyle = `rgba(${r},${g},${b},${(a || 200) / 255})`;
    ctx.fillRect(x, y, boxSize, boxSize);

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, boxSize, boxSize);

    // 标签
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stops[i].label || '', x + boxSize + 4, y + boxSize - 3);
  }
}

/** 格式化数值标签 */
function formatValue(v) {
  if (v >= 1000) return v >= 10000 ? (v / 10000).toFixed(1) + 'w' : (v / 1000).toFixed(1) + 'k';
  if (v % 1 !== 0) return v.toFixed(1);
  return String(v);
}

/** 主绘制函数 */
function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const stops = datasetColorMaps[props.dataset]?.stops;
  if (!stops || stops.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  // 清除画布
  ctx.clearRect(0, 0, w, h);

  if (isCategorical(props.dataset)) {
    drawCategorical(ctx, stops, w, h);
  } else {
    drawContinuousGradient(ctx, stops, w, h);
  }
}

onMounted(() => {
  nextTick(() => draw());
});

// 数据集切换时重绘
watch(() => props.dataset, () => {
  nextTick(() => draw());
});
</script>

<style scoped>
.dynamic-legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.legend-caption {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}

.legend-canvas {
  display: block;
  border-radius: 3px;
}
</style>
