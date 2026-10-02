import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrivateNoteEditor } from './PrivateNoteEditor';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@/utils/privateNotes', () => ({
  createPrivateNote: vi.fn(),
  updatePrivateNote: vi.fn(),
  deletePrivateNote: vi.fn(),
}));

describe('PrivateNoteEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('メモがない場合: 「＋ メモを作成」ボタンが表示され、クリックで入力フィールドが開く', () => {
    render(
      <PrivateNoteEditor
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('まだ個人メモはありません。')).toBeDefined();
    const createButton = screen.getByRole('button', { name: '＋ メモを作成' });
    expect(createButton).toBeDefined();

    // クリックすると新規作成モードが開く
    fireEvent.click(createButton);
    expect(screen.getByText('新規個人メモ')).toBeDefined();
    expect(screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)')).toBeDefined();
    expect(screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)').getAttribute('aria-label')).toBe('個人メモ');
    expect(screen.getByText('0/1000文字')).toBeDefined();
    expect(screen.getByRole('button', { name: '保存' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDefined();
  });

  it('新規作成時のキャンセル: 入力フィールドが閉じ、初期の「＋ メモを作成」ボタンが表示される', () => {
    render(
      <PrivateNoteEditor
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '＋ メモを作成' }));
    const textarea = screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)');
    fireEvent.change(textarea, { target: { value: '入力中のテキスト' } });

    // キャンセルボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    // 入力フォームが閉じ、「＋ メモを作成」ボタンが表示される状態に戻る
    expect(screen.queryByPlaceholderText('ここにメモを入力してください (最大1000文字)')).toBeNull();
    expect(screen.getByRole('button', { name: '＋ メモを作成' })).toBeDefined();
  });

  it('テキスト入力時に文字数カウントが更新され、1000文字制限が適用される', () => {
    render(
      <PrivateNoteEditor
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '＋ メモを作成' }));
    const textarea = screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'テストメモ' } });

    expect(textarea.value).toBe('テストメモ');
    expect(screen.getByText('5/1000文字')).toBeDefined();

    // 1001文字の文字列を試みる
    const longText = 'a'.repeat(1001);
    fireEvent.change(textarea, { target: { value: longText } });
    // 1000文字を超える場合は handleChange 内の制限で更新されない
    expect(textarea.value).toBe('テストメモ');
  });

  it('既存メモがある場合: 表示モードでレンダリングされ、編集・削除ボタンが表示される', () => {
    render(
      <PrivateNoteEditor
        initialNote={{
          id: 'note-1',
          content: '既存のメモ内容です',
        }}
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('個人メモ')).toBeDefined();
    expect(screen.getByText('既存のメモ内容です')).toBeDefined();
    expect(screen.getByRole('button', { name: '編集' })).toBeDefined();
    expect(screen.getByRole('button', { name: '削除' })).toBeDefined();

    // 編集ボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: '編集' }));

    // 編集モードに切り替わる
    const textarea = screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)') as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.value).toBe('既存のメモ内容です');
  });

  it('編集時のキャンセル: 元の内容に戻り表示モードになる', () => {
    const onCancel = vi.fn();
    render(
      <PrivateNoteEditor
        initialNote={{
          id: 'note-1',
          content: '初期コンテンツ',
        }}
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
        onCancel={onCancel}
      />
    );

    // 編集モードに入る
    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    const textarea = screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)');

    // 内容を書き換え
    fireEvent.change(textarea, { target: { value: '書き換え後の内容' } });

    // キャンセルボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    // 表示モードに戻り、初期コンテンツが表示される
    expect(screen.getByText('初期コンテンツ')).toBeDefined();
    expect(onCancel).toHaveBeenCalled();
  });

  it('保存ボタンをクリックするとEdge Functionが呼ばれ、成功時にonSaveSuccessが呼ばれて表示モードになる', async () => {
    const onSaveSuccess = vi.fn();
    const mockResponse = {
      data: {
        id: 'new-note-id',
        content: '保存するメモ',
        target_user_id: 'profile-user-1',
      },
      error: null,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce(mockResponse as never);

    render(
      <PrivateNoteEditor
        profileUserId="profile-user-1"
        onSaveSuccess={onSaveSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '＋ メモを作成' }));
    const textarea = screen.getByPlaceholderText('ここにメモを入力してください (最大1000文字)');
    fireEvent.change(textarea, { target: { value: '保存するメモ' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('private-notes', {
        body: {
          content: '保存するメモ',
          note_content: '保存するメモ',
          profile_user_id: 'profile-user-1',
          target_user_id: 'profile-user-1',
        },
        method: 'POST',
      });
      expect(onSaveSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-note-id',
          content: '保存するメモ',
        })
      );
    });
  });

  it('削除機能: 削除ボタンをクリックして確認ダイアログでOKすると、削除されて初期状態に戻る', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleteSuccess = vi.fn();

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { message: 'deleted' },
      error: null,
    } as never);

    render(
      <PrivateNoteEditor
        initialNote={{
          id: 'note-to-delete',
          content: '削除対象のメモ',
        }}
        profileUserId="profile-user-1"
        onSaveSuccess={vi.fn()}
        onDeleteSuccess={onDeleteSuccess}
      />
    );

    const deleteButton = screen.getByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('このメモを本当に削除しますか？');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('private-notes', {
        method: 'DELETE',
        body: { id: 'note-to-delete', note_id: 'note-to-delete' },
      });
      expect(onDeleteSuccess).toHaveBeenCalledWith('note-to-delete');
    });
  });
});
