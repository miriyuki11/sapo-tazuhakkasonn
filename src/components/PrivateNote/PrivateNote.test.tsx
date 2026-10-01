import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrivateNote } from './PrivateNote';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'note-1',
                note_content: '更新されたメモ内容',
                target_user_id: 'target-1',
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/utils/privateNotes', () => ({
  deletePrivateNote: vi.fn(),
  updatePrivateNote: vi.fn(),
}));

describe('PrivateNote Component - ステップ4 操作ボタン機能', () => {
  const sampleNote = {
    id: 'note-123',
    content: '初期のメモ内容です。',
    target_user_id: 'user-456',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('1. 初期表示（表示モード）: メモ内容と編集ボタンが表示される', () => {
    render(<PrivateNote note={sampleNote} />);

    expect(screen.getByText('初期のメモ内容です。')).toBeDefined();
    expect(screen.getByRole('button', { name: '編集' })).toBeDefined();
    expect(screen.queryByPlaceholderText('メモを編集...')).toBeNull();
  });

  it('note がない場合はプレースホルダーを読み取り専用で表示する', () => {
    render(<PrivateNote />);

    expect(screen.getByText('ここに自分専用の非公開メモを記述できます。')).toBeDefined();
    expect(screen.queryByRole('button', { name: '編集' })).toBeNull();
    expect(screen.queryByRole('button', { name: '削除' })).toBeNull();
  });

  it('2. 編集ボタンをクリック: 編集モードに切り替わり、保存・キャンセル・削除ボタンが表示される', () => {
    render(<PrivateNote note={sampleNote} />);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));

    const textarea = screen.getByPlaceholderText('メモを編集...') as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.getAttribute('aria-label')).toBe('メモを編集');
    expect(textarea.value).toBe('初期のメモ内容です。');
    expect(screen.getByRole('button', { name: '保存' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDefined();
    expect(screen.getByRole('button', { name: '削除' })).toBeDefined();
  });

  it('3. キャンセルボタンをクリック: 編集内容が破棄され、元の内容に戻って表示モードになる', () => {
    render(<PrivateNote note={sampleNote} />);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    const textarea = screen.getByPlaceholderText('メモを編集...');
    fireEvent.change(textarea, { target: { value: '編集中の変更内容' } });

    // キャンセルボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    // 表示モードに戻り、初期内容が表示される
    expect(screen.getByText('初期のメモ内容です。')).toBeDefined();
    expect(screen.queryByText('編集中の変更内容')).toBeNull();
    expect(screen.queryByPlaceholderText('メモを編集...')).toBeNull();
  });

  it('4. 削除ボタンのクリック（ダイアログキャンセル時）: 削除されず編集モードのまま', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDeleteSuccess = vi.fn();

    render(<PrivateNote note={sampleNote} onDeleteSuccess={onDeleteSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    expect(window.confirm).toHaveBeenCalledWith('このメモを本当に削除しますか？');
    expect(onDeleteSuccess).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('メモを編集...')).toBeDefined();
  });

  it('5. 削除ボタンのクリック（ダイアログOK時）: 削除APIが呼ばれ、onDeleteSuccessが実行される', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleteSuccess = vi.fn();

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { message: 'Note deleted successfully', id: sampleNote.id },
      error: null,
    } as never);

    render(<PrivateNote note={sampleNote} onDeleteSuccess={onDeleteSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('private-notes', {
        method: 'DELETE',
        body: { id: sampleNote.id, note_id: sampleNote.id },
      });
      expect(onDeleteSuccess).toHaveBeenCalledWith(sampleNote.id);
    });
  });

  it('6. 保存ボタンをクリック: PUT APIが呼ばれ、onUpdateSuccessが実行されて表示モードに戻る', async () => {
    const onUpdateSuccess = vi.fn();

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        note: {
          id: sampleNote.id,
          content: '新しく保存した内容',
        },
      },
      error: null,
    } as never);

    render(<PrivateNote note={sampleNote} onUpdateSuccess={onUpdateSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    const textarea = screen.getByPlaceholderText('メモを編集...');
    fireEvent.change(textarea, { target: { value: '新しく保存した内容' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('private-notes', {
        method: 'PUT',
        body: {
          id: sampleNote.id,
          note_id: sampleNote.id,
          content: '新しく保存した内容',
          note_content: '新しく保存した内容',
        },
      });
      expect(onUpdateSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sampleNote.id,
          content: '新しく保存した内容',
        })
      );
    });
  });
});
