$buildDir = 'c:\Users\Herbert\Downloads\G3TZKP-MESSENGER-BETA-main\G3TZKP-MESSENGER-BETA-main\G3ZKPBETAFINAL-main\zkp-circuits\build'
$files = Get-ChildItem $buildDir -File -ErrorAction SilentlyContinue
$count = $files.Count

Write-Output "Build Directory Check"
Write-Output "===================="
Write-Output "Path: $buildDir"
Write-Output "Files found: $count"
Write-Output ""

if ($count -gt 0) {
    Write-Output "File List:"
    $files | ForEach-Object {
        $size = $_.Length / 1MB
        Write-Output "  $($_.Name) - $([Math]::Round($size, 2)) MB"
    }
} else {
    Write-Output "No files in build directory"
}
