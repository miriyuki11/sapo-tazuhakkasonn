import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfileCard } from './UserProfileCard';
import { supabase } from '@/lib/supabase';
import * as privateNotesUtils from '@/utils/privateNotes';

vi.mock('@/lib/supabase', () => ({
  supabase: {
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

    vi.mocked(privateNotesUtils.getPrivateNotes).mockResolvedValueOnce(mockNotes as never);
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
});
