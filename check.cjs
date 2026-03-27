const fs = require('fs');
const files = [
  'public/pwa-icon-192-v6.png',
  'public/pwa-icon-512-v6.png',
  'public/apple-touch-icon-v6.png'
];
files.forEach(f => {
  try {
    const stat = fs.statSync(f);
    console.log(f, stat.size, 'bytes');
  } catch (e) {
    console.log(f, 'not found');
  }
});
