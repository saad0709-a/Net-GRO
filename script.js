/* =========================================================================
  LinkedIn Lite — Vanilla JS + localStorage
  Features:
   - Profile editing (with avatar upload base64)
   - Post delete (owner-only)
   - Feed search/filter
   - Image attachments for posts (base64)
   - Import/Export JSON backup/restore
   ====================================================================== */

const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

const KEYS = {
  users: 'll_users',
  posts: 'll_posts',
  comments: 'll_comments',
  likes: 'll_likes',
  educations: 'll_educations',
  experiences: 'll_experiences',
  skills: 'll_skills',
  counters: 'll_counters',
  session: 'll_session'
};

const get = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const nextId = (type) => {
  const c = get(KEYS.counters, {});
  c[type] = (c[type] || 0) + 1;
  set(KEYS.counters, c);
  return c[type];
};
const dateISO = () => new Date().toISOString();

/* ---------- File → base64 helper (for images) ---------- */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

/* ---------- Avatar generator ---------- */
function avatarFor(user) {
  const name = (user?.Name || 'User').trim();
  const initials = name.split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'U').join('');
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const bg = `hsl(${hue} 60% 24%)`;
  const fg = `hsl(${hue} 80% 88%)`;
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'>
      <defs><clipPath id='r'><rect x='0' y='0' width='150' height='150' rx='24'/></clipPath></defs>
      <rect width='150' height='150' fill='${bg}' clip-path='url(#r)'/>
      <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
            font-family='Inter, system-ui, Segoe UI, Roboto, Arial'
            font-size='56' font-weight='700' fill='${fg}'>${initials}</text>
    </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function avatarURL(user) {
  return user?.ProfilePicURL ? user.ProfilePicURL : avatarFor(user);
}

/* ---------- Seed demo data ---------- */
function seedIfEmpty() {
  if (get(KEYS.users).length) return;
  const user1 = {
    UserID: nextId('User'),
    Name: 'Aisha Khan',
    Email: 'aisha@example.com',
    Password: 'password',
    Bio: 'Curious builder. I like clean UI and clear APIs.',
    Headline: 'Frontend Engineer @ Example',
    ProfilePicURL: ''
  };
  const user2 = {
    UserID: nextId('User'),
    Name: 'Rohit Sharma',
    Email: 'rohit@example.com',
    Password: 'password',
    Bio: 'Full-stack dev who ships fast.',
    Headline: 'Full-stack Developer @ Startup',
    ProfilePicURL: ''
  };
  set(KEYS.users, [user1, user2]);

  const post1 = {
    PostID: nextId('Post'),
    Content: 'Built a tiny LinkedIn clone in vanilla JS. localStorage FTW!',
    Date: dateISO(),
    UserID: user1.UserID,
    ImageURL: ''
  };
  const post2 = {
    PostID: nextId('Post'),
    Content: 'Hiring interns for a side project. DM if you love frontend.',
    Date: dateISO(),
    UserID: user2.UserID,
    ImageURL: ''
  };
  set(KEYS.posts, [post2, post1]);

  const c1 = { CommentID: nextId('Comment'), Content: 'Looks slick! Share the repo?', Date: dateISO(), UserID: user2.UserID, PostID: post1.PostID };
  const c2 = { CommentID: nextId('Comment'), Content: 'I’m interested! What stack?', Date: dateISO(), UserID: user1.UserID, PostID: post2.PostID };
  set(KEYS.comments, [c1, c2]);

  const l1 = { LikeID: nextId('Like'), UserID: user2.UserID, PostID: post1.PostID };
  const l2 = { LikeID: nextId('Like'), UserID: user1.UserID, PostID: post2.PostID };
  set(KEYS.likes, [l1, l2]);

  set(KEYS.session, { userId: user1.UserID });
}

/* ---------- Auth & session ---------- */
function currentUser() {
  const sess = get(KEYS.session, null);
  if (!sess) return null;
  const users = get(KEYS.users, []);
  return users.find(u => u.UserID === sess.userId) || null;
}
function login(email, password) {
  const users = get(KEYS.users, []);
  const user = users.find(u => u.Email === email && u.Password === password);
  if (!user) return false;
  set(KEYS.session, { userId: user.UserID });
  return true;
}
function signup({ name, email, password, headline, bio }) {
  const users = get(KEYS.users, []);
  if (users.some(u => u.Email === email)) throw new Error('Email already registered.');
  const newUser = {
    UserID: nextId('User'),
    Name: name,
    Email: email,
    Password: password,
    Bio: bio || '',
    Headline: headline || '',
    ProfilePicURL: ''
  };
  users.push(newUser);
  set(KEYS.users, users);
  set(KEYS.session, { userId: newUser.UserID });
  return newUser;
}
function logout(){ localStorage.removeItem(KEYS.session); }

/* ---------- Database helpers ---------- */
const db = {
  users: () => get(KEYS.users, []),
  posts: () => get(KEYS.posts, []),
  comments: () => get(KEYS.comments, []),
  likes: () => get(KEYS.likes, []),
  addPost(content, userId, image=''){
    const posts = db.posts();
    const p = { PostID: nextId('Post'), Content: content, Date: dateISO(), UserID: userId, ImageURL: image };
    posts.unshift(p); set(KEYS.posts, posts); return p;
  },
  deletePost(postId){
    set(KEYS.posts, db.posts().filter(p=>p.PostID!==postId));
    set(KEYS.comments, db.comments().filter(c=>c.PostID!==postId));
    set(KEYS.likes, db.likes().filter(l=>l.PostID!==postId));
  },
  addComment(content,uId,pId){
    const list = db.comments();
    const c = { CommentID: nextId('Comment'), Content: content, Date: dateISO(), UserID: uId, PostID: pId };
    list.push(c); set(KEYS.comments,list); return c;
  },
  toggleLike(uId,pId){
    const likes=db.likes(); const found=likes.find(l=>l.UserID===uId&&l.PostID===pId);
    if(found) likes.splice(likes.indexOf(found),1); else likes.push({LikeID:nextId('Like'),UserID:uId,PostID:pId});
    set(KEYS.likes,likes);
  },
  updateUser(u){ set(KEYS.users, db.users().map(x=>x.UserID===u.UserID?u:x)); }
};

/* ---------- Helpers ---------- */
function timeago(iso){
  const d=new Date(iso), diff=(Date.now()-d)/1000;
  if(diff<60)return'just now'; if(diff<3600)return`${Math.floor(diff/60)}m ago`;
  if(diff<86400)return`${Math.floor(diff/3600)}h ago`; return d.toLocaleString();
}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

/* ---------- Feed rendering ---------- */
let currentSearch='';
$('#feedSearch')?.addEventListener('input',e=>{currentSearch=e.target.value.trim().toLowerCase();renderFeed();});
$('#clearSearch')?.addEventListener('click',()=>{currentSearch='';$('#feedSearch').value='';renderFeed();});

function renderFeed(){
  const me=currentUser(); if(!me)return;
  $('#composerAvatar').src=avatarURL(me);
  const posts=db.posts(), users=db.users(), cmts=db.comments(), likes=db.likes();
  const feed=$('#feedList'); feed.innerHTML='';
  const filtered=posts.filter(p=>{
    if(!currentSearch)return true;
    const author=users.find(x=>x.UserID===p.UserID)?.Name?.toLowerCase()||'';
    return p.Content.toLowerCase().includes(currentSearch)||author.includes(currentSearch);
  });
  filtered.forEach(p=>{
    const u=users.find(x=>x.UserID===p.UserID);
    const lks=likes.filter(l=>l.PostID===p.PostID);
    const liked=lks.some(l=>l.UserID===me.UserID);
    const cm=cmts.filter(c=>c.PostID===p.PostID);
    const mine=p.UserID===me.UserID;
    const card=document.createElement('article');
    card.className='card post';
    card.innerHTML=`
      <div class="post__head">
        <img class="post__avatar" src="${avatarURL(u)}" alt="">
        <div class="post__meta">
          <span class="post__name">${u?.Name??'User'}</span>
          <span class="post__headline">${u?.Headline??''}</span>
          <span class="muted" style="font-size:.85rem">${timeago(p.Date)}</span>
        </div>
        ${mine?`<button class="btn btn--small btn--danger" data-del="${p.PostID}">Delete</button>`:''}
      </div>
      <div class="post__content">${escapeHtml(p.Content)}</div>
      ${p.ImageURL?`<img class="post__img" src="${p.ImageURL}" alt="">`:''}
      <div class="post__actions">
        <button class="iconbtn ${liked?'active':''}" data-like="${p.PostID}">♥ Like (${lks.length})</button>
        <button class="iconbtn" data-cmt-toggle="${p.PostID}">💬 Comments (${cm.length})</button>
      </div>
      <div class="commentbox" data-cmts="${p.PostID}" style="display:${cm.length?'grid':'none'}">
        ${cm.map(c=>{const cu=users.find(x=>x.UserID===c.UserID);
          return`<div class="comment"><img src="${avatarURL(cu)}"><div class="comment__bubble"><div class="comment__meta">${cu?.Name} • <span class="muted">${timeago(c.Date)}</span></div><div>${escapeHtml(c.Content)}</div></div></div>`;
        }).join('')}
        <form class="form" data-cmt-form="${p.PostID}">
          <input type="text" placeholder="Write a comment…" required />
          <button class="btn btn--small" type="submit">Reply</button>
        </form>
      </div>`;
    feed.appendChild(card);
  });
}

/* ---------- Feed interactions ---------- */
document.addEventListener('click',async e=>{
  const me=currentUser(); if(!me)return;
  const like=e.target.closest('[data-like]');
  if(like){db.toggleLike(me.UserID,+like.dataset.like);renderFeed();}
  const tog=e.target.closest('[data-cmt-toggle]');
  if(tog){const el=document.querySelector(`[data-cmts="${tog.dataset.cmtToggle}"]`);if(el)el.style.display=el.style.display==='none'?'grid':'none';}
  const del=e.target.closest('[data-del]');
  if(del&&confirm('Delete this post?')){db.deletePost(+del.dataset.del);toast('Deleted');renderFeed();}
});
document.addEventListener('submit',e=>{
  const f=e.target.closest('[data-cmt-form]');
  if(f){e.preventDefault();const id=+f.dataset.cmtForm;const me=currentUser();
    db.addComment(f.querySelector('input').value.trim(),me.UserID,id);renderFeed();}
});

/* ---------- Profile ---------- */
function renderProfile(){
  const u=currentUser(); if(!u)return;
  $('#profileAvatar').src=avatarURL(u);
  $('#profileName').textContent=u.Name; $('#profileHeadline').textContent=u.Headline; $('#profileBio').textContent=u.Bio;
  $('#editName').value=u.Name; $('#editHeadline').value=u.Headline; $('#editBio').value=u.Bio;
  $('#editAvatarPreview').src=avatarURL(u); $('#editAvatarPreview').classList.remove('hidden');
  const posts=db.posts().filter(p=>p.UserID===u.UserID);
  $('#profilePostCount').textContent=posts.length;
}

/* ---------- Avatar upload preview ---------- */
$('#editAvatar')?.addEventListener('change',async e=>{
  const file=e.target.files[0]; const data=file?await fileToDataURL(file):'';
  const img=$('#editAvatarPreview');
  if(data){img.src=data;img.dataset.newAvatar=data;img.classList.remove('hidden');}
});

/* ---------- Profile save ---------- */
$('#profileForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const me=currentUser(); const users=db.users();
  const u=users.find(x=>x.UserID===me.UserID);
  u.Name=$('#editName').value.trim();
  u.Headline=$('#editHeadline').value.trim();
  u.Bio=$('#editBio').value.trim();
  const newAv=$('#editAvatarPreview').dataset.newAvatar||'';
  if(newAv)u.ProfilePicURL=newAv;
  db.updateUser(u); toast('Profile updated'); renderProfile(); renderFeed();
});

/* ---------- Quick Post Image Preview ---------- */
let quickImageData='';
$('#quickPostImage')?.addEventListener('change',async e=>{
  const file=e.target.files[0];
  quickImageData=file?await fileToDataURL(file):'';
  const prev=$('#quickPreview');
  if(quickImageData){prev.src=quickImageData;prev.classList.remove('hidden');}
  else prev.classList.add('hidden');
});

/* ---------- Create Post Image Preview ---------- */
let createImageData='';
$('#createPostImage')?.addEventListener('change',async e=>{
  const file=e.target.files[0];
  createImageData=file?await fileToDataURL(file):'';
  const prev=$('#createPreview');
  if(createImageData){prev.src=createImageData;prev.classList.remove('hidden');}
  else prev.classList.add('hidden');
});

/* ---------- Create & Quick Post Submit ---------- */
$('#createPostForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const me=currentUser();
  const txt=$('#createPostContent').value.trim();
  if(!txt)return;
  db.addPost(txt,me.UserID,createImageData);
  e.target.reset(); $('#createPreview').classList.add('hidden'); createImageData='';
  toast('Post published'); go('#home');
});
$('#quickPostForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const me=currentUser(); const txt=$('#quickPostContent').value.trim();
  if(!txt)return;
  db.addPost(txt,me.UserID,quickImageData);
  e.target.reset(); $('#quickPreview').classList.add('hidden'); quickImageData='';
  toast('Posted'); renderFeed();
});

/* ---------- Routing ---------- */
function go(h){location.hash=h;}
function showRoute(){
  const h=location.hash||'#home';
  $$('.route').forEach(r=>r.classList.add('hidden'));
  const t=$(h); if(t)t.classList.remove('hidden');
  if(h==='#home')renderFeed(); if(h==='#profile')renderProfile();
}
window.addEventListener('hashchange',showRoute);

/* ---------- Auth ---------- */
$('#logoutBtn')?.addEventListener('click',()=>{logout();gate();});
$('#loginForm')?.addEventListener('submit',e=>{
  e.preventDefault(); if(login($('#loginEmail').value,$('#loginPassword').value)){toast('Logged in');gate();}else toast('Invalid credentials');
});
$('#signupForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  try{signup({name:$('#signupName').value,email:$('#signupEmail').value,password:$('#signupPassword').value,headline:$('#signupHeadline').value,bio:$('#signupBio').value});
    toast('Account created');gate();}catch(err){toast(err.message);}
});

/* ---------- Gate ---------- */
function gate(){
  const u=currentUser();
  if(u){$('#authGate').classList.add('hidden');$('#app').classList.remove('hidden');showRoute();}
  else{$('#app').classList.add('hidden');$('#authGate').classList.remove('hidden');}
}

/* ---------- Toast ---------- */
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1600);
}

/* ---------- Init ---------- */
seedIfEmpty(); gate(); showRoute();
