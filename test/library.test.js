import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sha256Bytes, hashFile, compareFiles, createFolderManifest, verifyFolderManifest, parseManifest, compareManifests } from "../index.js";
import { sha256Bytes as browserHash } from "../browser.js";
const bytes = new TextEncoder().encode("abc");
test("standard SHA-256 vectors agree across runtimes", async () => {
  assert.equal(sha256Bytes(bytes), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await browserHash(bytes), sha256Bytes(bytes));
  assert.equal(await browserHash(new Uint8Array()), sha256Bytes(new Uint8Array()));
});
test("local hashes, comparisons, CLI and folder classifications", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ctf-core-"));
  try {
    const folder = join(dir, "folder"); await mkdir(folder);
    const a = join(folder, "a.txt"), b = join(folder, "b.txt");
    await writeFile(a, bytes); await writeFile(b, bytes);
    assert.equal((await hashFile(a)).size, 3);
    assert.equal((await compareFiles(a, b)).matches, true);
    const manifest = await createFolderManifest(folder);
    assert.equal((await verifyFolderManifest(manifest, folder)).matches, true);
    await writeFile(a, "changed"); await rm(b); await writeFile(join(folder, "c.txt"), "new");
    const result = await verifyFolderManifest(manifest, folder);
    assert.deepEqual(result.changed, ["a.txt"]); assert.deepEqual(result.missing, ["b.txt"]); assert.deepEqual(result.unexpected, ["c.txt"]);
    assert.equal(result.matches, false);
    const cli = fileURLToPath(new URL("../cli.js", import.meta.url));
    assert.equal(JSON.parse(execFileSync(process.execPath, [cli, "hash", a], { encoding: "utf8" })).size, 7);
    assert.equal(spawnSync(process.execPath, [cli, "compare", a, join(folder, "c.txt")]).status, 1);
    assert.equal(spawnSync(process.execPath, [cli, "hash", join(dir, "missing")]).status, 2);
    await assert.rejects(hashFile(a, { maxBytes: 1 }), /FILE_TOO_LARGE/);
    const controller = new AbortController(); controller.abort(); await assert.rejects(hashFile(a, { signal: controller.signal }));
    await symlink(a, join(folder, "link.txt"));
    await assert.rejects(createFolderManifest(folder), /SYMLINK_NOT_SUPPORTED/);
    await assert.rejects(hashFile(join(folder, "link.txt")), /REGULAR_FILE_REQUIRED/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("untrusted manifests fail closed without reading their labels", () => {
  const valid = { kind: "checkthisfile-file-manifest", version: 1, algorithm: "SHA-256", files: [{ path: "a.txt", size: 3, sha256: sha256Bytes(bytes) }] };
  for (const path of ["../secret", "/secret", "x//y", "C:\\secret", "a\u202eb", "a/./b"]) assert.throws(() => parseManifest({ ...valid, files: [{ ...valid.files[0], path }] }), /INVALID_MANIFEST/);
  assert.throws(() => parseManifest({ ...valid, secret: "extra" }));
  assert.throws(() => parseManifest({ ...valid, files: [...valid.files, ...valid.files] }));
  assert.throws(() => parseManifest({ ...valid, files: [{ ...valid.files[0], size: -1 }] }));
  assert.throws(() => parseManifest(" ".repeat(256 * 1024 + 1)));
  assert.equal(compareManifests(valid, valid).matches, true);
});
