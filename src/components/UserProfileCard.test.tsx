import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UserProfileCard } from './UserProfileCard';
import { supabase } from '@/lib/supabase';
import * as privateNotesUtils from '@/utils/privateNotes';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/utils/privateNotes', () => ({
  getPrivateNotes: vi.fn(),
  createPrivateNote: vi.fn(),
  updatePrivateNote: vi.fn(),
  deletePrivateNote: vi.fn(),
}));

describe('UserProfileCard Component - メモ一覧・操作管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('ユーザー情報とメモ一覧が正しくレンダリングされ、削除時に一覧から除外される', async () => {
    const mockNotes = [
      {
        id: 'note-1',
        note_content: '一郎さん向けのメモ1',
        target_user_id: 'user-2',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'note-2',
        note_content: '一郎さん向けのメモ2',
        target_user_id: 'user-2',
        created_at: '2026-10-01T11:00:00Z',
        updated_at: '2026-10-01T11:00:00Z',
      },
    ];

    vi.mocked(privateNotesUtils.getPrivateNotes).mockResolvedValue(mockNotes as never);
    vi.mocked(privateNotesUtils.deletePrivateNote).mockResolvedValueOnce(true);

    render(
      <UserProfileCard
        targetUserId="user-2"
        userName="鈴木 一郎"
        role="テックリード"
      />
    );

    // ユーザー情報
    expect(screen.getByText('鈴木 一郎')).toBeDefined();
    expect(screen.getByText('テックリード')).toBeDefined();

    // メモ一覧の読み込み完了を待機
    await waitFor(() => {
      expect(screen.getByText('一郎さん向けのメモ1')).toBeDefined();
      expect(screen.getByText('一郎さん向けのメモ2')).toBeDefined();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'private-notes?profile_user_id=user-2',
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const authChangeHandler = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    act(() => authChangeHandler('SIGNED_OUT', null));
    expect(screen.queryByText('一郎さん向けのメモ1')).toBeNull();
    expect(screen.queryByText('一郎さん向けのメモ2')).toBeNull();

    act(() => authChangeHandler('SIGNED_IN', { user: { id: 'user-1' } } as never));
    await waitFor(() => {
      expect(screen.getByText('一郎さん向けのメモ1')).toBeDefined();
      expect(privateNotesUtils.getPrivateNotes).toHaveBeenCalledTimes(2);
    });

    // 1つ目のメモの「編集」をクリック
    const editButtons = screen.getAllByRole('button', { name: '編集' });
    fireEvent.click(editButtons[0]);

    // 削除ボタンが表示されるのでクリック
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[0]);

    // リストから1つ目のメモが消え、2つ目のメモだけが残る
    await waitFor(() => {
      expect(screen.queryByText('一郎さん向けのメモ1')).toBeNull();
      expect(screen.getByText('一郎さん向けのメモ2')).toBeDefined();
      expect(screen.getByText('個人メモ (1件)')).toBeDefined();
    });
  });

  it('新規メモの入力欄にアクセシブルな名前がある', () => {
    render(<UserProfileCard targetUserId="user-2" />);

    fireEvent.click(screen.getByRole('button', { name: '＋ メモを追加' }));
    expect(screen.getByRole('textbox', { name: '新しいメモ' })).toBeDefined();
  });
});
