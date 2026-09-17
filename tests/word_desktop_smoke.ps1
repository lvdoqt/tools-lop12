param([Parameter(Mandatory = $true)][string[]]$DocumentPaths)

# Run on Windows with desktop Word. Checks the actual Word loader, which is
# stricter about OLE storage than python-docx/olefile. Never opens source files
# for writing or attaches to an existing Word instance.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$wordCheck = New-Object -ComObject Word.Application
$wordCheck.Visible = $false
$wordCheck.DisplayAlerts = 0
$wordCheck.AutomationSecurity = 3
try {
    foreach ($sourcePath in $DocumentPaths) {
        $sourcePath = (Resolve-Path -LiteralPath $sourcePath).Path
        $packageCheck = [System.IO.Compression.ZipFile]::OpenRead($sourcePath)
        try {
            $readerCheck = [System.IO.StreamReader]::new($packageCheck.GetEntry('word/document.xml').Open())
            try { [xml]$xmlCheck = $readerCheck.ReadToEnd() } finally { $readerCheck.Dispose() }
            $expectedOle = $xmlCheck.GetElementsByTagName('OLEObject', 'urn:schemas-microsoft-com:office:office').Count
            $expectedMath = $xmlCheck.GetElementsByTagName('oMath', 'http://schemas.openxmlformats.org/officeDocument/2006/math').Count
        } finally { $packageCheck.Dispose() }
        $docCheck = $null
        try {
            $docCheck = $wordCheck.Documents.Open($sourcePath, $false, $true)
            $null = $docCheck.Fields.Update()
            $docCheck.Repaginate()
            if ($docCheck.Content.Text -match 'Error!|Objects cannot be created') {
                throw "Word field error in $sourcePath"
            }
            $actualOle = 0
            foreach ($shapeCheck in $docCheck.InlineShapes) {
                if ($shapeCheck.Type -eq 1) {
                    if ($shapeCheck.OLEFormat.ProgID -ne 'Equation.DSMT4') { throw 'Unexpected OLE class' }
                    $actualOle++
                }
            }
            if ($actualOle -ne $expectedOle) { throw "Expected $expectedOle MathType equations; Word loaded $actualOle" }
            if ($docCheck.OMaths.Count -ne $expectedMath) { throw "Expected $expectedMath native equations; Word loaded $($docCheck.OMaths.Count)" }
            $pdfCheck = [System.IO.Path]::ChangeExtension($sourcePath, '.pdf')
            $docCheck.ExportAsFixedFormat($pdfCheck, 17)
            Write-Output "$([System.IO.Path]::GetFileName($sourcePath)): MathType=$actualOle; Equation=$expectedMath; pages=$($docCheck.ComputeStatistics(2)); no field errors"
        } finally {
            if ($null -ne $docCheck) { $docCheck.Close(0) }
        }
    }
} finally {
    $wordCheck.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordCheck) | Out-Null
}
