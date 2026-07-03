#!/bin/bash
# Add demo AOI cards for cnsysop via API endpoint
# Make sure your server is running first

curl -X POST http://localhost:5000/api/war/add-demo-cards \
  -H "Content-Type: application/json" \
  -d '{"agentEmail": "cnsysop@aoglobelife.com"}'

echo ""
echo "✅ Demo cards added! Visit /war-reports to see them."
