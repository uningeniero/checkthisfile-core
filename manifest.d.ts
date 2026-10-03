export interface ManifestFile { path: string; size: number; sha256: string }
export interface FileManifest { kind: "checkthisfile-file-manifest"; version: 1; algorithm: "SHA-256"; files: ManifestFile[] }
export interface ManifestComparison { matches: boolean; matching: string[]; changed: string[]; missing: string[]; unexpected: string[] }
export const limits: Readonly<{ files: number; fileBytes: number; totalBytes: number; manifestBytes: number; depth: number; directories: number }>;
export function normalizePath(path: string): string;
export function parseManifest(input: unknown): FileManifest;
export function compareManifests(reference: unknown, current: unknown): ManifestComparison;
