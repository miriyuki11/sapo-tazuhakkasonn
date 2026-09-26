// supabase/functions/private-notes/index.ts

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

// 環境変数を取得
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is not set in environment variables.')
}

// Edge Functionの基本的なハンドラ
Deno.serve(async (req: Request) => {
  try {
    // ヘルスチェックや、後のステップで実装するCRUDエンドポイントのベース
    const { method, url } = req
    const path = new URL(url).pathname

    if (path === '/private-notes' && method === 'GET') {
      // このステップではまだ具体的なCRUDロジックは実装しません。
      // 単純なレスポンスを返して、関数が動作することを確認します。
      return new Response(JSON.stringify({ message: 'Private notes function is running!' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response('Not Found', { status: 404 })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in private-notes function:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})