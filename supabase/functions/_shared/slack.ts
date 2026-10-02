declare const crypto: {
  subtle: SubtleCrypto;
};

export async function verifySlackSignature(params: {
  signingSecret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): Promise<boolean> {
  const { signingSecret, signature, timestamp, rawBody } = params;

  if (!signature || !timestamp) {
    return false;
  }

  // タイムスタンプが5分以上離れている場合はリプレイ攻撃防止のため拒絶
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - parseInt(timestamp, 10));
  if (isNaN(timeDiff) || timeDiff > 60 * 5) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sigBasestring),
  );

  const hashHex = Array.from(new Uint8Array(signatureBytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const expectedSignature = `v0=${hashHex}`;

  // Timing-safe constant-time comparison
  if (expectedSignature.length !== signature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
