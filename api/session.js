const SESSION_COOKIE = 'pp_session';

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

export default async function handler(request) {
  const secret = process.env.PP_SESSION_SECRET;
  if (!secret) {
    return Response.json({ authenticated: false });
  }

  const cookieHeader = request.headers.get('cookie');
  const sessionValue = parseCookie(cookieHeader, SESSION_COOKIE);

  if (!sessionValue) {
    return Response.json({ authenticated: false });
  }

  const dotIndex = sessionValue.lastIndexOf('.');
  if (dotIndex === -1) {
    return Response.json({ authenticated: false });
  }

  const payloadB64 = sessionValue.substring(0, dotIndex);
  const signature = sessionValue.substring(dotIndex + 1);

  const valid = await hmacVerify(payloadB64, signature, secret);
  if (!valid) {
    return Response.json({ authenticated: false });
  }

  let session;
  try {
    session = JSON.parse(atob(payloadB64));
  } catch {
    return Response.json({ authenticated: false });
  }

  if (!session.exp || Date.now() > session.exp) {
    return Response.json({ authenticated: false });
  }

  return Response.json({
    authenticated: true,
    role: session.role,
    slug: session.slug,
  });
}

export const config = {
  runtime: 'edge',
};
