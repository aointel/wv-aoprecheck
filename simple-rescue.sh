#!/bin/bash

# These are the callIDs we KNOW exist and are available from earlier testing
CALL_IDS=(
  "68eefdc16ebc4082cb9f3994"
  "68eef54a9f86d05673eb3e58"
  "68eeeb2348db301243d903e9"
  "68eee49fbd1879a98749cacc"
  "68eee02ac000b7779bd48a24"
  "68eedfc47143cbaaf7becad1"
  "68eedf5948db301243d8d9b4"
)

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"

mkdir -p recordings

for call_id in "${CALL_IDS[@]}"; do
  echo "⬇️  Downloading: $call_id"
  
  curl -s "https://api.taalk.ai/api/calls/${call_id}/recording?db=michaelmandella" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: audio/mpeg" \
    --output "recordings/${call_id}.mp3" \
    --fail --show-error
  
  if [ -f "recordings/${call_id}.mp3" ] && [ -s "recordings/${call_id}.mp3" ]; then
    SIZE=$(ls -lh "recordings/${call_id}.mp3" | awk '{print $5}')
    echo "✅ SAVED: ${call_id}.mp3 ($SIZE)"
  else
    echo "❌ FAILED: ${call_id}"
    rm -f "recordings/${call_id}.mp3"
  fi
  
  sleep 0.5
done

echo ""
echo "📊 Results:"
ls -lh recordings/*.mp3 2>/dev/null || echo "No files downloaded"
