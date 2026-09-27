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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (request.method !== 'POST') {
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

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Request body is required' }, 400)
  }

  const { target_user_id: targetUserId, note_content: noteContent } = body as {
    target_user_id?: unknown
    note_content?: unknown
  }

  if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
    return jsonResponse({ error: 'target_user_id is required' }, 400)
  }

  if (typeof noteContent !== 'string' || !noteContent.trim()) {
    return jsonResponse({ error: 'note_content is required' }, 400)
  }

  const trimmedContent = noteContent.trim()
  if (trimmedContent.length > 1000) {
    return jsonResponse({ error: 'note_content must be 1000 characters or less' }, 400)
  }

  const { data: note, error: insertError } = await supabase
    .from('user_private_notes')
    .insert({
      author_user_id: userData.user.id,
      target_user_id: targetUserId.trim(),
      note_content: trimmedContent,
    })
    .select('id, author_user_id, target_user_id, note_content, created_at, updated_at')
    .single()

  if (insertError || !note) {
    console.error('Error creating private note:', insertError)
    return jsonResponse({ error: insertError?.message ?? 'Failed to create private note' }, 500)
  }

  return jsonResponse(
    {
      message: 'Private note created successfully',
      note,
    },
    201,
  )
})
