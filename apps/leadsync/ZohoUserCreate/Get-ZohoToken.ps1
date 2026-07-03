# Zoho OAuth Configuration
$config = @{
    client_id     = "1000.J997V5CGG0NS742VQA401ZFKTI5MJF"
    client_secret = "b60187effb9b211d02853c974b5f82ae3f51e53f54"
    code          = "1000.f3e5ff2254e25b4e746387ad43a74217.4f38846ac48b169f4308de9a17fe30d2"
    redirect_uri  = "http://localhost:8080/callback"  # Update this if you have a different redirect URI
    accounts_url  = "https://accounts.zoho.com"
    scopes        = @{
        crm   = "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL"
        voice = "zohovoice.queues.READ,zohovoice.queues.UPDATE"
    }
}

# Function to get initial access and refresh tokens
function Get-InitialTokens {
    param (
        [hashtable]$Config,
        [string]$Scope
    )

    $tokenUrl = "$($Config.accounts_url)/oauth/v2/token"
    $body = @{
        code          = $Config.code
        client_id     = $Config.client_id
        client_secret = $Config.client_secret
        grant_type    = "authorization_code"
        redirect_uri  = $Config.redirect_uri
        scope         = $Scope
    }

    try {
        $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body

        $tokens = @{
            access_token  = $response.access_token
            refresh_token = $response.refresh_token
            expires_at    = (Get-Date).AddSeconds($response.expires_in).ToString('o')
            scope         = $Scope
        }

        return $tokens
    } catch {
        Write-Error "Error getting initial tokens for scope '$Scope': $_"
        throw
    }
}

# Function to refresh access token
function Update-AccessToken {
    param (
        [hashtable]$Config,
        [string]$RefreshToken,
        [string]$Scope
    )

    $tokenUrl = "$($Config.accounts_url)/oauth/v2/token"
    $body = @{
        refresh_token = $RefreshToken
        client_id     = $Config.client_id
        client_secret = $Config.client_secret
        grant_type    = "refresh_token"
        scope         = $Scope
    }

    try {
        $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body
        
        $tokens = @{
            access_token  = $response.access_token
            refresh_token = $RefreshToken
            expires_at    = (Get-Date).AddSeconds($response.expires_in).ToString('o')
            scope         = $Scope
        }

        return $tokens
    } catch {
        Write-Error "Error refreshing token for scope '$Scope': $_"
        throw
    }
}

# Function to get agent details by email
function Get-AgentDetails {
    param (
        [string]$Email,
        [hashtable]$Tokens
    )

    $searchUrl = "$($config.accounts_url)/crm/v2/Contacts/search"
    $headers = @{
        'Authorization' = "Bearer $($Tokens.access_token)"
        'Content-Type' = 'application/json'
    }
    
    $criteria = "(Email:equals:$Email)"
    
    try {
        $response = Invoke-RestMethod -Uri "$searchUrl`?criteria=$criteria" -Method Get -Headers $headers
        return $response.data
    } catch {
        Write-Error "Error fetching agent details: $_"
        throw
    }
}

# Function to get agent's approved markets and licenses
function Get-AgentLicenses {
    param (
        [string]$AgentId,
        [hashtable]$Tokens
    )

    $licensesUrl = "$($config.accounts_url)/crm/v2/Agent_Licenses/$AgentId"
    $headers = @{
        'Authorization' = "Bearer $($Tokens.access_token)"
        'Content-Type' = 'application/json'
    }

    try {
        $response = Invoke-RestMethod -Uri $licensesUrl -Method Get -Headers $headers
        return $response.data
    } catch {
        Write-Error "Error fetching agent licenses: $_"
        throw
    }
}

# Function to load queue mappings from CSV
function Get-QueueMappings {
    param (
        [string]$CsvPath = "queue_mappings.csv"
    )

    try {
        if (Test-Path $CsvPath) {
            $mappings = Import-Csv -Path $CsvPath
            return $mappings
        } else {
            Write-Error "Queue mappings CSV file not found at: $CsvPath"
            throw
        }
    } catch {
        Write-Error "Error loading queue mappings: $_"
        throw
    }
}

# Updated function to use CSV mappings
function Update-SupabaseQueueAssignments {
    param (
        [string]$AgentEmail,
        [array]$ApprovedMarkets
    )

    # Load queue mappings
    $queueMappings = Get-QueueMappings
    $queueAssignments = @()

    # Generate queue assignments based on approved markets and mappings
    foreach ($market in $ApprovedMarkets) {
        $state = $market.state_abbreviation
        $marketTypes = $market.market_types

        foreach ($type in $marketTypes) {
            # Look up the queue ID from mappings
            $queueMapping = $queueMappings | Where-Object { 
                $_.state -eq $state -and $_.market_type -eq $type 
            }

            if ($queueMapping) {
                $queueAssignments += @{
                    agent_email = $AgentEmail
                    queue_id = $queueMapping.queue_id
                    queue_name = $queueMapping.description
                    state = $state
                    market_type = $type
                }
            } else {
                Write-Warning "No queue mapping found for market type '$type' in state '$state'"
            }
        }
    }

    # Here you would add the Supabase connection and update logic
    # This is a placeholder for the actual Supabase implementation
    return $queueAssignments
}

# Function to update Zoho Voice Queue
function Update-ZohoQueue {
    param (
        [hashtable]$Tokens,
        [string]$QueueId,
        [string]$QueueName,
        [array]$MemberIds,
        [string]$Strategy = "top-down",
        [int]$MaxWaitTime = 60
    )

    $updateUrl = "https://voice.zoho.com/rest/json/zv/api/groups"
    $headers = @{
        'Authorization' = "Bearer $($Tokens.access_token)"
        'Content-Type' = 'application/json'
    }

    $body = @{
        groupid = $QueueId
        name = $QueueName
        members = $MemberIds
        isBulk = $false
        config = @{
            "strategy" = $Strategy
            "max-wait-time" = $MaxWaitTime
            "max-wait-time-with-no-agent" = $MaxWaitTime
            "mwtformat" = "seconds"
            "mwtwnaformat" = "seconds"
        }
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $updateUrl -Method Put -Headers $headers -Body $body
        Write-Host "Queue updated successfully"
        return $response
    } catch {
        Write-Error "Error updating queue: $_"
        throw
    }
}

# Function to get all Zoho Voice Queues
function Get-ZohoQueues {
    param (
        [hashtable]$Tokens,
        [int]$From = 0,
        [int]$Offset = 100,
        [string]$SearchText = "",
        [string]$QueueId = ""
    )

    $baseUrl = "https://voice.zoho.com/rest/json/zv/api/queues"
    $headers = @{
        'Authorization' = "Bearer $($Tokens.access_token)"
        'Content-Type' = 'application/json'
    }

    # Build query parameters
    $queryParams = @{
        from = $From
        offset = $Offset
    }

    if ($SearchText) {
        $queryParams.Add("searchText", $SearchText)
    }
    
    if ($QueueId) {
        $queryParams.Add("queueid", $QueueId)
    }

    # Build query string
    $queryString = ($queryParams.GetEnumerator() | ForEach-Object { 
        "$($_.Key)=$([System.Web.HttpUtility]::UrlEncode($_.Value))" 
    }) -join '&'
    
    $url = "$baseUrl`?$queryString"

    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
        
        # Format the output for easier reading
        $queues = $response.data | ForEach-Object {
            @{
                QueueId = $_.groupid
                Name = $_.name
                EmailId = $_.emailId
                Extension = $_.extension
                MemberCount = $_.members.Count
                Members = $_.members
                Config = $_.config
            }
        }

        return $queues
    } catch {
        Write-Error "Error fetching queues: $_"
        throw
    }
}

# Function to manage tokens for different scopes
function Get-ScopedToken {
    param (
        [string]$ScopeName
    )

    $tokenFile = "zoho_tokens_$ScopeName.json"
    
    try {
        if (Test-Path $tokenFile) {
            $tokens = Get-Content -Path $tokenFile | ConvertFrom-Json
            
            # Check if token is expired or about to expire (within 5 minutes)
            $expiresAt = [DateTime]::Parse($tokens.expires_at)
            if ((Get-Date) -ge $expiresAt.AddMinutes(-5)) {
                Write-Host "Token for $ScopeName expired or about to expire. Refreshing..."
                $tokens = Update-AccessToken -Config $config -RefreshToken $tokens.refresh_token -Scope $config.scopes[$ScopeName]
                $tokens | ConvertTo-Json | Set-Content -Path $tokenFile
            }
        } else {
            Write-Host "No existing tokens found for $ScopeName. Generating new tokens..."
            $tokens = Get-InitialTokens -Config $config -Scope $config.scopes[$ScopeName]
            $tokens | ConvertTo-Json | Set-Content -Path $tokenFile
        }

        return $tokens
    } catch {
        Write-Error "Failed to get token for scope '$ScopeName': $_"
        throw
    }
}

# Main execution
try {
    # Get CRM tokens
    $crmTokens = Get-ScopedToken -ScopeName "crm"
    Write-Host "CRM tokens acquired successfully"

    # Get Voice tokens
    $voiceTokens = Get-ScopedToken -ScopeName "voice"
    Write-Host "Voice tokens acquired successfully"

    # Use appropriate tokens for each API call
    $allQueues = Get-ZohoQueues -Tokens $voiceTokens
    Write-Host "`nAvailable Queues:"
    $allQueues | ForEach-Object {
        Write-Host "Queue ID: $($_.QueueId) | Name: $($_.Name) | Extension: $($_.Extension) | Members: $($_.MemberCount)"
    }

    $agentEmail = Read-Host "Enter agent email"
    $agentDetails = Get-AgentDetails -Email $agentEmail -Tokens $crmTokens

    if ($agentDetails) {
        Write-Host "Agent found: $($agentDetails.Full_Name)"
        
        # Get agent licenses and approved markets
        $agentLicenses = Get-AgentLicenses -AgentId $agentDetails.id -Tokens $crmTokens

        # Update queue assignments in Supabase
        $queueAssignments = Update-SupabaseQueueAssignments -AgentEmail $agentEmail -ApprovedMarkets $agentLicenses

        # Display assignments with more detail
        Write-Host "`nQueue Assignments:"
        $queueAssignments | ForEach-Object {
            Write-Host "Queue ID: $($_.queue_id) | Name: $($_.queue_name) | State: $($_.state) | Market: $($_.market_type)"
        }
    } else {
        Write-Host "No agent found with email: $agentEmail"
    }

} catch {
    Write-Error "Script execution failed: $_"
    exit 1
} 