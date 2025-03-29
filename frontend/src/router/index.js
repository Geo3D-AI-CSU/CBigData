import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/components/HomePage.vue'; 
import LoginPage from '@/components/LoginPage.vue'; 
import CesiumMap from '@/components/CesiumMap.vue';

const routes = [
  {
    path: '/',          // 根路径
    name: 'Home',
    component: HomePage,
  },
  {
    path: '/login',     // 登录注册路径
    name: 'Login',
    component: LoginPage,
  },
  {
    path: '/cesium',     // cesium路径
    name: 'Cesium',
    component: CesiumMap,
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
