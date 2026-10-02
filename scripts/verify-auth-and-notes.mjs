import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_TEST_EMAIL,
  SUPABASE_TEST_PASSWORD,
} = process.env;

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  !SUPABASE_TEST_EMAIL ||
  !SUPABASE_TEST_PASSWORD
) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD."
  );
}

console.log("=================================================");
console.log("Supabase Auth & 個人メモCRUD 動作確認スクリプト");
console.log("=================================================");

let passCount = 0;
let failCount = 0;

function assert(condition, testName, extra = "") {
  if (condition) {
    passCount++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    failCount++;
    console.error(`❌ [FAIL] ${testName} - ${extra}`);
  }
}

async function runVerification() {
  // 1. Supabaseクライアントの初期化
  console.log("\n--- 1. Supabase クライアント初期化確認 ---");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  assert(!!supabase && !!supabase.auth, "Supabaseクライアントが正常に初期化されている");

  const testPassword = SUPABASE_TEST_PASSWORD;
  // 2. ユーザーログイン機能のテスト (signInWithPassword)
  console.log("\n--- 2. ユーザーログイン機能のテスト ---");
  const testEmail = SUPABASE_TEST_EMAIL;
  let authUser = null;
  try {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    assert(
      !signInError && !!signInData.session,
      `登録済みユーザーでのログイン (${testEmail})`,
      signInError?.message
    );
    authUser = signInData.user;
  } catch (err) {
    assert(false, "ログイン処理で例外発生", String(err));
  }

  // 3. セッション & ユーザー取得確認 (getSession, getUser)
  console.log("\n--- 3. セッション & ユーザー情報の取得 ---");
  try {
    const {
      data: { session: currentSession },
      error: sessionError,
    } = await supabase.auth.getSession();
    assert(
      !sessionError && currentSession?.user?.email === testEmail,
      "getSession() で現在のセッションを取得可能",
      sessionError?.message
    );

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();
    assert(
      !userError && currentUser?.id === authUser?.id,
      "getUser() で認証済みユーザー情報を取得可能",
      userError?.message
    );
  } catch (err) {
    assert(false, "セッション取得で例外発生", String(err));
  }

  // 4. 認証済みユーザーによる個人メモCRUD操作
  console.log("\n--- 4. 認証済みユーザーによる個人メモCRUD操作 ---");
  let createdNoteId = null;
  const testNoteContent = `検証用メモ: ${new Date().toISOString()}`;

  // 4-1. CREATE
  try {
    const { data: createdNote, error: createError } = await supabase
      .from("user_private_notes")
      .insert({
        author_user_id: authUser.id,
        target_user_id: authUser.id,
        note_content: testNoteContent,
      })
      .select()
      .single();

    assert(
      !createError && !!createdNote?.id,
      "個人メモの作成 (INSERT)",
      createError?.message
    );
    createdNoteId = createdNote?.id;
  } catch (err) {
    assert(false, "メモ作成で例外発生", String(err));
  }

  // 4-2. READ
  try {
    const { data: notes, error: readError } = await supabase
      .from("user_private_notes")
      .select("*")
      .order("created_at", { ascending: false });

    const found = notes?.some((n) => n.id === createdNoteId);
    assert(
      !readError && found,
      "作成した個人メモの一覧取得 (SELECT)",
      readError?.message
    );
  } catch (err) {
    assert(false, "メモ取得で例外発生", String(err));
  }

  // 4-3. UPDATE
  try {
    const updatedContent = `${testNoteContent} [UPDATED]`;
    const { data: updatedNote, error: updateError } = await supabase
      .from("user_private_notes")
      .update({
        note_content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdNoteId)
      .select()
      .single();

    assert(
      !updateError && updatedNote?.note_content === updatedContent,
      "個人メモの更新 (UPDATE)",
      updateError?.message
    );
  } catch (err) {
    assert(false, "メモ更新で例外発生", String(err));
  }

  // 4-4. DELETE
  try {
    const { error: deleteError } = await supabase
      .from("user_private_notes")
      .delete()
      .eq("id", createdNoteId);

    assert(!deleteError, "個人メモの削除 (DELETE)", deleteError?.message);

    // 削除後の確認
    const { data: notesAfterDelete } = await supabase
      .from("user_private_notes")
      .select("*")
      .eq("id", createdNoteId);

    assert(
      notesAfterDelete?.length === 0,
      "削除後にメモが存在しないことの確認"
    );
  } catch (err) {
    assert(false, "メモ削除で例外発生", String(err));
  }

  // 5. ユーザーログアウト機能のテスト
  console.log("\n--- 5. ユーザーログアウト機能のテスト ---");
  try {
    const { error: signOutError } = await supabase.auth.signOut();
    assert(!signOutError, "ログアウト実行 (signOut)", signOutError?.message);

    const {
      data: { session: afterSignOutSession },
    } = await supabase.auth.getSession();
    assert(
      afterSignOutSession === null,
      "ログアウト後のセッションが null にクリアされていること"
    );
  } catch (err) {
    assert(false, "ログアウト処理で例外発生", String(err));
  }

  // 6. 未認証ユーザーによる個人メモCRUDの拒否テスト (RLS検証)
  console.log("\n--- 6. 未認証ユーザーによる個人メモ操作の拒否テスト (RLS検証) ---");
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 6-1. 未認証でのSELECT
  try {
    const { data: anonNotes, error: anonSelectError } = await anonClient
      .from("user_private_notes")
      .select("*");

    assert(
      anonNotes?.length === 0,
      "未認証ユーザーのSELECTはRLSにより0件（他者メモは不可視）",
      anonSelectError?.message
    );
  } catch (err) {
    assert(false, "未認証SELECTで例外", String(err));
  }

  // 6-2. 未認証でのINSERT拒否
  try {
    const { data: anonInserted, error: anonInsertError } = await anonClient
      .from("user_private_notes")
      .insert({
        author_user_id: "00000000-0000-0000-0000-000000000000",
        target_user_id: "00000000-0000-0000-0000-000000000000",
        note_content: "不正なメモ作成",
      })
      .select();

    assert(
      !!anonInsertError || !anonInserted || anonInserted.length === 0,
      "未認証ユーザーのINSERTはRLSにより拒否される"
    );
  } catch (err) {
    assert(false, "未認証INSERTで例外", String(err));
  }

  console.log("\n=================================================");
  console.log(`検証結果サマリー: PASS = ${passCount}, FAIL = ${failCount}`);
  console.log("=================================================");
  process.exitCode = failCount > 0 ? 1 : 0;
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exitCode = 1;
});
