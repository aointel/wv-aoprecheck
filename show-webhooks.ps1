$response = Invoke-RestMethod -Uri "https://aoirail-production.up.railway.app/api/webhooks/planet/last-10"

Write-Host "`n=== WEBHOOK TABLE ENTRIES ==="
Write-Host "Found: $($response.webhookTableEntries) entries`n"

if ($response.webhooks.Count -gt 0) {
    $i = 1
    foreach ($w in $response.webhooks) {
        Write-Host "$i. Agent: $($w.agent_email)"
        $leadId = if ($w.hotlead_id) { $w.hotlead_id } elseif ($w.lead_id) { $w.lead_id } else { "N/A" }
        Write-Host "   Lead ID: $leadId"
        $time = if ($w.sent_at) { $w.sent_at } else { $w.created_at }
        Write-Host "   Time: $time"
        Write-Host "   Status: $($w.webhook_status)"
        if ($w.webhook_payload) {
            $p = if ($w.webhook_payload -is [string]) { $w.webhook_payload | ConvertFrom-Json } else { $w.webhook_payload }
            Write-Host "   Payload: lead_id=$($p.lead_id), associate_id=$($p.associate_id)"
        }
        Write-Host ""
        $i++
    }
}

Write-Host "`n=== BOOKED DISPOSITIONS (Last 10) ==="
Write-Host "Found: $($response.bookedDispositions.Count) booked/Meet dispositions`n"

$i = 1
foreach ($call in $response.bookedDispositions) {
    Write-Host "$i. Agent: $($call.agent_email)"
    Write-Host "   Lead: $($call.lead_name) - $($call.lead_phone)"
    Write-Host "   Disposition: $($call.disposition)"
    Write-Host "   Time: $($call.created_at)"
    Write-Host ""
    $i++
}









