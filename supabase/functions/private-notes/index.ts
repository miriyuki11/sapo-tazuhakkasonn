// supabase/functions/private-notes/index.ts
// deno-lint-ignore no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase URL or Anon Key is not set in environment variables.' }, 500)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.split(' ')[1]

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    })

    const { data: userData } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
    const currentUserId = userData?.user?.id

    if (!currentUserId) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const url = new URL(req.url)
    const method = req.method

    // GET: メモの取得
    if (method === 'GET') {
      const searchTarget = url.searchParams.get('profile_user_id') || url.searchParams.get('target_user_id')
      let query = supabase.from('user_private_notes').select('*').order('created_at', { ascending: false })

      if (currentUserId) {
        query = query.eq('author_user_id', currentUserId)
      }
      if (searchTarget) {
        query = query.eq('target_user_id', searchTarget)
      }

      const { data, error } = await query
      if (error) {
        return jsonResponse({ error: error.message }, 500)
      }
      return jsonResponse(data || [], 200)
    }

    // POST: メモの新規作成
    if (method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const content = body.content || body.note_content || ''
      const targetUserId = body.profile_user_id || body.target_user_id || currentUserId

      if (!content || !content.trim()) {
        return jsonResponse({ error: 'content is required' }, 400)
      }
      if (content.length > 1000) {
        return jsonResponse({ error: 'content must be 1000 characters or less' }, 400)
      }
      if (!currentUserId) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const { data, error } = await supabase
        .from('user_private_notes')
        .insert({
          author_user_id: currentUserId,
          target_user_id: targetUserId,
          note_content: content.trim(),
        })
        .select('*')
        .single()

      if (error) {
        return jsonResponse({ error: error.message }, 500)
      }

      return jsonResponse({
        id: data.id,
        content: data.note_content,
        note_content: data.note_content,
        target_user_id: data.target_user_id,
        profile_user_id: data.target_user_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }, 201)
    }

    // PUT: 既存メモの更新
    if (method === 'PUT') {
      const body = await req.json().catch(() => ({}))
      const noteId = body.id || body.note_id
      const content = body.content || body.note_content || ''

      if (!noteId) {
        return jsonResponse({ error: 'id is required' }, 400)
      }
      if (!content || !content.trim()) {
        return jsonResponse({ error: 'content is required' }, 400)
      }
      if (content.length > 1000) {
        return jsonResponse({ error: 'content must be 1000 characters or less' }, 400)
      }

      let query = supabase
        .from('user_private_notes')
        .update({
          note_content: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)

      if (currentUserId) {
        query = query.eq('author_user_id', currentUserId)
      }

      const { data, error } = await query.select('*').single()
      if (error) {
        return jsonResponse({ error: error.message }, 500)
      }

      return jsonResponse({
        id: data.id,
        content: data.note_content,
        note_content: data.note_content,
        target_user_id: data.target_user_id,
        profile_user_id: data.target_user_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }, 200)
    }

    // DELETE: メモの削除
    if (method === 'DELETE') {
      const body = await req.json().catch(() => ({}))
      const urlNoteId = url.pathname.split('/').filter(Boolean).pop()
      const noteId = body.id || body.note_id || (urlNoteId !== 'private-notes' ? urlNoteId : undefined)

      if (!noteId) {
        return jsonResponse({ error: 'id is required' }, 400)
      }

      let query = supabase.from('user_private_notes').delete().eq('id', noteId)
      if (currentUserId) {
        query = query.eq('author_user_id', currentUserId)
      }

      const { data, error } = await query.select('id').maybeSingle()
      if (error) {
        return jsonResponse({ error: error.message }, 500)
      }
      if (!data) {
        return jsonResponse({ error: 'Note not found' }, 404)
      }

      return jsonResponse({ message: 'Note deleted successfully', id: noteId }, 200)
    }

    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in private-notes function:', message)
    return jsonResponse({ error: message }, 500)
  }
})