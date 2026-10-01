// src/lib/supabase/auth.ts
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * 新しいユーザーをメールアドレスとパスワードで登録します。
 * @param email - ユーザーのメールアドレス
 * @param password - ユーザーのパスワード
 * @param options - 認証オプション（emailRedirectTo など）
 * @returns 登録されたユーザーデータとエラーオブジェクト
 */
export const signUpUser = async (
  email: string,
  password: string,
  options?: {
    emailRedirectTo?: string;
    data?: Record<string, unknown>;
  }
): Promise<{
  data: { user: User | null; session: Session | null } | null;
  error: AuthError | Error | null;
}> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      ...(options ? { options } : {}),
    });
    if (error) throw error;
    console.log("User signed up successfully:", data);
    return { data, error: null };
  } catch (error: unknown) {
    const authError = error as AuthError | Error;
    console.error("Error signing up:", authError.message);
    return { data: null, error: authError };
  }
};

/**
 * 既存のユーザーをメールアドレスとパスワードでログインさせます。
 * @param email - ユーザーのメールアドレス
 * @param password - ユーザーのパスワード
 * @returns ログインセッションデータとエラーオブジェクト
 */
export const signInUser = async (
  email: string,
  password: string
): Promise<{
  data: { user: User; session: Session } | null;
  error: AuthError | Error | null;
}> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    console.log("User signed in successfully:", data);
    return { data, error: null };
  } catch (error: unknown) {
    const authError = error as AuthError | Error;
    console.error("Error signing in:", authError.message);
    return { data: null, error: authError };
  }
};

/**
 * 現在のユーザーをログアウトさせます。
 * @returns エラーオブジェクト
 */
export const signOutUser = async (): Promise<{
  error: AuthError | Error | null;
}> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    console.log("User signed out successfully.");
    return { error: null };
  } catch (error: unknown) {
    const authError = error as AuthError | Error;
    console.error("Error signing out:", authError.message);
    return { error: authError };
  }
};

/**
 * 現在のユーザーセッションを取得します。
 * @returns 現在のセッションデータとエラーオブジェクト
 */
export const getCurrentSession = async (): Promise<{
  session: Session | null;
  error: AuthError | Error | null;
}> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    console.log("Current session:", session);
    return { session, error: null };
  } catch (error: unknown) {
    const authError = error as AuthError | Error;
    console.error("Error getting session:", authError.message);
    return { session: null, error: authError };
  }
};

/**
 * 現在認証されているユーザー情報を取得します。
 * @returns ユーザーデータとエラーオブジェクト
 */
export const getUser = async (): Promise<{
  user: User | null;
  error: AuthError | Error | null;
}> => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    console.log("Current user:", user);
    return { user, error: null };
  } catch (error: unknown) {
    const authError = error as AuthError | Error;
    console.error("Error getting user:", authError.message);
    return { user: null, error: authError };
  }
};
