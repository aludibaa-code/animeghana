(function(){
  // Update the header notification badge with pending counts
  function updateNotifications(){
    try{
      const posts = JSON.parse(localStorage.getItem('agh_posts')||'[]');
      const news = JSON.parse(localStorage.getItem('agh_news_posts')||'[]');
      const pendingPosts = (posts.filter(p=>p.status==='pending')).length;
      const pendingNews = (news.filter(p=>p.status==='pending')).length;
      const total = pendingPosts + pendingNews;
      document.querySelectorAll('#notif-count').forEach(el=>el.textContent = total);
      document.querySelectorAll('#notif-link').forEach(el=>el.style.display = total>0 ? 'inline-flex' : 'none');
    }catch(e){ /* ignore */ }
  }
  // initial and reactive updates
  document.addEventListener('DOMContentLoaded', updateNotifications);
  window.addEventListener('storage', updateNotifications);
  // periodic check in case local changes don't emit storage events in same tab
  setInterval(updateNotifications, 4000);
  // expose for debugging
  window.AGNotify = { updateNotifications };
})();
