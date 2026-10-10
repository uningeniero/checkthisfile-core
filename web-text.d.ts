export const webTextProfile: "web-section-v1";
export const webTextLimits: Readonly<{ htmlBytes: number; textBytes: number; characters: number; lines: number; depth: number; nodes: number }>;
export function decodeHtmlText(value: string): string;
export function validateWebText(text: string): string;
export function extractWebText(html: string, options: { elementId: string }): { profile: "web-section-v1"; elementId: string; text: string };
export function hashWebText(text: string): Promise<{ profile: "web-section-v1"; sha256: string; sizeBytes: number }>;
export function verifyWebPublicationEvidence(evidence: unknown, trustedKey: { keyId: string; jwk: JsonWebKey }, observationTrustedKey?: { keyId: string; jwk: JsonWebKey }): Promise<{ signatureValid: boolean; textMatches: boolean; observationValid: boolean | null; valid: boolean; currentOnlineStatus: "unknown" }>;
