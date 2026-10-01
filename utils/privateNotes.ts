import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

export type UserPrivateNote =
  Database["public"]["Tables"]["user_private_notes"]["Row"];

export type CreatePrivateNoteInput = {
  target_user_id?: string;
  note_content?: string;
  author_user_id?: string;
  // 簡易仕様やレガシー互換用のフィールド
  title?: string;
  content?: string;
};

export type UpdatePrivateNoteInput = {
  note_content?: string;
  title?: string;
  content?: string;
};

/**
 * 現在認証されているユーザーの個人メモ一覧を取得します。
 * targetUserId を指定した場合は、そのユーザーに対するメモのみをフィルタします。
 * RLSにより、ログインユーザー自身のメモのみが取得されます。
 */
export async function getPrivateNotes(
  targetUserId?: string
): Promise<UserPrivateNote[] | null> {
  try {
    let query = supabase
      .from("user_private_notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (targetUserId) {
      query = query.eq("target_user_id", targetUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching private notes:", error.message);
      return null;
    }
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Exception in getPrivateNotes:", message);
    return null;
  }
}

/**
 * 新しい個人メモを作成します。
 * author_user_id は未指定の場合、ログイン中ユーザーの auth.uid() が自動設定されます。
 * target_user_id が未指定の場合は、自身に対するメモとして author_user_id が使用されます。
 */
export async function createPrivateNote(
  note: CreatePrivateNoteInput
): Promise<UserPrivateNote | null> {
  try {
    let authorId = note.author_user_id;
    if (!authorId) {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error("Error creating private note: User not authenticated.");
        return null;
      }
      authorId = userData.user.id;
    }

    const targetUserId = note.target_user_id || authorId;

    // note_content の組み立て（title/content 形式も吸収）
    let content = note.note_content;
    if (!content) {
      if (note.title && note.content) {
        content = `【${note.title}】\n${note.content}`;
      } else {
        content = note.title || note.content || "";
      }
    }

    const { data, error } = await supabase
      .from("user_private_notes")
      .insert({
        author_user_id: authorId,
        target_user_id: targetUserId,
        note_content: content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating private note:", error.message);
      return null;
    }
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Exception in createPrivateNote:", message);
    return null;
  }
}

/**
 * 指定されたIDの個人メモを更新します。
 * RLSにより、ログインユーザー自身のメモのみが更新可能です。
 */
export async function updatePrivateNote(
  noteId: string,
  updates: UpdatePrivateNoteInput
): Promise<UserPrivateNote | null> {
  try {
    let content = updates.note_content;
    if (content === undefined) {
      if (updates.title && updates.content) {
        content = `【${updates.title}】\n${updates.content}`;
      } else if (updates.title !== undefined) {
        content = updates.title;
      } else if (updates.content !== undefined) {
        content = updates.content;
      }
    }

    const updatePayload: {
      note_content?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      updatePayload.note_content = content;
    }

    const { data, error } = await supabase
      .from("user_private_notes")
      .update(updatePayload)
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating private note:", error.message);
      return null;
    }
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Exception in updatePrivateNote:", message);
    return null;
  }
}

/**
 * 指定されたIDの個人メモを削除します。
 * RLSにより、ログインユーザー自身のメモのみが削除可能です。
 */
export async function deletePrivateNote(noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_private_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting private note:", error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Exception in deletePrivateNote:", message);
    return false;
  }
}
