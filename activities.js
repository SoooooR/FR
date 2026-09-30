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
    loadPendingApplications();
  }
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

// 加载所有活动，并显示当前用户的申请状态
async function loadActivities() {
  const { data: activities } = await siteApp.from('activities').select('*').order('created_at', { ascending: false });
  const list = document.getElementById('activities-list');
  if (!activities || activities.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">目前没有活动。</p>';
    return;
  }

  // 获取当前用户所有的申请记录
  const { data: myApps } = await siteApp.from('activity_applications').select('activity_id, status').eq('applicant_id', currentUser.id);
  const myAppMap = {};
  (myApps || []).forEach(a => myAppMap[a.activity_id] = a.status);

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
      <div class="content" style="font-size:14px; color:#444;">${a.description}</div>
      <div class="activity-actions">${btnHtml}</div>
    </div>`;
  }).join('');
}

// 申请参加活动（新增：要求填写收款地址）
async function applyActivity(activityId) {
  // 弹出提示让用户输入收款地址
  const paymentAddress = prompt("请输入您的收款地址（如支付宝/微信/银行卡号）：");
  if (!paymentAddress) { alert('必须填写收款地址才能申请！'); return; }

  const { error } = await siteApp.from('activity_applications').insert({
    activity_id: activityId, 
    applicant_id: currentUser.id, 
    status: 'pending',
    payment_address: paymentAddress // 存入数据库
  });

  if (error) { alert('申请失败：' + error.message); return; }
  alert('申请成功！请等待管理员审核。');
  loadActivities();
}

// 管理员：加载所有待审核的申请
async function loadPendingApplications() {
  const list = document.getElementById('pending-apps-list');
  
  // 查询所有状态为 pending 的申请
  const { data: apps } = await siteApp.from('activity_applications')
    .select('*, activities(title, reward)')
    .eq('status', 'pending').order('created_at', { ascending: false });

  if (!apps || apps.length === 0) {
    list.innerHTML = '<p style="font-size:14px; color:#999;">暂无待审核的申请。</p>';
    return;
  }

  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  list.innerHTML = apps.map(a => `
    <div class="post-card" style="margin-bottom:10px; border-left: 3px solid #f59e0b;">
      <div>申请人：<b>${profileMap[a.applicant_id] || '未知'}</b></div>
      <div>申请活动：${a.activities?.title} （奖励：${a.activities?.reward}）</div>
      <div style="color: #0084ff; margin-top: 5px;">收款地址：${a.payment_address || '未填写'}</div> <!-- 新增显示收款地址 -->
      <div style="margin-top:10px;">
        <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveApp('${a.id}')">通过</button>
        <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectApp('${a.id}')">拒绝</button>
      </div>
    </div>`).join('');
}

async function approveApp(id) {
  await siteApp.from('activity_applications').update({ status: 'approved' }).eq('id', id);
  loadPendingApplications(); loadActivities();
}
async function rejectApp(id) {
  await siteApp.from('activity_applications').update({ status: 'rejected' }).eq('id', id);
  loadPendingApplications(); loadActivities();
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
