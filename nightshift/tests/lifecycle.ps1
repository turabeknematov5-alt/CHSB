# Cross-platform mocks exercise real lifecycle functions without installing software.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../Start-Lab.ps1') -LibraryOnly
function Assert($Value,[string]$Message){if(-not $Value){throw $Message}}
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('nightshift-test-'+[guid]::NewGuid().ToString('N'))
$env:LOCALAPPDATA=Join-Path $testRoot 'local-app-data'
try {
 $source=Join-Path $testRoot "USB apostrophe's Unicode-测试"
 [IO.Directory]::CreateDirectory($source)|Out-Null
 [IO.File]::WriteAllText((Join-Path $source 'hello.txt'),'hello')
 [IO.File]::WriteAllText((Join-Path $source 'unrelated.txt'),'preserve')
 Write-Json (Join-Path $source 'manifest.json') @(@{path='hello.txt';sha256=(Get-FileHash (Join-Path $source 'hello.txt')).Hash.ToLowerInvariant()})
 $id=[guid]::NewGuid().ToString('N');$Session=Join-Path $env:LOCALAPPDATA "CodexBrowserLab/sessions/$id"
 [IO.Directory]::CreateDirectory($Session)|Out-Null
 $package=Join-Path $Session 'package'
 $entries=@(Copy-Distribution $source $package)
 Assert (-not (Test-Path (Join-Path $package 'unrelated.txt'))) 'Only declared distribution files may copy'
 $entries+=@{path='manifest.json';sha256=(Get-FileHash (Join-Path $package 'manifest.json')).Hash.ToLowerInvariant()}
 $script:Owned=@{sessionId=$id;root=[IO.Path]::GetFullPath($Session);status='ended';ownerPid=0;ownerStarted='';packageFiles=$entries;ownedTrees=@('runtime','tools');processes=@();reused=@();configurationChanges=@();backups=@()};Save-Ownership
 # Simulate actual USB removal: source no longer exists at its original path.
 Move-Item -LiteralPath $source -Destination ($source+'-ejected')
 Assert ((Get-Content (Join-Path $package 'hello.txt') -Raw) -eq 'hello') 'Local copy must work after source removal'
 [IO.Directory]::CreateDirectory((Join-Path $Session 'runtime'))|Out-Null
 [IO.File]::WriteAllText((Join-Path $Session 'runtime/auth.json'),'mock-session-auth')
 [IO.File]::WriteAllText((Join-Path $Session 'user-added.txt'),'not owned')
 Assert (-not (Cleanup-Session)) 'Unknown user files must preserve session and manifest'
 Assert (Test-Path (Join-Path $Session 'user-added.txt')) 'User-added file was deleted'
 Assert (-not (Test-Path (Join-Path $Session 'runtime'))) 'Owned profile/auth tree was not removed'
 Remove-Item (Join-Path $Session 'user-added.txt')
 Assert (Cleanup-Session) 'Owned session removal should finish'
 Assert (Test-Path ($source+'-ejected/unrelated.txt')) 'Pre-existing USB file was modified'
 $rejected=$false;try{Assert-LocalSession $testRoot}catch{$rejected=$true};Assert $rejected 'Arbitrary folder cleanup must be rejected'
 # Mock native success/failure, exercising exit propagation without winget or installers.
 if([Environment]::OSVersion.Platform -eq 'Win32NT'){$native='cmd.exe';$ok=@('/c','exit','0');$bad=@('/c','exit','19')}else{$native='/bin/sh';$ok=@('-c','exit 0');$bad=@('-c','exit 19')}
 Native $native $ok
 $rejected=$false;try{Native $native $bad}catch{$rejected=$true};Assert $rejected 'Native failure must not be reported as success'
 # Mock both pre-existing and newly installed Codex paths through the real Ensure-Codex function.
 $id=[guid]::NewGuid().ToString('N');$Session=Join-Path $env:LOCALAPPDATA "CodexBrowserLab/sessions/$id";[IO.Directory]::CreateDirectory($Session)|Out-Null
 $script:Owned=@{sessionId=$id;root=[IO.Path]::GetFullPath($Session);status='ended';ownerPid=0;ownerStarted='';packageFiles=@();ownedTrees=@('runtime','tools');processes=@();reused=@();configurationChanges=@();backups=@();installations=@()};Save-Ownership
 $env:CODEX_HOME=Join-Path $Session 'runtime/codex-home'
 $script:UseExisting=$true;$script:InstallerStarted=$false;$script:NativeCalls=@()
 function Get-Command {param([string]$Name,$ErrorAction) if($script:UseExisting){[pscustomobject]@{Source='/pre-existing/codex.exe'}}}
 function Native {param([string]$Exe,[string[]]$Arguments) $script:NativeCalls+=@{exe=$Exe;arguments=$Arguments}}
 function Own-Process {param($Process,[string]$Purpose)}
 function Start-Process {param($FilePath,$ArgumentList,$WorkingDirectory,[switch]$PassThru)
  $script:InstallerStarted=$true
  Assert ($ArgumentList -like '*vendor/codex-install.ps1*') 'Must invoke official standalone installer'
  $p=[pscustomobject]@{ExitCode=0};$p|Add-Member ScriptMethod WaitForExit {param($Timeout) return $true};return $p
 }
 $exe=Ensure-Codex
 Assert ($exe -eq '/pre-existing/codex.exe' -and -not $script:InstallerStarted) 'Pre-existing Codex should be reused, never upgraded'
 $script:UseExisting=$false;$exe=Ensure-Codex
 Assert ($script:InstallerStarted -and $exe -eq (Join-Path $Session 'tools/codex-bin/codex.exe')) 'Missing Codex must install at the session path'
 Assert ($script:Owned.installations.Count -eq 1) 'New installation must be recorded'
 Remove-Item Function:Get-Command,Function:Native,Function:Own-Process,Function:Start-Process
 # Malicious copy manifest must not escape destination.
 $source=$source+'-ejected';Write-Json (Join-Path $source 'manifest.json') @(@{path='../escape';sha256='bad'})
 $rejected=$false;try{Copy-Distribution $source (Join-Path $testRoot 'escape-target')}catch{$rejected=$true};Assert $rejected 'Path traversal manifest was accepted'
 Write-Host 'Lifecycle mocks: PASS (copy whitelist, Unicode/apostrophe source, source removal, ownership cleanup, native exit handling, mocked Codex reuse/install, traversal rejection)' -ForegroundColor Green
}finally{if(Test-Path -LiteralPath $testRoot){Remove-Item -LiteralPath $testRoot -Recurse -Force}}
