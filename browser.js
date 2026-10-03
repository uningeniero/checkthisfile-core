export { limits, normalizePath, parseManifest, compareManifests } from "./manifest.js";
export async function sha256Bytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error("INVALID_BYTES");
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
