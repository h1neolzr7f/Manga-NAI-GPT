param(
    [string]$Version = "1.0.3",
    [string]$SourceRoot = "",
    [string]$StagingDir = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SourceRoot) { $SourceRoot = Split-Path -Parent $ScriptDir }
if (-not $StagingDir) { $StagingDir = Join-Path $SourceRoot "dist\installer-staging" }
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)
$StagingDir = [IO.Path]::GetFullPath($StagingDir)

if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot "99_server.py"))) {
    throw "SourceRoot does not look like the application repository: $SourceRoot"
}
if ($StagingDir -eq $SourceRoot -or -not $StagingDir.StartsWith(([IO.Path]::GetFullPath((Join-Path $SourceRoot "dist"))) + [IO.Path]::DirectorySeparatorChar)) {
    throw "StagingDir must be a child of the repository dist directory."
}

if (Test-Path -LiteralPath $StagingDir) { Remove-Item -LiteralPath $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

$excludeDirs = @(
    ".git", ".github", ".claude", ".playwright-cli", ".pytest_cache",
    "node_modules", "user_data", "outputs", "dist", "__pycache__",
    "llm_doc", "roadmap", "99_doc", "test", "installer",
    "ロードマップ２", "ロードマップ３_複数API対応"
)
$excludeFiles = @(".env", ".DS_Store")

Get-ChildItem -LiteralPath $SourceRoot -Directory | ForEach-Object {
    if ($_.Name -like "*API*" -or $_.Name -like "*roadmap*") { $excludeDirs += $_.Name }
}

$robocopyArgs = @($SourceRoot, $StagingDir, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP", "/XD") + $excludeDirs + @("/XF") + $excludeFiles
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

$runtimeDir = Join-Path $StagingDir "runtime"
$pythonDir = Join-Path $runtimeDir "python"
$nodeDir = Join-Path $runtimeDir "node"
New-Item -ItemType Directory -Force -Path $pythonDir, $nodeDir | Out-Null
$licensesDir = Join-Path $StagingDir "licenses"
New-Item -ItemType Directory -Force -Path $licensesDir | Out-Null
Copy-Item -LiteralPath (Join-Path $SourceRoot "installer\ChineseSimplified-LICENSE.txt") -Destination (Join-Path $licensesDir "inno-setup-chinese-translation.txt") -Force

$PythonVersion = "3.12.10"
$PythonArchiveName = "python-$PythonVersion-embed-amd64.zip"
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/$PythonArchiveName"
$PythonSha256 = "4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3"

$NodeVersion = "24.14.1"
$NodeArchiveName = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeArchiveName"
$NodeSha256 = "6e50ce5498c0cebc20fd39ab3ff5df836ed2f8a31aa093cecad8497cff126d70"

$tempDir = Join-Path ([IO.Path]::GetTempPath()) ("desu-nai-installer-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

function Get-VerifiedArchive([string]$Url, [string]$Destination, [string]$ExpectedSha256) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
    $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $ExpectedSha256.ToLowerInvariant()) {
        throw "SHA-256 mismatch for $Url. Expected $ExpectedSha256, got $actual"
    }
}

try {
    $pythonArchive = Join-Path $tempDir $PythonArchiveName
    Get-VerifiedArchive $PythonUrl $pythonArchive $PythonSha256
    Expand-Archive -LiteralPath $pythonArchive -DestinationPath $pythonDir -Force

    $sitePackages = Join-Path $pythonDir "Lib\site-packages"
    New-Item -ItemType Directory -Force -Path $sitePackages | Out-Null
    & python -m pip install --disable-pip-version-check --no-compile --only-binary=:all: --target $sitePackages "Pillow==12.3.0"
    if ($LASTEXITCODE -ne 0) { throw "Failed to install Pillow into the embedded runtime." }

    @(
        "python312.zip",
        ".",
        "Lib\site-packages",
        "..\..",
        "..\..\local_tools"
    ) | Set-Content -LiteralPath (Join-Path $pythonDir "python312._pth") -Encoding Ascii

    $nodeArchive = Join-Path $tempDir $NodeArchiveName
    Get-VerifiedArchive $NodeUrl $nodeArchive $NodeSha256
    $nodeExtract = Join-Path $tempDir "node"
    Expand-Archive -LiteralPath $nodeArchive -DestinationPath $nodeExtract -Force
    $nodePayload = Join-Path $nodeExtract "node-v$NodeVersion-win-x64"
    Copy-Item -LiteralPath (Join-Path $nodePayload "node.exe") -Destination $nodeDir -Force
    Copy-Item -LiteralPath (Join-Path $nodePayload "LICENSE") -Destination (Join-Path $nodeDir "LICENSE.txt") -Force

    $pythonExe = Join-Path $pythonDir "python.exe"
    $iconSource = Join-Path $StagingDir "03_images\icon\icon_full_512_512.png"
    $iconOutput = Join-Path $StagingDir "app.ico"
    # Audit 84: pass paths as argv so apostrophes/Unicode in the folder name stay valid Python.
    & $pythonExe -c "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); im.save(sys.argv[2], sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])" $iconSource $iconOutput
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $iconOutput)) { throw "Failed to create the Windows application icon." }

    & $pythonExe -c "import PIL, sys; print(sys.version); print('Pillow', PIL.__version__)"
    & (Join-Path $nodeDir "node.exe") --version

    @{
        appVersion = $Version
        python = $PythonVersion
        node = $NodeVersion
        pillow = "12.3.0"
        architecture = "x64"
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir "versions.json") -Encoding UTF8
} finally {
    if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
}

# ---- Lightweight bundled model (comic-text-detector ~91MB). Heavier models download in-app. ----
$bundleDir = Join-Path $StagingDir "bundled_models"
New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
$ctdName = "comictextdetector.pt.onnx"
$ctdPath = Join-Path $bundleDir $ctdName
$ctdUrl = "https://github.com/zyddnys/manga-image-translator/releases/download/beta-0.3/comictextdetector.pt.onnx"
$ctdSha = "1a86ace74961413cbd650002e7bb4dcec4980ffa21b2f19b86933372071d718f"
$ctdBytes = 94669756
if (-not (Test-Path -LiteralPath $ctdPath) -or (Get-Item -LiteralPath $ctdPath).Length -ne $ctdBytes) {
    Write-Host "Downloading bundled model $ctdName ..."
    $tmp = Join-Path $bundleDir ($ctdName + ".part")
    Invoke-WebRequest -UseBasicParsing -Uri $ctdUrl -OutFile $tmp
    $actual = (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $ctdSha) { throw "SHA-256 mismatch for $ctdName" }
    if ((Get-Item -LiteralPath $tmp).Length -ne $ctdBytes) { throw "Size mismatch for $ctdName" }
    Move-Item -LiteralPath $tmp -Destination $ctdPath -Force
}
Copy-Item -LiteralPath (Join-Path $SourceRoot "bundled_models\MANIFEST.json") -Destination (Join-Path $bundleDir "MANIFEST.json") -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $SourceRoot "bundled_models\README.md") -Destination (Join-Path $bundleDir "README.md") -Force -ErrorAction SilentlyContinue
Write-Host "Bundled model ready: $ctdPath ($ctdBytes bytes)"

Write-Host "Installer staging prepared: $StagingDir"
