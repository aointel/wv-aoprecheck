#!/bin/bash
export NODE_ENV=development
export PATH="/home/runner/.local/bin:./node_modules/.bin:$PATH"
exec bun run server/index.ts
