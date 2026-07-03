const { execSync } = require('child_process');
const fs = require('fs');
const p = 'dist/public/index.html';
if (fs.existsSync(p)) {
  let h = fs.readFileSync(p, 'utf8');
  const u = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL ||
    (process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL ? 'https://' + process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL : '');
  if (u && !h.includes('__AOIRAIL_DATA_SERVICE_URL__')) {
    h = h.replace('</head>', '<script>window.__AOIRAIL_DATA_SERVICE_URL__=' + JSON.stringify(u) + ';</script></head>');
    fs.writeFileSync(p, h);
    console.error('Injected data URL:', u);
  } else {
    console.error('Skip inject: url=' + (u||'none') + ' alreadySet=' + h.includes('__AOIRAIL'));
  }
}
