# OPERATION NIGHTSHIFT

Portable browser lab, version 0.1.0. The deterministic local demo is tested. Windows installation/USB behavior and authenticated CHSB behavior are **not yet validated**. No production-readiness claim.

## Activate on Windows

1. Extract `Nightshift.zip`. Copy its `Nightshift` folder to the USB drive. Keep the complete folder together. Internet access is needed to install missing dependencies and authenticate Codex.
2. Double-click `START.cmd` in that folder. It opens Windows PowerShell 5.1, creates a unique `%LOCALAPPDATA%\CodexBrowserLab\sessions\<random-id>`, copies only the hashed distribution, verifies every copied file and starts the local lifecycle.
3. Wait for **LOCAL COPY VERIFIED. You may safely eject the USB using Windows.** Then use Windows' eject action. The local process waits until the original launcher console has exited; hashes detect corruption, not authenticity of an unsigned publisher. Run START.cmd by double-click; it intentionally exits its cmd console.
4. Select an allowlisted AI identity. Codex is validated/reused or installed with the bundled official standalone installer into this disposable session. A dedicated login window opens immediately after version verification. Sign in with ChatGPT while optional browser dependencies install. This does not reuse or log out the ordinary Codex account.
5. Choose the browser plugin, then a model preset and an explicit model from the account's advertised catalog. No API-key or paid-API fallback. Sadaqah uses the lowest advertised effort; Friend requires medium; Super Supreme Admin requires high. Unsupported models/efforts stop setup. Labels are preferences, not prices or Windows privileges.
6. A separate titled mission window shows account, model, effort, plugin and cleanup policy. Choose Demo and the deterministic mock solver for a no-inference test. Click Next manually in the shared visible browser. The already-visible question is deliberately ignored. Use `Pause`, `Resume`, or `End session` in the mission terminal. The watcher never clicks Next or final submission.
7. Sadaqah/Friend clean up on End session; Super Supreme Admin asks Cleanup/Retain. Retained sessions include isolated account/browser credentials. No forensic erasure is attempted. On crashes, relaunch and choose recovery for the old session or use the printed Cleanup command. Unknown or modified files are preserved, and leftovers are reported.

`Start-Lab.ps1` is the one lifecycle entry: Activate, Run, Doctor, Cleanup. Prepare and Auth are internal phases of the same lifecycle. Example diagnostics:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Lab.ps1 -Mode Doctor
powershell -NoProfile -ExecutionPolicy Bypass -File '<local-session>\package\Start-Lab.ps1' -Mode Cleanup -Session '<local-session>'
```

No administrator, PS7, Windows Terminal, Python, uv, browser extension or MCP is required. Existing compatible Node 22+ and Edge/Chrome are reused. Missing Node is downloaded session-locally with SHA-256 verification; Chromium is downloaded only with explicit selection if no reusable browser is found. No global tool upgrades or uninstalls. The official Codex installer briefly adds a session PATH entry; the lifecycle journals it and removes that exact entry, preserving other PATH edits.

## Run the tested demo from source (Linux or Windows with Node 22+)

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node node_modules/playwright/cli.js install chromium
npm run demo
```

On Linux with an existing Chromium, use `NIGHTSHIFT_BROWSER=/usr/bin/chromium npm run demo`. `--headless` is available for smoke tests, while normal missions always show the browser. `npm test` compiles first and runs browser and contract/bridge fixtures. Tests prefer `/usr/bin/chromium` on Linux; set NIGHTSHIFT_BROWSER for another compatible executable. On Windows use an installed Playwright Chromium (see tests configuration). Build/package requires TypeScript and Python's standard ZIP module; Python is a packager tool only.

The demo includes delayed new text, old text during loading, late images/math, unrelated mutations, repeated fingerprints, SPA/full navigation, rapid clicks and multi-select fixtures. Mock inference is deterministic and is never presented as an AI benchmark.

## CHSB status and secure inspection

`tasks/chsb/adapter.ts` uses the shared watcher but is **blocked pending authenticated DOM inspection**. No selector is invented. No live login or exam interaction has been performed. Do not put website credentials in chat, JSON, arguments or scripts.

On a disposable Windows test PC, a developer must inspect the authenticated UI with the supplied account through the normal visible website, then create `tasks/chsb/selectors.local.json` locally with `verified: true`, `inspectedAt` and a `mapping` matching `Mapping` in `runtime/dom-adapter.ts`. Inspect the login fields, verified authenticated state, Next control, question region/text, stable choice IDs, selected state, loading, math and selection mode. Login selectors and success state must be verified separately. The mapping is excluded from redistribution by the packager. The lifecycle checks for it before requesting a masked website login. For this task password equals login; it is sent only over the child process's stdin and kept in process memory, never logged or passed to Codex. The browser profile will contain normal website session data until cleanup.

CAPTCHA/MFA or unexpected verification requires manual handling; timeout does not claim success. Live selector review and authenticated smoke tests remain manual prerequisites. Do not infer site ownership or authorization from the URL. Use only the supplied account and normal UI.

## Extension and boundaries

Add a task folder with task.json and an adapter exporting createAdapter; shared discovery rejects missing plugin capabilities. CHSB-specific login/DOM mapping remains in its adapter. Future trigger types require a documented adapter implementation; the shipped watcher implements trusted manual Next. Playwright owns the tab exclusively; optional browser-use is not shipped or claimed supported.

Question regions may be sent to the selected Codex subscription model, including image screenshots; credentials and unrelated tabs are excluded. Codex jobs use the isolated home, selected model/effort, structured schema, image attachments, read-only sandbox, disabled shell/unified-exec/web search, no MCP configuration and no live browser handle. The caller validates question/choice IDs and selection counts. Cancellation and timeouts discard obsolete answers. If the user changes the question or selects an answer, the generation is invalidated; an atomic browser-side check guards each click.

Cleanup owns only newly created session directories, exact hash-checked distribution files, and recorded processes verified by PID/start time/executable. A Windows Job Object contains mission descendants; the child waits for its gate before launching a browser. It does not erase Windows logs, history, ordinary browser profiles or ordinary Codex credentials. Dynamic directories are dedicated generated session resources; do not store personal files inside runtime/tools/node_modules. Unknown files in the session/package are retained and prevent a complete-deletion claim. Official Codex-generated junctions are removed as links, never followed.

See docs/architecture.md, docs/audit.md, docs/external-verification.md and docs/validation.md for evidence and remaining work.
