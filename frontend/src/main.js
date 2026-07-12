import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createI18n, i18nPlugin } from './i18n';

// 创建 i18n 实例 (自动从 localStorage 恢复语言偏好)
const i18n = createI18n({
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
});

const app = createApp(App);
app.use(router);
app.use(ElementPlus);
app.use(i18nPlugin, { i18n });  // 注册国际化插件, 注入 $t / $i18n / useI18n()
app.mount('#app');
