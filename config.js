// config.js
const SUPABASE_URL = 'https://oxhlcfsxvqceadgmcgwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HxM8EF8WeWd5iD6HMBOH1w_-i6qwzwl';

// ================= 全站动态粒子网格背景 =================
document.addEventListener('DOMContentLoaded', () => {
  // 1. 创建 Canvas 并插入到页面最底层
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; pointer-events:none;';
  document.body.prepend(canvas); // 确保它在所有元素后面

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  // 2. 监听窗口大小变化
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // 3. 粒子配置
  const particles = [];
  const particleCount = 80; // 粒子数量（太多会卡，太少不够密）
  const maxDistance = 150;  // 粒子之间连线的最大距离
  const mouseRadius = 150;  // 鼠标引力范围

  // 4. 鼠标位置跟踪
  const mouse = { x: null, y: null };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // 5. 生成粒子
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5, // 随机X轴速度
      vy: (Math.random() - 0.5) * 0.5, // 随机Y轴速度
      radius: Math.random() * 2 + 1       // 粒子大小
    });
  }

  // 6. 动画循环
  function animate() {
    ctx.clearRect(0, 0, width, height);

    // 更新粒子位置并绘制
    particles.forEach((p, index) => {
      // 让粒子自己慢慢飘动
      p.x += p.vx;
      p.y += p.vy;

      // 边界反弹（防止粒子跑出屏幕）
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // 鼠标引力逻辑：如果鼠标存在且靠近粒子，粒子被“拎”起来
      if (mouse.x !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseRadius) {
          // 让粒子稍微往鼠标方向移动（产生被牵引的感觉）
          p.x += dx * 0.01;
          p.y += dy * 0.01;
        }
      }

      // 画粒子本身（小圆点）
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)'; // 亮蓝色粒子
      ctx.fill();

      // 画连线（粒子之间的网）
      for (let j = index + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          // 距离越近，线条越亮
          const opacity = 1 - (dist / maxDistance);
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity * 0.4})`; // 紫色连线
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(animate);
  }

  animate();
});
// ================= 全站修改密码功能 =================
window.changePassword = async function() {
  const newPassword = prompt("请输入新密码（至少6位）：");
  if (!newPassword || newPassword.length < 6) { alert("密码长度不能少于6位！"); return; }
  
  const confirmPassword = prompt("请再次输入新密码确认：");
  if (newPassword !== confirmPassword) { alert("两次输入的密码不一致！"); return; }

  const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await tempClient.auth.updateUser({ password: newPassword });
  
  if (error) { alert("修改密码失败：" + error.message); return; }
  alert("密码修改成功！下次登录请使用新密码。");
};
