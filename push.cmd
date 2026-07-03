cd /d %~dp0
git add server/index.ts client/src/components/outbound-dialer/OutboundDialerInterface.tsx client/src/components/ui/AppVolumeControl.tsx
git commit -m "Fix: LOCAL PRESENCE caller IDs"
git push origin master
pause


