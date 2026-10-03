export * from "./manifest.js";
import type { FileManifest, ManifestComparison } from "./manifest.js";
export interface Fingerprint { algorithm: "SHA-256"; size: number; sha256: string }
export const version: string;
export function sha256Bytes(bytes: Uint8Array): string;
export function hashFile(path: string, options?: { maxBytes?: number; signal?: AbortSignal }): Promise<Fingerprint>;
export function compareFiles(first: string, second: string, options?: { maxBytes?: number; signal?: AbortSignal }): Promise<{ matches: boolean; first: Fingerprint; second: Fingerprint }>;
export function createFolderManifest(root: string, options?: { signal?: AbortSignal }): Promise<FileManifest>;
export function verifyFolderManifest(reference: unknown, root: string, options?: { signal?: AbortSignal }): Promise<ManifestComparison>;
