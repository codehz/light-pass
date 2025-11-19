export type WebAppData = { user: WebAppUser };
export type WebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

/**
 * 校验 Telegram Mini App 传入的数据
 * @param initData - 从 Telegram.WebApp.initData 接收到的原始查询字符串
 * @param botToken - 你的 Telegram Bot Token
 * @returns - 校验成功后解析的数据对象，如果校验失败则返回 null
 */
export async function validateTelegramMiniAppData(
  initData: string,
  botToken: string,
): Promise<WebAppData | null> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    console.warn("initData does not contain a hash parameter.");
    return null;
  }

  // 1. 构建 data-check-string
  const dataCheckStringArray: string[] = [];
  const sortedKeys = Array.from(params.keys()).sort();

  for (const key of sortedKeys) {
    if (key === "hash") continue; // hash 不包含在 data-check-string 中
    dataCheckStringArray.push(`${key}=${params.get(key)}`);
  }
  const dataCheckString = dataCheckStringArray.join("\n");

  // 2. 计算 secret_key
  const botTokenBytes = new TextEncoder().encode(botToken);
  const webAppDataKeyBytes = new TextEncoder().encode("WebAppData");

  const webAppDataKey = await crypto.subtle.importKey(
    "raw",
    webAppDataKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const secretKeyBuffer = await crypto.subtle.sign(
    "HMAC",
    webAppDataKey,
    botTokenBytes,
  );

  // 将 ArrayBuffer 转换为 Uint8Array 以便用于下一个 HMAC 操作
  const secretKey = new Uint8Array(secretKeyBuffer);

  // 3. 计算 data-check-string 的 HMAC-SHA-256 签名
  const dataCheckStringBytes = new TextEncoder().encode(dataCheckString);

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    dataCheckStringBytes,
  );

  // 将 ArrayBuffer 转换为十六进制字符串
  const calculatedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 4. 比较计算出的哈希与接收到的哈希
  if (calculatedHash === receivedHash) {
    // 校验 auth_date 防止旧数据被重放攻击
    const authDate = params.get("auth_date");
    if (authDate) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const dataTimestamp = parseInt(authDate, 10);
      // 例如，允许数据在 1 小时内有效
      const MAX_AGE_SECONDS = 3600;
      if (currentTimestamp - dataTimestamp > MAX_AGE_SECONDS) {
        console.warn("Data is too old.");
        return null;
      }
    }

    // 校验成功，将查询参数转换为对象返回
    const result: Record<string, any> = {};
    for (const [key, value] of params.entries()) {
      if (key === "user") {
        result.user = JSON.parse(value);
      } else {
        result[key] = value;
      }
    }
    return result as WebAppData;
  } else {
    console.warn("Data validation failed: Hashes do not match.");
    return null;
  }
}
