(function(){
  // community.js - handles communities (create, join, leave) and auto-news generation
  // Storage keys:
  // - agh_communities : array of {id,title,desc,discord,creator,created,members:[]}
  // - agh_memberships_<userid> : array of community ids
  // - agh_autonews : array of generated news posts {id,title,body,source,at}

  function uid(prefix){ return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,8); }
  function safeParse(k){ try{ return JSON.parse(localStorage.getItem(k)||'null') }catch(e){ return null } }
  function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  function currentUserId(){ try{ const u = JSON.parse(localStorage.getItem('agh_user')||'null'); return u? (u.provider+':'+(u.name||u.provider)) : null }catch(e){ return null } }
  function currentUserName(){ try{ const u = JSON.parse(localStorage.getItem('agh_user')||'null'); return u? u.name : 'Anon' }catch(e){ return 'Anon' } }

  // communities API
  function loadCommunities(){ return safeParse('agh_communities') || [] }
  function saveCommunities(arr){ save('agh_communities', arr) }
  function findCommunity(id){ return loadCommunities().find(c=>c.id===id) }

  function loadMemberships(){ const id = currentUserId(); if(!id) return []; return safeParse('agh_memberships_'+id) || [] }
  function saveMemberships(arr){ const id = currentUserId(); if(!id) return; save('agh_memberships_'+id, arr) }

  // UI binding (only run on community page)
  function mountUI(){
    const container = document.getElementById('communities-root');
    if(!container) return;
    // build create form and list
    container.innerHTML = `
      <div class="community-create">
        <h3>Create or Import a Community</h3>
        <p class="muted">Bring your Discord server or start a new group - members and links are stored locally for this demo.</p>
        <div class="community-create-form">
          <input id="comm-title" placeholder="Community name" />
          <input id="comm-discord" placeholder="Discord invite URL (optional)" />
          <input id="comm-desc" placeholder="Short description" />
          <div style="display:flex;gap:8px;margin-top:8px"><button id="comm-create" class="post-btn">Create</button><button id="comm-import" class="post-btn">Import from Discord</button></div>
        </div>
      </div>
      <hr />
      <div class="community-list-wrap">
        <h3>Communities</h3>
        <div id="community-list" class="community-list"></div>
      </div>
    `;

    document.getElementById('comm-create').addEventListener('click', ()=>{
      const title = (document.getElementById('comm-title').value||'').trim();
      const desc = (document.getElementById('comm-desc').value||'').trim();
      const discord = (document.getElementById('comm-discord').value||'').trim();
      if(!title) return alert('Please provide a community name');
      const communities = loadCommunities();
      const id = uid('comm');
      const c = { id, title, desc, discord, creator: currentUserName(), created: Date.now(), members: [ currentUserName() ] };
      communities.push(c); saveCommunities(communities);
      // ensure user is a member
      const mem = loadMemberships(); if(mem.indexOf(id)===-1){ mem.push(id); saveMemberships(mem); }
      renderList();
    });

    document.getElementById('comm-import').addEventListener('click', ()=>{
      const discord = (document.getElementById('comm-discord').value||'').trim();
      if(!discord) return alert('Paste a Discord invite URL (e.g. https://discord.gg/abc123)');
      // try to derive a name from the URL (best-effort)
      const m = discord.match(/discord\.gg\/(.+)$/i) || discord.match(/discordapp\.com\/invite\/(.+)$/i);
      const code = m? m[1].split('?')[0] : discord;
      const title = 'Discord: '+ (code.length>10? code.slice(0,10)+'...' : code);
      const desc = 'Imported Discord invite: '+discord;
      const communities = loadCommunities();
      const id = uid('comm');
      const c = { id, title, desc, discord, creator: currentUserName(), created: Date.now(), members: [ currentUserName() ] };
      communities.push(c); saveCommunities(communities);
      const mem = loadMemberships(); if(mem.indexOf(id)===-1){ mem.push(id); saveMemberships(mem); }
      renderList();
      alert('Imported community (local demo). To actually join people you will need to share the Discord invite URL.');
    });

    renderList();
  }

  function renderList(){
    const wrap = document.getElementById('community-list'); if(!wrap) return;
    const comms = loadCommunities().slice().reverse();
    if(comms.length===0){ wrap.innerHTML = '<p class="muted">No communities yet - create one to get started.</p>'; return; }
    const mems = loadMemberships();
    wrap.innerHTML = '';
    comms.forEach(c=>{
      const el = document.createElement('div'); el.className = 'community-card';
      const memberCount = (c.members && c.members.length) || 0;
      const joined = mems.indexOf(c.id) !== -1;
      el.innerHTML = `
        <div class="community-main">
          <div class="community-info">
            <h4><a href="community.html?comm=${c.id}">${escapeHtml(c.title)}</a></h4>
            <p class="muted">${escapeHtml(c.desc || '')}</p>
            <div class="muted">${memberCount} members • created by ${escapeHtml(c.creator)}</div>
          </div>
          <div class="community-actions">
            ${c.discord? `<a class="ext-btn" href="${escapeHtml(c.discord)}" target="_blank" rel="noopener noreferrer">Discord invite</a>` : ''}
            <button class="post-btn" data-join="${c.id}">${joined? 'Leave' : 'Join'}</button>
          </div>
        </div>
      `;
      wrap.appendChild(el);
    });

    // bind join/leave
    wrap.querySelectorAll('[data-join]').forEach(btn=>btn.addEventListener('click', e=>{
      const id = e.currentTarget.dataset.join;
      const mems = loadMemberships();
      const idx = mems.indexOf(id);
      const communities = loadCommunities();
      const comm = communities.find(x=>x.id===id);
      const name = currentUserName();
      if(idx === -1){ // join
        mems.push(id); saveMemberships(mems);
        // add to community members
        if(comm){ comm.members = comm.members || []; if(comm.members.indexOf(name)===-1) comm.members.push(name); saveCommunities(communities); }
      } else { // leave
        mems.splice(idx,1); saveMemberships(mems);
        if(comm){ comm.members = comm.members || []; const i = comm.members.indexOf(name); if(i!==-1) comm.members.splice(i,1); saveCommunities(communities); }
      }
      renderList();
    }));
  }

  // small util
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[c])); }

  // Auto-news generator: pull Jikan top and produce short headlines
  async function generateAutoNews(){
    try{
      const existing = safeParse('agh_autonews') || [];
      // fetch top 6 anime as trending
      const res = await fetch('https://api.jikan.moe/v4/top/anime?page=1');
      if(!res.ok) return;
      const js = await res.json();
      const arr = (js.data||[]).slice(0,8).map(it=>({ id: uid('autonews'), title: it.title, body: `${it.title} is trending - score ${it.score || 'N/A'}. ${ (it.synopsis||'').slice(0,140) }`, source: it.url, at: Date.now() }));
      // merge sensibly: keep newest first and avoid duplicates by title
      const merged = arr.concat(existing).filter((v,i,self)=> i===self.findIndex(x=>x.title===v.title));
      localStorage.setItem('agh_autonews', JSON.stringify(merged.slice(0,50)) );
      return merged;
    }catch(e){ console.warn('auto news failed', e); return null }
  }

  // If there are no auto-news items, seed with curated sample headlines so site isn't blank.
  async function ensureSeededAutoNews(){
    try{
      const existing = safeParse('agh_autonews') || [];
      if(existing && existing.length) return existing;
      // curated samples
      const samples = [
        { id: uid('autonews'), title: 'One Piece returns next week', body: 'One Piece drops a major episode next week - watch parties scheduled across Accra and Kumasi.', source:'', at: Date.now() - 1000*60*60 },
        { id: uid('autonews'), title: 'Jujutsu Kaisen: Fan theories explode', body: 'Fans debate the recent twist in Jujutsu Kaisen; theories and AMVs flood social channels.', source:'', at: Date.now() - 1000*60*60*5 },
        { id: uid('autonews'), title: 'Attack on Titan rewatch: Community picks', body: 'Local groups host a rewatch of the most talked-about episodes - join a viewing near you.', source:'', at: Date.now() - 1000*60*60*24 },
        { id: uid('autonews'), title: 'New anime streaming in Ghana', body: 'Several new licenses bring classic and modern titles to regional platforms - check the details.', source:'', at: Date.now() - 1000*60*30 }
      ];
      localStorage.setItem('agh_autonews', JSON.stringify(samples.concat(existing)));
      return samples;
    }catch(e){ return [] }
  }

  // COMMUNITY PAGE: render a dedicated community page (community.html?comm=<id>) with pinned posts, chat, and announcements
  function mountCommunityPage(commId){
    const root = document.getElementById('communities-root');
    if(!root) return;
    const comm = findCommunity(commId);
    if(!comm){ root.innerHTML = `<p class="muted">Community not found.</p>`; return; }
    // ensure structure
    root.innerHTML = `
      <div class="community-page">
        <div class="community-header"><h2>${escapeHtml(comm.title)}</h2><p class="muted">${escapeHtml(comm.desc||'')}</p><div class="community-meta muted">${(comm.members?comm.members.length:0)} members • created by ${escapeHtml(comm.creator)}</div></div>
        <div class="community-body" style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:12px">
          <div class="community-feed" id="community-feed"></div>
          <aside class="community-side">
            <div class="community-chat" id="community-chat-wrap"><h4>Chat</h4><div id="community-chat" class="chat-log"></div><textarea id="community-chat-input" placeholder="Say something to the community"></textarea><div style="text-align:right;margin-top:6px"><button id="community-chat-send" class="post-btn">Send</button></div></div>
            <div class="community-announcements" id="community-announcements" style="margin-top:12px"><h4>Announcements</h4><div id="community-ann-list"></div></div>
          </aside>
        </div>
      </div>
    `;
    // render feed (pinned posts and community posts)
    function renderFeed(){
      const feed = document.getElementById('community-feed'); feed.innerHTML = '';
      // pinned posts (if any)
      if(comm.pinned && comm.pinned.length){
        const pinWrap = document.createElement('div'); pinWrap.innerHTML = '<h3>Pinned</h3>';
        comm.pinned.forEach(pid=>{ const all = safeParse('agh_posts')||[]; const p = all.find(x=>x.id===pid); if(p){ const el = document.createElement('article'); el.className='post-card'; el.innerHTML = `<h4>${escapeHtml(p.title)}</h4><p class=\"muted\">by ${escapeHtml(p.author)} • ${new Date(p.created).toLocaleString()}</p><p>${escapeHtml(p.content)}</p>`; pinWrap.appendChild(el); } });
        feed.appendChild(pinWrap);
      }
      // community posts: filter posts that indicate community id in a `community` field
      const all = safeParse('agh_posts')||[];
      const commPosts = all.slice().reverse().filter(p=>p.community === commId);
        const newsAll = safeParse('agh_news_posts')||[];
        const commNews = newsAll.slice().reverse().filter(p=>p.community === commId);
        const merged = commPosts.concat(commNews);
        if(merged.length===0){ feed.innerHTML += '<p class="muted">No posts in this community yet - make the first post and tag the community.</p>'; }
        merged.forEach(p=>{
          const el = document.createElement('article'); el.className='post-card';
          const title = p.title || p.content || p.body || '(untitled)';
          const content = p.content || p.body || '';
          const author = p.author || 'Anon';
          const created = p.created || p.at || Date.now();
          el.innerHTML = `<h4>${escapeHtml(title)}</h4><div class="muted">${escapeHtml(author)} • ${new Date(created).toLocaleString()}</div><p>${escapeHtml(content)}</p><div style="margin-top:8px"><button class="post-btn" data-pin="${p.id}">Pin</button></div>`;
          feed.appendChild(el);
        });
      // bind pin buttons (only creator or moderator)
      feed.querySelectorAll('[data-pin]').forEach(b=>b.addEventListener('click', e=>{
        const pid = e.currentTarget.dataset.pin;
        const user = currentUserName(); const isMod = localStorage.getItem('agh_is_admin')==='true';
        if(user !== comm.creator && !isMod){ alert('Only the community creator or a moderator can pin posts.'); return; }
        comm.pinned = comm.pinned || [];
        if(comm.pinned.indexOf(pid)===-1) comm.pinned.push(pid); else comm.pinned = comm.pinned.filter(x=>x!==pid);
        const allComms = loadCommunities(); const idx = allComms.findIndex(x=>x.id===comm.id); if(idx!==-1) allComms[idx]=comm; saveCommunities(allComms); renderFeed(); renderAnnouncements();
      }));
    }
    // chat functions
    function chatKey(){ return 'agh_comm_chat_'+commId }
    function loadChat(){ return safeParse(chatKey()) || [] }
    function saveChat(a){ save(chatKey(), a) }
    function renderChat(){ const log = document.getElementById('community-chat'); log.innerHTML=''; const arr = loadChat(); arr.slice(-80).forEach(m=>{ const el = document.createElement('div'); el.className='chat-msg'; el.innerHTML = `<div class=\"muted\">${escapeHtml(m.author)} • ${new Date(m.at).toLocaleTimeString()}</div><div>${escapeHtml(m.text)}</div>`; log.appendChild(el); }); log.scrollTop = log.scrollHeight; }
    document.getElementById('community-chat-send').addEventListener('click', ()=>{ const ta = document.getElementById('community-chat-input'); const txt = (ta.value||'').trim(); if(!txt) return; const m = { id: uid('chat'), text: txt, author: currentUserName(), at: Date.now() }; const arr = loadChat(); arr.push(m); saveChat(arr); ta.value=''; renderChat(); });
    // announcements
    function renderAnnouncements(){ const list = document.getElementById('community-ann-list'); list.innerHTML=''; (comm.announcements||[]).slice().reverse().forEach(a=>{ const el = document.createElement('div'); el.className='post-card'; el.innerHTML = `<h4>${escapeHtml(a.title)}</h4><div class=\"muted\">${new Date(a.at).toLocaleString()}</div><p>${escapeHtml(a.body)}</p>`; list.appendChild(el); });
      // if user is creator or mod, show create announcement
      const user = currentUserName(); const isMod = localStorage.getItem('agh_is_admin')==='true';
      if(user===comm.creator || isMod){ const btn = document.createElement('button'); btn.className='post-btn'; btn.textContent='New announcement'; btn.addEventListener('click', ()=>{ const t = prompt('Announcement title'); if(!t) return; const b = prompt('Announcement body'); if(!b) return; comm.announcements = comm.announcements||[]; comm.announcements.push({id:uid('ann'), title:t, body:b, at:Date.now(), author:currentUserName()}); const all = loadCommunities(); const idx = all.findIndex(x=>x.id===comm.id); if(idx!==-1){ all[idx]=comm; saveCommunities(all); } renderAnnouncements(); }); list.appendChild(btn); }
    }
    renderFeed(); renderChat(); renderAnnouncements();
  }

  // expose some helpers to global for pages to call
  window.AGCommunity = {
    mountUI, loadCommunities, saveCommunities, generateAutoNews, loadMemberships, renderList, mountCommunityPage, ensureSeededAutoNews
  };

  // auto-run generator occasionally (background) but don't spam API - run only if not present
  (async function autoSeed(){
    const existing = safeParse('agh_autonews') || [];
    if(!existing || !existing.length){ await generateAutoNews(); }
    // schedule a background refresh every 24 hours (just set a timestamp)
    const last = localStorage.getItem('agh_autonews_last')||0;
    const now = Date.now();
    if(now - last > 1000 * 60 * 60 * 24){ try{ await generateAutoNews(); localStorage.setItem('agh_autonews_last', String(now)); }catch(e){} }
  })();

})();
