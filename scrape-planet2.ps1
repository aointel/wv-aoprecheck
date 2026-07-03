Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = New-Object System.Net.CookieContainer
$handler.AllowAutoRedirect = $true

$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

# Build form content manually
$pairs = New-Object 'System.Collections.Generic.List[System.Collections.Generic.KeyValuePair[string,string]]'
$pairs.Add([System.Collections.Generic.KeyValuePair[string,string]]::new("Alias", "michaelmandella"))
$pairs.Add([System.Collections.Generic.KeyValuePair[string,string]]::new("Password", 'C8fkef8agyeh!!'))

$formData = New-Object System.Net.Http.FormUrlEncodedContent($pairs)

$response = $client.PostAsync("https://pod.planetaltig.com/Account/Login", $formData).Result
$content = $response.Content.ReadAsStringAsync().Result
$finalUrl = $response.RequestMessage.RequestUri
Write-Host "Login URL:" $finalUrl
Write-Host "Logged in:" ($content -match "Logout|logout|Sign Out")

if ($content -match "Logout|logout") {
    Write-Host "SUCCESS - logged in"
    # Try agent search
    $search = $client.GetStringAsync("https://pod.planetaltig.com/Agent?name=Aaron+Lawrence").Result
    Write-Host "Search result length:" $search.Length
    Write-Host $search.Substring(0, 1000)
} else {
    Write-Host "Login failed"
    Write-Host $content.Substring(0, 500)
}
