const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { data: profile } = await siteApp.from('profiles').select('username').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
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
    // 限制文件大小 50MB
    if (file.size > 50 * 1024 * 1024) { alert('文件不能超过 50MB！'); return; }
    
    const { data: { session } } = await siteApp.auth.getSession();
    // 生成唯一文件路径：用户ID/时间戳-文件名
    const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
    
    // 上传文件
    const { error: uploadError } = await siteApp.storage.from('files').upload(filePath, file);
    if (uploadError) { alert('文件上传失败：' + uploadError.message); return; }

    // 获取文件的公开访问 URL
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

async function loadResources() {
  const { data: posts } = await siteApp.from('posts').select('*').eq('category', 'resource').order('created_at', { ascending: false });
  const list = document.getElementById('resources-list');
  if (!posts || posts.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">还没有资源分享。</p>';
    return;
  }
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);

// 在 resources.js 顶部，加上 currentUserRole 变量
let currentUserRole = 'member';
// 在 init() 或 checkAuth() 里获取角色
// const { data: profile } = await siteApp.from('profiles').select('username, role').eq('id', session.user.id).single();
// currentUserRole = profile?.role || 'member';

// 更新 loadResources 的渲染部分：
list.innerHTML = posts.map(p => `
    <div class="post-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h3>${p.title}</h3>
        ${currentUserRole === 'admin' ? `<button class="admin-delete-btn" onclick="deleteResource('${p.id}')">🗑️ 删除</button>` : ''}
      </div>
      <div class="meta">分享者：${profileMap[p.author_id] || '未知'} · ${new Date(p.created_at).toLocaleString()}</div>
      <div class="content">${marked.parse(p.content)}</div>
    </div>
  `).join('');

// 在文件最末尾加上删除函数：
async function deleteResource(id) {
  if (!confirm('确定要删除这条资源吗？')) return;
  await siteApp.from('posts').delete().eq('id', id);
  loadResources();
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

checkAuth();
loadResources();
