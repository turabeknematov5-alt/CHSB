# Validation record

## Executed in Linux cloud

* TypeScript strict compilation: passed.
* `NIGHTSHIFT_BROWSER=/usr/bin/chromium npm test`: 20 tests passed; 0 failed, 0 skipped. Fifteen browser cases exercise real Chromium and the local demo with deterministic mock inference. Three contract/catalog cases and two subprocess bridge fixtures exercise validation, account/model metadata, image/schema argument transport, timeout/cancellation and output cleanup. The fake CLI does not read the attached image or perform real inference.
* Windows Job Object C# interop type compilation on Linux: passed; Windows API execution remains untested.
* PowerShell 7.5.4 parser checks: passed for lifecycle, Windows Job Object helper, bundled official installer and lifecycle tests.
* `tests/lifecycle.ps1` on PowerShell 7.5.4 Linux: passed copy allowlist, apostrophe/Unicode source path, SHA-256 copy verification, simulated source removal, preservation of unrelated/user-added files, exact session cleanup, arbitrary-path rejection, native exit handling, mocked Codex reuse/standalone installation and manifest traversal rejection. No actual tool installation or Windows registry/process operation was mocked as a real Windows success.
* Complete ZIP extraction, read-only source copy through the real PowerShell Copy-Distribution function, and full manifest verification: passed. Source directory included spaces, apostrophe and Unicode. After renaming the source to simulate ejection, npm ci completed in the independent local copy and the shipped compiled demo started in headless Chromium, remained IDLE, accepted End session and exited successfully. This does not validate Windows eject or launcher-console exit semantics.

The first tsx-transformed browser run failed because serialized browser functions referred to an injected __name helper. Tests were corrected to use the actual tsc-compiled runtime. No passing test replaced a failed assertion.

## Not executed; manual prerequisites

* A disposable Windows 10/11 PC is needed for Windows PowerShell 5.1, standalone Codex and Node installation/removal, PATH journaling, Windows Job Object containment, visible authentication/mission windows, read-only USB, launcher-exit timing and actual safe ejection tests.
* Sign in to one of the configured identities on that PC. Actual subscription model access, authenticated model catalog and real Codex text/image solver inference have not been tested. Never infer availability from a display name. No API calls were made using the cloud host's unrelated login.
* Authenticated CHSB selector inspection and smoke testing await secure runtime credentials. The task remains blocked until a locally reviewed selector mapping exists. This is an unverified live adapter, not a working-live-exam claim.
* Full real Windows installation/removal is not replaced by Linux parser or mocked lifecycle checks. Browser-use is not included.

Use `tests/windows-checklist.md` for the disposable-PC test procedure. Existing checkouts in cloud tasks are already isolated; do not create a Git worktree unless explicitly requested.
