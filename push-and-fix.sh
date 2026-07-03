#!/bin/bash
cd /Users/michaelmandella/Desktop/AOIrail-master
git add -A
git commit -m "Add VPN fix script and admin route for GPS override"
git push origin master
echo "✅ Pushed to master"
echo ""
echo "Now trigger the fix endpoint:"
echo "curl -X POST http://localhost:3000/api/admin/fix-vpn-flags-with-gps -H 'Content-Type: application/json' -d '{}'"

