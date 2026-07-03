#!/bin/sh
# Download video file from Google Drive on first startup if it doesn't exist

VIDEO_FILE="/app/attached_assets/ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4"
GOOGLE_DRIVE_ID="1fbZsKSj23mqIutJRaFXJ8412pjreZjsv"
DOWNLOAD_URL="https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_ID}"

if [ ! -f "$VIDEO_FILE" ]; then
    echo "📹 Video not found, downloading from Google Drive..."
    echo "🔗 URL: ${DOWNLOAD_URL}"
    
    mkdir -p /app/attached_assets
    
    # Download the video file (109MB)
    echo "⏬ Downloading... (this may take a minute)"
    wget --no-check-certificate -O "$VIDEO_FILE" "$DOWNLOAD_URL" || \
    curl -L -o "$VIDEO_FILE" "$DOWNLOAD_URL"
    
    if [ -f "$VIDEO_FILE" ]; then
        FILE_SIZE=$(stat -f%z "$VIDEO_FILE" 2>/dev/null || stat -c%s "$VIDEO_FILE" 2>/dev/null)
        echo "✅ Video downloaded successfully! Size: ${FILE_SIZE} bytes"
    else
        echo "❌ Failed to download video"
        exit 1
    fi
else
    echo "✅ Video already exists"
fi

