param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Output = "backend/internal/catalog/p24_snapshot.json"
)

$raw = Get-Content -LiteralPath $Source -Raw
$start = $raw.IndexOf('[')
$end = $raw.LastIndexOf(']')
if ($start -lt 0 -or $end -le $start) { throw "Array JSON produk tidak ditemukan" }
$sourceItems = $raw.Substring($start, $end - $start + 1) | ConvertFrom-Json
$items = [System.Collections.Generic.List[object]]::new()

foreach ($sourceItem in $sourceItems) {
  if (-not $sourceItem.Active) { continue }
  $sku = ([string]$sourceItem.Code).Trim().ToUpperInvariant()
  $name = ([string]$sourceItem.Name).Trim()
  $priceType = ([string]$sourceItem.PriceType).Trim().ToUpperInvariant()
  $isOpen = $priceType.StartsWith("OPEN_AMOUNT")
  $listedPrice = [int64]$sourceItem.Price
  if (-not $sku -or -not $name) { continue }
  if (-not $isOpen -and $listedPrice -le 0) { continue }
  $items.Add([ordered]@{
    id = 0
    sku = $sku
    nama = $name
    group_name = ([string]$sourceItem.Group).Trim()
    kategori_nama = ([string]$sourceItem.Category).Trim()
    brand_nama = ([string]$sourceItem.Provider).Trim()
    tipe_harga = $(if ($isOpen) { "OPEN_AMOUNT" } else { "FIXED" })
    harga = $(if ($isOpen) { 0 } else { $listedPrice })
    fee_tambahan = $(if ($isOpen) { [Math]::Max(0, $listedPrice) } else { 0 })
  })
}

$target = Join-Path (Get-Location) $Output
$parent = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$items | ConvertTo-Json -Depth 3 -Compress | Set-Content -LiteralPath $target -Encoding UTF8
Write-Output "Imported $($items.Count) active Pulsa24Jam products into $Output"
