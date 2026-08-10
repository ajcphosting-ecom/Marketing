// Symmetric encryption for integration credentials at rest (AES-256-GCM).
// The database only ever stores ciphertext — plaintext API keys/tokens
// exist in memory just long enough to call the provider's API.

const crypto = require("crypto");

const ALGO = "aes-256-gcm";
let warned = false;

function getKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATIONS_ENCRYPTION_KEY must be set in production. Generate one with:\n" +
          "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    if (!warned) {
      console.warn(
        "[crypto] INTEGRATIONS_ENCRYPTION_KEY not set — using an insecure dev-only key. " +
          "Set INTEGRATIONS_ENCRYPTION_KEY before storing real credentials."
      );
      warned = true;
    }
  }

  // Hash whatever we have to a fixed 32-byte key — accepts any length input.
  return crypto.createHash("sha256").update(raw || "dev-only-insecure-key").digest();
}

/** Encrypts a JSON-serializable value, returns a single base64 string. */
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Reverses encrypt() — throws if the key is wrong or the value was tampered with. */
function decrypt(encoded) {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = { encrypt, decrypt };
