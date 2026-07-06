// Server-only AES-GCM helpers for subscription credential encryption.
// Never import from client-reachable modules at top level; import inside handler bodies.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const raw = process.env.SUBSCRIPTION_ENCRYPTION_KEY;
  if (!raw) throw new Error("SUBSCRIPTION_ENCRYPTION_KEY not configured");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string | null | undefined): Promise<string | null> {
  if (!plain) return null;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  return `v1:${b64(iv)}:${b64(cipher)}`;
}

export async function decryptSecret(payload: string | null | undefined): Promise<string | null> {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const key = await getKey();
    const iv = unb64(parts[1]);
    const cipher = unb64(parts[2]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}
