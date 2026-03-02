const SESSION_COOKIE = 'pp_session';

export default async function handler() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

export const config = {
  runtime: 'edge',
};
