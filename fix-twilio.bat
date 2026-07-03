@echo off
git add client/src/components/outbound-dialer/OutboundDialerInterface.tsx client/src/components/ui/AppVolumeControl.tsx server/index.ts
git commit -m "Fix: Twilio SDK device.state + webhook uses LOCAL PRESENCE caller IDs per state"
git push origin master
pause

