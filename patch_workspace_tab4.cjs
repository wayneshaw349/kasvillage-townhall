const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// === 1: Add coupon state ===
if (!s.includes('coupons, setCoupons')) {
  s = s.replace(
    "  // Publishing state\n  const [isPublishing, setIsPublishing] = useState(false);",
    `  // Coupons
  const [coupons, setCoupons] = useState<any[]>([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [couponForm, setCouponForm] = useState({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' });
  
  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);`
  );
  changes++; console.log('1: Added coupon state');
}

// === 2: Add coupon helpers ===
if (!s.includes('handleSaveCoupon')) {
  s = s.replace(
    "  const handleCopyTemplate = async () => {",
    `  // Coupon CRUD
  const handleSaveCoupon = () => {
    const code = couponForm.code.trim().toUpperCase();
    if (!code || code.length < 3) { Alert.alert('Required', 'Coupon code must be at least 3 characters'); return; }
    if (!couponForm.discountPercent && !couponForm.discountKas) { Alert.alert('Required', 'Set a discount (% or KAS)'); return; }
    const coupon = {
      id: editingCoupon?.id || 'cpn_' + Date.now(),
      code,
      discountPercent: parseFloat(couponForm.discountPercent) || 0,
      discountKas: parseFloat(couponForm.discountKas) || 0,
      maxUses: parseInt(couponForm.maxUses) || 10,
      usedCount: editingCoupon?.usedCount || 0,
      expiryDays: parseInt(couponForm.expiryDays) || 30,
      description: couponForm.description.trim(),
      createdAt: editingCoupon?.createdAt || Date.now(),
    };
    if (editingCoupon) {
      setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? coupon : c));
    } else {
      setCoupons(prev => [...prev, coupon]);
    }
    setShowCouponForm(false);
    setEditingCoupon(null);
    setCouponForm({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' });
  };

  // Visibility score (client-side mirror of TownHall algorithm)
  // Weights: 30% XP, 25% runway, 25% price, 10% pledge, 10% freshness
  const calcVisibilityScore = (xp: number, runwayPct: number, priceFactor: number, pledgeKas: number, ageHours: number) => {
    const xpScore = Math.min(xp / 5000, 1.0);
    const runwayScore = Math.min(runwayPct / 100, 1.0);
    const priceScore = priceFactor; // 0-1, lower price = higher score, free=1.0
    const pledgeScore = Math.min(pledgeKas / 2500, 1.0);
    const freshnessScore = Math.pow(0.5, ageHours / 24); // 24hr half-life
    const total = xpScore * 0.30 + runwayScore * 0.25 + priceScore * 0.25 + pledgeScore * 0.10 + freshnessScore * 0.10;
    return { total: Math.round(total * 100), xpScore: Math.round(xpScore * 100), runwayScore: Math.round(runwayScore * 100), priceScore: Math.round(priceScore * 100), pledgeScore: Math.round(pledgeScore * 100), freshnessScore: Math.round(freshnessScore * 100) };
  };

  const handleCopyTemplate = async () => {`
  );
  changes++; console.log('2: Added coupon helpers + visibility calc');
}

// === 3: Load coupons on mount ===
if (s.includes("if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);") && !s.includes('cfg.coupons')) {
  s = s.replace(
    "if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);",
    "if (cfg.bannerStyle) setBannerStyle(cfg.bannerStyle);\n        if (cfg.coupons) setCoupons(cfg.coupons);"
  );
  changes++; console.log('3: Load coupons on mount');
}

// === 4: Include coupons in publish config ===
if (s.includes('bannerRecipe,') && !s.includes('coupons,\n')) {
  s = s.replace(
    "        bannerRecipe,",
    "        bannerRecipe,\n        coupons,"
  );
  changes++; console.log('4: Added coupons to publish config');
}

// === 5: Replace coupons tab (currently empty — no tab content exists) ===
// The tab name 'coupons' is in the toolbar but no content block exists
// Insert before DApps tab
const couponsTabContent = `        {/* Coupons Tab */}
        {activeView === 'coupons' && (
          <View>
            <SectionCard title="🎟️ Coupon Management">
              <Text style={{ fontSize: rs.font(11), color: COLORS.stone500, marginBottom: rs.s(12) }}>
                Create discount codes. Linked to agreements at checkout.
              </Text>

              {/* Bar Chart — coupon usage */}
              {coupons.length > 0 && (
                <View style={{ backgroundColor: COLORS.stone50, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(16) }}>
                  <Text style={{ fontSize: rs.font(11), fontWeight: 'bold', color: COLORS.stone600, marginBottom: rs.s(8) }}>Usage Overview</Text>
                  <Svg viewBox={'0 0 ' + Math.max(coupons.length * 60, 200) + ' 100'} style={{ width: '100%', height: rs.s(100) }}>
                    {coupons.map((cpn, i) => {
                      const barW = 40;
                      const gap = 20;
                      const x = i * (barW + gap) + 10;
                      const usePct = cpn.maxUses > 0 ? Math.min(cpn.usedCount / cpn.maxUses, 1) : 0;
                      const maxH = 70;
                      const barH = Math.max(usePct * maxH, 4);
                      const colors = ['#d97706', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#6366f1'];
                      const color = colors[i % colors.length];
                      return (
                        <G key={cpn.id}>
                          {/* Background bar */}
                          <Rect x={x} y={100 - maxH - 10} width={barW} height={maxH} rx="4" fill={COLORS.stone200} />
                          {/* Usage bar */}
                          <Rect x={x} y={100 - barH - 10} width={barW} height={barH} rx="4" fill={color} />
                          {/* Label */}
                          <Rect x={x} y={92} width={barW} height={0} />
                        </G>
                      );
                    })}
                  </Svg>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(8), marginTop: rs.s(4) }}>
                    {coupons.map((cpn, i) => {
                      const colors = ['#d97706', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#6366f1'];
                      return (
                        <View key={cpn.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors[i % colors.length] }} />
                          <Text style={{ fontSize: rs.font(9), color: COLORS.stone500 }}>{cpn.code} ({cpn.usedCount}/{cpn.maxUses})</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Coupon List */}
              {coupons.map(cpn => {
                const daysLeft = Math.max(0, Math.ceil((cpn.createdAt + cpn.expiryDays * 86400000 - Date.now()) / 86400000));
                const expired = daysLeft <= 0;
                return (
                  <View key={cpn.id} style={{ backgroundColor: expired ? COLORS.red50 : COLORS.cardBg, borderRadius: rs.s(12), padding: rs.s(12), marginBottom: rs.s(8), borderWidth: 1, borderColor: expired ? COLORS.red200 : COLORS.amber200 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs.s(8) }}>
                          <Text style={{ fontSize: rs.font(16), fontWeight: '900', fontFamily: 'monospace', color: expired ? COLORS.red500 : COLORS.amber900 }}>{cpn.code}</Text>
                          {expired && <Text style={{ fontSize: rs.font(9), color: COLORS.red600, fontWeight: 'bold' }}>EXPIRED</Text>}
                        </View>
                        <Text style={{ fontSize: rs.font(11), color: COLORS.stone600, marginTop: 2 }}>
                          {cpn.discountPercent > 0 ? cpn.discountPercent + '% off' : cpn.discountKas + ' KAS off'}
                          {cpn.description ? ' — ' + cpn.description : ''}
                        </Text>
                        <Text style={{ fontSize: rs.font(10), color: COLORS.stone400, marginTop: 2 }}>
                          Used {cpn.usedCount}/{cpn.maxUses} • {daysLeft > 0 ? daysLeft + ' days left' : 'Expired'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                        <TouchableOpacity onPress={() => { setEditingCoupon(cpn); setCouponForm({ code: cpn.code, discountPercent: cpn.discountPercent?.toString() || '', discountKas: cpn.discountKas?.toString() || '', maxUses: cpn.maxUses?.toString() || '10', expiryDays: cpn.expiryDays?.toString() || '30', description: cpn.description || '' }); setShowCouponForm(true); }}>
                          <Edit3 size={rs.s(16)} color={COLORS.blue600} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Alert.alert('Delete?', 'Remove coupon ' + cpn.code + '?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setCoupons(prev => prev.filter(c => c.id !== cpn.id)) }])}>
                          <Trash2 size={rs.s(16)} color={COLORS.red600} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}

              {coupons.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: rs.s(20) }}>
                  <Text style={{ fontSize: rs.font(13), color: COLORS.amber600, fontStyle: 'italic' }}>No coupons yet</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => { setEditingCoupon(null); setCouponForm({ code: '', discountPercent: '', discountKas: '', maxUses: '10', expiryDays: '30', description: '' }); setShowCouponForm(true); }}
                style={{ backgroundColor: COLORS.amber600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: rs.s(8), marginTop: rs.s(8) }}>
                <Plus size={rs.s(16)} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Create Coupon</Text>
              </TouchableOpacity>
            </SectionCard>

            {/* Visibility Score */}
            <SectionCard title="📊 Mailbox Visibility Score">
              <Text style={{ fontSize: rs.font(10), color: COLORS.stone500, marginBottom: rs.s(10) }}>
                This score determines how high your store ranks in buyer mailboxes.
              </Text>
              {(() => {
                const vis = calcVisibilityScore(userXp, 80, coupons.length > 0 ? 0.8 : 0.5, 0, 1);
                return (
                  <View>
                    <View style={{ alignItems: 'center', marginBottom: rs.s(12) }}>
                      <Text style={{ fontSize: rs.font(42), fontWeight: '900', color: vis.total >= 60 ? COLORS.green600 : vis.total >= 30 ? COLORS.amber600 : COLORS.red600 }}>{vis.total}</Text>
                      <Text style={{ fontSize: rs.font(11), color: COLORS.stone500 }}>out of 100</Text>
                    </View>
                    {[
                      { label: 'XP (30%)', score: vis.xpScore, color: '#4f46e5', tip: 'Complete agreements to earn XP' },
                      { label: 'Runway (25%)', score: vis.runwayScore, color: '#16a34a', tip: 'Pledge duration remaining' },
                      { label: 'Price (25%)', score: vis.priceScore, color: '#d97706', tip: 'Lower prices + coupons = higher score' },
                      { label: 'Pledge (10%)', score: vis.pledgeScore, color: '#9333ea', tip: 'KAS pledged (max 2500)' },
                      { label: 'Fresh (10%)', score: vis.freshnessScore, color: '#0891b2', tip: '24hr half-life decay' },
                    ].map(row => (
                      <View key={row.label} style={{ marginBottom: rs.s(8) }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: rs.font(10), fontWeight: 'bold', color: COLORS.stone600 }}>{row.label}</Text>
                          <Text style={{ fontSize: rs.font(10), color: COLORS.stone500 }}>{row.score}%</Text>
                        </View>
                        <View style={{ height: rs.s(8), backgroundColor: COLORS.stone200, borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: row.score + '%', backgroundColor: row.color, borderRadius: 4 }} />
                        </View>
                        <Text style={{ fontSize: rs.font(8), color: COLORS.stone400, marginTop: 1 }}>{row.tip}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </SectionCard>

            {/* Coupon Form Modal */}
            <Modal visible={showCouponForm} animationType="slide" transparent>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: rs.s(20) }}>
                <View style={{ backgroundColor: COLORS.cardBg, borderRadius: rs.s(20), padding: rs.s(20) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs.s(16) }}>
                    <Text style={{ fontSize: rs.font(18), fontWeight: '900', color: COLORS.amber900 }}>{editingCoupon ? '✏️ Edit Coupon' : '🎟️ New Coupon'}</Text>
                    <TouchableOpacity onPress={() => { setShowCouponForm(false); setEditingCoupon(null); }}>
                      <X size={rs.s(20)} color={COLORS.stone500} />
                    </TouchableOpacity>
                  </View>
                  <InputField label="Coupon Code" value={couponForm.code} onChangeText={(t) => setCouponForm(p => ({ ...p, code: t.toUpperCase() }))} placeholder="WELCOME10" />
                  <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                    <View style={{ flex: 1 }}>
                      <InputField label="Discount %" value={couponForm.discountPercent} onChangeText={(t) => setCouponForm(p => ({ ...p, discountPercent: t, discountKas: '' }))} placeholder="10" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField label="— OR — Fixed KAS" value={couponForm.discountKas} onChangeText={(t) => setCouponForm(p => ({ ...p, discountKas: t, discountPercent: '' }))} placeholder="5" keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: rs.s(10) }}>
                    <View style={{ flex: 1 }}>
                      <InputField label="Max Uses" value={couponForm.maxUses} onChangeText={(t) => setCouponForm(p => ({ ...p, maxUses: t }))} placeholder="10" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField label="Expires (days)" value={couponForm.expiryDays} onChangeText={(t) => setCouponForm(p => ({ ...p, expiryDays: t }))} placeholder="30" keyboardType="numeric" />
                    </View>
                  </View>
                  <InputField label="Description (optional)" value={couponForm.description} onChangeText={(t) => setCouponForm(p => ({ ...p, description: t }))} placeholder="First-time buyer discount" />
                  <TouchableOpacity onPress={handleSaveCoupon}
                    style={{ backgroundColor: COLORS.green600, borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center', marginTop: rs.s(8) }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>{editingCoupon ? 'Save Changes' : 'Create Coupon'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        )}`;

// Find where to insert — before DApps tab
if (!s.includes("{/* Coupons Tab */}")) {
  const dappsMarker = "        {/* DApps Tab */}";
  const dappsIdx = s.indexOf(dappsMarker);
  if (dappsIdx >= 0) {
    s = s.slice(0, dappsIdx) + couponsTabContent + '\n        \n' + s.slice(dappsIdx);
    changes++; console.log('5: Added Coupons tab with chart + visibility score');
  } else {
    console.log('5: WARN - DApps marker not found');
  }
} else {
  console.log('5: Coupons tab already exists');
}

fs.writeFileSync(f, s);
console.log('\nTotal changes:', changes);

const v = fs.readFileSync(f, 'utf8');
console.log('Verify - coupon state:', v.includes('coupons, setCoupons'));
console.log('Verify - handleSaveCoupon:', v.includes('handleSaveCoupon'));
console.log('Verify - visibility calc:', v.includes('calcVisibilityScore'));
console.log('Verify - bar chart SVG:', v.includes('Usage Overview'));
console.log('Verify - coupon form modal:', v.includes('New Coupon'));
console.log('Verify - weights correct (price 25%):', v.includes('priceScore * 0.25'));
console.log('Verify - weights correct (pledge 10%):', v.includes('pledgeScore * 0.10'));
console.log('Verify - 24hr half-life:', v.includes('ageHours / 24'));
