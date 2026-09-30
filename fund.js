// fund.js
const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

async function init() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: profile } = await siteApp.from('profiles').select('username').eq('id', currentUser.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';

  await loadReviewers(); // 加载审核人下拉菜单
  loadFundRequests();
}

// 加载所有其他成员，填进下拉框
async function loadReviewers() {
  const select = document.getElementById('reviewer-id');
  // 获取除了自己以外的所有用户
  const { data: profiles, error } = await siteApp.from('profiles').select('id, username').neq('id', currentUser.id);
  
  if (error) {
    select.innerHTML = '<option value="">加载失败</option>';
    return;
  }

  if (!profiles || profiles.length === 0) {
    select.innerHTML = '<option value="">暂无其他成员</option>';
    return;
  }

  select.innerHTML = '<option value="">请选择审核人...</option>' + 
    profiles.map(p => `<option value="${p.id}">${p.username || '未知用户'}</option>`).join('');
}

async function submitFundRequest() {
  const amount = document.getElementById('fund-amount').value;
  const reason = document.getElementById('fund-reason').value;
  const reviewerId = document.getElementById('reviewer-id').value;
  const paymentAddress = document.getElementById('fund-payment-address').value; // 新增

  if (!amount || !reason || !reviewerId || !paymentAddress) { alert('请填写完整！'); return; }

  const { error } = await siteApp.from('fund_requests').insert({
    applicant_id: currentUser.id,
    reviewer_id: reviewerId,
    amount: parseFloat(amount),
    reason,
    payment_address: paymentAddress // 新增
  });

  if (error) { alert('提交失败：' + error.message); return; }

  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-reason').value = '';
  document.getElementById('fund-payment-address').value = ''; // 清空
  document.getElementById('reviewer-id').value = '';
  loadFundRequests();
  alert('申请已提交！');
}

async function loadFundRequests() {
  const { data: myReqs } = await siteApp.from('fund_requests').select('*').eq('applicant_id', currentUser.id).order('created_at', { ascending: false });
  const { data: pendingReqs } = await siteApp.from('fund_requests').select('*').eq('reviewer_id', currentUser.id).eq('status', 'pending');
  
  // 加载所有用户信息，为了显示名字而不是ID
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {};
  (profiles || []).forEach(p => profileMap[p.id] = p.username);

  document.getElementById('my-requests').innerHTML = '<h3 style="margin-bottom:15px;">我的申请</h3>' + 
    (myReqs || []).map(r => `
    <div class="post-card" style="margin-bottom:10px;">
      <div>金额：¥${r.amount} | 理由：${r.reason}</div>
      <div>收款地址：${r.payment_address || '未填写'}</div>
      <div class="meta">审核人：${profileMap[r.reviewer_id] || '未知'} | 状态：<span class="status-${r.status}">${
        r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已拒绝'
      }</span></div>
    </div>`).join('');

  document.getElementById('pending-reviews').innerHTML = '<h3 style="margin-top:20px; margin-bottom:15px;">待我审核</h3>' + 
    (pendingReqs || []).map(r => `
    <div class="post-card" style="margin-bottom:10px;">
      <div>申请人：${profileMap[r.applicant_id] || '未知'} | 金额：¥${r.amount}</div>
      <div>理由：${r.reason}</div>
      <div>收款地址：<b>${r.payment_address || '未填写'}</b></div>
      <div style="margin-top:10px;">
        <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveRequest('${r.id}')">通过</button>
        <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectRequest('${r.id}')">拒绝</button>
      </div>
    </div>`).join('');
}

async function approveRequest(id) { await siteApp.from('fund_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function rejectRequest(id) { await siteApp.from('fund_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
