import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { extractWebText, hashWebText, verifyWebPublicationEvidence } from '../web-text.js';
test('extracts one stable section, excludes scripts and verification links, preserves Unicode', async () => {
 const html = '<html><body><nav>Menu</nav><main id="main-content"><h1>Política &amp; condiciones</h1><p>Texto <b>original</b> &#x1F600; &nbsp; prueba</p><script>if (a < b) alert(1)</script><div hidden>Secret</div><div aria-hidden="true">Hidden</div><a data-checkthisfile-exclude href="/record">Verify</a></main></body></html>';
 const copy = extractWebText(html,{elementId:'main-content'});
 assert.equal(copy.text,'Política & condiciones\nTexto original 😀 prueba');
 assert.equal((await hashWebText(copy.text)).sizeBytes,new TextEncoder().encode(copy.text).length);
 assert.deepEqual(copy,extractWebText(html.replace('Menu','Changed menu'),{elementId:'main-content'}));
 assert.notEqual((await hashWebText(copy.text)).sha256,(await hashWebText(copy.text.replace('original','changed'))).sha256);
});
test('fails closed for ambiguous, incomplete, hidden, unsupported or oversized sections', () => {
 for (const html of ['<div id="content">One</div><div id="content">Two</div>','<main id="content">Open','<main id="content" hidden>Hidden</main>','<main id="content"><p>Broken</main>','<main id="content">&unknown;</main>','<main id="content">&#0;</main>','<main id="content">'+('x'.repeat(100001))+'</main>']) assert.throws(() => extractWebText(html,{elementId:'content'}));
 assert.throws(()=>extractWebText('<main id="other">Hello</main>',{elementId:'content'}),/SECTION_NOT_FOUND/);
 assert.throws(()=>extractWebText('<main id="content">'+Array.from({length:501},()=>'<p>Line</p>').join('')+'</main>',{elementId:'content'}),/INVALID_WEB_TEXT/);
});
test('hashes exact UTF-8 text with no newline folding', async () => {
 assert.notEqual((await hashWebText('a\nb')).sha256,(await hashWebText('a\r\nb')).sha256);
 assert.notEqual((await hashWebText('é')).sha256,(await hashWebText('e\u0301')).sha256);
});
test('requires an independent trusted key and verifies text bytes and observations offline', async () => {
 const key = generateKeyPairSync('ed25519'), jwk = key.publicKey.export({format:'jwk'}), keyId='synthetic';
 const hash = await hashWebText('Approved text');
 const payload = { schema:'urn:checkthisfile:web-publication:v1',canonicalization:'RFC8785',profile:'web-section-v1',documentId:'doc',versionId:'version',version:1,...hash };
 const canonical = value => value===null || typeof value!=='object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
 const signature = {algorithm:'Ed25519',keyId,signatureBase64url:sign(null,Buffer.from(canonical(payload)),key.privateKey).toString('base64url'),publicKeyJwk:jwk};
 const evidence = {payload,signature,text:'Approved text'};
 assert.equal((await verifyWebPublicationEvidence(evidence,{keyId,jwk})).valid,true);
 assert.equal((await verifyWebPublicationEvidence({...evidence,text:'Changed text'},{keyId,jwk})).textMatches,false);
 assert.equal((await verifyWebPublicationEvidence({...evidence,payload:{...payload,version:2}},{keyId,jwk})).signatureValid,false);
 assert.equal((await verifyWebPublicationEvidence(evidence,{keyId,jwk:generateKeyPairSync('ed25519').publicKey.export({format:'jwk'})})).signatureValid,false);
 const observation = {payload:{schema:'urn:checkthisfile:web-observation:v1',documentId:'different',versionId:'version'},signature};
 assert.equal((await verifyWebPublicationEvidence({...evidence,observation},{keyId,jwk})).valid,false);
 assert.equal((await verifyWebPublicationEvidence(evidence,{keyId,jwk})).currentOnlineStatus,'unknown');
 const rotated=generateKeyPairSync('ed25519'),observationPayload={schema:'urn:checkthisfile:web-observation:v1',documentId:'doc',versionId:'version',status:'match'};
 const rotatedObservation={payload:observationPayload,signature:{algorithm:'Ed25519',keyId:'rotated',signatureBase64url:sign(null,Buffer.from(canonical(observationPayload)),rotated.privateKey).toString('base64url')}};
 const rotatedEvidence={...evidence,observation:rotatedObservation};
 assert.equal((await verifyWebPublicationEvidence(rotatedEvidence,{keyId,jwk})).observationValid,false);
 assert.equal((await verifyWebPublicationEvidence(rotatedEvidence,{keyId,jwk},{keyId:'rotated',jwk:rotated.publicKey.export({format:'jwk'})})).valid,true);
});
