import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from './AuthForm'
import { vi } from 'vitest'

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
  })

  describe('バリデーション', () => {
    test('空のフォームで送信時にメール未入力エラーを表示', async () => {
      render(<AuthForm />)
      const submitButton = screen.getByRole('button', { name: /ログイン/i })

      await userEvent.click(submitButton)

      await waitFor(() => {
        const errorText = screen.queryByText((content, element) =>
          content.includes('有効なメールアドレス') && element?.className.includes('text-red')
        )
        expect(errorText || screen.getByText(/有効なメールアドレス/i)).toBeTruthy()
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

      expect(screen.getByText(/アカウントをお持ちでない方はこちら/i)).toBeInTheDocument()
    })

    test('モード切り替え時にエラーメッセージをリセット', async () => {
      render(<AuthForm />)
      const submitButton = screen.getByRole('button', { name: /ログイン/i })

      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/有効なメールアドレス/i)).toBeInTheDocument()
      })

      const toggleButton = screen.getByText(/アカウントをお持ちでない方はこちら/i)
      await userEvent.click(toggleButton)

      expect(screen.queryByText(/有効なメールアドレス/i)).not.toBeInTheDocument()
    })
  })
})
