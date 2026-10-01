'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createPrivateNote, updatePrivateNote, deletePrivateNote } from '@/utils/privateNotes';

// メモの型定義
export interface PrivateNote {
  id?: string;
  content: string;
  note_content?: string;
  user_id?: string;
  author_user_id?: string;
  profile_user_id?: string;
  target_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrivateNoteEditorProps {
  initialNote?: PrivateNote;
  onSaveSuccess: (updatedNote: PrivateNote) => void;
  onCancel?: () => void;
  onDeleteSuccess?: (noteId: string) => void;
  profileUserId: string;
}

const MAX_NOTE_LENGTH = 1000;

export const PrivateNoteEditor: React.FC<PrivateNoteEditorProps> = ({
  initialNote,
  onSaveSuccess,
  onCancel,
  onDeleteSuccess,
  profileUserId,
}) => {
  const getInitialContent = () => initialNote?.content || initialNote?.note_content || '';
  const [noteContent, setNoteContent] = useState(getInitialContent());
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // initialNote が外部から変更された場合に同期
  useEffect(() => {
    setNoteContent(getInitialContent());
    setIsEditing(false);
  }, [initialNote]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_NOTE_LENGTH) {
      setNoteContent(e.target.value);
    }
  };

  const handleSave = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    const trimmedContent = noteContent.trim();
    if (!trimmedContent) {
      setError('メモの内容を入力してください。');
      setIsLoading(false);
      return;
    }

    try {
      let savedNote: PrivateNote | null = null;
      const payload = {
        content: trimmedContent,
        note_content: trimmedContent,
        profile_user_id: profileUserId,
        target_user_id: profileUserId,
      };

      // 1. Edge Function 'private-notes'
      try {
        let response;
        if (initialNote?.id) {
          response = await supabase.functions.invoke('private-notes', {
            body: { ...payload, id: initialNote.id, note_id: initialNote.id },
            method: 'PUT',
          });
        } else {
          response = await supabase.functions.invoke('private-notes', {
            body: payload,
            method: 'POST',
          });
        }

        if (response && !response.error && response.data) {
          const resData = response.data?.note || response.data;
          savedNote = {
            id: resData.id || initialNote?.id,
            content: resData.content || resData.note_content || trimmedContent,
            note_content: resData.note_content || resData.content || trimmedContent,
            profile_user_id: resData.profile_user_id || resData.target_user_id || profileUserId,
            target_user_id: resData.target_user_id || profileUserId,
            created_at: resData.created_at || new Date().toISOString(),
            updated_at: resData.updated_at || new Date().toISOString(),
          };
        }
      } catch (funcErr) {
        console.warn('Edge function failed, trying fallback:', funcErr);
      }

      // 2. フォールバック (直接DB操作)
      if (!savedNote) {
        if (initialNote?.id) {
          const updated = await updatePrivateNote(initialNote.id, {
            note_content: trimmedContent,
          });
          if (updated) {
            savedNote = {
              id: updated.id,
              content: updated.note_content,
              note_content: updated.note_content,
              profile_user_id: updated.target_user_id,
              target_user_id: updated.target_user_id,
              created_at: updated.created_at,
              updated_at: updated.updated_at,
            };
          }
        } else {
          const created = await createPrivateNote({
            target_user_id: profileUserId,
            note_content: trimmedContent,
          });
          if (created) {
            savedNote = {
              id: created.id,
              content: created.note_content,
              note_content: created.note_content,
              profile_user_id: created.target_user_id,
              target_user_id: created.target_user_id,
              created_at: created.created_at,
              updated_at: created.updated_at,
            };
          }
        }
      }

      if (!savedNote) {
        throw new Error('メモの保存に失敗しました。');
      }

      onSaveSuccess(savedNote);
      setNoteContent(savedNote.content);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save private note:', err);
      setError(err instanceof Error ? err.message : 'メモの保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [noteContent, initialNote, onSaveSuccess, profileUserId]);

  const handleCancel = useCallback(() => {
    setNoteContent(getInitialContent()); // 元のコンテンツに戻す
    setIsEditing(false); // 表示モードに戻る
    setError(null);
    onCancel?.(); // 親コンポーネントに通知
  }, [initialNote, onCancel]);

  const handleDelete = useCallback(async () => {
    if (!initialNote?.id) return;
    if (window.confirm('このメモを本当に削除しますか？')) {
      setIsLoading(true);
      setError(null);
      try {
        let deleted = false;
        try {
          const response = await supabase.functions.invoke('private-notes', {
            method: 'DELETE',
            body: { id: initialNote.id, note_id: initialNote.id },
          });
          if (response && !response.error) {
            deleted = true;
          }
        } catch (e) {
          console.warn('Edge function delete failed, trying fallback', e);
        }

        if (!deleted) {
          deleted = await deletePrivateNote(initialNote.id);
        }

        if (deleted) {
          onDeleteSuccess?.(initialNote.id);
          setNoteContent('');
          setIsEditing(false);
          alert('メモが削除されました。');
        } else {
          throw new Error('メモの削除に失敗しました。');
        }
      } catch (err) {
        console.error('Failed to delete note:', err);
        setError(err instanceof Error ? err.message : 'メモの削除に失敗しました。');
        alert('メモの削除に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    }
  }, [initialNote, onDeleteSuccess]);

  const hasNote = Boolean(initialNote && (initialNote.content || initialNote.note_content));
  const isMaxLength = noteContent.length >= MAX_NOTE_LENGTH;

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white" data-testid="private-note-editor">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-800">
          {hasNote ? '個人メモ' : isEditing ? '新規個人メモ' : '個人メモ'}
        </h3>
        {/* データロックやサブスクリプション表示は一切含まれません */}
      </div>

      {isEditing ? (
        <div>
          <textarea
            className="w-full p-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 bg-white"
            rows={5}
            placeholder="ここにメモを入力してください (最大1000文字)"
            value={noteContent}
            onChange={handleChange}
            maxLength={MAX_NOTE_LENGTH}
            disabled={isLoading}
          />
          <div className="flex justify-between items-center text-xs mt-1">
            <span className={isMaxLength ? 'text-red-500 font-medium' : 'text-gray-400'}>
              {isMaxLength && '※ 最大文字数（1000文字）に達しました'}
            </span>
            <span className={isMaxLength ? 'text-red-600 font-bold' : 'text-gray-500'}>
              {noteContent.length}/{MAX_NOTE_LENGTH}文字
            </span>
          </div>

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <div className="flex justify-end items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
              disabled={isLoading}
            >
              キャンセル
            </button>
            {initialNote?.id && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 cursor-pointer font-medium"
                disabled={isLoading}
              >
                削除
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 cursor-pointer font-medium"
              disabled={isLoading || noteContent.trim().length === 0}
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : hasNote ? (
        <div className="space-y-3">
          <p className="text-gray-800 text-sm whitespace-pre-wrap bg-gray-50/70 p-3 rounded border border-gray-100">
            {noteContent || getInitialContent()}
          </p>
          <div className="flex justify-end items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded hover:bg-gray-300 transition-colors duration-200 cursor-pointer font-medium"
            >
              編集
            </button>
            {initialNote?.id && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-xs rounded border border-red-200 transition-colors duration-200 cursor-pointer font-medium"
              >
                削除
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="py-2 text-center">
          <p className="text-gray-500 text-xs mb-3">まだ個人メモはありません。</p>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors duration-200 cursor-pointer font-medium shadow-sm"
          >
            ＋ メモを作成
          </button>
        </div>
      )}
    </div>
  );
};

export default PrivateNoteEditor;
