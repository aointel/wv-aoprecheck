#!/bin/bash
# Upload video to Railway volume

echo "🚀 Uploading video to Railway..."
echo "Make sure you've created the 'attached_assets' volume first!"
echo ""

# Link to Railway project
railway link

# Copy the video file to the volume using railway shell
railway run bash -c "mkdir -p /app/attached_assets && cat > '/app/attached_assets/ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4'" < "attached_assets/ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4"

echo "✅ Video uploaded!"



