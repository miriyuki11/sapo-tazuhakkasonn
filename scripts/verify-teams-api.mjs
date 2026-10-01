import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ccarnmeqioneyfnjrlva.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PVvn9xKKuAaLg2Ew5AzPgg_q2x3-5Wk";
const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CREDENTIALS = {
  userA: { email: "sapo_test_user_a@gmail.com", password: "Password123!" },
  userB: { email: "user1@example.com", password: "Password123!" },
  userC: { email: "user2@example.com", password: "Password123!" },
};

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message}`);
  }
  return { token: data.session.access_token, user: data.user };
}

let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

async function request(method, path, token, body = null) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log("=== チーム管理API 動作確認テスト開始 ===");
  console.log(`Functions Base URL: ${FUNCTIONS_BASE_URL}\n`);

  // 1. ログイン & トークン取得
  console.log("1. テストユーザーのログイン & JWT取得");
  const authA = await login(CREDENTIALS.userA.email, CREDENTIALS.userA.password);
  const authB = await login(CREDENTIALS.userB.email, CREDENTIALS.userB.password);
  const authC = await login(CREDENTIALS.userC.email, CREDENTIALS.userC.password);

  console.log(`  ユーザーA (オーナー): ${authA.user.id} (${CREDENTIALS.userA.email})`);
  console.log(`  ユーザーB (メンバー): ${authB.user.id} (${CREDENTIALS.userB.email})`);
  console.log(`  ユーザーC (非メンバー): ${authC.user.id} (${CREDENTIALS.userC.email})\n`);

  let createdTeamId = null;

  // 2. チーム作成 (POST /functions/teams)
  console.log("2. チーム作成 (POST /functions/teams)");
  {
    // 異常系: 認証なし
    const resNoAuth = await request("POST", "/teams", null, {
      name: "Unauthorized Attempt",
      description: "Should fail.",
    });
    assert(
      resNoAuth.status === 401,
      "異常系: 認証なし (401 Unauthorized)",
      `Status: ${resNoAuth.status}, Body: ${JSON.stringify(resNoAuth.data)}`
    );

    // 異常系: 必須項目不足 (nameなし)
    const resNoName = await request("POST", "/teams", authA.token, {
      description: "Team without a name.",
    });
    assert(
      resNoName.status === 400,
      "異常系: 必須項目不足 (nameなし) (400 Bad Request)",
      `Status: ${resNoName.status}, Body: ${JSON.stringify(resNoName.data)}`
    );

    // 正常系: オーナーによるチーム作成
    const uniqueTeamName = `Developer Team ${Date.now()}`;
    const resCreate = await request("POST", "/teams", authA.token, {
      name: uniqueTeamName,
      description: "Team for developers.",
    });
    assert(
      resCreate.status === 201 && resCreate.data?.id && resCreate.data?.owner_id === authA.user.id,
      "正常系: オーナーによるチーム作成 (201 Created & owner_id一致)",
      `Status: ${resCreate.status}, Body: ${JSON.stringify(resCreate.data)}`
    );

    createdTeamId = resCreate.data?.id;
    console.log(`  -> 作成された Team ID: ${createdTeamId}\n`);
  }

  if (!createdTeamId) {
    console.error("チームの作成に失敗したため、以降のテストを中止します。");
    return;
  }

  // 3. チームメンバー管理: メンバー追加 (POST /functions/teams/:team_id/members)
  console.log("3. チームメンバー管理: メンバー追加 (POST /functions/teams/:team_id/members)");
  {
    // 異常系: メンバー（まだ非メンバーのB）によるメンバー追加
    const resAddByB = await request("POST", `/teams/${createdTeamId}/members`, authB.token, {
      user_id: authC.user.id,
    });
    assert(
      resAddByB.status === 403,
      "異常系: オーナー以外によるメンバー追加 (403 Forbidden)",
      `Status: ${resAddByB.status}, Body: ${JSON.stringify(resAddByB.data)}`
    );

    // 異常系: 存在しないuser_idの追加
    const resAddNonExistent = await request("POST", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: "00000000-0000-0000-0000-000000000000",
    });
    assert(
      resAddNonExistent.status === 404 || resAddNonExistent.status === 400,
      "異常系: 存在しないuser_idの追加 (404 Not Found / 400)",
      `Status: ${resAddNonExistent.status}, Body: ${JSON.stringify(resAddNonExistent.data)}`
    );

    // 正常系: オーナーによるメンバー追加 (ユーザーBを追加)
    const resAddMember = await request("POST", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: authB.user.id,
      role: "メンバー",
    });
    assert(
      resAddMember.status === 201 && resAddMember.data?.member?.user_id === authB.user.id,
      "正常系: オーナーによるメンバー追加 (201 Created)",
      `Status: ${resAddMember.status}, Body: ${JSON.stringify(resAddMember.data)}`
    );

    // 異常系: 既にメンバーであるユーザーの追加
    const resAddDuplicate = await request("POST", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: authB.user.id,
    });
    assert(
      resAddDuplicate.status === 409,
      "異常系: 既にメンバーであるユーザーの追加 (409 Conflict)",
      `Status: ${resAddDuplicate.status}, Body: ${JSON.stringify(resAddDuplicate.data)}`
    );
    console.log();
  }

  // 4. チーム情報取得 (GET /functions/teams/:team_id)
  console.log("4. チーム情報取得 (GET /functions/teams/:team_id)");
  {
    // 正常系: オーナーによる取得
    const resGetOwner = await request("GET", `/teams/${createdTeamId}`, authA.token);
    assert(
      resGetOwner.status === 200 && resGetOwner.data?.id === createdTeamId,
      "正常系: オーナーによる取得 (200 OK)",
      `Status: ${resGetOwner.status}, Body: ${JSON.stringify(resGetOwner.data)}`
    );

    // 正常系: メンバーによる取得
    const resGetMember = await request("GET", `/teams/${createdTeamId}`, authB.token);
    assert(
      resGetMember.status === 200 && resGetMember.data?.id === createdTeamId,
      "正常系: メンバーによる取得 (200 OK)",
      `Status: ${resGetMember.status}, Body: ${JSON.stringify(resGetMember.data)}`
    );

    // 異常系: 非メンバーによる取得
    const resGetNonMember = await request("GET", `/teams/${createdTeamId}`, authC.token);
    assert(
      resGetNonMember.status === 403,
      "異常系: 非メンバーによる取得 (403 Forbidden)",
      `Status: ${resGetNonMember.status}, Body: ${JSON.stringify(resGetNonMember.data)}`
    );

    // 異常系: 存在しないチームID
    const resGetNotFound = await request("GET", "/teams/00000000-0000-0000-0000-000000000000", authA.token);
    assert(
      resGetNotFound.status === 404,
      "異常系: 存在しないチームIDの取得 (404 Not Found)",
      `Status: ${resGetNotFound.status}, Body: ${JSON.stringify(resGetNotFound.data)}`
    );
    console.log();
  }

  // 5. チーム情報更新 (PUT /functions/teams/:team_id)
  console.log("5. チーム情報更新 (PUT /functions/teams/:team_id)");
  {
    // 異常系: メンバーによる更新
    const resUpdateMember = await request("PUT", `/teams/${createdTeamId}`, authB.token, {
      name: "Attempt by Member",
      description: "Should be rejected.",
    });
    assert(
      resUpdateMember.status === 403,
      "異常系: メンバーによる更新 (403 Forbidden)",
      `Status: ${resUpdateMember.status}, Body: ${JSON.stringify(resUpdateMember.data)}`
    );

    // 異常系: 非メンバーによる更新
    const resUpdateNonMember = await request("PUT", `/teams/${createdTeamId}`, authC.token, {
      name: "Attempt by Non-Member",
      description: "Should be rejected.",
    });
    assert(
      resUpdateNonMember.status === 403,
      "異常系: 非メンバーによる更新 (403 Forbidden)",
      `Status: ${resUpdateNonMember.status}, Body: ${JSON.stringify(resUpdateNonMember.data)}`
    );

    // 異常系: 存在しないチームID
    const resUpdateNotFound = await request("PUT", "/teams/00000000-0000-0000-0000-000000000000", authA.token, {
      name: "Non Existent",
      description: "Should fail.",
    });
    assert(
      resUpdateNotFound.status === 404,
      "異常系: 存在しないチームIDの更新 (404 Not Found)",
      `Status: ${resUpdateNotFound.status}, Body: ${JSON.stringify(resUpdateNotFound.data)}`
    );

    // 異常系: 必須項目不足 (空文字等)
    const resUpdateInvalid = await request("PUT", `/teams/${createdTeamId}`, authA.token, {
      name: "",
    });
    assert(
      resUpdateInvalid.status === 400,
      "異常系: 必須項目不足 (空文字のname) (400 Bad Request)",
      `Status: ${resUpdateInvalid.status}, Body: ${JSON.stringify(resUpdateInvalid.data)}`
    );

    // 正常系: オーナーによる更新
    const resUpdateOwner = await request("PUT", `/teams/${createdTeamId}`, authA.token, {
      name: "Updated Dev Team",
      description: "Description has been updated.",
    });
    assert(
      resUpdateOwner.status === 200 && resUpdateOwner.data?.name === "Updated Dev Team",
      "正常系: オーナーによる更新 (200 OK & 更新反映)",
      `Status: ${resUpdateOwner.status}, Body: ${JSON.stringify(resUpdateOwner.data)}`
    );
    console.log();
  }

  // 6. チームメンバー管理: メンバー削除 (DELETE /functions/teams/:team_id/members)
  console.log("6. チームメンバー管理: メンバー削除 (DELETE /functions/teams/:team_id/members)");
  {
    // 異常系: メンバーによるメンバー削除
    const resDeleteByMember = await request("DELETE", `/teams/${createdTeamId}/members`, authB.token, {
      user_id: authB.user.id,
    });
    assert(
      resDeleteByMember.status === 403,
      "異常系: メンバーによるメンバー削除 (403 Forbidden)",
      `Status: ${resDeleteByMember.status}, Body: ${JSON.stringify(resDeleteByMember.data)}`
    );

    // 異常系: オーナー自身の削除
    const resDeleteOwner = await request("DELETE", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: authA.user.id,
    });
    assert(
      resDeleteOwner.status === 400,
      "異常系: オーナー自身の削除 (400 Bad Request)",
      `Status: ${resDeleteOwner.status}, Body: ${JSON.stringify(resDeleteOwner.data)}`
    );

    // 異常系: 存在しないメンバーの削除
    const resDeleteNonMember = await request("DELETE", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: "00000000-0000-0000-0000-000000000000",
    });
    assert(
      resDeleteNonMember.status === 404,
      "異常系: 存在しないメンバーの削除 (404 Not Found)",
      `Status: ${resDeleteNonMember.status}, Body: ${JSON.stringify(resDeleteNonMember.data)}`
    );

    // 正常系: オーナーによるメンバー削除
    const resDeleteSuccess = await request("DELETE", `/teams/${createdTeamId}/members`, authA.token, {
      user_id: authB.user.id,
    });
    assert(
      resDeleteSuccess.status === 200,
      "正常系: オーナーによるメンバー削除 (200 OK)",
      `Status: ${resDeleteSuccess.status}, Body: ${JSON.stringify(resDeleteSuccess.data)}`
    );
    console.log();
  }

  // 7. テスト結果サマリー
  console.log("=========================================");
  console.log(`実行テスト数: ${testCount}`);
  console.log(`合格 (PASS): ${passedCount}`);
  console.log(`不合格 (FAIL): ${failedCount}`);
  console.log("=========================================");

  if (failedCount === 0) {
    console.log("\n🎉 全ての確認項目が正常に動作していることが確認できました！");
  } else {
    console.log("\n一部のテストが失敗しました。ログを確認してください。");
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
});
