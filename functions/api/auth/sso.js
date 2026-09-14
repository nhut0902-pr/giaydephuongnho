export async function onRequestPost({ request, env }) {
  const CORS = {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  };

  try {
    const { email, name, nctToken } = await request.json();
    if (!email || !nctToken) {
      return new Response(JSON.stringify({ error: 'Thieu email hoac token' }), { status: 400, headers: CORS });
    }

    // Verify with NhutCoder Team
    const verifyResp = await fetch(`https://nhutcoder-team-v2.vercel.app/api/auth/verify?token=${nctToken}`);
    const verifyData = await verifyResp.json();
    if (!verifyData.ok) {
      return new Response(JSON.stringify({ error: 'Token SSO khong hop le' }), { status: 401, headers: CORS });
    }

    // Call the Worker API to do the actual SSO login
    const apiResp = await fetch('https://giaydephuongnho-api.lamminhnhut09022011.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'admin123', recaptchaToken: 'dummy' }),
    });
    const apiData = await apiResp.json();

    if (apiData.token) {
      return new Response(JSON.stringify(apiData), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: 'SSO login failed', detail: apiData }), { status: 401, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    }
  });
}
