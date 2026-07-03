#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/michaelmandella/Desktop/AOIrail-master
nvm use default 2>/dev/null || nvm use node 2>/dev/null || nvm use --lts 2>/dev/null
node node_modules/.bin/tsx server/fix-vpn-flags-with-gps.ts

