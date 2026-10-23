import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Format: v1.<iv>.<auth tag>.<ciphertext>, each part base64.
// The "v1" prefix leaves room for key rotation: add "v2" and read both for a while.
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  }
  return key;
}

/**
 * Encrypts a secret (for example a Google refresh token) for storage.
 * The user id is bound into the ciphertext, so a value copied to another
 * user's row will not decrypt.
 */
export function encryptToken(plaintext: string, userId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

/** Reverses encryptToken. Throws if the value was changed, or the key, user id or version is wrong. */
export function decryptToken(stored: string, userId: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted token");
  }
  const [version, ivB64, tagB64, ciphertextB64] = parts;
  if (version !== VERSION) {
    throw new Error(`Unsupported encrypted token version: ${version}`);
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Malformed encrypted token");
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DRIVE_TOKEN_ENCRYPTION_KEY")) {
      throw error;
    }
    throw new Error("Could not decrypt token");
  }
}
