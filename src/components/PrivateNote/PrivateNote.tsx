"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { deletePrivateNote, updatePrivateNote } from '@/utils/privateNotes';

export interface PrivateNoteItem {
  id: string;
  content: string;
  note_content?: string;
  user_id?: string;
  author_user_id?: string;
  target_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrivateNoteProps {
  note?: PrivateNoteItem;
  onDeleteSuccess?: (noteId: string) => void; // 親コンポーネントに削除成功を通知
  onUpdateSuccess?: (updatedNote: PrivateNoteItem) => void; // 更新成功通知
}

const defaultPlaceholderNote: PrivateNoteItem = {
  id: 'preview-note',
  content: 'ここに自分専用の非公開メモを記述できます。',
  target_user_id: '',
};

/**
 * 個人メモコンポーネント。
 * 表示モードと編集モードの切り替え、保存、キャンセル、削除機能を提供します。
 */
export const PrivateNote: React.FC<PrivateNoteProps> = ({
  note,
  onDeleteSuccess,
  onUpdateSuccess,
}) => {
  const isPlaceholder = !note;
  const displayedNote = note ?? defaultPlaceholderNote;
  const noteText = displayedNote.content || displayedNote.note_content || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(noteText);
  const [originalContent, setOriginalContent] = useState(noteText); // キャンセル用
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // note.content が変更された場合に、editedContentとoriginalContentを更新
  useEffect(() => {
    const text = displayedNote.content || displayedNote.note_content || '';
    setEditedContent(text);
    setOriginalContent(text);
    if (!note) {
      setIsEditing(false);
    }
  }, [displayedNote.content, displayedNote.note_content, note]);

  const handleEditClick = () => {
    setIsEditing(true);
    setOriginalContent(editedContent);
    setError(null);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditedContent(originalContent); // 元の内容に戻す
    setError(null);
  };

  const handleSave = async () => {
    const trimmed = editedContent.trim();
    if (!trimmed) {
      alert('メモの内容は空にできません。');
      return;
    }
    if (trimmed === originalContent) {
      setIsEditing(false); // 変更がない場合は保存せずにモードを終了
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let updatedData: PrivateNoteItem | null = null;

      // 1. Edge Function 'private-notes' (PUT) を呼び出し
      try {
        const response = await supabase.functions.invoke('private-notes', {
          method: 'PUT',
          body: {
            id: displayedNote.id,
            note_id: displayedNote.id,
            content: trimmed,
            note_content: trimmed,
          },
        });

        if (response && !response.error && response.data) {
          const res = response.data?.note || response.data;
          updatedData = {
            id: res.id || displayedNote.id,
            content: res.content || res.note_content || trimmed,
            note_content: res.note_content || res.content || trimmed,
            target_user_id: res.target_user_id || displayedNote.target_user_id,
            created_at: res.created_at || displayedNote.created_at,
            updated_at: res.updated_at || new Date().toISOString(),
          };
        }
      } catch (funcErr) {
        console.warn('Edge function update failed, trying fallback:', funcErr);
      }

      // 2. フォールバック: utils/privateNotes (直接DB操作)
      if (!updatedData) {
        const updated = await updatePrivateNote(displayedNote.id, {
          note_content: trimmed,
        });
        if (updated) {
          updatedData = {
            id: updated.id,
            content: updated.note_content,
            note_content: updated.note_content,
            target_user_id: updated.target_user_id,
            created_at: updated.created_at,
            updated_at: updated.updated_at,
          };
        }
      }

      // 3. テーブル直接操作フォールバック
      if (!updatedData) {
        const { data, error: dbError } = await supabase
          .from('user_private_notes')
          .update({
            note_content: trimmed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', displayedNote.id)
          .select()
          .single();

        if (!dbError && data) {
          updatedData = {
            id: data.id,
            content: data.note_content,
            note_content: data.note_content,
            target_user_id: data.target_user_id,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        }
      }

      if (updatedData) {
        onUpdateSuccess?.(updatedData); // 親コンポーネントに更新成功を通知
        setOriginalContent(trimmed); // 保存成功したらオリジナルも更新
        setIsEditing(false);
        alert('メモが更新されました。');
      } else {
        throw new Error('メモの更新に失敗しました。');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'メモの更新中にエラーが発生しました。';
      console.error('メモの更新中にエラーが発生しました:', message);
      setError(message);
      alert('メモの更新に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    if (window.confirm('このメモを本当に削除しますか？')) {
      setIsLoading(true);
      setError(null);

      try {
        let deleted = false;

        // 1. Edge Function 'private-notes' (DELETE)
        try {
          const response = await supabase.functions.invoke('private-notes', {
            method: 'DELETE',
            body: { id: displayedNote.id, note_id: displayedNote.id },
          });
          if (response && !response.error) {
            deleted = true;
          }
        } catch (funcErr) {
          console.warn('Edge function delete failed, trying fallback:', funcErr);
        }

        // 2. フォールバック: utils/privateNotes
        if (!deleted) {
          deleted = await deletePrivateNote(displayedNote.id);
        }

        // 3. テーブル直接操作フォールバック
        if (!deleted) {
          const { data, error: dbError } = await supabase
            .from('user_private_notes')
            .delete()
            .eq('id', displayedNote.id)
            .select('id')
            .maybeSingle();
          if (!dbError && data) {
            deleted = true;
          }
        }

        if (deleted) {
          onDeleteSuccess?.(displayedNote.id); // 親コンポーネントに削除成功を通知
          alert('メモが削除されました。');
        } else {
          throw new Error('メモの削除に失敗しました。');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'メモの削除中にエラーが発生しました。';
        console.error('メモの削除中にエラーが発生しました:', message);
        setError(message);
        alert('メモの削除に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
      {isEditing ? (
        // 編集モードUI
        <>
          <textarea
            aria-label="メモを編集"
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-gray-900 bg-white"
            value={editedContent}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setEditedContent(e.target.value);
              }
            }}
            maxLength={1000}
            rows={5}
            placeholder="メモを編集..."
            disabled={isLoading}
          />
          <p className="text-right text-sm text-gray-500 mt-1">
            {editedContent.length}/1000
          </p>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          {!isPlaceholder && <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !editedContent.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer disabled:opacity-50 font-medium"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors cursor-pointer disabled:opacity-50 font-medium"
            >
              削除
            </button>
          </div>}
        </>
      ) : (
        // 表示モードUI
        <>
          <p className="text-gray-800 whitespace-pre-wrap">{editedContent || noteText}</p>
          {!isPlaceholder && <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleEditClick}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors cursor-pointer font-medium"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isLoading}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-md border border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-colors cursor-pointer font-medium"
            >
              削除
            </button>
          </div>}
        </>
      )}
    </div>
  );
};

export default PrivateNote;
