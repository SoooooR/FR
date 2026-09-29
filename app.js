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

  loadMembers();
  loadPosts();
}

async function loadMembers() {
  const { data: profiles } = await siteApp.from('profiles').select('username, role').order('created_at');
  const list = document.getElementById('member-list');
  if (!profiles || profiles.length === 0) { list.innerHTML = '<p style="font-size:13px; color:#999;">暂无成员</p>'; return; }
  
  list.innerHTML = profiles.map(p => `
    <div class="member-item">
      <div class="member-avatar">${(p.username || '?')[0].toUpperCase()}</div>
      <span>${p.username || '匿名'}</span>
      <span class="member-role ${p.role === 'admin' ? 'admin' : ''}">${p.role === 'admin' ? '👑 管理员' : '成员'}</span>
    </div>
  `).join('');
}

async function createPost() {
  const title = document.getElementById('post-title').value || '无标题';
  const content = document.getElementById('post-content').value;
  if (!content) { alert('内容不能为空哦！'); return; }
  await siteApp.from('posts').insert({ author_id: currentUser.id, title, content, category: 'general' });
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  loadPosts();
}

async function loadPosts() {
  // 1. 获取所有帖子
  const { data: posts } = await siteApp.from('posts').select('*').eq('category', 'general').order('created_at', { ascending: false });
  const list = document.getElementById('posts-list');
  if (!posts || posts.length === 0) { list.innerHTML = '<p style="text-align:center; color:#8590a6; margin-top:50px;">还没有帖子，快来发第一条吧！</p>'; return; }

  // 2. 获取所有用户信息
  const { data: profiles } = await siteApp.from('profiles').select('id, username');
  const profileMap = {}; (profiles || []).forEach(p => profileMap[p.id] = p.username);

  // 3. 获取所有点赞
  const { data: likes } = await siteApp.from('likes').select('*');
  const likeCounts = {}; const userLikedSet = new Set();
  (likes || []).forEach(l => { 
    likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; 
    if (l.user_id === currentUser.id) userLikedSet.add(l.post_id);
  });

  // 4. 获取所有评论
  const { data: comments } = await siteApp.from('comments').select('*').order('created_at', { ascending: true });
  const commentMap = {};
  (comments || []).forEach(c => {
    if (!commentMap[c.post_id]) commentMap[c.post_id] = [];
    commentMap[c.post_id].push(c);
  });

  // 5. 渲染页面
  list.innerHTML = posts.map(p => {
    const isLiked = userLikedSet.has(p.id);
    const likeCount = likeCounts[p.id] || 0;
    const postComments = commentMap[p.id] || [];
    const isAdmin = currentUserRole === 'admin';

    return `
    <div class="post-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h3>${p.title}</h3>
          <div class="meta">作者：${profileMap[p.author_id] || '未知'} · 发布于 ${new Date(p.created_at).toLocaleString()}</div>
        </div>
        ${isAdmin ? `<button class="admin-delete-btn" onclick="deletePost('${p.id}')">🗑️ 删除</button>` : ''}
      </div>
      <div class="content">${marked.parse(p.content)}</div>
      
      <!-- 点赞和评论按钮 -->
      <div class="post-actions">
        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">
          ❤️ <span>${likeCount > 0 ? likeCount : '点赞'}</span>
        </button>
        <button class="action-btn" onclick="document.getElementById('comment-input-${p.id}').focus()">
          💬 评论 (${postComments.length})
        </button>
      </div>

      <!-- 评论区 -->
      <div class="comments-section" id="comments-${p.id}">
        ${postComments.map(c => `
          <div class="comment-item">
            <span class="c-author">${profileMap[c.user_id] || '匿名'}</span>：
            <span>${c.content}</span>
            <span class="c-time">${new Date(c.created_at).toLocaleString()}</span>
          </div>
        `).join('')}
        <div class="comment-input-group">
          <input type="text" id="comment-input-${p.id}" placeholder="写下你的评论...">
          <button onclick="submitComment('${p.id}')">发送</button>
        </div>
      </div>
    </div>
  `}).join('');
}

// 管理员删除帖子
async function deletePost(id) {
  if (!confirm('确定要删除这条帖子吗？')) return;
  await siteApp.from('posts').delete().eq('id', id);
  loadPosts();
}

// 点赞 / 取消点赞
async function toggleLike(postId) {
  const { data: existing } = await siteApp.from('likes').select('id').eq('post_id', postId).eq('user_id', currentUser.id).single();
  if (existing) {
    await siteApp.from('likes').delete().eq('id', existing.id); // 取消点赞
  } else {
    await siteApp.from('likes').insert({ post_id: postId, user_id: currentUser.id }); // 点赞
  }
  loadPosts(); // 刷新列表
}

// 提交评论
async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value;
  if (!content) { alert('评论不能为空！'); return; }
  await siteApp.from('comments').insert({ post_id: postId, user_id: currentUser.id, content });
  input.value = '';
  loadPosts(); // 刷新列表
}

async function changeUsername() {
  const newName = prompt("请输入新的昵称：");
  if (!newName) return;
  await siteApp.from('profiles').update({ username: newName }).eq('id', currentUser.id);
  document.getElementById('current-user').textContent = newName;
  loadMembers(); loadPosts();
}

async function logout() { await siteApp.auth.signOut(); window.location.href = 'login.html'; }

init();
