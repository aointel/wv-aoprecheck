@echo off
cd C:\zoho-airtable-sync
node master.js >> logs\sync_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%.log 2>&1 