$ErrorActionPreference = "Stop"

#----- Calculate the version -----
# Each of the numbers has to be < 65535
$now = Get-Date
$year = $now.Year
$startOfTime = Get-Date -Year 1900 -Month 1 -Day 1 -Hour 0 -Minute 0 -Second 0 -Millisecond 0
$minutesElapsed = [Int32] [math]::floor($now.Subtract($startOfTime).TotalMinutes)
$secondSpot = [Int32] [math]::floor($minutesElapsed / 10000)
$thirdSpot = [Int32] ($minutesElapsed % 10000)
$version = "0.$secondSpot.$thirdSpot"

Write-Host "Publishing version: $version"

#----- Settings -----
$root = $PSScriptRoot
$releaseOutDir = "$root\dist\OpenMEA-Studio-win32-x64"

#----- Let's go! -----

# Build the webpack app
Write-Host ""
Write-Host ""
Write-Host "===================================================="
Write-Host "              Building JS package"
Write-Host "===================================================="
Write-Host ""

iex "npm run build-prod"

# Copy the release variant of package.json and adjust the version in it. 
$packageJsonSource = "$root/scripts/package.dist.json"
$packageJsonDest = "$root/build/package.json"
((Get-Content -Path $packageJsonSource -Raw) -replace "__VERSION__", $version) | Set-Content $packageJsonDest


# Generate the distributable package in the /dist folder
iex "npm run package" # This will also delete dist folder

# Copy Python into the package. Make sure to exclude any files/folders related to development.
Write-Host "Copying '$root\engine' to '$releaseOutDir\resources\engine'"

# Have to create the destination dir first. Otherwise, Copy-Item below will produce weird bugs.
New-Item -Path "$releaseOutDir\resources" -Name "engine" -ItemType "directory"

$excludeItems = @('.venv', 'venv', '.idea', 'log.txt')

Get-ChildItem "$root\engine" |
    Where-Object{$_.Name -notin $excludeItems} |
    Copy-Item -Destination "$releaseOutDir\resources\engine" -Recurse -Force -Verbose

Get-ChildItem "$releaseOutDir\resources\engine" -Include "__pycache__" -Recurse -Force |
    Remove-Item -Force -Recurse -Verbose

# Copy-Item "$root\engine" -Destination "$releaseOutDir\resources\engine"  -Recurse -Exclude ".venv",".idea","__pycache__","log.txt"

# Generate the final installer
Write-Host "Building the installer"
iex "node ./scripts/run-squirrel.js"

Write-Host "Done"
