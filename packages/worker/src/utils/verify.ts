export type HmacVerifier = {
  encode: (input: string) => Promise<string>;
  decode: (hashedString: string) => Promise<string>;
};

export async function createHmacVerifier(
  secret: string,
): Promise<HmacVerifier> {
  // Convert secret to a CryptoKey once during initialization
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  async function encode(input: string): Promise<string> {
    // Validate input: only letters, numbers, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(input)) {
      throw new Error(
        "Input must contain only letters, numbers, and underscores",
      );
    }

    // Create HMAC
    const inputData = encoder.encode(input);
    const signature = await crypto.subtle.sign("HMAC", key, inputData);

    // Convert signature to hex
    const hash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `${input}:${hash}`;
  }

  async function decode(hashedString: string): Promise<string> {
    // Split input into original string and hash
    const [input, providedHash] = hashedString.split(":");

    if (!input || !providedHash) {
      throw new Error("Invalid hashed string format");
    }

    // Validate input format
    if (!/^[a-zA-Z0-9_]+$/.test(input)) {
      throw new Error("Invalid input format in hashed string");
    }

    // Generate hash for verification
    const inputData = encoder.encode(input);
    const signature = await crypto.subtle.sign("HMAC", key, inputData);

    // Convert signature to hex for comparison
    const computedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Verify hash
    if (computedHash !== providedHash) {
      throw new Error("Hash verification failed");
    }

    return input;
  }

  return { encode, decode };
}
