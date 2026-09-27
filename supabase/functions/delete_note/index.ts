import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())

app.options('*', (c) => c.text('ok', 204))

app.post('*', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  )

  const { data: authData, error: userError } = await supabaseClient.auth.getUser()
  if (userError || !authData.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const noteId = (body as { note_id?: unknown }).note_id
  if (typeof noteId !== 'string' || !noteId.trim()) {
    return c.json({ error: 'note_id is required and must be a string.' }, 400)
  }

  const { data, error } = await supabaseClient
    .from('user_private_notes')
    .delete()
    .eq('id', noteId)
    .eq('author_user_id', authData.user.id)
    .select('id')

  if (error) {
    console.error('Error deleting note:', error)
    return c.json({ error: 'Failed to delete note', details: error.message }, 500)
  }

  if (!data || data.length === 0) {
    return c.json({ error: 'Note not found or you do not have permission to delete it.' }, 404)
  }

  return c.json({ message: 'Note deleted successfully.' }, 200)
})

Deno.serve(app.fetch)