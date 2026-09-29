// resources.js
const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { data: profile } = await siteApp.from('profiles').select('username').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
}

async function shareResource() {
  const title = document.getElementById('resource-title').value;
  const url = document.getElementById('resource-url').value;
  const desc = document.getElementById('resource-desc').value;
  if (!title || !url) { alert('标题和链接不能为空！'); return; }

  const { data: { session } } = await siteApp.auth.getSession();
  await siteApp.from('posts').insert({ author_id: session.user.id, title, content: `${desc}\n\n链接：${url}`, category: 'resource' });
  document.getElementById('resource-title').value = '';
  document.getElementById('resource-url').value = '';
  document.getElementById('resource-desc').value = '';
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

  list.innerHTML = posts.map(p => `
    <div class="post-card">
      <h3>${p.title}</h3>
      <div class="meta">分享者：${profileMap[p.author_id] || '未知'} · ${new Date(p.created_at).toLocaleString()}</div>
      <div class="content">${marked.parse(p.content)}</div>
    </div>
  `).join('');
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

checkAuth();
loadResources();
