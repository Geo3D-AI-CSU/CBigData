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
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

function hasUnexpiredToken() {
  const token = localStorage.getItem('cbigdata_auth_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 > Date.now()) return true;
  } catch {
    // Invalid local token is cleared below.
  }
  localStorage.removeItem('cbigdata_auth_token');
  localStorage.removeItem('cbigdata_auth_user');
  return false;
}

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !hasUnexpiredToken()) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
