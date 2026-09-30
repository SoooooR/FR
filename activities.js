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

  // 如果是管理员，显示发布活动和审核区域
  if (currentUserRole === 'admin') {
    document.getElementById('create-activity-card').style.display = 'block';
    document.getElementById('pending-apps-card').style.display = 'block';
    document.getElementById('admin-all-act-records').style.display = 'block';
    loadPendingApplications();
  }
  
  // 无论普通用户还是管理员，都要加载活动列表
  loadActivities();
}

async function createActivity() {
  const title = document.getElementById('act-title').value;
  const reward = document.getElementById('act-reward').value;
  const desc = document.getElementById('act-desc').value;
  if (!title || !reward || !desc) { alert('请填写完整！'); return; }
  await siteApp.from('activities').insert({ title, reward, description: desc, creator_id: currentUser.id });
  document.getElementById('act-title').value = '';
  document.getElementById('act-reward').value = '';
  document.getElementById('act-desc').value = '';
  loadActivities();
  alert('活动发布成功！');
}

async function loadActivities() {
  const list = document.getElementById('activities-list');
  if (!list) return; // 容错：如果页面没有这个元素，直接结束

  // 1. 获取所有活动
  const { data: activities, error: actError } = await siteApp.from('activities').select('*').order('created_at', { ascending: false });
  
  if (actError) {
    console.error("加载活动失败：", actError);
    list.innerHTML = '<p style="text-align:center; color:#ef4444; margin-top:50px;">加载活动失败，请检查网络或权限。</p>';
    return;
  }

  if (!activities || activities.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">目前没有活动。</p>';
    return;
  }

  // 2. 获取当前用户的申请记录（容错：如果 currentUser 为空，就不查）
  let myAppMap = {};
  if (currentUser) {
    const { data: myApps } = await siteApp.from('activity_applications').select('activity_id, status').eq('applicant_id', currentUser.id);
    (myApps || []).forEach(a => myAppMap[a.activity_id] = a.status);
  }

  // 3. 渲染列表
  list.innerHTML = activities.map(a => {
    const status = myAppMap[a.id]; // pending, approved, rejected, 或 undefined
    let btnHtml = '';
    
    if (!status) {
      btnHtml = `<button class="btn-submit" style="width:auto; padding:6px 20px; font-size:14px;" onclick="applyActivity('${a.id}')">申请参加</button>`;
    } else if (status === 'pending') {
      btnHtml = `<span style="color:#f59e0b; font-weight:bold;">⏳ 审核中</span>`;
    } else if (status === 'approved') {
      btnHtml = `<span style="color:#10b981; font-weight:bold;">✅ 已通过（获得 ${a.reward}）</span>`;
    } else if (status === 'rejected') {
      btnHtml = `<span style="color:#ef4444; font-weight:bold;">❌ 已拒绝</span>`;
    }

    return `
    <div class="activity-card">
      <h3>${a.title}</h3>
      <div class="activity-reward">💰 奖励：${a.reward}</div>
      <div class="content" style="font-size:14px; color:#cbd5e1;">${a.description}</div>
      <div class="activity-actions">${btnHtml}</div>
    </div>`;
  }).join('');
}

async function applyActivity(activityId) {
  const paymentAddress = prompt("请输入您的收款地址（如支付宝/微信/银行卡号）：");
  if (!paymentAddress) { alert('必须填写收款地址才能申请！'); return; }
  const { error } = await siteApp.from('activity_applications').insert({
    activity_id: activityId, applicant_id: currentUser.id, status: 'pending', payment_address: paymentAddress
  });
  if (error) { alert('申请失败：' + error.message); return; }
  alert('申请成功！请等待管理员审核。');
  loadActivities();
}

// 管理员加载所有申请（包含待审核和历史）
async function loadPendingApplications() {
  const pendingList = document.getElementById('pending-apps-list');
  const historyList = document.getElementById('all-act-list');
  if (!pendingList || !historyList) return; // 容错

  const { data: apps } = await siteApp.from('activity_applications').select('*, activities(title, reward)').order('created_at', { ascending: false });
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  if (!apps || apps.length === 0) {
    pendingList.innerHTML = '<p style="color:#8590a6;">暂无待审核的申请。</p>';
    historyList.innerHTML = '<p style="color:#8590a6;">暂无历史记录。</p>';
    return;
  }

  const pendingApps = apps.filter(a => a.status === 'pending');
  const processedApps = apps.filter(a => a.status !== 'pending');

  pendingList.innerHTML = pendingApps.length === 0 ? '<p style="color:#8590a6;">暂无待审核的申请。</p>' : pendingApps.map(a => `
    <div class="post-card" style="border-left: 4px solid #f59e0b; margin-bottom:12px;">
      <div><b>申请人：</b>${profileMap[a.applicant_id] || '未知'}</div>
      <div><b>活动：</b>${a.activities?.title} （奖励：${a.activities?.reward}）</div>
      <div style="color: #38bdf8;"><b>收款地址：</b>${a.payment_address || '未填写'}</div>
      <div style="margin-top:12px;">
        <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveApp('${a.id}')">通过</button>
        <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectApp('${a.id}')">拒绝</button>
      </div>
    </div>`).join('');

  historyList.innerHTML = processedApps.length === 0 ? '<p style="color:#8590a6;">暂无历史记录。</p>' : processedApps.map(a => `
    <div class="post-card" style="opacity:0.85; margin-bottom:12px;">
      <div><b>申请人：</b>${profileMap[a.applicant_id] || '未知'}</div>
      <div><b>活动：</b>${a.activities?.title} （奖励：${a.activities?.reward}）</div>
      <div style="color: #38bdf8;"><b>收款地址：</b>${a.payment_address || '未填写'}</div>
      <div style="margin-top:8px;">状态：<span class="status-${a.status}">${a.status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}</span></div>
    </div>`).join('');
}

async function approveApp(id) { await siteApp.from('activity_applications').update({ status: 'approved' }).eq('id', id); loadPendingApplications(); loadActivities(); }
async function rejectApp(id) { await siteApp.from('activity_applications').update({ status: 'rejected' }).eq('id', id); loadPendingApplications(); loadActivities(); }
async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
