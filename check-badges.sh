#!/bin/bash

# Quick badge upload status checker
echo "📦 Badge Upload Status:"
echo "======================"

cd attached_assets
PARTS_FOUND=$(ls 1024.part*.rar 2>/dev/null | wc -l)
echo "Parts uploaded: $PARTS_FOUND/13"

if [ "$PARTS_FOUND" -gt 0 ]; then
    echo ""
    echo "Files found:"
    ls -lh 1024.part*.rar 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
fi

echo ""
if [ "$PARTS_FOUND" -eq 13 ]; then
    echo "✅ All parts ready - running extraction..."
    cd ..
    ./extract-badges.sh
elif [ "$PARTS_FOUND" -gt 0 ]; then
    echo "⏳ Upload remaining $((13 - PARTS_FOUND)) parts to continue"
    echo "💡 Tip: Upload multiple parts at once if possible"
else
    echo "❌ No badge parts found yet"
fi