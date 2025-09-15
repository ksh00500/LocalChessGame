import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    // 'light' | 'dark' | 'system'
    theme: 'system',
    mediaQuery: null
  }),
  getters: {
    resolvedTheme(state) {
      if (state.theme === 'light' || state.theme === 'dark') return state.theme;
      const prefersDark = typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
  },
  actions: {
    initTheme() {
      try {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          this.theme = saved;
        }
      } catch {}
      // 적용
      this.applyTheme();

      // 시스템 설정 변화를 감지해 'system'일 때만 따라감
      if (typeof window !== 'undefined' && window.matchMedia) {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
          if (this.theme === 'system') this.applyTheme();
        };
        // 최신 브라우저
        if (this.mediaQuery.addEventListener) {
          this.mediaQuery.addEventListener('change', handler);
        } else if (this.mediaQuery.addListener) {
          // 구형 브라우저 호환
          this.mediaQuery.addListener(handler);
        }
      }
    },
    setTheme(next) {
      if (!['light', 'dark', 'system'].includes(next)) return;
      this.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      this.applyTheme();
    },
    applyTheme() {
      const resolved = this.resolvedTheme;
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }
});