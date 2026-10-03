export const limits = Object.freeze({ files: 100, fileBytes: 50 * 1024 * 1024, totalBytes: 250 * 1024 * 1024, manifestBytes: 256 * 1024, depth: 32, directories: 1000 });
function fail() { throw new Error("INVALID_MANIFEST"); }
function keys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== expected.length || !expected.every(key => Object.hasOwn(value, key))) fail();
}
export function normalizePath(path) {
  if (typeof path !== "string") fail();
  const normalized = path.normalize("NFC");
  if (!normalized.length || normalized.length > 500 || /[\\:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(normalized) || normalized.split("/").some(part => !part.trim() || part === "." || part === "..")) fail();
  return normalized;
}
export function parseManifest(input) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > limits.manifestBytes) fail();
    try { input = JSON.parse(input); } catch { fail(); }
  }
  keys(input, ["kind", "version", "algorithm", "files"]);
  if (input.kind !== "checkthisfile-file-manifest" || input.version !== 1 || input.algorithm !== "SHA-256" || !Array.isArray(input.files) || !input.files.length || input.files.length > limits.files) fail();
  const seen = new Set(); let total = 0;
  const files = input.files.map(file => {
    keys(file, ["path", "size", "sha256"]);
    const path = normalizePath(file.path);
    if (seen.has(path) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > limits.fileBytes || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) fail();
    seen.add(path); total += file.size;
    if (total > limits.totalBytes) fail();
    return { path, size: file.size, sha256: file.sha256 };
  });
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { kind: "checkthisfile-file-manifest", version: 1, algorithm: "SHA-256", files };
}
export function compareManifests(reference, current) {
  const expected = parseManifest(reference), actual = parseManifest(current);
  const byPath = new Map(actual.files.map(file => [file.path, file]));
  const result = { matching: [], changed: [], missing: [], unexpected: [] };
  for (const file of expected.files) {
    const found = byPath.get(file.path);
    if (!found) result.missing.push(file.path);
    else (file.size === found.size && file.sha256 === found.sha256 ? result.matching : result.changed).push(file.path);
    byPath.delete(file.path);
  }
  result.unexpected = [...byPath.keys()];
  return { ...result, matches: !result.changed.length && !result.missing.length && !result.unexpected.length };
}
