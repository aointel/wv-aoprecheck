Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = New-Object System.Net.CookieContainer
$handler.AllowAutoRedirect = $true

$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

# GET login page
$loginPage = $client.GetStringAsync("https://pod.planetaltig.com/Account/Login").Result

# POST login
$formData = New-Object System.Net.Http.FormUrlEncodedContent([System.Collections.Generic.Dictionary[string,string]]@{
    "Alias" = "michaelmandella"
    "Password" = "C8fkef8agyeh!!"
})

$response = $client.PostAsync("https://pod.planetaltig.com/Account/Login", $formData).Result
$content = $response.Content.ReadAsStringAsync().Result
Write-Host "Login response URL:" $response.RequestMessage.RequestUri
Write-Host "Contains dashboard:" ($content -match "dashboard|Dashboard|logout|Logout")

# Try fetching a search
$searchResp = $client.GetStringAsync("https://pod.planetaltig.com/Agent?name=Aaron+Lawrence").Result
Write-Host "Search length:" $searchResp.Length
Write-Host "First 500:" $searchResp.Substring(0, [Math]::Min(500, $searchResp.Length))
