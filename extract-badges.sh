#!/bin/bash

# Badge Asset Extraction Script
# Extracts 600 Destiny-style badge assets from multi-part RAR archive

echo "🔍 Checking for badge asset parts..."
cd attached_assets

# Count RAR parts
PARTS_COUNT=$(ls 1024.part*.rar 2>/dev/null | wc -l)
echo "Found $PARTS_COUNT out of 13 expected parts"

if [ "$PARTS_COUNT" -eq 13 ]; then
    echo "✅ All 13 parts found! Beginning extraction..."
    
    # Create extraction directory
    mkdir -p badge_extraction
    cd badge_extraction
    
    # Extract multi-part RAR archive using 7z
    echo "📦 Extracting RAR archive..."
    7z x ../1024.part01*.rar
    
    # Check extraction success
    if [ $? -eq 0 ]; then
        echo "✅ Extraction successful!"
        
        # Count extracted files
        BADGE_COUNT=$(find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | wc -l)
        echo "Found $BADGE_COUNT badge image files"
        
        if [ "$BADGE_COUNT" -eq 600 ]; then
            echo "🎯 Perfect! All 600 badge assets extracted"
            
            # Organize badges into proper structure
            echo "📁 Organizing badges into Season Pass structure..."
            mkdir -p ../../client/src/assets/badges/shields
            
            # Copy and rename badges sequentially
            counter=1
            for file in $(find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | sort); do
                # Pad with leading zeros (001, 002, etc.)
                padded_num=$(printf "%03d" $counter)
                ext="${file##*.}"
                cp "$file" "../../client/src/assets/badges/shields/badge_${padded_num}.${ext}"
                counter=$((counter + 1))
            done
            
            echo "🎮 Badge assets ready for Season Pass integration!"
            echo "   - Location: client/src/assets/badges/shields/"
            echo "   - Format: badge_001.png to badge_600.png"
            echo "   - Ready for Destiny-style Season Pass system"
            
        else
            echo "⚠️  Warning: Expected 600 badges but found $BADGE_COUNT"
        fi
        
    else
        echo "❌ Extraction failed! Check RAR integrity"
        exit 1
    fi
    
else
    echo "⏳ Waiting for more parts... ($PARTS_COUNT/13 uploaded)"
    echo "Upload all 13 parts to begin extraction"
fi