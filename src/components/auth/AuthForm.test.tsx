import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from './AuthForm'
import { supabase } from '@/lib/supabase'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.signInWithPassword).mockReset()
    vi.mocked(supabase.auth.signUp).mockReset()
    window.history.replaceState({}, '', '/login')
  })

  describe('バリデーション', () => {
    test('空のフォームで送信時にメール未入力エラーを表示', async () => {
      render(<AuthForm />)
      const submitButton = screen.getByRole('button', { name: /ログイン/i })

      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/有効なメールアドレス/i)).toBeTruthy()
      })
    })

    test('パスワードが6文字未満の場合、エラーを表示', async () => {
      render(<AuthForm />)
      const emailInput = screen.getByPlaceholderText(/name@example.com/i)
      const passwordInput = screen.getByPlaceholderText(/6文字以上のpassword/i)
      const submitButton = screen.getByRole('button', { name: /ログイン/i })

      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'short')
      await userEvent.click(submitButton)

      await waitFor(() => {
        const errors = screen.getAllByText(/6文字以上で入力/i)
        expect(errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('フォーム入力', () => {
    test('メールアドレスを入力できる', async () => {
      render(<AuthForm />)
      const emailInput = screen.getByPlaceholderText(/name@example.com/i) as HTMLInputElement

      await userEvent.type(emailInput, 'test@example.com')

      expect(emailInput.value).toBe('test@example.com')
    })

    test('パスワードを入力できる', async () => {
      render(<AuthForm />)
      const passwordInput = screen.getByPlaceholderText(/6文字以上のpassword/i) as HTMLInputElement

      await userEvent.type(passwordInput, 'password123')

      expect(passwordInput.value).toBe('password123')
    })
  })

  describe('モード切り替え', () => {
    test('ログイン/サインアップ切り替えボタンが表示される', () => {
      render(<AuthForm />)

      expect(screen.getByText(/アカウントをお持ちでない方はこちら/i)).toBeTruthy()
    })

    test('モード切り替え時にエラーメッセージをリセット', async () => {
      render(<AuthForm />)
      const submitButton = screen.getByRole('button', { name: /ログイン/i })

      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/有効なメールアドレス/i)).toBeTruthy()
      })

      const toggleButton = screen.getByText(/アカウントをお持ちでない方はこちら/i)
      await userEvent.click(toggleButton)

      expect(screen.queryByText(/有効なメールアドレス/i)).toBeNull()
    })
  })

  describe('認証処理', () => {
    test('ログイン成功時にSupabaseを呼び出してトップページへ遷移', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ error: null } as never)
      render(<AuthForm />)

      await userEvent.type(screen.getByPlaceholderText(/name@example.com/i), 'test@example.com')
      await userEvent.type(screen.getByPlaceholderText(/6文字以上のpassword/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    test('登録成功時にcallback URLを指定し、確認案内へ遷移', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as never)
      render(<AuthForm />)

      await userEvent.click(screen.getByRole('button', { name: /アカウントをお持ちでない方/i }))
      await userEvent.type(screen.getByPlaceholderText(/name@example.com/i), 'new@example.com')
      await userEvent.type(screen.getByPlaceholderText(/6文字以上のpassword/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: '新規登録' }))

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'new@example.com',
          password: 'password123',
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        expect(mockPush).toHaveBeenCalledWith('/auth/verify-email')
      })
    })

    test('認証エラーを日本語に変換して表示', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      } as never)
      render(<AuthForm />)

      await userEvent.type(screen.getByPlaceholderText(/name@example.com/i), 'test@example.com')
      await userEvent.type(screen.getByPlaceholderText(/6文字以上のpassword/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

      expect(await screen.findByText('メールアドレスまたはパスワードが正しくありません。')).toBeTruthy()
    })

    test('callbackエラーのクエリを日本語で表示', async () => {
      render(<AuthForm callbackError />)

      expect(screen.getByText(/メール認証を完了できませんでした/)).toBeTruthy()
    })

    test('送信中はボタンと入力欄を無効化して処理中と表示', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(new Promise(() => { }) as never)
      render(<AuthForm />)

      await userEvent.type(screen.getByPlaceholderText(/name@example.com/i), 'test@example.com')
      await userEvent.type(screen.getByPlaceholderText(/6文字以上のpassword/i), 'password123')
      await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

      expect(screen.getByRole('button', { name: '処理中...' }).hasAttribute('disabled')).toBe(true)
      expect(screen.getByPlaceholderText(/name@example.com/i).hasAttribute('disabled')).toBe(true)
      expect(screen.getByPlaceholderText(/6文字以上のpassword/i).hasAttribute('disabled')).toBe(true)
    })
  })
})
