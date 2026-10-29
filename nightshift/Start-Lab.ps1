#requires -Version 5.1
[CmdletBinding()]
param(
 [ValidateSet('Activate','Run','Doctor','Cleanup','Prepare','Auth')][string]$Mode='Doctor',
 [string]$Session='', [int]$LauncherPid=0, [string]$LauncherStarted='', [switch]$Mock,
 [switch]$LibraryOnly
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
function Note([string]$Text){Write-Host "[NIGHTSHIFT] $Text" -ForegroundColor Cyan}
function Write-Json([string]$Path,$Value){
 $temp="$Path.$PID.tmp";[IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding $false));Move-Item -LiteralPath $temp -Destination $Path -Force
}
function Quote-PS([string]$Value){return "'"+$Value.Replace("'","''")+"'"}
function New-Window([string]$Command,[string]$Working){
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
 Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoLogo -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -WorkingDirectory $Working -PassThru
}
function Assert-LocalSession([string]$Root){
 $base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexBrowserLab/sessions')).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar
 $full=[IO.Path]::GetFullPath($Root)
 if(-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing non-session cleanup path'}
 $relative=$full.Substring($base.Length)
 if($relative -notmatch '^[a-f0-9]{32}$'){throw 'Invalid session ID/path'}
 $cursor=Get-Item -LiteralPath $full
 while($cursor){if($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Session ancestor is a reparse point'};if($cursor.FullName -eq [IO.Path]::GetPathRoot($full)){break};$cursor=$cursor.Parent}
 $manifest=Get-Content -LiteralPath (Join-Path $full 'ownership.json') -Raw|ConvertFrom-Json
 foreach($file in $manifest.packageFiles){if($file.path -notmatch '^[a-zA-Z0-9_./-]+$' -or $file.path -match '(^|/)\.\.(/|$)' -or $file.path.StartsWith('/')){throw 'Unsafe ownership file path'}}
 $pkg=Join-Path $full 'package'
 if((Test-Path -LiteralPath $pkg) -and ((Get-Item -LiteralPath $pkg).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Package root was replaced by a reparse point'}
 if($manifest.sessionId -ne $relative -or $manifest.root -ne $full){throw 'Ownership manifest mismatch'}
 return $manifest
}
function Save-Ownership {Write-Json (Join-Path $Session 'ownership.json') $script:Owned}
function Own-Process($Process,[string]$Purpose){
 $Process.Refresh();if(-not $Process.HasExited){$script:Owned.processes+=@{pid=$Process.Id;started=$Process.StartTime.ToUniversalTime().ToString('o');purpose=$Purpose;path=$Process.MainModule.FileName};Save-Ownership}
}
function Native([string]$Exe,[string[]]$Arguments){
 & $Exe @Arguments | Out-Host
 if($LASTEXITCODE -ne 0){throw "Native operation failed: $Exe (exit $LASTEXITCODE)"}
}
function Verify-Package([string]$Root){
 $entries=@(Get-Content -LiteralPath (Join-Path $Root 'manifest.json') -Raw|ConvertFrom-Json)
 $seen=@{}
 foreach($entry in $entries){
  if($entry.path -notmatch '^[a-zA-Z0-9_./-]+$' -or $entry.path -match '(^|/)\.\.(/|$)' -or $entry.path.StartsWith('/') -or $seen.ContainsKey($entry.path)){throw 'Unsafe or duplicate manifest path'}
  $seen[$entry.path]=$true;$p=Join-Path $Root $entry.path
  $walk=Get-Item -LiteralPath $p
  while($walk -and $walk.FullName -ne (Get-Item -LiteralPath $Root).FullName){if($walk.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Distribution reparse points are forbidden'};$walk=$walk.Parent}
  if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw "Package hash mismatch: $($entry.path)"}
 }
 return $entries
}
function Copy-Distribution([string]$Source,[string]$Destination){
 $entries=Verify-Package $Source
 New-Item -ItemType Directory -Path $Destination|Out-Null
 foreach($entry in $entries){$target=Join-Path $Destination $entry.path;[IO.Directory]::CreateDirectory((Split-Path -Parent $target))|Out-Null;[IO.File]::Copy((Join-Path $Source $entry.path),$target,$false)}
 [IO.File]::Copy((Join-Path $Source 'manifest.json'),(Join-Path $Destination 'manifest.json'),$false)
 $null=Verify-Package $Destination
 return $entries
}
function Remove-OwnedTree([string]$Path){
 if(-not (Test-Path -LiteralPath $Path)){return}
 $item=Get-Item -LiteralPath $Path -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){
  if($item.PSIsContainer){[IO.Directory]::Delete($item.FullName)}else{Remove-Item -LiteralPath $item.FullName -Force};return
 }
 if($item.PSIsContainer){foreach($child in Get-ChildItem -LiteralPath $Path -Force){Remove-OwnedTree $child.FullName};[IO.Directory]::Delete($item.FullName)}else{Remove-Item -LiteralPath $Path -Force}
}
function Test-SafeOwnedFile([string]$Root,[string]$Path){
 $item=Get-Item -LiteralPath $Path -Force
 while($item -and $item.FullName -ne $Root){if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){return $false};$item=$item.Parent}
 return $true
}
function Remove-EmptyDirectories([string]$Path){
 $item=Get-Item -LiteralPath $Path -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){return}
 foreach($child in Get-ChildItem -LiteralPath $Path -Directory -Force){Remove-EmptyDirectories $child.FullName}
 if(-not (Get-ChildItem -LiteralPath $Path -Force)){[IO.Directory]::Delete($Path)}
}
function Cleanup-Session {
 $manifest=Assert-LocalSession $Session
 if($manifest.status -eq 'active' -and $manifest.ownerPid -ne $PID){
  $live=Get-Process -Id $manifest.ownerPid -ErrorAction SilentlyContinue
  if($live -and $live.StartTime.ToUniversalTime().ToString('o') -eq $manifest.ownerStarted){throw 'Session is active. Select End session in its mission window first.'}
 }
 foreach($record in $manifest.processes){
  $p=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
  if($p -and $p.Id -ne $PID -and $p.StartTime.ToUniversalTime().ToString('o') -eq $record.started -and $p.MainModule.FileName -eq $record.path){$p.Kill();$p.WaitForExit(10000)|Out-Null}
 }
 # Only exact newly created trees registered by this lifecycle, never arbitrary user folders.
 foreach($name in @('runtime','tools')){if($manifest.ownedTrees -contains $name){Remove-OwnedTree (Join-Path $Session $name)}}
 $package=Join-Path $Session 'package'
 foreach($name in @('node_modules')){if($manifest.ownedTrees -contains "package/$name"){Remove-OwnedTree (Join-Path $package $name)}}
 foreach($file in $manifest.packageFiles){$p=Join-Path $package $file.path;if(Test-Path -LiteralPath $p){if((Test-SafeOwnedFile $package $p) -and (Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant() -eq $file.sha256){Remove-Item -LiteralPath $p -Force}else{Note "Preserving modified file: $p"}}}
 if(Test-Path -LiteralPath $package){Remove-EmptyDirectories $package}
 $remaining=@(Get-ChildItem -LiteralPath $Session -Force|Where-Object Name -ne 'ownership.json')
 if($remaining.Count){Note ('Cleanup incomplete; preserved leftovers: '+($remaining.FullName -join ', '));Note ('Recovery: powershell -File '+(Quote-PS $PSCommandPath)+' -Mode Cleanup -Session '+(Quote-PS $Session));return $false}
 Remove-Item -LiteralPath (Join-Path $Session 'ownership.json') -Force;[IO.Directory]::Delete($Session);Note 'Session resources removed. Windows logs/history were not erased.';return $true
}
function Ensure-Codex {
 $existing=Get-Command codex.exe -ErrorAction SilentlyContinue
 if($existing){$script:Owned.reused+=@{kind='codex';path=$existing.Source};Save-Ownership;Native $existing.Source @('--version');return $existing.Source}
 $env:CODEX_INSTALL_DIR=Join-Path $Session 'tools/codex-bin';$env:CODEX_NON_INTERACTIVE='1'
 # Official standalone installer, pinned source included in the integrity-checked distribution.
 # CODEX_HOME and CODEX_INSTALL_DIR are supported by this exact reviewed upstream installer.
 $mutex=New-Object Threading.Mutex($false,'Local\CodexBrowserLabInstall');$locked=$false
 try{
  $locked=$mutex.WaitOne(120000);if(-not $locked){throw 'Another package install holds the lock'}
  $before=[Environment]::GetEnvironmentVariable('Path','User')
  $script:Owned.configurationChanges+=@{target='User PATH';before=$before;action='official installer adds only session Codex bin; remove exact entry afterward'};Save-Ownership
  $installer=Join-Path $PSScriptRoot 'vendor/codex-install.ps1'
  $p=Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$installer`"" -WorkingDirectory $Session -PassThru
  Own-Process $p 'official Codex installer'
  if(-not $p.WaitForExit(600000)){$p.Kill();$p.WaitForExit();throw 'Codex installer timed out and was stopped'}
  if($p.ExitCode -ne 0){throw "Official Codex installer failed ($($p.ExitCode)); no silent fallback"}
 }finally{
  # Remove only our exact entry, preserving concurrent unrelated PATH edits.
  $current=[Environment]::GetEnvironmentVariable('Path','User')
  if($null -ne $current){$keep=@($current -split ';'|Where-Object {$_ -and $_.TrimEnd('\') -ne $env:CODEX_INSTALL_DIR.TrimEnd('\')});$after=$keep -join ';';if($after -cne $current){[Environment]::SetEnvironmentVariable('Path',$after,'User')}}
  $script:Owned.configurationChanges+=@{target='User PATH';after=[Environment]::GetEnvironmentVariable('Path','User');action='session bin entry removed; other entries preserved'};Save-Ownership
  if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
 }
 $exe=Join-Path $env:CODEX_INSTALL_DIR 'codex.exe';Native $exe @('--version');$script:Owned.installations+=@{tool='codex';path=$exe;home=$env:CODEX_HOME;created=$true};Save-Ownership;return $exe
}
function Ensure-Node {
 $found=Get-Command node.exe -ErrorAction SilentlyContinue
 if($found){$ver=& $found.Source -p 'process.versions.node';if([int]($ver.Split('.')[0]) -ge 22){$script:Owned.reused+=@{kind='node';path=$found.Source};Save-Ownership;return $found.Source}}
 $version='22.22.0';$arch=if($env:PROCESSOR_ARCHITECTURE -eq 'ARM64'){'arm64'}else{'x64'};$asset="node-v$version-win-$arch.zip"
 $dir=Join-Path $Session 'tools';$archive=Join-Path $dir $asset;$sums=Join-Path $dir 'SHASUMS256.txt'
 Invoke-WebRequest "https://nodejs.org/dist/v$version/SHASUMS256.txt" -UseBasicParsing -OutFile $sums
 Invoke-WebRequest "https://nodejs.org/dist/v$version/$asset" -UseBasicParsing -OutFile $archive
 $line=@(Get-Content -LiteralPath $sums|Where-Object {$_ -match ('\s'+[regex]::Escape($asset)+'$')})
 if($line.Count -ne 1 -or (Get-FileHash -LiteralPath $archive).Hash.ToLowerInvariant() -ne ($line[0] -split '\s+')[0]){throw 'Node checksum mismatch'}
 Expand-Archive -LiteralPath $archive -DestinationPath $dir
 $exe=Join-Path $dir "node-v$version-win-$arch/node.exe";$script:Owned.installations+=@{tool='node';path=$exe;created=$true};Save-Ownership;return $exe
}
if($LibraryOnly){return}
try{
 try{$Host.UI.RawUI.BackgroundColor='Black';$Host.UI.RawUI.ForegroundColor='Green';$Host.UI.RawUI.WindowTitle="OPERATION NIGHTSHIFT / $Mode"}catch{}
 if($Mode -eq 'Activate'){
  $source=if($env:NIGHTSHIFT_SOURCE){$env:NIGHTSHIFT_SOURCE}else{$PSScriptRoot}
  $id=[guid]::NewGuid().ToString('N');$Session=Join-Path $env:LOCALAPPDATA "CodexBrowserLab/sessions/$id"
  [IO.Directory]::CreateDirectory($Session)|Out-Null
  $entries=Copy-Distribution $source (Join-Path $Session 'package')
  $manifestFile=Join-Path $Session 'package/manifest.json'
  $entries+=@{path='manifest.json';sha256=(Get-FileHash -LiteralPath $manifestFile).Hash.ToLowerInvariant()}
  $script:Owned=@{version=1;sessionId=$id;root=[IO.Path]::GetFullPath($Session);status='prepared';ownerPid=0;ownerStarted='';packageFiles=$entries;ownedTrees=@('runtime','tools');processes=@();reused=@();configurationChanges=@();backups=@();installations=@();browserProfiles=@();codexHome=''  };Save-Ownership
  $parent=Get-CimInstance Win32_Process -Filter "ProcessId=$PID";$launcher=Get-Process -Id $parent.ParentProcessId
  $local=Join-Path $Session 'package/Start-Lab.ps1';$env:NIGHTSHIFT_SOURCE=$null
  $command="& $(Quote-PS $local) -Mode Prepare -Session $(Quote-PS $Session) -LauncherPid $($launcher.Id) -LauncherStarted $(Quote-PS $launcher.StartTime.ToUniversalTime().ToString('o'))"
  $null=New-Window $command $Session
  exit 0
 }
 if($Mode -eq 'Doctor'){
  Note 'Windows PowerShell 5.1+ supported; Node 22+ needed for browser mode.'
  foreach($name in @('codex','node','npm')){$c=Get-Command $name -ErrorAction SilentlyContinue;if($c){Note "$name found: $($c.Source)"}else{Note "$name missing; Prepare installs session-local dependencies when selected"}}
  if(Test-Path (Join-Path $PSScriptRoot 'manifest.json')){$null=Verify-Package $PSScriptRoot;Note 'Distribution hashes verified (not publisher authentication)'}
  exit 0
 }
 if($Mode -eq 'Run' -and $LauncherPid){while($true){$parent=Get-Process -Id $LauncherPid -ErrorAction SilentlyContinue;if(-not $parent -or $parent.StartTime.ToUniversalTime().ToString('o') -ne $LauncherStarted){break};Start-Sleep -Milliseconds 100}}
 $script:Owned=Assert-LocalSession $Session
 if($Mode -eq 'Cleanup'){$result=Cleanup-Session;if(-not $result){exit 2};exit 0}
 $runtime=Join-Path $Session 'runtime';$tools=Join-Path $Session 'tools';[IO.Directory]::CreateDirectory($runtime)|Out-Null;[IO.Directory]::CreateDirectory($tools)|Out-Null
 if($script:Owned.codexHome){$env:CODEX_HOME=$script:Owned.codexHome}else{$env:CODEX_HOME=Join-Path $runtime 'codex-home';$script:Owned.codexHome=$env:CODEX_HOME;Save-Ownership};[IO.Directory]::CreateDirectory($env:CODEX_HOME)|Out-Null
 if($Mode -eq 'Auth'){
  $Host.UI.RawUI.WindowTitle='NIGHTSHIFT / CODEX AUTHENTICATION'
  & $env:NIGHTSHIFT_CODEX login
  if($LASTEXITCODE -ne 0){exit 1}
  & $env:NIGHTSHIFT_CODEX login status
  exit $LASTEXITCODE
 }
 if($Mode -eq 'Prepare'){
  if($LauncherPid){while($true){$p=Get-Process -Id $LauncherPid -ErrorAction SilentlyContinue;if(-not $p -or $p.StartTime.ToUniversalTime().ToString('o') -ne $LauncherStarted){break};Start-Sleep -Milliseconds 100}}
  Note 'LOCAL COPY VERIFIED. You may safely eject the USB using Windows.'
  $script:Owned.status='active';$script:Owned.ownerPid=$PID;$script:Owned.ownerStarted=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o');Save-Ownership
  $env:NIGHTSHIFT_SESSION=$runtime
  # Offer recovery only; never delete older sessions automatically.
  $older=@(Get-ChildItem -LiteralPath (Split-Path -Parent $Session) -Directory|Where-Object {$_.FullName -ne $Session})
  foreach($old in $older){Note "Previous session: $($old.FullName)";if((Read-Host 'Type CLEANUP to attempt owned-resource recovery; Enter keeps it') -ceq 'CLEANUP'){$saved=$Session;try{$Session=$old.FullName;$null=Cleanup-Session}finally{$Session=$saved}}}
  $accounts=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config/accounts.json') -Raw|ConvertFrom-Json).allowlist
  for($i=0;$i -lt $accounts.Count;$i++){Note "$($i+1). $($accounts[$i].label) / $($accounts[$i].id)"}
  $choice=[int](Read-Host 'AI account number');if($choice -lt 1 -or $choice -gt $accounts.Count){throw 'Invalid account choice'};$email=$accounts[$choice-1].id
  $env:NIGHTSHIFT_CODEX=Ensure-Codex
  # Launch immediately after version validation. Login runs concurrently with dependency preparation.
  $auth=New-Window "& $(Quote-PS $PSCommandPath) -Mode Auth -Session $(Quote-PS $Session)" $Session;Own-Process $auth 'temporary authentication window'
  $browser=(Read-Host 'Install optional browser plugin? Y / N') -match '^(?i:y|yes)$'
  $node=$null
  if($browser){
   $script:Owned.status='preparing';Save-Ownership
   $node=Ensure-Node;$env:Path=(Split-Path -Parent $node)+';'+$env:Path
   Set-Location $PSScriptRoot
   $script:Owned.ownedTrees+=@('package/node_modules');Save-Ownership
   $npm=Join-Path (Split-Path -Parent $node) 'npm.cmd';Native $npm @('ci','--ignore-scripts','--no-audit','--no-fund')
   # Compiled JS is shipped and hash-verified. Type-check without changing packaged files.
   Native $node @('node_modules/typescript/bin/tsc','--noEmit')
   & $node 'build/plugins/browser/check.js'
   if($LASTEXITCODE -ne 0){if((Read-Host 'No reusable browser. Download session Chromium? Y / N') -notmatch '^(?i:y|yes)$'){throw 'Browser dependency not available'};$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $tools 'browsers';Native $node @('node_modules/playwright/cli.js','install','chromium')}
  }
  while($true){
   $auth.WaitForExit();& $env:NIGHTSHIFT_CODEX login status
   if($auth.ExitCode -eq 0 -and $LASTEXITCODE -eq 0){break}
   $retry=Read-Host 'Login failed/closed: Retry / Choose account / Cancel'
   if($retry -eq 'Choose account'){
    for($i=0;$i -lt $accounts.Count;$i++){Note "$($i+1). $($accounts[$i].id)"}
    $choice=[int](Read-Host 'AI account number');if($choice -lt 1 -or $choice -gt $accounts.Count){throw 'Invalid account'};$email=$accounts[$choice-1].id
    $env:CODEX_HOME=Join-Path $runtime ('codex-home-'+[guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($env:CODEX_HOME)|Out-Null;$script:Owned.codexHome=$env:CODEX_HOME;Save-Ownership
    $retry='Retry'
   }
   if($retry -ne 'Retry'){throw 'Authentication cancelled'}
   $auth=New-Window "& $(Quote-PS $PSCommandPath) -Mode Auth -Session $(Quote-PS $Session)" $Session;Own-Process $auth 'authentication retry'
  }
  if(-not $browser){$script:Owned.status='retained';Save-Ownership;Note 'Codex authenticated. No task selected because browser plugin was declined.';Note "Cleanup: powershell -File `"$PSCommandPath`" -Mode Cleanup -Session `"$Session`"";exit 0}
  $help=& $env:NIGHTSHIFT_CODEX exec --help|Out-String
  foreach($flag in @('--output-schema','--image','--ephemeral','--ignore-user-config','--ignore-rules')){if(-not $help.Contains($flag)){throw "Installed Codex lacks required capability $flag"}}
  $selection=Join-Path $runtime 'selection.json';Native $node @('build/runtime/configure.js',$env:NIGHTSHIFT_CODEX,$env:CODEX_HOME,$email,$selection)
  $env:NIGHTSHIFT_NODE=$node
  $mission=New-Window "& $(Quote-PS $PSCommandPath) -Mode Run -Session $(Quote-PS $Session) -LauncherPid $PID -LauncherStarted $(Quote-PS (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o'))" $Session;Own-Process $mission 'mission window'
  exit 0
 }
 if($Mode -eq 'Run'){
  $script:Owned.status='active';$script:Owned.ownerPid=$PID;$script:Owned.ownerStarted=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o');Save-Ownership
  $env:NIGHTSHIFT_SESSION=$runtime;if(Test-Path (Join-Path $tools 'browsers')){$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $tools 'browsers'}
  Set-Location $PSScriptRoot
  $selection=Get-Content -LiteralPath (Join-Path $runtime 'selection.json') -Raw|ConvertFrom-Json
  $tasks=@(Get-ChildItem (Join-Path $PSScriptRoot 'tasks') -Directory|ForEach-Object {Get-Content -LiteralPath (Join-Path $_.FullName 'task.json') -Raw|ConvertFrom-Json})
  for($i=0;$i -lt $tasks.Count;$i++){Note "$($i+1). $($tasks[$i].title) / verification: $($tasks[$i].verified)"}
  $pick=[int](Read-Host 'Task number');if($pick -lt 1 -or $pick -gt $tasks.Count){throw 'Invalid task choice'};$task=$tasks[$pick-1]
  $Host.UI.RawUI.WindowTitle="OPERATION NIGHTSHIFT / $($task.id.ToUpperInvariant())"
  Note "AI account: $($selection.account) | Email metadata verified: $($selection.identityVerified) | Model: $($selection.model) | Effort: $($selection.effort)"
  Note "Plugin: browser / Playwright | Cleanup: $($selection.cleanup)"
  if($task.id -eq 'chsb' -and -not (Test-Path (Join-Path $PSScriptRoot 'tasks/chsb/selectors.local.json'))){throw 'CHSB adapter awaits authenticated DOM inspection. Use the local demo; never send website credentials in chat.'}
  $secret=$null
  if($task.id -eq 'chsb'){Note 'Website login:';Note 'For this task, password equals login.';$secret=Read-Host -AsSecureString}
  if((Read-Host 'Launch / Back') -ne 'Launch'){return}
  $mockFlag='';if($task.id -eq 'demo' -and (Read-Host 'Deterministic mock solver? Y / N') -match '^(?i:y|yes)$'){$mockFlag=' --mock'}
  $taskFlag=if($task.id -eq 'demo'){'--demo'}else{"--task $($task.id)"}
  $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=$env:NIGHTSHIFT_NODE;$psi.Arguments="build/runtime/cli.js --start-gated $taskFlag$mockFlag";$psi.WorkingDirectory=$PSScriptRoot;$psi.UseShellExecute=$false;$psi.RedirectStandardInput=$true
  . (Join-Path $PSScriptRoot 'runtime/windows-job.ps1')
  $job=New-MissionJob
  $script:Owned.browserProfiles+=@{path=(Join-Path $runtime 'browser-profile');created=$true};Save-Ownership
  $engine=[Diagnostics.Process]::Start($psi)
  try{$job.Add($engine)}catch{if(-not $engine.HasExited){$engine.Kill()};$job.Dispose();throw 'Cannot contain mission process tree in a Windows Job Object; launch stopped'}
  Own-Process $engine 'browser watcher supervisor'
  $engine.StandardInput.WriteLine('{"start":true}')
  if($secret){$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);try{$credential=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);$engine.StandardInput.WriteLine((@{credential=$credential}|ConvertTo-Json -Compress));$credential=$null}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$secret.Dispose()}}
  while(-not $engine.HasExited){$command=Read-Host 'Pause / Resume / End session (Continue if verification is paused)';if($engine.HasExited){break};$engine.StandardInput.WriteLine($command);if($command -eq 'End session'){if(-not $engine.WaitForExit(150000)){throw 'Engine did not stop. Recovery manifest retained; no success claim.'};break}}
  $job.Dispose();$script:Owned.status='ended';Save-Ownership
  if($selection.cleanup -eq 'automatic' -or (Read-Host 'Cleanup / Retain') -eq 'Cleanup'){
   # Run from an external helper so the local entry point can be removed safely.
   $helper=Join-Path ([IO.Path]::GetTempPath()) ('nightshift-cleanup-'+[guid]::NewGuid().ToString('N')+'.ps1')
   Copy-Item -LiteralPath $PSCommandPath -Destination $helper
   $cmd="try { & $(Quote-PS $helper) -Mode Cleanup -Session $(Quote-PS $Session) } finally { Remove-Item -LiteralPath $(Quote-PS $helper) -Force }"
   $null=New-Window $cmd ([IO.Path]::GetTempPath())
  }else{Note "Session retained at $Session; it includes isolated account and browser credentials. Cleanup explicitly when finished."}
 }
}catch{
 if(Get-Variable job -ErrorAction SilentlyContinue){if($job){$job.Dispose()}}
 Write-Host ('[ERROR] '+$_.Exception.Message) -ForegroundColor Red
 if($Session){Note "Session retained for recovery: $Session";Note "Recovery: powershell -File `"$PSCommandPath`" -Mode Cleanup -Session `"$Session`""}
 if($Host.Name -eq 'ConsoleHost'){Read-Host 'Press Enter to close'|Out-Null}
 exit 1
}
