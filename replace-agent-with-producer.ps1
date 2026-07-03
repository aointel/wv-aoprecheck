# Replace "agent" with "Producer" in user-facing text
# Excludes: API endpoints, variable names, technical terms

$files = Get-ChildItem -Path "client\src" -Recurse -Include *.tsx,*.ts,*.jsx,*.js | Where-Object { $_.FullName -notmatch "node_modules" }

$replacements = @(
    # UI Text - Specific phrases first (most specific to least specific)
    @{Pattern = '\bActive Agents\b'; Replace = 'Active Producers'},
    @{Pattern = '\bactive agents\b'; Replace = 'active producers'},
    @{Pattern = '\bAgent Status\b'; Replace = 'Producer Status'},
    @{Pattern = '\bagent status\b'; Replace = 'producer status'},
    @{Pattern = '\bAgent Dashboard\b'; Replace = 'Producer Dashboard'},
    @{Pattern = '\bagent dashboard\b'; Replace = 'producer dashboard'},
    @{Pattern = '\bAgent Profile\b'; Replace = 'Producer Profile'},
    @{Pattern = '\bagent profile\b'; Replace = 'producer profile'},
    @{Pattern = '\bAgent Name\b'; Replace = 'Producer Name'},
    @{Pattern = '\bagent name\b'; Replace = 'producer name'},
    @{Pattern = '\bAgent Setup\b'; Replace = 'Producer Setup'},
    @{Pattern = '\bagent setup\b'; Replace = 'producer setup'},
    @{Pattern = '\bAgent Info\b'; Replace = 'Producer Info'},
    @{Pattern = '\bagent info\b'; Replace = 'producer info'},
    @{Pattern = '\bAgent Settings\b'; Replace = 'Producer Settings'},
    @{Pattern = '\bagent settings\b'; Replace = 'producer settings'},
    @{Pattern = '\bAgent Performance\b'; Replace = 'Producer Performance'},
    @{Pattern = '\bagent performance\b'; Replace = 'producer performance'},
    @{Pattern = '\bAgent Stats\b'; Replace = 'Producer Stats'},
    @{Pattern = '\bagent stats\b'; Replace = 'producer stats'},
    @{Pattern = '\bAgent Activity\b'; Replace = 'Producer Activity'},
    @{Pattern = '\bagent activity\b'; Replace = 'producer activity'},
    @{Pattern = '\bAgent Availability\b'; Replace = 'Producer Availability'},
    @{Pattern = '\bagent availability\b'; Replace = 'producer availability'},
    @{Pattern = '\bAgent Call\b'; Replace = 'Producer Call'},
    @{Pattern = '\bagent call\b'; Replace = 'producer call'},
    @{Pattern = '\bAgent Calls\b'; Replace = 'Producer Calls'},
    @{Pattern = '\bagent calls\b'; Replace = 'producer calls'},
    @{Pattern = '\bAgent Email\b'; Replace = 'Producer Email'},
    @{Pattern = '\bagent email\b'; Replace = 'producer email'},
    @{Pattern = '\bAgent ID\b'; Replace = 'Producer ID'},
    @{Pattern = '\bagent id\b'; Replace = 'producer id'},
    @{Pattern = '\bAgent Leaderboard\b'; Replace = 'Producer Leaderboard'},
    @{Pattern = '\bagent leaderboard\b'; Replace = 'producer leaderboard'},
    @{Pattern = '\bAgent List\b'; Replace = 'Producer List'},
    @{Pattern = '\bagent list\b'; Replace = 'producer list'},
    @{Pattern = '\bAgent Management\b'; Replace = 'Producer Management'},
    @{Pattern = '\bagent management\b'; Replace = 'producer management'},
    @{Pattern = '\bAgent Metrics\b'; Replace = 'Producer Metrics'},
    @{Pattern = '\bagent metrics\b'; Replace = 'producer metrics'},
    @{Pattern = '\bAgent Reports\b'; Replace = 'Producer Reports'},
    @{Pattern = '\bagent reports\b'; Replace = 'producer reports'},
    @{Pattern = '\bAgent Ticker\b'; Replace = 'Producer Ticker'},
    @{Pattern = '\bagent ticker\b'; Replace = 'producer ticker'},
    @{Pattern = '\bAgent View\b'; Replace = 'Producer View'},
    @{Pattern = '\bagent view\b'; Replace = 'producer view'},
    @{Pattern = '\bLive Agent\b'; Replace = 'Live Producer'},
    @{Pattern = '\bLive agent\b'; Replace = 'Live producer'},
    @{Pattern = '\blive agent\b'; Replace = 'live producer'},
    @{Pattern = '\bthe agent\b'; Replace = 'the producer'},
    @{Pattern = '\bThe agent\b'; Replace = 'The producer'},
    @{Pattern = '\bthis agent\b'; Replace = 'this producer'},
    @{Pattern = '\bThis agent\b'; Replace = 'This producer'},
    @{Pattern = '\ban agent\b'; Replace = 'a producer'},
    @{Pattern = '\bAn agent\b'; Replace = 'A producer'},
    @{Pattern = '\beach agent\b'; Replace = 'each producer'},
    @{Pattern = '\bEach agent\b'; Replace = 'Each producer'},
    @{Pattern = '\bAll agents\b'; Replace = 'All producers'},
    @{Pattern = '\ball agents\b'; Replace = 'all producers'},
    @{Pattern = '\bfor agents\b'; Replace = 'for producers'},
    @{Pattern = '\bFor agents\b'; Replace = 'For producers'},
    @{Pattern = '\bto agents\b'; Replace = 'to producers'},
    @{Pattern = '\bTo agents\b'; Replace = 'To producers'},
    @{Pattern = '\bby agents\b'; Replace = 'by producers'},
    @{Pattern = '\bBy agents\b'; Replace = 'By producers'},
    @{Pattern = '\bagents can\b'; Replace = 'producers can'},
    @{Pattern = '\bAgents can\b'; Replace = 'Producers can'},
    @{Pattern = '\bagents will\b'; Replace = 'producers will'},
    @{Pattern = '\bAgents will\b'; Replace = 'Producers will'},
    @{Pattern = '\bagents are\b'; Replace = 'producers are'},
    @{Pattern = '\bAgents are\b'; Replace = 'Producers are'},
    @{Pattern = '\bagents have\b'; Replace = 'producers have'},
    @{Pattern = '\bAgents have\b'; Replace = 'Producers have'},
    
    # Generic replacements (last resort)
    @{Pattern = '(?<!user-)(?<!vdp_)(?<!/)agent(?!_|Email|Id|Name|Status)'; Replace = 'producer'},
    @{Pattern = '(?<!user-)(?<!vdp_)(?<!/)Agent(?!_|Email|Id|Name|Status)'; Replace = 'Producer'}
)

# Patterns to EXCLUDE (don't replace these)
$excludePatterns = @(
    'user-agent',
    'agentEmail',
    'agentId',
    'agent_email',
    'agent_id',
    '/api/agent',
    'vdp_agents',
    'agent-',
    'useragent'
)

$totalChanges = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    $originalContent = $content
    $fileChanges = 0
    
    foreach ($replacement in $replacements) {
        # Skip if the line contains any excluded patterns
        $shouldSkip = $false
        foreach ($exclude in $excludePatterns) {
            if ($content -match [regex]::Escape($exclude)) {
                # Don't skip the whole file, just be careful
            }
        }
        
        $newContent = $content -replace $replacement.Pattern, $replacement.Replace
        if ($newContent -ne $content) {
            $matches = ([regex]::Matches($content, $replacement.Pattern)).Count
            $fileChanges += $matches
            $content = $newContent
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalChanges += $fileChanges
        Write-Host "✅ Updated $($file.Name) - $fileChanges replacements" -ForegroundColor Green
    }
}

Write-Host "`n🎉 TOTAL REPLACEMENTS: $totalChanges across $($files.Count) files" -ForegroundColor Cyan

