#!/bin/bash

# Continuous badge upload monitor
echo "🔄 Starting badge upload monitor..."

while true; do
    clear
    echo "===================="
    echo "🎮 BADGE UPLOAD STATUS"
    echo "===================="
    
    cd attached_assets
    PARTS_COUNT=$(ls 1024.part*.rar 2>/dev/null | wc -l)
    
    echo "Progress: $PARTS_COUNT/13 parts uploaded"
    echo ""
    
    # Progress bar
    PROGRESS=$(( PARTS_COUNT * 100 / 13 ))
    printf "["
    for i in $(seq 1 50); do
        if [ $i -le $(( PROGRESS / 2 )) ]; then
            printf "="
        else
            printf " "
        fi
    done
    printf "] $PROGRESS%%\n"
    echo ""
    
    if [ "$PARTS_COUNT" -eq 13 ]; then
        echo "✅ ALL PARTS READY! Running extraction..."
        cd ..
        ./extract-badges.sh
        break
    elif [ "$PARTS_COUNT" -gt 0 ]; then
        echo "📁 Files found:"
        ls -lh 1024.part*.rar 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
        echo ""
        echo "⏳ Waiting for $((13 - PARTS_COUNT)) more parts..."
        echo "💡 Upload remaining parts to continue"
    else
        echo "❌ No parts found yet"
        echo "📤 Start uploading badge archive parts"
    fi
    
    echo ""
    echo "🔄 Checking again in 30 seconds... (Ctrl+C to stop)"
    sleep 30
done