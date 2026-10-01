// config.js
const SUPABASE_URL = 'https://oxhlcfsxvqceadgmcgwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HxM8EF8WeWd5iD6HMBOH1w_-i6qwzwl';

// ================= 全站无缝音乐控制 =================
window.addEventListener('DOMContentLoaded', () => {
  // 如果这个页面有音乐播放器
  const audio = document.getElementById('bg-music');
  const playBtn = document.getElementById('play-btn');

  if (audio && playBtn) {
    const savedTime = localStorage.getItem('musicTime');
    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';
    
    // 1. 恢复进度
    if (savedTime) audio.currentTime = parseFloat(savedTime);

    // 2. 如果上次是播放状态，尝试自动播放
    if (wasPlaying) {
      audio.play().then(() => {
        playBtn.textContent = '⏸️ 暂停';
      }).catch(err => {
        // 被浏览器拦截（没有用户交互），我们静音自动播放
        console.log("自动播放被拦截，启用静音自动播放等待用户点击...");
        audio.muted = true;
        audio.play().then(() => {
          playBtn.textContent = '⏸️ 暂停 (点击任意处恢复声音)';
        });
      });
    }

    // 3. 记录进度
    audio.addEventListener('timeupdate', () => {
      localStorage.setItem('musicTime', audio.currentTime);
    });

    // 4. 记录播放状态
    audio.addEventListener('play', () => localStorage.setItem('musicPlaying', 'true'));
    audio.addEventListener('pause', () => localStorage.setItem('musicPlaying', 'false'));

    // 5. 点击页面任意处，解除静音
    document.addEventListener('click', () => {
      if (audio.muted) {
        audio.muted = false;
        playBtn.textContent = '⏸️ 暂停';
      }
    }, { once: true });

    // 6. 绑定播放/暂停按钮（防止原有函数冲突）
    playBtn.onclick = () => {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    };
  }
});
