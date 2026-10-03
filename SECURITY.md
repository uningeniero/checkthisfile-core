# Security policy

Only the current 0.1.x release line is maintained initially. This is an early release, without an external audit or promised SLA.

Report suspected vulnerabilities privately through https://checkthisfile.com/en/support with reproduction steps and synthetic inputs. Do not post secrets, customer documents, personal filenames or API credentials. There is no paid bug-bounty programme.

Runtime is local, read-only and bounded; no automatic network updates or telemetry. A trusted reference manifest is required. Concurrent hostile filesystem replacement is outside the snapshot guarantees of this implementation. See README.md for exact limits and trust assumptions.

Future security fixes will have versioned releases and changelog entries. Do not use the hosted application's administrator keys or database to work around validation errors.
