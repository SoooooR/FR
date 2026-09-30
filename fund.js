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

  await loadReviewers();
  loadFundRequests();
}

async function loadReviewers() {
  const select = document.getElementById('reviewer-id');
  const { data: profiles, error } = await siteApp.from('profiles').select('id, username').neq('id', currentUser.id);
  if (error || !profiles) { select.innerHTML = '<option value="">加载失败</option>'; return; }
  select.innerHTML = '<option value="">请选择审核人...</option>' + 
    profiles.map(p => `<option value="${p.id}">${p.username || '未知用户'}</option>`).join('');
}

async function submitFundRequest() {
  const amount = document.getElementById('fund-amount').value;
  const reason = document.getElementById('fund-reason').value;
  const reviewerId = document.getElementById('reviewer-id').value;
  const paymentAddress = document.getElementById('fund-payment-address').value;

  if (!amount || !reason || !reviewerId || !paymentAddress) { alert('请填写完整！'); return; }

  const { error } = await siteApp.from('fund_requests').insert({
    applicant_id: currentUser.id, reviewer_id: reviewerId,
    amount: parseFloat(amount), reason, payment_address: paymentAddress
  });

  if (error) { alert('提交失败：' + error.message); return; }
  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-reason').value = '';
  document.getElementById('fund-payment-address').value = '';
  document.getElementById('reviewer-id').value = '';
  loadFundRequests();
  alert('申请已提交！');
}

async function loadFundRequests() {
  // 获取所有用户资料用于显示昵称
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  // 1. 如果是管理员，显示全部记录
  if (currentUserRole === 'admin') {
    document.getElementById('my-requests').innerHTML = ''; // 管理员可以不看自己的申请，或者保留
    document.getElementById('admin-all-fund-records').style.display = 'block';

    const { data: allReqs } = await siteApp.from('fund_requests').select('*').order('created_at', { ascending: false });
    
    // 待审核的
    const pendingReqs = (allReqs || []).filter(r => r.status === 'pending');
    // 已处理的
    const processedReqs = (allReqs || []).filter(r => r.status !== 'pending');

    document.getElementById('pending-reviews').innerHTML = '<h3 style="margin-top:32px; margin-bottom:16px; color:#fff;">⏳ 待我审核的申请</h3>' + 
      (pendingReqs.length === 0 ? '<p style="color:#8590a6;">暂无待审核申请。</p>' : pendingReqs.map(r => `
      <div class="post-card" style="border-left: 4px solid #f59e0b;">
        <div><b>申请人：</b>${profileMap[r.applicant_id] || '未知'} | <b>金额：</b>¥${r.amount}</div>
        <div><b>理由：</b>${r.reason}</div>
        <div style="color: #38bdf8;"><b>收款地址：</b>${r.payment_address || '未填写'}</div>
        <div style="margin-top:12px;">
          <button class="btn-submit" style="background:#10b981; width:auto; padding:6px 16px; font-size:13px; margin-right:10px;" onclick="approveRequest('${r.id}')">通过</button>
          <button class="btn-submit" style="background:#ef4444; width:auto; padding:6px 16px; font-size:13px;" onclick="rejectRequest('${r.id}')">拒绝</button>
        </div>
      </div>`).join(''));

    document.getElementById('all-fund-list').innerHTML = processedReqs.map(r => `
      <div class="post-card" style="opacity:0.85;">
        <div><b>申请人：</b>${profileMap[r.applicant_id] || '未知'} | <b>金额：</b>¥${r.amount} | <b>审核人：</b>${profileMap[r.reviewer_id] || '未知'}</div>
        <div><b>理由：</b>${r.reason}</div>
        <div style="color: #38bdf8;"><b>收款地址：</b>${r.payment_address || '未填写'}</div>
        <div style="margin-top:8px;">状态：<span class="status-${r.status}">${r.status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}</span></div>
      </div>`).join('');

  } else {
    // 2. 普通用户，只显示自己的申请
    document.getElementById('admin-all-fund-records').style.display = 'none';
    const { data: myReqs } = await siteApp.from('fund_requests').select('*').eq('applicant_id', currentUser.id).order('created_at', { ascending: false });
    
    document.getElementById('pending-reviews').innerHTML = ''; // 普通用户不需要看这个
    document.getElementById('my-requests').innerHTML = '<h3 style="margin-top:32px; margin-bottom:16px; color:#fff;">📋 我的申请记录</h3>' + 
      (myReqs || []).map(r => `
      <div class="post-card">
        <div><b>金额：</b>¥${r.amount} | <b>审核人：</b>${profileMap[r.reviewer_id] || '未知'}</div>
        <div><b>理由：</b>${r.reason}</div>
        <div style="color: #38bdf8;"><b>收款地址：</b>${r.payment_address || '未填写'}</div>
        <div style="margin-top:8px;">状态：<span class="status-${r.status}">${r.status === 'pending' ? '⏳ 待审核' : r.status === 'approved' ? '✅ 已通过' : '❌ 已拒绝'}</span></div>
      </div>`).join('');
  }
}

async function approveRequest(id) { await siteApp.from('fund_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function rejectRequest(id) { await siteApp.from('fund_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id); loadFundRequests(); }
async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
