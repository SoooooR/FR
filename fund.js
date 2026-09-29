// fund.js
const siteApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
  const { data: { session } } = await siteApp.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { data: profile } = await siteApp.from('profiles').select('username').eq('id', session.user.id).single();
  document.getElementById('current-user').textContent = profile?.username || '用户';
}

async function submitFundRequest() {
  const amount = document.getElementById('fund-amount').value;
  const reason = document.getElementById('fund-reason').value;
  const reviewerId = document.getElementById('reviewer-id').value;
  if (!amount || !reason || !reviewerId) { alert('请填写完整！'); return; }
  const { data: { session } } = await siteApp.auth.getSession();
  await siteApp.from('fund_requests').insert({ applicant_id: session.user.id, reviewer_id: reviewerId, amount: parseFloat(amount), reason });
  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-reason').value = '';
  document.getElementById('reviewer-id').value = '';
  loadFundRequests();
  alert('申请已提交！');
}

async function loadFundRequests() {
  const { data: { session } } = await siteApp.auth.getSession();
  const { data: myReqs } = await siteApp.from('fund_requests').select('*').eq('applicant_id', session.user.id).order('created_at', { ascending: false });
  const { data: pendingReqs } = await siteApp.from('fund_requests').select('*').eq('reviewer_id', session.user.id).eq('status', 'pending');

  document.getElementById('my-requests').innerHTML = '<h3 style="margin-bottom:15px;">我的申请</h3>' + (myReqs || []).map(r => `
    <div class="post-card" style="margin-bottom:10px;">
      <div>金额：¥${r.amount} | 理由：${r.reason}</div>
      <div class="meta">状态：<span class="status-${r.status}">${
        r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已拒绝'
      }</span></div>
    </div>`).join('');

  document.getElementById('pending-reviews').innerHTML = '<h3 style="margin-top:20px; margin-bottom:15px;">待我审核</h3>' + (pendingReqs || []).map(r => `
    <div class="post-card" style="margin-bottom:10px;">
      <div>金额：¥${r.amount} | 理由：${r.reason}</div>
      <div style="margin-top:10px;">
        <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveRequest('${r.id}')">通过</button>
        <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectRequest('${r.id}')">拒绝</button>
      </div>
    </div>`).join('');
}

async function approveRequest(id) { await siteApp.from('fund_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function rejectRequest(id) { await siteApp.from('fund_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

checkAuth();
loadFundRequests();
