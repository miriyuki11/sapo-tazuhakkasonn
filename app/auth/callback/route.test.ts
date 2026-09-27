import { beforeEach, describe, expect, test, vi } from 'vitest'
import { GET } from './route'

const { mockExchangeCodeForSession, mockVerifyOtp } = vi.hoisted(() => ({
    mockExchangeCodeForSession: vi.fn(),
    mockVerifyOtp: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
    createServerSupabaseClient: async () => ({
        auth: {
            exchangeCodeForSession: mockExchangeCodeForSession,
            verifyOtp: mockVerifyOtp,
        },
    }),
}))

describe('Auth callback route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('PKCE codeを交換してトップページへリダイレクト', async () => {
        mockExchangeCodeForSession.mockResolvedValue({ error: null })

        const response = await GET(new Request('https://introcard.test/auth/callback?code=auth-code'))

        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code')
        expect(response.headers.get('location')).toBe('https://introcard.test/')
    })

    test('signup token hashを検証してトップページへリダイレクト', async () => {
        mockVerifyOtp.mockResolvedValue({ error: null })

        const response = await GET(new Request(
            'https://introcard.test/auth/callback?token_hash=email-token&type=signup',
        ))

        expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'email-token', type: 'signup' })
        expect(response.headers.get('location')).toBe('https://introcard.test/')
    })

    test('認証情報がない場合はログイン画面へエラー付きでリダイレクト', async () => {
        const response = await GET(new Request('https://introcard.test/auth/callback'))

        expect(response.headers.get('location')).toBe(
            'https://introcard.test/login?error=auth_callback',
        )
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
        expect(mockVerifyOtp).not.toHaveBeenCalled()
    })

    test('未対応のtoken typeは拒否', async () => {
        const response = await GET(new Request(
            'https://introcard.test/auth/callback?token_hash=email-token&type=recovery',
        ))

        expect(response.headers.get('location')).toBe(
            'https://introcard.test/login?error=auth_callback',
        )
        expect(mockVerifyOtp).not.toHaveBeenCalled()
    })

    test('認証交換に失敗した場合はログイン画面へリダイレクト', async () => {
        mockExchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') })

        const response = await GET(new Request('https://introcard.test/auth/callback?code=bad-code'))

        expect(response.headers.get('location')).toBe(
            'https://introcard.test/login?error=auth_callback',
        )
    })
})