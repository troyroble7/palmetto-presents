const SESSION_COOKIE = 'pp_session';
const LOGIN_PATH = '/login.html';

// Paths that are accessible WITHOUT authentication
// Everything else on the entire site requires a valid session
const PUBLIC_PATHS = [
  '/login.html',
  '/auth.js',
  '/plr-logo.png',
  '/robots.txt',
  '/favicon.ico',
];

// Prefixes that are accessible without auth
const PUBLIC_PREFIXES = [
  '/api/',     // API routes handle their own auth
];

// Match ALL routes (negative lookahead excludes Vercel internals only)
export const config = {
  matcher: ['/((?!_next).*)'],
};

async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(payload, signature, secret) {
  const expected = await hmacSign(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function redirectToLogin(request) {
  const url = new URL(request.url);
  const redirect = encodeURIComponent(url.pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: { Location: `${LOGIN_PATH}?redirect=${redirect}` },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow public paths (login page, logo, robots.txt, API routes)
  if (PUBLIC_PATHS.includes(path)) return;
  for (const prefix of PUBLIC_PREFIXES) {
    if (path.startsWith(prefix)) return;
  }

  const secret = process.env.PP_SESSION_SECRET || '';

  const cookieHeader = request.headers.get('cookie');

  // Try server-side session cookie first (HMAC-signed)
  let session = null;
  const sessionValue = parseCookie(cookieHeader, SESSION_COOKIE);
  if (sessionValue && secret) {
    const dotIndex = sessionValue.lastIndexOf('.');
    if (dotIndex !== -1) {
      const payloadB64 = sessionValue.substring(0, dotIndex);
      const signature = sessionValue.substring(dotIndex + 1);
      const valid = await hmacVerify(payloadB64, signature, secret);
      if (valid) {
        try {
          const parsed = JSON.parse(atob(payloadB64));
          if (parsed.exp && Date.now() < parsed.exp) {
            session = parsed;
          }
        } catch {}
      }
    }
  }

  // Fallback: client-side auth cookie (pp_auth)
  if (!session) {
    const authValue = parseCookie(cookieHeader, 'pp_auth');
    if (authValue) {
      const dotIndex = authValue.lastIndexOf('.');
      if (dotIndex !== -1) {
        try {
          const parsed = JSON.parse(atob(authValue.substring(0, dotIndex)));
          if (parsed.v && parsed.exp && Date.now() < parsed.exp) {
            session = parsed;
          }
        } catch {}
      }
    }
  }

  if (!session) {
    return redirectToLogin(request);
  }

  // Authorization checks
  const { role, slug } = session;

  // Admin can access everything
  if (role === 'admin') {
    return;
  }

  // Intel pages are admin-only — return 403 for authenticated EPC users
  if (path.startsWith('/intel/') || path === '/intel') {
    return new Response(
      '<html><head><title>Access Denied</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf9f7;color:#611D11;text-align:center;}.card{max-width:400px;padding:40px;}.card h1{font-size:1.5rem;margin-bottom:12px;}.card p{color:#666;margin-bottom:24px;}.card a{color:#F9593B;text-decoration:none;font-weight:600;}</style></head><body><div class="card"><h1>Access Denied</h1><p>This section is restricted to LightReach administrators.</p><a href="/">Back to Home</a></div></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // EPC users can only access their own slug — 403 for other EPCs
  if (role === 'epc' && path.startsWith('/epc/')) {
    const pathSlug = path.split('/')[2]; // /epc/{slug}/...
    if (pathSlug && pathSlug !== slug) {
      return new Response(
        '<html><head><title>Access Denied</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf9f7;color:#611D11;text-align:center;}.card{max-width:400px;padding:40px;}.card h1{font-size:1.5rem;margin-bottom:12px;}.card p{color:#666;margin-bottom:24px;}.card a{color:#F9593B;text-decoration:none;font-weight:600;}</style></head><body><div class="card"><h1>Access Denied</h1><p>You can only access your own partner portal.</p><a href="/epc/' + slug + '/">Go to Your Portal</a></div></body></html>',
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }
    return;
  }

  // EPC users can access homepage, solar-3-0, channel-program, shared assets
  if (role === 'epc') {
    return;
  }

  // Default deny
  return redirectToLogin(request);
}
