const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 检查登录状态
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const { data: profile } = await supabase
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
  const { data: { session } } = await supabase.auth.getSession();

  await supabase.from('posts').insert({
    author_id: session.user.id, title, content, category: 'general'
  });
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  loadPosts();
}

async function loadPosts() {
  const { data } = await supabase
    .from('posts').select('*, profiles(username)')
    .eq('category', 'general').order('created_at', { ascending: false });
  const list = document.getElementById('posts-list');
  list.innerHTML = (data || []).map(p =>
    `<div><h3>${p.title}</h3><p>${p.content}</p>
     <small>${p.profiles?.username || ''} · ${new Date(p.created_at).toLocaleString()}</small></div>`
  ).join('');
}

// ---- 资金审批功能 ----
async function submitFundRequest() {
  const amount = document.getElementById('fund-amount').value;
  const reason = document.getElementById('fund-reason').value;
  const { data: { session } } = await supabase.auth.getSession();

  // 你需要指定审核人的ID（可以改为下拉选择家庭成员）
  const reviewerId = prompt('请输入审核人的用户ID：');

  await supabase.from('fund_requests').insert({
    applicant_id: session.user.id,
    reviewer_id: reviewerId,
    amount: parseFloat(amount),
    reason
  });
  loadFundRequests();
}

async function loadFundRequests() {
  const { data: { session } } = await supabase.auth.getSession();

  // 我提交的申请
  const { data: myReqs } = await supabase
    .from('fund_requests').select('*')
    .eq('applicant_id', session.user.id)
    .order('created_at', { ascending: false });

  // 需要我审核的申请
  const { data: pendingReqs } = await supabase
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
  await supabase.from('fund_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
  loadFundRequests();
}

async function rejectRequest(id) {
  await supabase.from('fund_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
  loadFundRequests();
}

// ---- 资源分享功能 ----
async function shareResource() {
  const title = document.getElementById('resource-title').value;
  const url = document.getElementById('resource-url').value;
  const desc = document.getElementById('resource-desc').value;
  const { data: { session } } = await supabase.auth.getSession();

  await supabase.from('posts').insert({
    author_id: session.user.id,
    title, content: `${desc}\n链接：${url}`, category: 'resource'
  });
  loadResources();
}

async function loadResources() {
  const { data } = await supabase
    .from('posts').select('*, profiles(username)')
    .eq('category', 'resource').order('created_at', { ascending: false });
  document.getElementById('resources-list').innerHTML =
    (data || []).map(p =>
      `<div><h3>${p.title}</h3><p>${p.content}</p>
       <small>${p.profiles?.username || ''}</small></div>`
    ).join('');
}

// 退出登录
async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// 页面加载时检查登录状态
checkAuth();
