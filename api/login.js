const SESSION_COOKIE = 'pp_session';
const SEVEN_DAYS = 7 * 24 * 60 * 60; // seconds

async function sha256(text) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionToken(payload, secret) {
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

function parseFormBody(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.text();
  const { passphrase, redirect } = parseFormBody(body);

  if (!passphrase) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/login.html?error=${encodeURIComponent('Please enter a passphrase')}&redirect=${encodeURIComponent(redirect || '/')}` },
    });
  }

  const secret = process.env.PP_SESSION_SECRET;
  const adminHash = process.env.PP_ADMIN_HASH;
  const epcPassphrasesRaw = process.env.PP_EPC_PASSPHRASES;

  if (!secret || !adminHash || !epcPassphrasesRaw) {
    console.error('Missing auth environment variables');
    return new Response(null, {
      status: 302,
      headers: { Location: `/login.html?error=${encodeURIComponent('Server configuration error')}&redirect=${encodeURIComponent(redirect || '/')}` },
    });
  }

  const inputHash = await sha256(passphrase);

  let role = null;
  let slug = null;

  // Check admin passphrase
  if (inputHash === adminHash) {
    role = 'admin';
    slug = '_admin';
  } else {
    // Check EPC passphrases
    let epcMap;
    try {
      epcMap = JSON.parse(epcPassphrasesRaw);
    } catch {
      console.error('Failed to parse PP_EPC_PASSPHRASES');
      return new Response(null, {
        status: 302,
        headers: { Location: `/login.html?error=${encodeURIComponent('Server configuration error')}&redirect=${encodeURIComponent(redirect || '/')}` },
      });
    }

    for (const [epcSlug, hash] of Object.entries(epcMap)) {
      if (inputHash === hash) {
        role = 'epc';
        slug = epcSlug;
        break;
      }
    }
  }

  if (!role) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/login.html?error=${encodeURIComponent('Invalid passphrase')}&redirect=${encodeURIComponent(redirect || '/')}` },
    });
  }

  // Create session token
  const sessionPayload = {
    slug,
    role,
    exp: Date.now() + (SEVEN_DAYS * 1000),
  };

  const token = await createSessionToken(sessionPayload, secret);

  // Determine redirect destination
  let dest = redirect || '/';
  // If EPC user with no specific redirect, send to their portal
  if (role === 'epc' && (!redirect || redirect === '/')) {
    dest = `/epc/${slug}/`;
  }

  // Sanitize redirect to prevent open redirect (block protocol-relative URLs)
  if (!dest.startsWith('/') || dest.startsWith('//')) {
    dest = '/';
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: dest,
      'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SEVEN_DAYS}`,
    },
  });
}

export const config = {
  runtime: 'edge',
};
