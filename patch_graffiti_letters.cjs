const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Add Text import from react-native-svg if not there
if (!s.includes("Text as SvgText")) {
  s = s.replace(
    "import Svg, { Rect, Defs, Pattern, Line, G, Path } from 'react-native-svg';",
    "import Svg, { Rect, Defs, Pattern, Line, G, Path, Text as SvgText } from 'react-native-svg';"
  );
  console.log('1: Added SvgText import');
}

// Replace the block rectangles with actual letter rendering
const oldLetters = `{/* 3D Shadow text */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 72 + Math.sin(i * 0.8) * 8 : 75;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 8 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -2 : 2) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 52 : 48;
                    const strokeW = bannerRecipe.style === 'bubble' ? 6 : 4;
                    return (
                      <G key={i}>
                        {/* Shadow */}
                        <Rect x={x - charW/2 + 3} y={y - fontSize/2 + 5} width={charW - 2} height={fontSize - 4} rx="4" fill={bannerRecipe.shadowColor} opacity="0.4" transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Outline */}
                        <Rect x={x - charW/2} y={y - fontSize/2 + 2} width={charW - 2} height={fontSize - 4} rx={bannerRecipe.style === 'bubble' ? 10 : 4} fill={bannerRecipe.outlineColor} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Fill */}
                        <Rect x={x - charW/2 + 2} y={y - fontSize/2 + 4} width={charW - 6} height={fontSize - 8} rx={bannerRecipe.style === 'bubble' ? 8 : 2} fill={bannerRecipe.fillColor} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                        {/* Letter */}
                        <Rect x={x - charW/2 + 4} y={y - fontSize/2 + 6} width={charW - 10} height={2} fill={bannerRecipe.outlineColor} opacity="0.15" transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'} />
                      </G>
                    );
                  })}
                  {/* Actual text on top */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 78 + Math.sin(i * 0.8) * 8 : 80;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 8 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -2 : 2) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 36 : 32;
                    return (
                      <G key={'t' + i} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'}>
                        <Rect x={x - 1} y={y - fontSize + 8} width={2} height={0} />
                      </G>
                    );
                  })}`;

const newLetters = `{/* Graffiti Letters */}
                  {bannerRecipe.text.split('').map((ch, i) => {
                    const total = bannerRecipe.text.length;
                    const charW = Math.min(320 / Math.max(total, 1), 50);
                    const startX = (360 - total * charW) / 2;
                    const x = startX + i * charW + charW / 2;
                    const y = bannerRecipe.style === 'wild' ? 75 + Math.sin(i * 0.8) * 8 : 78;
                    const rot = bannerRecipe.style === 'wild' ? Math.sin(i * 1.2) * 10 : bannerRecipe.style === 'block' ? (i % 2 === 0 ? -3 : 3) : 0;
                    const fontSize = bannerRecipe.style === 'bubble' ? 48 : 44;
                    const strokeW = bannerRecipe.style === 'bubble' ? 8 : 5;
                    return (
                      <G key={i} transform={'rotate(' + rot + ' ' + x + ' ' + y + ')'}>
                        {/* Drop shadow */}
                        <SvgText x={x + 3} y={y + 3} fontSize={fontSize} fontWeight="900" fill={bannerRecipe.shadowColor} opacity="0.5" textAnchor="middle">{ch}</SvgText>
                        {/* Thick outline */}
                        <SvgText x={x} y={y} fontSize={fontSize} fontWeight="900" fill="none" stroke={bannerRecipe.outlineColor} strokeWidth={strokeW} textAnchor="middle">{ch}</SvgText>
                        {/* Fill */}
                        <SvgText x={x} y={y} fontSize={fontSize} fontWeight="900" fill={bannerRecipe.fillColor} textAnchor="middle">{ch}</SvgText>
                        {/* Inner highlight */}
                        <SvgText x={x - 1} y={y - 2} fontSize={fontSize * 0.85} fontWeight="900" fill={bannerRecipe.fillColor} opacity="0.3" textAnchor="middle">{ch}</SvgText>
                      </G>
                    );
                  })}`;

if (s.includes(oldLetters)) {
  s = s.replace(oldLetters, newLetters);
  console.log('2: Replaced block rects with actual graffiti letters');
} else {
  console.log('ERROR: old letter pattern not found');
}

fs.writeFileSync(f, s);
