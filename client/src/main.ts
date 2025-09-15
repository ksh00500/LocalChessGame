// 초기 페인트 전에 테마 적용(FOUC 방지)
(() => {
  try {
    const saved = localStorage.getItem('theme') || 'system';
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved =
      saved === 'dark' ? 'dark' : saved === 'light' ? 'light' : prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  } catch {}
})();

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './assets/styles.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');