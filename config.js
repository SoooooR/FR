// config.js
const SUPABASE_URL = 'https://oxhlcfsxvqceadgmcgwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HxM8EF8WeWd5iD6HMBOH1w_-i6qwzwl';

// ================= 全站鼠标炫酷跟随光晕 =================
document.addEventListener('DOMContentLoaded', () => {
  // 创建光晕元素
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.appendChild(glow);

  // 监听鼠标移动
  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
});
