(function(){
  // Small client-side "News AI" assistant: aggregates Reddit r/anime, Jikan top, and local auto-news
  // Builds a short extractive summary using simple heuristics (no external ML).

  function createAssistantModal(){
    if(document.getElementById('news-assistant-modal')) return;
    const modalB = document.createElement('div'); modalB.id = 'news-assistant-modal'; modalB.className = 'modal-backdrop';
    modalB.style.display = 'none';
    modalB.innerHTML = `
      <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="na-title">
        <div class="modal-header"><h3 id="na-title">News Assistant</h3><button class="modal-close" id="na-close">✕</button></div>
        <div class="modal-body">
          <p class="modal-sub">A quick summary of trending anime news aggregated from public sources (Reddit & MyAnimeList), plus local community highlights.</p>
          <div style="display:flex;gap:12px;align-items:center;margin-top:10px">
            <input id="na-query" type="text" placeholder="Ask: e.g. What's trending? Or enter anime name" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(2,6,23,0.06)">
            <button class="post-btn" id="na-run">Generate</button>
          </div>
          <div id="na-status" class="muted" style="margin-top:10px">Sources: Reddit r/anime, MyAnimeList (Jikan), local auto-news</div>
          <div id="na-results" style="margin-top:12px;max-height:340px;overflow:auto"></div>
        </div>
        <div class="modal-footer"><div>Tip: try "trending" or an anime name</div><div><a href="news.html">Open News</a></div></div>
      </div>
    `;
    document.body.appendChild(modalB);

    // wiring
    const close = modalB.querySelector('#na-close');
    const run = modalB.querySelector('#na-run');
    const query = modalB.querySelector('#na-query');
    const results = modalB.querySelector('#na-results');
    close.addEventListener('click', ()=> modalB.style.display = 'none');
    modalB.addEventListener('click', (e)=>{ if(e.target === modalB) modalB.style.display = 'none'; });
    run.addEventListener('click', ()=> runQuery(query.value||''));
    query.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') run.click(); });

    async function runQuery(q){
      results.innerHTML = '<div class="muted">Fetching headlines…</div>';
      try{
        // parallel fetches
        const [reddit, jikan, local] = await Promise.allSettled([
          fetchRedditTop(q),
          fetchJikanTop(q),
          fetchLocalAutoNews(q)
        ]);
        const redditTitles = reddit.status === 'fulfilled' ? reddit.value : [];
        const jikanTitles = jikan.status === 'fulfilled' ? jikan.value : [];
        const localItems = local.status === 'fulfilled' ? local.value : [];

        const summary = synthesize(q, redditTitles, jikanTitles, localItems);
        results.innerHTML = '';
        const out = document.createElement('div');
        out.innerHTML = `<div style="padding:10px;border-radius:8px;background:linear-gradient(180deg,#fff,#fbfdff);box-shadow:0 8px 30px rgba(2,6,23,0.06)"><h4>Summary</h4><p>${escapeHtml(summary)}</p></div>`;
        // attach source lists
        const src = document.createElement('div'); src.style.marginTop = '12px';
        src.innerHTML = '<h4>Headlines</h4>';
        const list = document.createElement('ul'); list.style.marginTop='6px'; list.style.paddingLeft='18px';
        const combined = (redditTitles || []).concat((localItems||[]).map(x=>x.title), (jikanTitles||[]));
        (combined.slice(0,12)).forEach(t=>{ const li = document.createElement('li'); li.style.marginBottom='6px'; li.textContent = t; list.appendChild(li); });
        src.appendChild(list);
        results.appendChild(out); results.appendChild(src);
      }catch(err){ results.innerHTML = '<div class="muted">Unable to generate summary: '+String(err)+'</div>'; }
    }

    // small helpers
    function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    async function fetchRedditTop(q){
      // if q looks like anime name, search subreddit for that term
      const path = q && q.trim().length>1 ? `https://www.reddit.com/r/anime/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=top&t=week&limit=8` : 'https://www.reddit.com/r/anime/top.json?t=day&limit=8';
      try{
        const r = await fetch(path);
        if(!r.ok) return [];
        const js = await r.json();
        const posts = (js.data && js.data.children) || [];
        return posts.map(p=>p.data.title).filter(Boolean).slice(0,8);
      }catch(e){ return []; }
    }

    async function fetchJikanTop(q){
      try{
        // If q looks like a specific anime, search; otherwise fetch top anime
        if(q && q.trim().length>2){
          const res = await fetch('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(q)+'&limit=6');
          if(!res.ok) return [];
          const js = await res.json();
          return (js.data||[]).map(d=>d.title).slice(0,6);
        }
        const res = await fetch('https://api.jikan.moe/v4/top/anime?page=1');
        if(!res.ok) return [];
        const js = await res.json();
        return (js.data||[]).slice(0,8).map(d=>d.title);
      }catch(e){ return []; }
    }

    async function fetchLocalAutoNews(q){
      try{
        const arr = JSON.parse(localStorage.getItem('agh_autonews')||'[]');
        if(!arr || !arr.length) return [];
        if(q && q.trim().length>1){
          const qq = q.toLowerCase();
          return arr.filter(a=> (a.title||'').toLowerCase().includes(qq) || (a.body||'').toLowerCase().includes(qq)).map(a=>a.title).slice(0,8);
        }
        return arr.slice(0,8).map(a=>a.title);
      }catch(e){ return []; }
    }

    function synthesize(q, reddit, jikan, local){
      // Build a concise summary string from available lists
      const topShows = Array.from(new Set([].concat(jikan||[]))).slice(0,6);
      const headlines = Array.from(new Set([].concat(reddit||[]).concat(local||[]))).slice(0,8);
      let parts = [];
      if(topShows.length){ parts.push('Trending shows: '+ topShows.slice(0,5).join(', ') + '.'); }
      if(headlines.length){ parts.push('Top headlines: '+ headlines.slice(0,4).join(' • ') + '.'); }
      // simple analysis: detect frequent keywords
      const keywords = extractKeywords(headlines.join(' '));
      if(keywords.length){ parts.push('Notable topics: '+ keywords.slice(0,6).join(', ')+'.'); }
      if(!parts.length) return 'No recent headlines found.';
      return parts.join(' ');
    }

    function extractKeywords(text){
      if(!text) return [];
      // basic keyword extraction: count word frequency excluding stopwords
      const stop = new Set(['the','a','an','and','or','in','on','of','to','for','with','is','are','this','that','by','from','new','latest','season']);
      const words = text.replace(/["\'.,;:()!?]/g,'').toLowerCase().split(/\s+/).filter(Boolean);
      const freq = {};
      words.forEach(w=>{ if(w.length<4) return; if(stop.has(w)) return; if(/^[0-9]+$/.test(w)) return; freq[w]= (freq[w]||0)+1; });
      const sorted = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]);
      return sorted.slice(0,8);
    }
  }

  // Create the modal on load
  window.addEventListener('DOMContentLoaded', ()=>{
    createAssistantModal();
    // Add button wiring if present
    const btn = document.getElementById('news-assistant-btn');
    const modal = document.getElementById('news-assistant-modal');
    if(btn && modal) btn.addEventListener('click', ()=>{ modal.style.display = 'flex'; const q = document.getElementById('na-query'); if(q) q.focus(); });
  });
})();
