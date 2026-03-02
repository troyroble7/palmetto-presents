// Adds Sign Out link to EPC portal and intel navigation bars
(async function() {
  try {
    var res = await fetch('/api/session');
    var data = await res.json();
    if (!data.authenticated) return;

    // EPC portal nav (ul.nav-links)
    var navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      var li = document.createElement('li');
      li.innerHTML = '<a href="/api/logout" style="color:#F9593B;font-weight:600;">Sign Out</a>';
      navLinks.appendChild(li);
    }

    // Intel page nav (.intel-nav-inner)
    var intelNav = document.querySelector('.intel-nav-inner');
    if (intelNav) {
      var link = document.createElement('a');
      link.href = '/api/logout';
      link.style.cssText = 'color:#F9593B;font-weight:600;margin-left:1.5rem;';
      link.textContent = 'Sign Out';
      intelNav.appendChild(link);
    }
  } catch (e) {
    // Fail silently
  }
})();
