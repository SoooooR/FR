const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

async function init() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: profile } = await siteApp.from('profiles').select('username, role').eq('id', currentUser.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';

  // 如果是管理员，显示发布活动的表单
  if (profile?.role === 'admin') {
    document.getElementById('create-activity-card').style.display = 'block';
  }
  loadActivities();
}

async function createActivity() {
  const title = document.getElementById('act-title').value;
  const reward = document.getElementById('act-reward').value;
  const desc = document.getElementById('act-desc').value;
  if (!title || !reward || !desc) { alert('请填写完整！'); return; }

  await siteApp.from('activities').insert({
    title, reward, description: desc, creator_id: currentUser.id
  });

  document.getElementById('act-title').value = '';
  document.getElementById('act-reward').value = '';
  document.getElementById('act-desc').value = '';
  loadActivities();
  alert('活动发布成功！');
}

async function loadActivities() {
  const { data: activities } = await siteApp.from('activities').select('*').order('created_at', { ascending: false });
  const list = document.getElementById('activities-list');
  if (!activities || activities.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">目前没有活动。</p>';
    return;
  }

  // 查询当前用户已经申请过哪些活动
  const { data: myApps } = await siteApp.from('activity_applications').select('activity_id').eq('applicant_id', currentUser.id);
  const appliedSet = new Set((myApps || []).map(a => a.activity_id));

  list.innerHTML = activities.map(a => {
    const isApplied = appliedSet.has(a.id);
    return `
    <div class="activity-card">
      <h3>${a.title}</h3>
      <div class="activity-reward">💰 奖励：${a.reward}</div>
      <div class="content" style="font-size:14px; color:#444;">${a.description}</div>
      <div class="activity-actions">
        ${isApplied 
          ? '<span style="color:#10b981; font-weight:bold;">✅ 已申请</span>' 
          : `<button class="btn-submit" style="width:auto; padding:6px 20px; font-size:14px;" onclick="applyActivity('${a.id}')">申请参加</button>`}
      </div>
    </div>
  `}).join('');
}

async function applyActivity(activityId) {
  await siteApp.from('activity_applications').insert({
    activity_id: activityId, applicant_id: currentUser.id, status: 'pending'
  });
  alert('申请成功！请等待管理员审核。');
  loadActivities();
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
