const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentUserRole = 'member';

async function init() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: profile } = await siteApp.from('profiles').select('username, role').eq('id', currentUser.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
  currentUserRole = profile?.role || 'member';

  await loadActivities();
  await loadMyApplications();
  await loadCreatorPendingApps();
  await loadCreatorHistory();
}

async function createActivity() {
  const title = document.getElementById('act-title').value;
  const reward = document.getElementById('act-reward').value;
  const desc = document.getElementById('act-desc').value;
  if (!title || !reward || !desc) { alert('请填写完整！'); return; }

  const { error } = await siteApp.from('activities').insert({ title, reward, description: desc, creator_id: currentUser.id });
  if (error) { alert('发布失败：' + error.message); return; }
  
  document.getElementById('act-title').value = '';
  document.getElementById('act-reward').value = '';
  document.getElementById('act-desc').value = '';
  alert('活动发布成功！');
  init(); // 重新加载页面数据
}

// 加载所有活动
async function loadActivities() {
  const list = document.getElementById('activities-list');
  if (!list) return;

  const { data: activities, error: actError } = await siteApp.from('activities').select('*').order('created_at', { ascending: false });
  if (actError || !activities || activities.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6;">目前没有活动。</p>';
    return;
  }

  let myAppMap = {};
  if (currentUser) {
    const { data: myApps } = await siteApp.from('activity_applications').select('activity_id, status').eq('applicant_id', currentUser.id);
    (myApps || []).forEach(a => myAppMap[a.activity_id] = a.status);
  }

  list.innerHTML = activities.map(a => {
    const status = myAppMap[a.id];
    let btnHtml = '';
    
    if (!status) btnHtml = `<button class="btn-submit" style="width:auto; padding:6px 20px; font-size:14px;" onclick="applyActivity('${a.id}')">申请参加</button>`;
    else if (status === 'pending') btnHtml = `<span style="color:#f59e0b; font-weight:bold;">⏳ 审核中</span>`;
    else if (status === 'approved') btnHtml = `<span style="color:#10b981; font-weight:bold;">✅ 已通过（获得 ${a.reward}）</span>`;
    else if (status === 'rejected') btnHtml = `<span style="color:#ef4444; font-weight:bold;">❌ 已拒绝</span>`;

    // 发布者或管理员可以删除活动
    const canDelete = currentUser.id === a.creator_id || currentUserRole === 'admin';
    const deleteBtn = canDelete ? `<button class="admin-delete-btn" style="color:#ef4444; background:none; border:none; cursor:pointer;" onclick="deleteActivity('${a.id}')">🗑️ 删除</button>` : '';

    return `
    <div class="activity-card" style="position:relative;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h3>${a.title}</h3>
        ${deleteBtn}
      </div>
      <div class="activity-reward">💰 金额：${a.reward}</div>
      <div class="content" style="font-size:14px; color:#cbd5e1;">${a.description}</div>
      <div class="activity-actions">${btnHtml}</div>
    </div>`;
  }).join('');
}

// 删除活动
async function deleteActivity(id) {
  if (!confirm('确定要删除这个活动吗？相关的申请记录也会一并消失！')) return;
  const { error } = await siteApp.from('activities').delete().eq('id', id);
  if (error) { alert('删除失败：' + error.message); return; }
  alert('活动已删除！');
  init();
}

// 申请参加活动
async function applyActivity(activityId) {
  const paymentAddress = prompt("请输入您的收款地址（如支付宝/微信/银行卡号）：");
  if (!paymentAddress) { alert('必须填写收款地址才能申请！'); return; }
  const { error } = await siteApp.from('activity_applications').insert({
    activity_id: activityId, applicant_id: currentUser.id, status: 'pending', payment_address: paymentAddress
  });
  if (error) { alert('申请失败：' + error.message); return; }
  alert('申请成功！请等待发布者审核。');
  init();
}

// 加载“我的申请记录”
async function loadMyApplications() {
  const list = document.getElementById('my-applications-list');
  const { data: apps } = await siteApp.from('activity_applications').select('*, activities(title, reward)').eq('applicant_id', currentUser.id).order('created_at', { ascending: false });

  if (!apps || apps.length === 0) {
    list.innerHTML = '<p style="color:#8590a6;">你还没有申请过任何活动。</p>';
    return;
  }

  list.innerHTML = apps.map(a => `
    <div class="post-card" style="margin-bottom:12px;">
      <div><b>活动：</b>${a.activities?.title} （金额：${a.activities?.reward}）</div>
      <div style="color: #38bdf8; margin-top:4px;"><b>收款地址：</b>${a.payment_address || '未填写'}</div>
      <div style="margin-top:8px;">状态：<span class="status-${a.status}">${a.status === 'pending' ? '⏳ 待审核' : a.status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}</span></div>
    </div>`).join('');
}

// 加载“待我审核的申请”（仅限我是发布者或管理员）
async function loadCreatorPendingApps() {
  const section = document.getElementById('creator-pending-section');
  const list = document.getElementById('creator-pending-list');

  // 1. 获取当前用户发布的活动ID
  const { data: myActivities } = await siteApp.from('activities').select('id').eq('creator_id', currentUser.id);
  const myActIds = (myActivities || []).map(a => a.id);

  if (myActIds.length === 0 && currentUserRole !== 'admin') {
    section.style.display = 'none';
    return;
  }

  // 2. 查询这些活动下的待审核申请（如果是管理员，查全部；如果是发布者，只查自己的）
  let query = siteApp.from('activity_applications').select('*, activities(title, reward)').eq('status', 'pending').order('created_at', { ascending: false });
  if (currentUserRole !== 'admin') {
    query = query.in('activity_id', myActIds);
  }

  const { data: apps } = await query;
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  if (!apps || apps.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = apps.map(a => `
    <div class="post-card" style="border-left: 4px solid #f59e0b; margin-bottom:12px;">
      <div><b>申请人：</b>${profileMap[a.applicant_id] || '未知'}</div>
      <div><b>活动：</b>${a.activities?.title} （金额：${a.activities?.reward}）</div>
      <div style="color: #38bdf8;"><b>收款地址：</b>${a.payment_address || '未填写'}</div>
      <div style="margin-top:12px;">
        <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveApp('${a.id}')">通过</button>
        <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectApp('${a.id}')">拒绝</button>
      </div>
    </div>`).join('');
}

// 加载“历史记录”（仅限我是发布者或管理员）
async function loadCreatorHistory() {
  const section = document.getElementById('history-section');
  const list = document.getElementById('history-list');

  const { data: myActivities } = await siteApp.from('activities').select('id').eq('creator_id', currentUser.id);
  const myActIds = (myActivities || []).map(a => a.id);

  if (myActIds.length === 0 && currentUserRole !== 'admin') {
    section.style.display = 'none';
    return;
  }

  let query = siteApp.from('activity_applications').select('*, activities(title, reward)').neq('status', 'pending').order('created_at', { ascending: false });
  if (currentUserRole !== 'admin') {
    query = query.in('activity_id', myActIds);
  }

  const { data: apps } = await query;
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  if (!apps || apps.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = apps.map(a => `
    <div class="post-card" style="opacity:0.85; margin-bottom:12px;">
      <div><b>申请人：</b>${profileMap[a.applicant_id] || '未知'}</div>
      <div><b>活动：</b>${a.activities?.title} （金额：${a.activities?.reward}）</div>
      <div style="color: #38bdf8;"><b>收款地址：</b>${a.payment_address || '未填写'}</div>
      <div style="margin-top:8px;">状态：<span class="status-${a.status}">${a.status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}</span></div>
    </div>`).join('');
}

async function approveApp(id) { await siteApp.from('activity_applications').update({ status: 'approved' }).eq('id', id); init(); }
async function rejectApp(id) { await siteApp.from('activity_applications').update({ status: 'rejected' }).eq('id', id); init(); }
async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
