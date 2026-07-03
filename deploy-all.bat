@echo off
echo Deploying all services from repo root...
cd /d C:\dev\AOIrail

railway service aoirail-connect && railway up --detach
railway service aoirail-data && railway up --detach
railway service campaginmanager && cd /d C:\dev\AOIrail\apps\campaign-manager && railway up --detach && cd /d C:\dev\AOIrail

echo Done.
