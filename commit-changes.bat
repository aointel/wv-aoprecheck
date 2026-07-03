@echo off
git add server/index.ts
git commit -m "Fix: Remove initialization delay in development mode for instant WebSocket availability"
git push origin master


