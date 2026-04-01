import { verifyAuth, login, getProfile, updateProfile } from './auth.js';
import { handleVpsRequest } from './vps.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.path ? params.path.join('/') : '';

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth Routes
    if (path === 'auth/login' && request.method === 'POST') {
      const resp = await login(request, env);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    if (path === 'auth/profile' && request.method === 'GET') {
      const auth = await verifyAuth(request, env);
      const resp = await getProfile(request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    if (path === 'auth/profile' && request.method === 'PUT') {
      const auth = await verifyAuth(request, env);
      const resp = await updateProfile(request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    // Public/Auth Proxy for VPS
    if (path.startsWith('vps')) {
      const auth = await verifyAuth(request, env);
      const resp = await handleVpsRequest(path, request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    return new Response(JSON.stringify({ error: 'Not Found', path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
