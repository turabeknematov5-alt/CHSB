# External capability evidence

Checked in this cloud task on 2026-10-28:

* Installed CLI: `codex-cli 0.163.0`. `codex exec --help` advertises --output-schema, --image, --ephemeral, --ignore-user-config, --ignore-rules, -m, --sandbox and -c configuration overrides. `codex login --help` advertises login/status. `codex app-server --help` advertises stdio JSON-RPC.
* Official source: https://github.com/openai/codex at commit 26ad281fd1ca712e4f0c7920a6273cf18c961b8a. README documents the Windows standalone installer. Installer source `scripts/install/install.ps1` supports CODEX_HOME, CODEX_INSTALL_DIR and CODEX_NON_INTERACTIVE; performs checksum validation; adds the selected bin directory to User PATH. Lab wraps installation, journals that change and removes only the exact session entry afterward. The bundled source is this upstream standalone installer, unmodified. Its Apache-2.0 license is included.
* Official generated protocol types expose `account/read` ChatGPT email and model/list model IDs, display names, supportedReasoningEfforts and inputModalities. The source's feature registry supports shell_tool=false and unified_exec=false. Runtime metadata, rather than static claims about GPT-6 names, resolves availability per signed-in account. Real inference remains untested without the requested session identity.
* Direct requests to chatgpt.com installer and developers.openai.com docs returned HTTP 403 in this cloud network. Official GitHub source was accessible using the supplied Git proxy. These failed requests were not bypassed by disabling TLS or extracting authentication.
* PowerShell 7.5.4 Linux binary downloaded from the official GitHub release and verified against its official hashes.sha256 file before use. This is a development test tool, not a dependency shipped to Windows users.
* Browser-use CLI is not included. Its skill install flags have not been validated; no Python/uv dependency or purported browser-use support is added.

The cloud host's unrelated Codex authentication was never used to run solver inference. CLI option checks are not proof of account/model access. Metadata and inference fixture tests are labeled as mocked. A real account must pass login status and runtime model discovery on the target PC.
