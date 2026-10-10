import { createHash } from "node:crypto";
import { open, lstat, opendir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";
import { limits, normalizePath, parseManifest, compareManifests } from "./manifest.js";
export { limits, normalizePath, parseManifest, compareManifests } from "./manifest.js";
export const version = "0.1.4";
export function sha256Bytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error("INVALID_BYTES");
  return createHash("sha256").update(bytes).digest("hex");
}
export async function hashFile(path, { maxBytes = 1024 * 1024 * 1024, signal } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("INVALID_LIMIT");
  signal?.throwIfAborted();
  // Do not follow a final-component symlink or wait on a FIFO/device.
  const initial = await lstat(path, { bigint: true });
  if (!initial.isFile() || initial.isSymbolicLink()) throw new Error("REGULAR_FILE_REQUIRED");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.ino !== initial.ino || before.dev !== initial.dev) throw new Error("FILE_CHANGED");
    if (before.size > BigInt(maxBytes)) throw new Error("FILE_TOO_LARGE");
    const hash = createHash("sha256"), buffer = new Uint8Array(64 * 1024); let size = 0;
    while (true) {
      signal?.throwIfAborted();
      const read = await handle.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      size += read.bytesRead; if (size > maxBytes) throw new Error("FILE_TOO_LARGE");
      hash.update(buffer.subarray(0, read.bytesRead));
    }
    signal?.throwIfAborted();
    const after = await handle.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(size) !== after.size) throw new Error("FILE_CHANGED");
    return { algorithm: "SHA-256", size, sha256: hash.digest("hex") };
  } finally { await handle.close(); }
}
export async function compareFiles(first, second, options) {
  const a = await hashFile(first, options), b = await hashFile(second, options);
  return { matches: a.size === b.size && a.sha256 === b.sha256, first: a, second: b };
}
export async function createFolderManifest(root, { signal } = {}) {
  const requested = resolve(root), rootStat = await lstat(requested);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("DIRECTORY_REQUIRED");
  const base = await realpath(requested), files = []; let total = 0, directories = 0;
  async function visit(directory, prefix = "", depth = 0) {
    signal?.throwIfAborted();
    if (depth > limits.depth || ++directories > limits.directories) throw new Error("DIRECTORY_LIMIT");
    const entries = [];
    for await (const entry of await opendir(directory)) {
      entries.push(entry);
      if (entries.length > limits.files + limits.directories) throw new Error("DIRECTORY_LIMIT");
    }
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const label = normalizePath(prefix ? `${prefix}/${entry.name}` : entry.name), path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("SYMLINK_NOT_SUPPORTED");
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error("SYMLINK_NOT_SUPPORTED");
      // Detect replaced ancestor directories before reading; no untrusted manifest path is opened.
      if (await realpath(path) !== path) throw new Error("PATH_CHANGED");
      if (stat.isDirectory()) { await visit(path, label, depth + 1); continue; }
      if (!stat.isFile()) throw new Error("REGULAR_FILE_REQUIRED");
      if (files.length >= limits.files) throw new Error("FILE_LIMIT");
      const fingerprint = await hashFile(path, { maxBytes: limits.fileBytes, signal });
      total += fingerprint.size; if (total > limits.totalBytes) throw new Error("TOTAL_LIMIT");
      files.push({ path: label, size: fingerprint.size, sha256: fingerprint.sha256 });
    }
  }
  await visit(base);
  return parseManifest({ kind: "checkthisfile-file-manifest", version: 1, algorithm: "SHA-256", files });
}
export async function verifyFolderManifest(reference, root, options) {
  const validated = parseManifest(reference); // Reject malicious labels before any folder I/O.
  return compareManifests(validated, await createFolderManifest(root, options));
}
