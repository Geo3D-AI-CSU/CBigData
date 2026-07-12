<template>
  <div class="locale-switcher">
    <button
      v-for="locale in locales"
      :key="locale.code"
      :class="['locale-btn', { active: currentLocale === locale.code }]"
      :title="locale.nativeLabel"
      @click="switchTo(locale.code)"
    >
      {{ locale.nativeLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n, availableLocales } from '@/i18n';

const { state, setLocale } = useI18n();

const locales = availableLocales;
const currentLocale = computed(() => state.locale);

function switchTo(code) {
  setLocale(code);
}
</script>

<style scoped>
.locale-switcher {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.locale-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.locale-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.locale-btn.active {
  background: rgba(60, 120, 220, 0.7);
  color: #fff;
  border-color: rgba(100, 160, 255, 0.8);
  font-weight: 600;
  box-shadow: 0 0 8px rgba(60, 120, 220, 0.4);
}
</style>
