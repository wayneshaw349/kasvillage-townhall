const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// The inner catch needs a closing } before the outer catch
const broken = "Alert.alert('Error', String(ae)); \n    } catch (e: any)";
const brokenAlt = "Alert.alert('Error', String(ae)); \r\n    } catch (e: any)";
const fixed = "Alert.alert('Error', String(ae)); }\n    } catch (e: any)";

if (f.includes(broken)) {
  f = f.replace(broken, fixed);
  console.log('Fixed (LF)');
} else if (f.includes(brokenAlt)) {
  f = f.replace(brokenAlt, fixed);
  console.log('Fixed (CRLF)');
} else {
  // Brute force: find line 2032 area
  const lines = f.split('\n');
  for (let i = 2028; i < 2040 && i < lines.length; i++) {
    if (lines[i].includes("Alert.alert('Error', String(ae))")) {
      // Check if next line starts with "} catch"
      if (i + 1 < lines.length && lines[i+1].trim().startsWith('} catch')) {
        // Add closing brace
        lines[i] = lines[i].replace("String(ae)); ", "String(ae)); } ");
        if (!lines[i].includes('} }')) {
          lines[i] = lines[i] + ' }';
        }
        f = lines.join('\n');
        console.log('Fixed at line', i + 1);
        break;
      }
    }
  }
}

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
