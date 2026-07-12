/**
 * CBigData 轻量级国际化 (i18n) 模块
 *
 * 设计要点:
 * 1. 基于 Vue 3 provide/inject + reactive，零外部依赖
 * 2. 同时支持 Composition API (useI18n) 与 Options API (this.$t)
 * 3. 语言切换即时生效，无需刷新页面
 * 4. 支持嵌套 key 访问 (如 'menu.items.basic-data.label')
 * 5. 未命中时自动回退到默认语言
 */
import { reactive, inject, provide } from 'vue';

// ─── 加载语言包 ────────────────────────────────────
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

/** 所有可用语言包 */
const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 可用语言列表 (供语言切换器使用) */
export const availableLocales = [
  { code: 'zh-CN', label: '中文', nativeLabel: '中文' },
  { code: 'en-US', label: 'English', nativeLabel: 'English' },
];

/** provide/inject 的 key — 使用 Symbol 避免命名冲突 */
export const I18N_KEY = Symbol('i18n');

// ─── 翻译函数 ──────────────────────────────────────

/**
 * 从嵌套对象中按 key 路径取值
 * @param {object} obj — 语言包对象
 * @param {string} key — 点号分隔的 key 路径, 如 'login.errors.emptyFields'
 * @returns {string|array|null}
 */
function getNestedValue(obj, key) {
  if (!obj) return null;
  const keys = key.split('.');
  let value = obj;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return null;
    }
  }
  return value;
}

/**
 * 工厂函数: 创建 i18n 实例
 * @param {object} options
 * @param {string} options.locale — 初始语言
 * @param {string} options.fallbackLocale — 回退语言
 * @returns {{ state: object, t: Function, setLocale: Function, availableLocales: Array }}
 */
export function createI18n(options = {}) {
  // 响应式状态: 切换语言时所有依赖自动更新
  const state = reactive({
    locale: options.locale || 'zh-CN',
    fallbackLocale: options.fallbackLocale || 'zh-CN',
  });

  /**
   * 翻译主函数
   * 用法: t('cesium.dataTypes.gpp') → '总初级生产力' (中文) / 'Gross Primary Productivity' (英文)
   *       t('login.errors.emptyFields') → fallback → defaultLang value
   * @param {string} key — 点号分隔的翻译键
   * @returns {string|array} 翻译文本
   */
  function t(key) {
    // 1) 在当前语言中查找
    let result = getNestedValue(messages[state.locale], key);

    // 2) 未找到 → 尝试回退语言
    if (result === null || result === undefined) {
      result = getNestedValue(messages[state.fallbackLocale], key);
    }

    // 3) 仍未找到 → 返回 key 本身 (便于发现遗漏翻译)
    if (result === null || result === undefined) {
      console.warn(`[i18n] Missing translation for key: "${key}"`);
      return key;
    }

    return result;
  }

  /**
   * 切换语言
   * @param {string} locale — 'zh-CN' | 'en-US'
   */
  function setLocale(locale) {
    if (messages[locale]) {
      state.locale = locale;
      // 持久化到 localStorage, 下次打开保持语言选择
      try {
        localStorage.setItem('cbigdata-locale', locale);
      } catch (_) { /* localStorage 不可用时忽略 */ }
    } else {
      console.warn(`[i18n] Unknown locale: "${locale}"`);
    }
  }

  // 初始化时从 localStorage 读取已保存的语言
  try {
    const saved = localStorage.getItem('cbigdata-locale');
    if (saved && messages[saved]) {
      state.locale = saved;
    }
  } catch (_) { /* 忽略 */ }

  return { state, t, setLocale, availableLocales };
}

// ─── Composition API — useI18n() ──────────────────

/**
 * 在 <script setup> 组件中使用
 *
 * @example
 *   const { t, setLocale, locale } = useI18n()
 *   console.log(t('common.appTitle'))
 *   setLocale('en-US')
 */
export function useI18n() {
  const i18n = inject(I18N_KEY);
  if (!i18n) {
    throw new Error(
      '[i18n] useI18n() must be called inside a component that has an i18n provider. ' +
      'Did you forget to call app.use(i18nPlugin, { i18n }) in main.js?'
    );
  }
  return i18n;
}

// ─── Vue 插件 (Installer) ─────────────────────────

/**
 * Vue 3 插件: 注入 $t 到 Options API 组件 + 注册全局 mixin
 *
 * 安装后:
 *  - Options API: 模板中 {{ $t('key') }}
 *  - Composition API: const { t } = useI18n()
 *
 * @example
 *   const { createI18n, i18nPlugin } = require('./i18n')
 *   const i18n = createI18n()
 *   app.use(i18nPlugin, { i18n })
 */
export const i18nPlugin = {
  install(app, options) {
    const i18n = options?.i18n;
    if (!i18n) {
      throw new Error('[i18n] i18nPlugin requires an i18n instance. Usage: app.use(i18nPlugin, { i18n })');
    }

    // 1) provide 给所有后代组件 (Composition API 通过 inject 获取)
    app.provide(I18N_KEY, i18n);

    // 2) 全局属性 $t (Options API 通过 this.$t 获取)
    app.config.globalProperties.$t = i18n.t;

    // 3) 全局属性 $i18n (需要访问 locale 或 setLocale 时使用)
    app.config.globalProperties.$i18n = i18n;
  },
};
