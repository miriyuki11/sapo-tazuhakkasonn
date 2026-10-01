'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PrivateNote, { PrivateNoteItem } from '@/src/components/PrivateNote/PrivateNote';
import { supabase } from '@/lib/supabase';
import { getPrivateNotes, createPrivateNote } from '@/utils/privateNotes';

export interface UserProfileCardProps {
  targetUserId: string; // プロフィールを表示しているユーザーのID
  userName?: string;
  avatarUrl?: string;
  role?: string;
  email?: string;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  targetUserId,
  userName = '対象メンバー',
  avatarUrl,
  role = 'メンバー',
  email,
}) => {
  const [privateNotes, setPrivateNotes] = useState<PrivateNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規メモ作成用ステート
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);

  const fetchPrivateNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let notes: PrivateNoteItem[] | null = null;

      // 1. Edge Function 'private-notes' (GET) を試みる
      try {
        const response = await supabase.functions.invoke('private-notes', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: { profile_user_id: targetUserId, target_user_id: targetUserId },
        });

        if (response && !response.error && response.data) {
          const list = Array.isArray(response.data) ? response.data : [response.data];
          notes = list.map((item) => ({
            id: item.id,
            content: item.content || item.note_content || '',
            note_content: item.note_content || item.content || '',
            target_user_id: item.target_user_id || targetUserId,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));
        }
      } catch (funcErr) {
        console.warn('Edge function fetch failed, fallback to direct query:', funcErr);
      }

      // 2. フォールバック: utils/privateNotes
      if (!notes) {
        const dbNotes = await getPrivateNotes(targetUserId);
        if (dbNotes) {
          notes = dbNotes.map((item) => ({
            id: item.id,
            content: item.note_content,
            note_content: item.note_content,
            target_user_id: item.target_user_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));
        }
      }

      setPrivateNotes(notes || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '個人メモの取得中にエラーが発生しました。';
      console.error('個人メモの取得中にエラーが発生しました:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchPrivateNotes();
  }, [fetchPrivateNotes]);

  // メモの削除成功時にリストから削除する関数
  const handleNoteDeleteSuccess = (deletedNoteId: string) => {
    setPrivateNotes((prev) => prev.filter((note) => note.id !== deletedNoteId));
  };

  // メモの更新成功時にリストの該当メモを更新する関数
  const handleNoteUpdateSuccess = (updatedNote: PrivateNoteItem) => {
    setPrivateNotes((prev) =>
      prev.map((note) => (note.id === updatedNote.id ? updatedNote : note))
    );
  };

  // 新規メモ作成の保存
  const handleCreateNote = async () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed) {
      alert('メモの内容を入力してください。');
      return;
    }

    setIsSavingNew(true);
    try {
      let created: PrivateNoteItem | null = null;

      // 1. Edge Function
      try {
        const response = await supabase.functions.invoke('private-notes', {
          method: 'POST',
          body: {
            content: trimmed,
            note_content: trimmed,
            profile_user_id: targetUserId,
            target_user_id: targetUserId,
          },
        });
        if (response && !response.error && response.data) {
          const res = response.data?.note || response.data;
          created = {
            id: res.id,
            content: res.content || res.note_content || trimmed,
            note_content: res.note_content || res.content || trimmed,
            target_user_id: res.target_user_id || targetUserId,
            created_at: res.created_at,
            updated_at: res.updated_at,
          };
        }
      } catch (e) {
        console.warn('Edge function create failed, trying fallback', e);
      }

      // 2. フォールバック
      if (!created) {
        const dbCreated = await createPrivateNote({
          target_user_id: targetUserId,
          note_content: trimmed,
        });
        if (dbCreated) {
          created = {
            id: dbCreated.id,
            content: dbCreated.note_content,
            note_content: dbCreated.note_content,
            target_user_id: dbCreated.target_user_id,
            created_at: dbCreated.created_at,
            updated_at: dbCreated.updated_at,
          };
        }
      }

      if (created) {
        setPrivateNotes((prev) => [created!, ...prev]);
        setNewNoteContent('');
        setIsCreating(false);
        alert('メモが作成されました。');
      } else {
        throw new Error('メモの作成に失敗しました。');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'メモ作成中にエラーが発生しました。';
      alert(message);
    } finally {
      setIsSavingNew(false);
    }
  };

  return (
    <div className="user-profile-card p-6 bg-gray-50 rounded-xl shadow-md border border-gray-200 max-w-lg w-full">
      {/* ユーザー情報ヘッダー */}
      <div className="flex items-center space-x-4 mb-6">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="w-14 h-14 rounded-full object-cover border border-gray-200"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl border border-indigo-200">
            {userName.slice(0, 1)}
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold text-gray-900">{userName}</h3>
          {email && <p className="text-sm text-gray-500">{email}</p>}
          <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
            {role}
          </span>
        </div>
      </div>

      {/* 個人メモセクション */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-bold text-gray-800">
            個人メモ ({privateNotes.length}件)
          </h4>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer font-medium"
            >
              ＋ メモを追加
            </button>
          )}
        </div>

        {/* 新規メモ作成フォーム */}
        {isCreating && (
          <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50/50">
            <h5 className="text-sm font-semibold text-gray-800 mb-2">新規メモ作成</h5>
            <textarea
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-gray-900 bg-white"
              value={newNoteContent}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setNewNoteContent(e.target.value);
                }
              }}
              maxLength={1000}
              rows={4}
              placeholder="新しいメモを入力してください (最大1000文字)..."
              disabled={isSavingNew}
            />
            <p className="text-right text-xs text-gray-500 mt-1">
              {newNoteContent.length}/1000
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewNoteContent('');
                }}
                disabled={isSavingNew}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleCreateNote}
                disabled={isSavingNew || !newNoteContent.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium cursor-pointer disabled:opacity-50"
              >
                {isSavingNew ? '保存中...' : '追加'}
              </button>
            </div>
          </div>
        )}

        {/* メモ一覧表示 */}
        {isLoading ? (
          <p className="text-sm text-gray-500 py-3">個人メモを読み込み中...</p>
        ) : error ? (
          <p className="text-sm text-red-500 py-3">{error}</p>
        ) : privateNotes.length > 0 ? (
          <div className="space-y-3">
            {privateNotes.map((note) => (
              <PrivateNote
                key={note.id}
                note={note}
                onDeleteSuccess={handleNoteDeleteSuccess}
                onUpdateSuccess={handleNoteUpdateSuccess}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 py-2">まだ個人メモはありません。</p>
        )}
      </div>
    </div>
  );
};

export default UserProfileCard;
