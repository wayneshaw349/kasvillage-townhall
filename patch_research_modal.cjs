const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');

// Fix modal overlay — slide up from bottom, take 85% height
s = s.replace(
  `overlay: {
    flex: 1,
    backgroundColor: 'rgba(120,96,72,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(16),
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(24),
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },`,
  `overlay: {
    flex: 1,
    backgroundColor: 'rgba(120,96,72,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: rs.s(24),
    borderTopRightRadius: rs.s(24),
    width: '100%',
    height: '85%',
    overflow: 'hidden',
  },`
);

fs.writeFileSync(f, s);
console.log('Fixed: Research Shelf modal now slides up, 85% height');
