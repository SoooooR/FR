const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局变量：记录当前用户的角色
let currentUserRole = 'member';

// 检查登录状态并获取用户角色
async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return false; }
  
  const { data: profile } = await siteApp.from('profiles').select('username, role').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
  currentUserRole = profile?.role || 'member'; // 核心：获取管理员权限
  return true;
}

// 更新界面上显示的文件名
function updateFileName() {
  const fileInput = document.getElementById('resource-file');
  const fileNameDisplay = document.getElementById('file-name');
  if (fileInput.files.length > 0) {
    fileNameDisplay.textContent = '已选择：' + fileInput.files[0].name;
    fileNameDisplay.style.color = '#0084ff';
  } else {
    fileNameDisplay.textContent = '尚未选择文件';
    fileNameDisplay.style.color = '#666';
  }
}

// 分享资源
async function shareResource() {
  const title = document.getElementById('resource-title').value;
  const url = document.getElementById('resource-url').value;
  const desc = document.getElementById('resource-desc').value;
  const fileInput = document.getElementById('resource-file');

  if (!title) { alert('资源名称不能为空！'); return; }

  let fileUrl = '';
  let fileName = '';

  // 如果有选择文件，先上传到 Supabase Storage
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 50 * 1024 * 1024) { alert('文件不能超过 50MB！'); return; }
    
    const { data: { session } } = await siteApp.auth.getSession();
    const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await siteApp.storage.from('files').upload(filePath, file);
    if (uploadError) { alert('文件上传失败：' + uploadError.message); return; }

    const { data: urlData } = siteApp.storage.from('files').getPublicUrl(filePath);
    fileUrl = urlData.publicUrl;
    fileName = file.name;
  }

  // 组装内容（Markdown 格式）
  let content = desc;
  if (fileUrl) content += `\n\n**📎 附件下载：[${fileName}](${fileUrl})**`;
  if (url) content += `\n\n**🔗 外部链接：**[点击访问](${url})`;

  const { data: { session } } = await siteApp.auth.getSession();
  await siteApp.from('posts').insert({ author_id: session.user.id, title, content, category: 'resource' });

  // 清空输入框
  document.getElementById('resource-title').value = '';
  document.getElementById('resource-url').value = '';
  document.getElementById('resource-desc').value = '';
  document.getElementById('resource-file').value = '';
  updateFileName();
  
  loadResources();
  alert('资源分享成功！');
}

// 加载资源列表
async function loadResources() {
  const { data: posts, error } = await siteApp.from('posts').select('*').eq('category', 'resource').order('created_at', { ascending: false });
  const list = document.getElementById('resources-list');
  
  if (error) {
    list.innerHTML = '<p style="color:red;">加载失败：' + error.message + '</p>';
    return;
  }
  
  if (!posts || posts.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">还没有资源分享。</p>';
    return;
  }

  // 获取所有用户资料用于显示昵称
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);

  // 渲染页面（这里已经修复了结构，正确使用了 currentUserRole）
  list.innerHTML = posts.map(p => `
    <div class="post-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h3>${p.title}</h3>
        ${currentUserRole === 'admin' ? `<button class="admin-delete-btn" onclick="deleteResource('${p.id}')">🗑️ 删除</button>` : ''}
      </div>
      <div class="meta">分享者：${profileMap[p.author_id] || '未知'} · ${new Date(p.created_at).toLocaleString()}</div>
      <div class="content">${typeof marked !== 'undefined' ? marked.parse(p.content) : p.content}</div>
    </div>
  `).join('');
}

// 管理员删除资源
async function deleteResource(id) {
  if (!confirm('确定要删除这条资源吗？')) return;
  const { error } = await siteApp.from('posts').delete().eq('id', id);
  if (error) { alert('删除失败：' + error.message); return; }
  loadResources();
}

// 退出登录
async function logout() {
  await siteApp.auth.signOut();
  window.location.href = 'login.html';
}

// 初始化执行
async function init() {
  const isLoggedIn = await checkAuth();
  if (isLoggedIn) {
    loadResources();
  }
}

init();
