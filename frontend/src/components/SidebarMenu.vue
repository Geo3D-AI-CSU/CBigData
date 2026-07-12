<template>
  <div class="sidebar-wrapper" :class="{ collapsed: !isExpanded }">
    <!-- 折叠/展开 切换按钮 -->
    <button
      class="sidebar-toggle"
      :title="isExpanded ? config.collapseTooltip : config.expandTooltip"
      @click="isExpanded = !isExpanded"
    >
      <span class="toggle-icon">{{ isExpanded ? '◀' : '▶' }}</span>
    </button>

    <!-- 菜单标题 -->
    <transition name="fade-slide">
      <div v-if="isExpanded" class="sidebar-title">{{ config.sidebarTitle }}</div>
    </transition>

    <!-- 菜单项列表 -->
    <ul class="sidebar-menu-list">
      <li
        v-for="item in config.menuItems"
        :key="item.id"
        class="sidebar-menu-item"
        :title="isExpanded ? '' : item.label"
        @click="handleMenuClick(item)"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <transition name="fade-slide">
          <span v-if="isExpanded" class="menu-label">{{ item.label }}</span>
        </transition>
        <transition name="fade-slide">
          <span v-if="isExpanded" class="menu-desc">{{ item.description }}</span>
        </transition>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import menuData from '@/config/menu-config.json';
import { useI18n } from '@/i18n';

const { t } = useI18n();

const emit = defineEmits([
  'flyToHunan',
  'switchToOCO',
  'flyToStreetTrees',
  'switchToGEDI2D',
  'toggleSatellite',
  'back',
]);

const isExpanded = ref(true);

// Merge config structure with i18n labels — falls back to config values
const config = computed(() => ({
  sidebarTitle: t('menu.sidebarTitle') || menuData.sidebarTitle,
  collapseTooltip: t('menu.collapseTooltip') || menuData.collapseTooltip,
  expandTooltip: t('menu.expandTooltip') || menuData.expandTooltip,
  menuItems: menuData.menuItems.map(item => ({
    ...item,
    label: t(`menu.items.${item.id}.label`) || item.label,
    description: t(`menu.items.${item.id}.description`) || item.description,
  })),
}));

function handleMenuClick(item) {
  emit(item.event);
}
</script>

<style scoped>
.sidebar-wrapper {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: rgba(30, 35, 50, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: none;
  border-radius: 0 14px 14px 0;
  padding: 12px 0;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.3s ease,
              border-radius 0.3s ease;
  width: 280px;
  min-width: 56px;
}

.sidebar-wrapper.collapsed {
  width: 56px;
  border-radius: 0 10px 10px 0;
  padding: 8px 0;
}

/* 切换按钮 */
.sidebar-toggle {
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(30, 35, 50, 0.95);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.2s ease;
  z-index: 10;
}

.sidebar-toggle:hover {
  background: rgba(60, 100, 200, 0.9);
  color: #fff;
  border-color: rgba(100, 150, 255, 0.6);
}

.toggle-icon {
  display: inline-block;
  line-height: 1;
}

/* 菜单标题 */
.sidebar-title {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 8px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
  white-space: nowrap;
}

/* 菜单列表 */
.sidebar-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 菜单项 */
.sidebar-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-menu-item:active {
  background: rgba(60, 100, 200, 0.25);
}

/* 选中态指示条 */
.sidebar-menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  height: 60%;
  width: 3px;
  background: rgba(100, 150, 255, 0);
  border-radius: 0 3px 3px 0;
  transition: background 0.2s ease;
}

.sidebar-menu-item:hover::before {
  background: rgba(100, 150, 255, 0.7);
}

/* 菜单图标 */
.menu-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  line-height: 1;
}

/* 菜单标签 */
.menu-label {
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

/* 菜单描述（展开时显示） */
.menu-desc {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  margin-left: auto;
  text-align: right;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 过渡动画 */
.fade-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 折叠态菜单项居中 */
.sidebar-wrapper.collapsed .sidebar-menu-item {
  justify-content: center;
  padding: 10px 8px;
}

.sidebar-wrapper.collapsed .menu-icon {
  font-size: 22px;
}
</style>
