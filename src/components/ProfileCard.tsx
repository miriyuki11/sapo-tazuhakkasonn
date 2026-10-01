'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase'; // Supabaseクライアントをインポート
import { PrivateNoteEditor, PrivateNote } from './PrivateNotes/PrivateNoteEditor'; // 作成したエディタコンポーネントをインポート

export interface ProfileCardProps {
  profileId: string;
  profileName: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profileId,
  profileName,
  email,
  role,
  avatarUrl,
}) => {
  const [myPrivateNote, setMyPrivateNote] = useState<PrivateNote | undefined>(undefined);
  const [isLoadingNote, setIsLoadingNote] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 現在のユーザーのセッション情報を取得
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fetchRequestRef = useRef(0);

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);
    };
    fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      if (!userId) {
        fetchRequestRef.current++;
        setMyPrivateNote(undefined);
        setFetchError(null);
        setIsLoadingNote(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // このプロフィールに対する現在のユーザーの個人メモを取得
  const fetchPrivateNote = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;
    if (!currentUserId) {
      setMyPrivateNote(undefined);
      setFetchError(null);
      setIsLoadingNote(false);
      return;
    }

    setIsLoadingNote(true);
    setFetchError(null);
    try {
      let notes: PrivateNote[] | null = null;

      // 1. Edge Function 'private-notes' の呼び出しを試みる
      try {
        const response = await supabase.functions.invoke(`private-notes?profile_user_id=${encodeURIComponent(profileId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.error && response.data) {
          notes = Array.isArray(response.data) ? response.data : [response.data];
        }
      } catch (funcErr) {
        console.warn('Edge function invoke failed, fallback to direct query', funcErr);
      }

      // 2. フォールバック: 直接テーブルから取得
      if (!notes) {
        const { data, error } = await supabase
          .from('user_private_notes')
          .select('*')
          .eq('target_user_id', profileId)
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        notes = (data || []).map((row) => ({
          id: row.id,
          content: row.note_content,
          note_content: row.note_content,
          target_user_id: row.target_user_id,
          profile_user_id: row.target_user_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      }

      if (requestId === fetchRequestRef.current) {
        setMyPrivateNote(notes && notes.length > 0 ? notes[0] : undefined);
      }
    } catch (err) {
      console.error('Failed to fetch private note:', err);
      if (requestId === fetchRequestRef.current) {
        setFetchError(err instanceof Error ? err.message : 'メモの取得に失敗しました。');
      }
    } finally {
      if (requestId === fetchRequestRef.current) {
        setIsLoadingNote(false);
      }
    }
  }, [currentUserId, profileId]);

  useEffect(() => {
    fetchPrivateNote();
  }, [fetchPrivateNote]);

  const handleNoteSaveSuccess = (updatedNote: PrivateNote) => {
    setMyPrivateNote(updatedNote);
  };

  const handleNoteDeleteSuccess = () => {
    setMyPrivateNote(undefined);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-6 shadow-sm bg-white max-w-lg w-full">
      <div className="flex items-center space-x-4 mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profileName}
            className="w-14 h-14 rounded-full object-cover border border-gray-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl border border-blue-200">
            {profileName.slice(0, 1)}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{profileName}</h2>
          {email && <p className="text-sm text-gray-500">{email}</p>}
          {role && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
              {role}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        {isLoadingNote ? (
          <div className="p-4 border rounded-lg bg-gray-50 text-gray-500 text-sm animate-pulse">
            個人メモを読み込み中...
          </div>
        ) : fetchError ? (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-600 text-sm">
            メモの読み込みエラー: {fetchError}
          </div>
        ) : (
          <PrivateNoteEditor
            initialNote={myPrivateNote}
            onSaveSuccess={handleNoteSaveSuccess}
            onDeleteSuccess={handleNoteDeleteSuccess}
            profileUserId={profileId}
          />
        )}
      </div>
    </div>
  );
};

export default ProfileCard;
