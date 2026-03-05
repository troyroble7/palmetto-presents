// Palmetto Presents — Auth Gate
// Runs BEFORE page content is visible. Validates session cookie.
(function() {
  'use strict';
  var COOKIE_NAME = 'pp_auth';
  var LOGIN_PATH = '/login.html';

  // Pages that don't require auth
  if (window.location.pathname === LOGIN_PATH) return;
  if (window.location.pathname === '/robots.txt') return;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  var token = getCookie(COOKIE_NAME);
  if (!token) {
    document.documentElement.style.display = 'none';
    var redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(LOGIN_PATH + '?redirect=' + redirect);
    return;
  }

  // Validate token structure and expiration
  try {
    var dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) throw new Error('bad token');
    var payload = JSON.parse(atob(token.substring(0, dotIdx)));
    if (!payload.exp || Date.now() > payload.exp) {
      // Expired — clear cookie and redirect
      document.cookie = COOKIE_NAME + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax';
      document.documentElement.style.display = 'none';
      var redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(LOGIN_PATH + '?redirect=' + redirect);
      return;
    }
    if (!payload.v) {
      // Old token without validation flag — force re-login
      document.cookie = COOKIE_NAME + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax';
      document.documentElement.style.display = 'none';
      var redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(LOGIN_PATH + '?redirect=' + redirect);
      return;
    }
  } catch (e) {
    // Invalid token — clear and redirect
    document.cookie = COOKIE_NAME + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax';
    document.documentElement.style.display = 'none';
    var redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(LOGIN_PATH + '?redirect=' + redirect);
  }
})();
