Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = "d:\Focus Trading Engine\Focus_Trading_Engine_v2_Deep_Research_Audit_2026-09-13.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

# Parse XML and extract paragraphs
[xml]$xmlDoc = $xml
$ns = New-Object System.Xml.XmlNamespaceManager($xmlDoc.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

$paragraphs = $xmlDoc.SelectNodes("//w:p", $ns)
$lines = @()
foreach ($p in $paragraphs) {
    $texts = $p.SelectNodes(".//w:t", $ns)
    $pText = ""
    foreach ($t in $texts) {
        $pText += $t.InnerText
    }
    if ($pText.Trim().Length -gt 0) {
        $lines += $pText
    }
}

$outPath = "d:\Focus Trading Engine\scripts\docx_extracted.txt"
$lines | Out-File -FilePath $outPath -Encoding utf8
Write-Host "Extracted $($lines.Count) paragraphs to $outPath"
