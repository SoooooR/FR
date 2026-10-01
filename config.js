// config.js
const SUPABASE_URL = 'https://oxhlcfsxvqceadgmcgwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HxM8EF8WeWd5iD6HMBOH1w_-i6qwzwl';

// ================= 全站无缝音乐控制（原有功能） =================
window.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('bg-music');
  const playBtn = document.getElementById('play-btn');

  if (audio && playBtn) {
    const savedTime = localStorage.getItem('musicTime');
    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';
    
    if (savedTime) audio.currentTime = parseFloat(savedTime);

    if (wasPlaying) {
      audio.play().then(() => {
        playBtn.textContent = '⏸️ 暂停';
      }).catch(err => {
        audio.muted = true;
        audio.play().then(() => {
          playBtn.textContent = '⏸️ 暂停 (点击任意处恢复声音)';
        });
      });
    }

    audio.addEventListener('timeupdate', () => localStorage.setItem('musicTime', audio.currentTime));
    audio.addEventListener('play', () => localStorage.setItem('musicPlaying', 'true'));
    audio.addEventListener('pause', () => localStorage.setItem('musicPlaying', 'false'));

    document.addEventListener('click', () => {
      if (audio.muted) {
        audio.muted = false;
        playBtn.textContent = '⏸️ 暂停';
      }
    }, { once: true });

    playBtn.onclick = () => {
      if (audio.paused) audio.play(); else audio.pause();
    };
  }
});

// ================= 动态粒子网络背景（非登录页才显示） =================
document.addEventListener('DOMContentLoaded', () => {
  // 判断是否为登录页
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('FR/');
  
  // 如果是登录页，或者页面没有导航栏，就不加载特效
  if (isLoginPage || !document.querySelector('.navbar')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; pointer-events:none;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = 80;
  const maxDistance = 150;
  const mouseRadius = 150;
  const mouse = { x: null, y: null };

  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width, y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1
    });
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p, index) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      if (mouse.x !== null) {
        const dx = mouse.x - p.x; const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseRadius) { p.x += dx * 0.01; p.y += dy * 0.01; }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.fill();

      for (let j = index + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x; const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
          const opacity = 1 - (dist / maxDistance);
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity * 0.4})`;
          ctx.lineWidth = 1; ctx.stroke();
        }
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
});
