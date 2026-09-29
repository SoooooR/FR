const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { data: profile } = await siteApp.from('profiles').select('username').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
  loadMembers();
}

async function loadMembers() {
  const { data: profiles } = await siteApp.from('profiles').select('username, role').order('created_at');
  const list = document.getElementById('member-list');
  if (!profiles || profiles.length === 0) {
    list.innerHTML = '<p style="font-size:13px; color:#999;">暂无成员</p>';
    return;
  }
  list.innerHTML = profiles.map(p => `
    <div class="member-item">
      <div class="member-avatar">${(p.username || '?')[0].toUpperCase()}</div>
      <span>${p.username || '匿名'}</span>
      <span class="member-role ${p.role === 'admin' ? 'admin' : ''}">${p.role === 'admin' ? '👑 管理员' : '成员'}</span>
    </div>
  `).join('');
}

async function createPost() {
  const title = document.getElementById('post-title').value || '无标题';
  const content = document.getElementById('post-content').value;
  if (!content) { alert('内容不能为空哦！'); return; }
  const { data: { session } } = await siteApp.auth.getSession();
  await siteApp.from('posts').insert({ author_id: session.user.id, title, content, category: 'general' });
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  loadPosts();
}

async function loadPosts() {
  const { data: posts } = await siteApp.from('posts').select('*').eq('category', 'general').order('created_at', { ascending: false });
  const list = document.getElementById('posts-list');
  if (!posts || posts.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">还没有帖子，快来发第一条吧！</p>';
    return;
  }
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);
  list.innerHTML = posts.map(p => `
    <div class="post-card">
      <h3>${p.title}</h3>
      <div class="meta">作者：${profileMap[p.author_id] || '未知'} · 发布于 ${new Date(p.created_at).toLocaleString()}</div>
      <div class="content">${marked.parse(p.content)}</div>
    </div>
  `).join('');
}

async function changeUsername() {
  const newName = prompt("请输入新的昵称：");
  if (!newName) return;
  const { data: { session } } = await siteApp.auth.getSession();
  await siteApp.from('profiles').update({ username: newName }).eq('id', session.user.id);
  document.getElementById('current-user').textContent = newName;
  loadMembers();
  loadPosts();
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

checkAuth();
loadPosts();
