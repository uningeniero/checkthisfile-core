# CheckThisFile

Local file integrity for applications, command-line workflows and coding agents.

Calculate SHA-256, compare exact files, create portable folder manifests and check a folder against a trusted manifest. MIT licensed. Node.js 22+, JavaScript and TypeScript, no dependencies, no native build.

**No network calls, account, API key, telemetry, activation or automatic update checks.** Operations run locally. The hosted service is separate and never a prerequisite.

## Install this release

Install the pinned release from npm:

```sh
npm install checkthisfile@0.1.3
./node_modules/.bin/checkthisfile --help
```

For a one-off CLI check, use `npx checkthisfile@0.1.3 --help`. You can also download the versioned archive and checksum from [the release page](https://checkthisfile.com/developers/local) and install it with `npm install ./checkthisfile-0.1.3.tgz`.

The package contains the MIT-licensed source, TypeScript declarations and documentation. Installation may contact npm; operations after installation do not use the network. Pin versions and keep your lockfile. Source and contributions: [GitHub](https://github.com/uningeniero/checkthisfile).

## JavaScript / TypeScript

```js
import { hashFile, compareFiles, createFolderManifest, verifyFolderManifest } from 'checkthisfile';

const fingerprint = await hashFile('./proposal.pdf');
const comparison = await compareFiles('./approved.pdf', './received.pdf');
if (!comparison.matches) throw new Error('Different file bytes');

const manifest = await createFolderManifest('./delivery');
// Store the manifest OUTSIDE the checked folder and distribute through a trusted channel.
const checked = await verifyFolderManifest(manifest, './received-delivery');
console.log(checked.matches, checked.changed, checked.missing, checked.unexpected);
```

Hashes are streamed in 64 KiB chunks. `hashFile` and `compareFiles` accept `{ maxBytes, signal }`; the default single-file limit is 1 GiB. An aborted or unreadable operation throws, never returns a successful match.

## CLI for scripts and agents

```sh
checkthisfile hash proposal.pdf
checkthisfile compare approved.pdf received.pdf
checkthisfile manifest ./delivery > delivery.manifest.json
checkthisfile verify delivery.manifest.json ./received-delivery
```

JSON on stdout, fixed error codes on stderr. Exit 0: completed or exact match; 1: differences; 2: invalid input or I/O failure. The CLI does not write originals, follow manifest paths, fetch keys or scan file contents for instructions. Shell redirection is your explicit output choice. Put manifests outside the selected folder.

## Browser and portable format

```js
import { sha256Bytes, compareManifests, parseManifest } from 'checkthisfile/browser';
const hash = await sha256Bytes(new Uint8Array(await file.arrayBuffer()));
```

Browser hashing uses Web Crypto and a whole in-memory byte buffer; use appropriate application size limits. The browser entry imports no Node modules. `checkthisfile/manifest` provides pure validators and comparison without crypto or filesystem access.

Manifest v1 is interoperable with [CheckThisFile's folder tool](https://checkthisfile.com/tools/folder-manifest): relative NFC paths, exact byte sizes and lowercase SHA-256. Bounds: 100 files, 50 MiB/file, 250 MiB total, JSON 256 KiB, depth 32 and 1,000 directories. Rejects duplicate normalized paths, traversal, absolute paths, control/bidi characters, symlinks and non-regular files. Invalid/unsupported inputs fail closed. All files, including hidden files, participate; empty directories do not. An entirely empty folder is rejected.

## Trust model

A manifest is unsigned. Obtain your reference from a trusted channel: replacing both files and manifest defeats a plain checksum comparison. Matching bytes is not proof of authorship, safe content, absence of malware/AI instructions, or qualified time. No byte hashing tool can report later edits without another comparison.

File stats are checked before/after hashing to detect common concurrent changes. This is not a filesystem snapshot or a sandbox for adversarial concurrent filesystem mutation; use an immutable copy or OS isolation for that threat model. Do not modify the directory during a run.

The separately hosted [integrity API](https://checkthisfile.com/developers/integrity) can register hashes and expose version status with explicitly scoped credentials. Offline signed-receipt verification is provided by the separate documented Python verifier; it is not implemented in this library version.

## Releases, licence and contribution

See CHANGELOG.md, SECURITY.md and AGENTS.md. Run `npm test` in the source checkout. The 0.1.x series is an early release, not a certification or a claim of audited cryptographic software.

MIT attribution remains in redistributed code and licence notices; no visible logo, account or backlink is required in end-user documents. The licence covers this package only, not the hosted application's source, brand assets or external dependencies. Suggestions and fixes are welcome in the dedicated public repository. Updates are opt-in, not network checks at runtime.
