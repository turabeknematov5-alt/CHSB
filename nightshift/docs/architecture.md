# Architecture decision

The supplied installers are provisioning scripts, not a browser evaluation engine. Reuse their official Codex installer URL, Edge reuse preference and console colors; replace shared lanes/global installers with a local session lifecycle. No administrator, Terminal, PS7, Python, uv, MCP or browser-use is required for Playwright.

PowerShell owns activation, authentication, setup and cleanup. TypeScript owns catalog discovery, normalized packets, the cancellation state machine, validated clicks and task discovery. The browser controller never receives Codex credentials. Codex receives a question and region images, never a browser handle or website credential. No interactive-terminal keystroke automation. Web text cannot redefine operational configuration.

Use `codex exec` for isolated structured inference; use the supported app-server JSON-RPC `account/read` and `model/list` for metadata. Query installed capabilities and fail closed on unsupported versions/options. Preset names are preferences, not invented model IDs, prices or privileges. Friend always requires an explicit catalog choice. Never test inference against the cloud host's unrelated logged-in account.

Each manually accepted Next event captures its baseline before page handlers. Serialized generations cancel obsolete work; polling observes readiness but cannot mint authorization. Fingerprints include text, choice identity and media, including canvas pixels. Three stable observations plus explicit loading/image/math gates precede capture. Atomic browser-side identity comparison immediately precedes DOM choice clicks. Trusted events are a UI filter only. Initial loads and unrelated mutations never mint tokens. A completed fingerprint ledger prevents repeated solves. Pause/End invalidate pending results.

CHSB is intentionally blocked pending authenticated DOM inspection. No selectors were invented, and no credential is requested in chat. A reviewed selectors.local.json must declare mapping and inspection timestamp. The demo exercises the shared implementation.

SHA-256 packaging detects copy corruption, not publisher authenticity. The Windows launcher passes USB paths through environment variables, copies only manifest entries into a new session, verifies the destination and waits for the original launcher process to exit before saying it is safe to eject. Processes and generated directories have explicit session ownership; cleanup refuses arbitrary paths and preserves unknown files rather than guessing ownership.
