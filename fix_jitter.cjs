const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();

  // 1. Add selector to JitterCommitmentConfig
  if (t === 'pub struct JitterCommitmentConfig {') {
    // Find the closing }
    for (let j = i+1; j < i+10; j++) {
      if (lines[j].trim() === '}') {
        lines.splice(j, 0, '    pub selector: Selector,');
        fixes++; console.log('L' + (j+1) + ': Added selector to JitterCommitmentConfig');
        break;
      }
    }
  }

  // 2. Store selector in config return
  if (t === 'JitterCommitmentConfig {' && i > 0 && lines[i-1].trim() === '') {
    // Check this is the one in configure() (after the gate)
    let inConfigure = false;
    for (let j = i-1; j > i-30 && j >= 0; j--) {
      if (lines[j].includes('pass_flag_must_be_one')) { inConfigure = true; break; }
    }
    if (inConfigure) {
      // Find closing of this struct init
      for (let j = i+1; j < i+10; j++) {
        if (lines[j].trim() === '}') {
          lines.splice(j, 0, '            selector,');
          fixes++; console.log('L' + (j+1) + ': Added selector to config init');
          break;
        }
      }
    }
  }

  // 3. Enable selector in synthesize - in the pass_flag region
  if (t === 'region.assign_advice(|| "pass_flag", config.pass_flag_col, 0, || self.pass_flag)') {
    // Insert selector enable before the assign
    const indent = '                ';
    lines.splice(i, 0, indent + 'config.selector.enable(&mut region, 0)?;');
    fixes++; console.log('L' + (i+1) + ': Enabled selector in pass_flag region');
    break; // Only first occurrence
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
