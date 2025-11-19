import { WorkersCacheStorage } from "workers-cache-storage";

export type Encryptor = {
  encrypt(input: string): Promise<string>;
  decrypt(input: string): Promise<string>;
};

export async function createEncryptor(secret: string): Promise<Encryptor> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 1000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const Cache = new WorkersCacheStorage<Uint8Array, CryptoKey>("cache", {
    key(key) {
      return `http://dummy?${encodeURIComponent(btoa(String.fromCharCode(...key)))}`;
    },
    async decode(value) {
      const data = await value.bytes();
      return await crypto.subtle.importKey(
        "raw",
        data,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    },
    async value(value, ttl) {
      const data = await crypto.subtle.exportKey("raw", value);
      return new Response(data as never as Uint8Array, {
        status: 200,
        headers: {
          "Cache-Control": `max-age=${ttl}`,
        },
      });
    },
  });
  Cache.put(salt, key);
  return {
    async encrypt(input: string): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for AES-GCM

      // Prepare header = salt + iv (this will be used as AAD for integrity)
      const header = new Uint8Array(salt.byteLength + iv.byteLength);
      header.set(salt, 0);
      header.set(iv, salt.byteLength);

      // Encrypt the input with header as additional authenticated data
      const encodedInput = encoder.encode(input);
      const encrypted = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: header,
          tagLength: 128,
        },
        key,
        encodedInput,
      );

      // Combine header and ciphertext (which includes the auth tag), then base64 encode
      const combined = new Uint8Array(header.byteLength + encrypted.byteLength);
      combined.set(header, 0);
      combined.set(new Uint8Array(encrypted), header.byteLength);
      return btoa(String.fromCharCode(...combined));
    },

    async decrypt(input: string): Promise<string> {
      // Decode base64 to bytes
      const combined = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));

      const saltLength = 16;
      const ivLength = 12;
      const headerLength = saltLength + ivLength;

      // Basic length check
      if (combined.length < headerLength + 16) {
        // Minimum for empty data + tag
        throw new Error("Invalid ciphertext");
      }

      // Extract header, salt, iv, and ciphertext
      const header = combined.slice(0, headerLength);
      const salt = combined.slice(0, saltLength);
      const iv = combined.slice(saltLength, headerLength);
      const ciphertext = combined.slice(headerLength);

      let key = await Cache.get(salt);
      if (!key) {
        key = await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt,
            iterations: 1000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
        Cache.put(salt, key);
      }

      // Decrypt using the recovered iv and header as AAD for integrity verification
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: header,
          tagLength: 128,
        },
        key,
        ciphertext,
      );

      return decoder.decode(decrypted);
    },
  };
}
