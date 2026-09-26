import { createClient } from '@supabase/supabase-js'

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Authorization header missing' }, 401)
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return jsonResponse({ error: 'Invalid Authorization header format' }, 401)
  }

  const targetUserId = new URL(request.url).searchParams.get('target_user_id')
  if (!targetUserId) {
    return jsonResponse({ error: 'target_user_id query parameter is required' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid authentication token' }, 401)
  }

  const { data: notes, error } = await supabase
    .from('user_private_notes')
    .select('id, author_user_id, target_user_id, note_content, created_at, updated_at')
    .eq('target_user_id', targetUserId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching private notes:', error)
    if (error.message.toLowerCase().includes('jwt') || error.message.toLowerCase().includes('auth')) {
      return jsonResponse({ error: error.message }, 401)
    }
    return jsonResponse({ error: error.message }, 500)
  }

  if (!notes || notes.length === 0) {
    return jsonResponse({ message: 'No private notes found for this target user.', notes: [] }, 200)
  }

  return jsonResponse({ notes }, 200)
})
