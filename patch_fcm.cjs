const fs = require('fs');
let c = fs.readFileSync('app.json', 'utf8');
let j = JSON.parse(c);
if (!j.expo.android.googleServicesFile) {
  j.expo.android.googleServicesFile = './google-services.json';
  console.log('Added googleServicesFile to app.json');
} else {
  console.log('Already set:', j.expo.android.googleServicesFile);
}
fs.writeFileSync('app.json', JSON.stringify(j, null, 2));
