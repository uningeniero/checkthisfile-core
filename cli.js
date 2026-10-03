#!/usr/bin/env node
import { open, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import { hashFile, compareFiles, createFolderManifest, verifyFolderManifest, version } from "./index.js";
const args = process.argv.slice(2), [command, ...paths] = args;
const help = `CheckThisFile Core ${version} - local file integrity\n\ncheckthisfile hash FILE\ncheckthisfile compare FIRST SECOND\ncheckthisfile manifest FOLDER\ncheckthisfile verify MANIFEST.json FOLDER\n\nJSON to stdout. Exit: 0 completed/match, 1 mismatch, 2 error.\nNo network, keys, telemetry, updates or file writes.\nNode.js 22+. Folder bounds: 100 files, 50 MiB each, 250 MiB combined.\n`;
try {
  let result;
  if (command === "--help" || command === "-h" || !command) process.stdout.write(help);
  else if (command === "--version" && paths.length === 0) process.stdout.write(`${version}\n`);
  else if (command === "hash" && paths.length === 1) result = await hashFile(paths[0]);
  else if (command === "compare" && paths.length === 2) result = await compareFiles(...paths);
  else if (command === "manifest" && paths.length === 1) result = await createFolderManifest(paths[0]);
  else if (command === "verify" && paths.length === 2) {
    const stat = await lstat(paths[0]);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("REGULAR_FILE_REQUIRED");
    const file = await open(paths[0], constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    let text;
    try {
      const current = await file.stat();
      if (!current.isFile() || current.ino !== stat.ino || current.dev !== stat.dev || current.size > 256 * 1024) throw new Error("INVALID_MANIFEST");
      const buffer = Buffer.alloc(256 * 1024 + 1); let size = 0;
      while (size < buffer.length) {
        const chunk = await file.read(buffer, size, buffer.length - size, null);
        if (!chunk.bytesRead) break;
        size += chunk.bytesRead;
      }
      if (size > 256 * 1024) throw new Error("INVALID_MANIFEST");
      text = buffer.subarray(0, size).toString("utf8");
    } finally { await file.close(); }
    result = await verifyFolderManifest(text, paths[1]);
  } else throw new Error("INVALID_ARGUMENTS");
  if (result) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.matches === false) process.exitCode = 1;
  }
} catch (error) {
  const safe = new Set(["INVALID_ARGUMENTS", "INVALID_MANIFEST", "INVALID_LIMIT", "INVALID_BYTES", "REGULAR_FILE_REQUIRED", "FILE_CHANGED", "FILE_TOO_LARGE", "DIRECTORY_REQUIRED", "DIRECTORY_LIMIT", "SYMLINK_NOT_SUPPORTED", "PATH_CHANGED", "FILE_LIMIT", "TOTAL_LIMIT"]);
  process.stderr.write(`${JSON.stringify({ error: safe.has(error?.message) ? error.message : "LOCAL_IO_ERROR" })}\n`);
  process.exitCode = 2;
}
