<#
.SYNOPSIS
  Resizes/recompresses JPEG photos in the photos/ folder in place, using
  Windows' built-in System.Drawing (no external tools required).

.EXAMPLE
  # Resize everything in photos/ that hasn't been processed yet is fine to
  # re-run too -- it's a no-op (harmless re-compress) on already-small files.
  .\resize-photos.ps1

.EXAMPLE
  # Resize a single file, or use a different max dimension / quality.
  .\resize-photos.ps1 -Path .\photos\lion1.jpg -MaxDim 1000 -Quality 75
#>
param(
  [string]$Path,
  [string]$Folder = "$PSScriptRoot\photos",
  [int]$MaxDim = 1200,
  [int]$Quality = 80
)

Add-Type -AssemblyName System.Drawing

function Resize-Photo {
  param([string]$FilePath, [int]$MaxDim, [int]$Quality)

  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  $ms = New-Object System.IO.MemoryStream(,$bytes)
  $img = [System.Drawing.Image]::FromStream($ms)

  $w = $img.Width
  $h = $img.Height
  $scale = [math]::Min(1.0, $MaxDim / [math]::Max($w, $h))
  $newW = [math]::Max(1, [int]($w * $scale))
  $newH = [math]::Max(1, [int]($h * $scale))

  $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($img, 0, 0, $newW, $newH)

  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)

  $outMs = New-Object System.IO.MemoryStream
  $bmp.Save($outMs, $jpegCodec, $encParams)

  $g.Dispose(); $bmp.Dispose(); $img.Dispose(); $ms.Dispose()

  $outBytes = $outMs.ToArray()
  $outMs.Dispose()
  [System.IO.File]::WriteAllBytes($FilePath, $outBytes)

  $origKB = [math]::Round($bytes.Length / 1KB)
  $newKB = [math]::Round($outBytes.Length / 1KB)
  Write-Output "$FilePath : ${w}x${h} (${origKB}KB) -> ${newW}x${newH} (${newKB}KB)"
}

if ($Path) {
  Resize-Photo -FilePath $Path -MaxDim $MaxDim -Quality $Quality
} else {
  Get-ChildItem -Path $Folder -Include *.jpg,*.jpeg,*.JPG,*.JPEG -File -Recurse |
    ForEach-Object { Resize-Photo -FilePath $_.FullName -MaxDim $MaxDim -Quality $Quality }
}
