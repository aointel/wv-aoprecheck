#!/usr/bin/env node
import('./server/fix-vpn-flags-with-gps.ts').then(module => {
  if (module.main) {
    module.main();
  } else {
    console.error('Main function not found');
    process.exit(1);
  }
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

