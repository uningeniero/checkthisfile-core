/** Offline, bounded extraction of server-delivered HTML. Never executes scripts or fetches URLs. */
export const webTextProfile = "web-section-v1";
export const webTextLimits = Object.freeze({ htmlBytes: 2 * 1024 * 1024, textBytes: 256 * 1024, characters: 100000, lines: 500, depth: 64, nodes: 20000 });
const encoder = new TextEncoder();
const entities = Object.freeze({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥", cent: "¢", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·", laquo: "«", raquo: "»", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü" });
const voidTags = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const blocks = new Set("address article aside blockquote div dl dt dd fieldset figcaption figure footer h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tr td th ul br".split(" "));
const rawTags = new Set(["script", "style", "textarea", "title"]);
export function decodeHtmlText(value) {
  return value.replace(/&(#(?:x|X)[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/g, (_, entity) => {
    if (entity[0] !== "#") { if (!(entity in entities)) throw new Error("UNSUPPORTED_HTML_ENTITY"); return entities[entity]; }
    const point = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) throw new Error("INVALID_HTML_ENTITY");
    return String.fromCodePoint(point);
  });
}
function attributes(source) {
  const result = Object.create(null); let rest = source;
  while (rest.trim()) {
    const match = /^\s+([A-Za-z_:][A-Za-z0-9_:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(rest);
    if (!match) throw new Error("UNSUPPORTED_HTML");
    const name = match[1].toLowerCase(); if (name in result) throw new Error("AMBIGUOUS_HTML");
    result[name] = decodeHtmlText(match[2] ?? match[3] ?? match[4] ?? ""); rest = rest.slice(match[0].length);
  }
  return result;
}
export function validateWebText(text) {
  if (typeof text !== "string" || !text.trim() || text.length > webTextLimits.characters || encoder.encode(text).length > webTextLimits.textBytes || text.split("\n").length > webTextLimits.lines || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(text.replace(/[\u{10000}-\u{10ffff}]/gu, ""))) throw new Error("INVALID_WEB_TEXT");
  return text;
}
export function extractWebText(html, { elementId }) {
  if (typeof html !== "string" || html.length > webTextLimits.htmlBytes || encoder.encode(html).length > webTextLimits.htmlBytes) throw new Error("HTML_TOO_LARGE");
  if (typeof elementId !== "string" || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(elementId)) throw new Error("INVALID_ELEMENT_ID");
  const stack = []; const parts = []; let position = 0, nodes = 0, targets = 0, targetClosed = false;
  const active = () => stack.some(item => item.target) && !stack.some(item => item.excluded);
  const boundary = () => { if (active()) parts.push("\n"); };
  while (position < html.length) {
    if (++nodes > webTextLimits.nodes) throw new Error("HTML_NODE_LIMIT");
    if (html[position] !== "<") {
      const next = html.indexOf("<", position), end = next < 0 ? html.length : next;
      if (active()) parts.push(decodeHtmlText(html.slice(position, end))); position = end; continue;
    }
    if (html.startsWith("<!--", position)) { const end = html.indexOf("-->", position + 4); if (end < 0) throw new Error("UNSUPPORTED_HTML"); position = end + 3; continue; }
    let end = position + 1, quote = "";
    for (; end < html.length; end++) { const c = html[end]; if (quote) { if (c === quote) quote = ""; } else if (c === '"' || c === "'") quote = c; else if (c === ">") break; }
    if (end === html.length) throw new Error("UNSUPPORTED_HTML");
    const token = html.slice(position + 1, end); position = end + 1;
    if (/^!doctype\s+html(?:\s|$)/i.test(token)) continue;
    const closing = /^\/([A-Za-z][A-Za-z0-9:-]*)\s*$/.exec(token);
    if (closing) {
      const tag = closing[1].toLowerCase(); if (blocks.has(tag)) boundary();
      const top = stack.pop(); if (!top || top.tag !== tag) throw new Error("UNSUPPORTED_HTML");
      if (top.target) targetClosed = true; continue;
    }
    const opening = /^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*?)\/?\s*$/.exec(token);
    if (!opening) throw new Error("UNSUPPORTED_HTML");
    const tag = opening[1].toLowerCase(), attr = attributes(opening[2]);
    const target = attr.id === elementId;
    if (target && ++targets > 1) throw new Error("AMBIGUOUS_SECTION");
    if (blocks.has(tag)) boundary();
    const excluded = ["script", "style", "template", "noscript", "textarea", "title"].includes(tag) || "hidden" in attr || attr["aria-hidden"] === "true" || "data-checkthisfile-exclude" in attr;
    if (target && (excluded || voidTags.has(tag))) throw new Error("UNSUPPORTED_SECTION");
    if (rawTags.has(tag)) {
      const close = new RegExp("</" + tag + "\\s*>", "ig"); close.lastIndex = position; const found = close.exec(html);
      if (!found) throw new Error("UNSUPPORTED_HTML"); position = close.lastIndex; continue;
    }
    if (!voidTags.has(tag)) { stack.push({ tag, target, excluded }); if (stack.length > webTextLimits.depth) throw new Error("HTML_DEPTH_LIMIT"); }
  }
  if (targets !== 1 || !targetClosed) throw new Error("SECTION_NOT_FOUND");
  const text = parts.join("").split("\n").map(line => line.replace(/[ \t\r\f]+/g, " ").trim()).filter(Boolean).join("\n");
  return { profile: webTextProfile, elementId, text: validateWebText(text) };
}
export async function hashWebText(text) {
  const bytes = encoder.encode(validateWebText(text));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return { profile: webTextProfile, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join(""), sizeBytes: bytes.length };
}

function canonicalJson(value, budget = { nodes: 0, characters: 0 }, depth = 0) {
  if (++budget.nodes > 20000 || depth > 64) throw new Error("INVALID_EVIDENCE");
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("INVALID_EVIDENCE"); return JSON.stringify(value); }
  if (typeof value === "string") { budget.characters += value.length; if (budget.characters > 2 * 1024 * 1024 || /[\ud800-\udfff]/u.test(value.replace(/[\u{10000}-\u{10ffff}]/gu,""))) throw new Error("INVALID_EVIDENCE"); return JSON.stringify(value); }
  if (Array.isArray(value)) { if(value.length > 20000) throw new Error("INVALID_EVIDENCE");return `[${value.map(item=>canonicalJson(item,budget,depth+1)).join(",")}]`; }
  if (value && Object.getPrototypeOf(value) === Object.prototype) { const keys=Object.keys(value);if(keys.length>20000) throw new Error("INVALID_EVIDENCE");return `{${keys.sort().map(key => `${canonicalJson(key,budget,depth+1)}:${canonicalJson(value[key],budget,depth+1)}`).join(",")}}`; }
  throw new Error("INVALID_EVIDENCE");
}
/** The caller supplies a separately trusted key. Embedded keys never establish trust. */
export async function verifyWebPublicationEvidence(evidence, trustedKey, observationTrustedKey = trustedKey) {
  const { payload, signature, text, observation } = evidence ?? {};
  if (!payload || !signature || !trustedKey || payload.schema !== "urn:checkthisfile:web-publication:v1" || payload.canonicalization !== "RFC8785" || payload.profile !== webTextProfile || !/^[a-f0-9]{64}$/.test(payload.sha256) || !Number.isSafeInteger(payload.sizeBytes) || typeof text !== "string" || text.length > webTextLimits.characters || !Number.isSafeInteger(payload.version) || payload.version < 1) throw new Error("INVALID_EVIDENCE");
  const verify = async (value, sig, anchor = trustedKey) => {
    if (sig?.algorithm !== "Ed25519" || sig.keyId !== anchor.keyId || anchor.jwk?.kty !== "OKP" || anchor.jwk?.crv !== "Ed25519" || typeof anchor.jwk?.x !== "string" || typeof sig.signatureBase64url !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(sig.signatureBase64url)) return false;
    try { const key = await crypto.subtle.importKey("jwk",anchor.jwk,{name:"Ed25519"},false,["verify"]); const bytes = Uint8Array.from(atob(sig.signatureBase64url.replace(/-/g,"+").replace(/_/g,"/")+"=="), c => c.charCodeAt(0)); return await crypto.subtle.verify("Ed25519",key,bytes,encoder.encode(canonicalJson(value))); } catch { return false; }
  };
  const bytes = encoder.encode(text), hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)), n => n.toString(16).padStart(2,"0")).join("");
  const signatureValid = await verify(payload,signature);
  const textMatches = bytes.length === payload.sizeBytes && hash === payload.sha256;
  const observationValid = observation ? observation.payload?.schema === "urn:checkthisfile:web-observation:v1" && observation.payload.documentId === payload.documentId && observation.payload.versionId === payload.versionId && await verify(observation.payload,observation.signature,observationTrustedKey) : null;
  return { signatureValid, textMatches, observationValid, valid: signatureValid && textMatches && observationValid !== false, currentOnlineStatus: "unknown" };
}
