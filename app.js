// app.js
// 这里命名为 siteApp，绝对不会和登录页的 authApp 冲突
const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 检查登录状态
async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const { data: profile } = await siteApp
    .from('profiles').select('username').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
}

// 切换板块
function showSection(name) {
  ['posts', 'fund', 'resources'].forEach(s => {
    document.getElementById(s + '-section').style.display = (s === name) ? 'block' : 'none';
  });
  if (name === 'posts') loadPosts();
  if (name === 'fund') loadFundRequests();
  if (name === 'resources') loadResources();
}

// ---- 发帖功能 ----
async function createPost() {
  const title = document.getElementById('post-title').value;
  const content = document.getElementById('post-content').value;
  const { data: { session } } = await siteApp.auth.getSession();

  await siteApp.from('posts').insert({
    author_id: session.user.id, title, content, category: 'general'
  });
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  loadPosts();
}

async function loadPosts() {
  // 1. 只查 posts 表
  const { data: posts, error } = await siteApp
    .from('posts').select('*')
    .eq('category', 'general').order('created_at', { ascending: false });

  if (error) { 
    document.getElementById('posts-list').innerHTML = '<p style="color:red;">加载失败：' + error.message + '</p>';
    return; 
  }
  if (!posts || posts.length === 0) {
    document.getElementById('posts-list').innerHTML = '<p style="color:#999; text-align:center;">还没有帖子，快来发第一篇吧！</p>';
    return;
  }

  // 2. 查出所有用户的资料，做个映射表
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);

  // 3. 渲染帖子
  document.getElementById('posts-list').innerHTML = posts.map(p => `
    <div class="post-item">
      <h3>${p.title}</h3>
      <div class="post-meta">作者：${profileMap[p.author_id] || '未知用户'} · 发布于 ${new Date(p.created_at).toLocaleString()}</div>
      <div class="post-content">${marked.parse(p.content)}</div>
    </div>
  `).join('');
}

async function loadResources() {
  const { data: posts, error } = await siteApp
    .from('posts').select('*')
    .eq('category', 'resource').order('created_at', { ascending: false });

  const list = document.getElementById('resources-list');
  if (error || !posts || posts.length === 0) {
    list.innerHTML = '<p style="color:#999; text-align:center;">还没有资源分享。</p>';
    return;
  }

  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);

  list.innerHTML = posts.map(p => `
    <div class="post-item">
      <h3>${p.title}</h3>
      <div class="post-meta">分享者：${profileMap[p.author_id] || '未知用户'}</div>
      <div class="post-content">${marked.parse(p.content)}</div>
    </div>
  `).join('');
}

// ---- 资金审批功能 ----
async function submitFundRequest() {
  const amount = document.getElementById('fund-amount').value;
  const reason = document.getElementById('fund-reason').value;
  const reviewerId = document.getElementById('reviewer-id').value;
  const { data: { session } } = await siteApp.auth.getSession();

  await siteApp.from('fund_requests').insert({
    applicant_id: session.user.id,
    reviewer_id: reviewerId,
    amount: parseFloat(amount),
    reason
  });
  loadFundRequests();
}

async function loadFundRequests() {
  const { data: { session } } = await siteApp.auth.getSession();

  const { data: myReqs } = await siteApp
    .from('fund_requests').select('*')
    .eq('applicant_id', session.user.id)
    .order('created_at', { ascending: false });

  const { data: pendingReqs } = await siteApp
    .from('fund_requests').select('*')
    .eq('reviewer_id', session.user.id)
    .eq('status', 'pending');

  document.getElementById('my-requests').innerHTML =
    '<h3>我的申请</h3>' + (myReqs || []).map(r =>
      `<div>¥${r.amount} - ${r.reason} - 状态：${r.status}</div>`
    ).join('');

  document.getElementById('pending-reviews').innerHTML =
    '<h3>待我审核</h3>' + (pendingReqs || []).map(r =>
      `<div>¥${r.amount} - ${r.reason}
       <button onclick="approveRequest('${r.id}')">通过</button>
       <button onclick="rejectRequest('${r.id}')">拒绝</button></div>`
    ).join('');
}

async function approveRequest(id) {
  await siteApp.from('fund_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
  loadFundRequests();
}

async function rejectRequest(id) {
  await siteApp.from('fund_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
  loadFundRequests();
}

// ---- 资源分享功能 ----
async function shareResource() {
  const title = document.getElementById('resource-title').value;
  const url = document.getElementById('resource-url').value;
  const desc = document.getElementById('resource-desc').value;
  const { data: { session } } = await siteApp.auth.getSession();

  await siteApp.from('posts').insert({
    author_id: session.user.id,
    title, content: `${desc}\n链接：${url}`, category: 'resource'
  });
  loadResources();
}

async function changeUsername() {
  const newName = prompt("请输入新的昵称：");
  if (!newName) return;
  const { data: { session } } = await siteApp.auth.getSession();
  
  const { error } = await siteApp.from('profiles').update({ username: newName }).eq('id', session.user.id);
  if (error) { alert('修改失败：' + error.message); return; }
  alert('昵称已修改！');
  document.getElementById('current-user').textContent = newName;
  loadPosts(); // 刷新帖子列表
}

// 退出登录
async function logout() {
  await siteApp.auth.signOut();
  window.location.href = 'login.html';
}

// 页面加载时检查登录状态
checkAuth();
