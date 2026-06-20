const fs = require('fs');
const f = 'src\\main.rs';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
let fixes = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'fn test_traits_can_buy() {') {
    // Find closing }
    let end = i;
    for (let j = i+1; j < i+20; j++) {
      if (lines[j].trim() === '}') { end = j; break; }
    }
    const indent = '        ';
    const newLines = [
      lines[i], // fn test_traits_can_buy() {
      indent + 'let mut t = CitadelTraits::default();',
      indent + 't.name = true; t.class = true; t.race = true; t.occupation = true;',
      indent + 'assert!(!t.can_buy()); // 4 traits < 5',
      indent + 't.origin_story = true;',
      indent + 'assert!(t.can_buy()); // 5 traits',
      '    }',
    ];
    lines.splice(i, end - i + 1, ...newLines);
    fixes++; console.log('Fixed test_traits_can_buy at L' + (i+1));
  }

  if (lines[i].trim() === 'fn test_traits_can_sell() {') {
    let end = i;
    for (let j = i+1; j < i+20; j++) {
      if (lines[j].trim() === '}') { end = j; break; }
    }
    const indent = '        ';
    const newLines = [
      lines[i],
      indent + 'let mut t = CitadelTraits::default();',
      indent + 't.name = true; t.class = true; t.race = true; t.occupation = true;',
      indent + 't.origin_story = true;',
      indent + 'assert!(!t.can_sell()); // 5 traits < 6',
      indent + 't.defining_moment = true;',
      indent + 'assert!(t.can_sell()); // 6 traits',
      '    }',
    ];
    lines.splice(i, end - i + 1, ...newLines);
    fixes++; console.log('Fixed test_traits_can_sell at L' + (i+1));
  }
}

fs.writeFileSync(f, lines.join('\r\n'));
console.log('Fixes: ' + fixes);
