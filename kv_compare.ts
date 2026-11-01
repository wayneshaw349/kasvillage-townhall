// KV_COMPARE: "Compare prices" next to a store item. Opens Google Shopping for the item name,
// sorted lowest price first, in the phone's OWN browser (never inside KasVillage). No key, no relay,
// nothing sent to any server of ours. Google picks and rates the stores, not KasVillage.
import { Alert, Linking } from 'react-native';

export function kvComparePrices(itemName: string): void {
  const q = String(itemName || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100);
  if (!q) return;
  const url = 'https://www.google.com/search?tbm=shop&tbs=p_ord:p&q=' + encodeURIComponent(q);
  Alert.alert('Compare prices',
    `Search Google Shopping for "${q}", lowest price first?\n\nOpens in your phone's browser. Google chooses and rates the stores - check store ratings, and paste any unfamiliar store into TownHall > Check a link first.`,
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Open', onPress: () => { Linking.openURL(url).catch(() => Alert.alert('Could not open', 'No browser accepted this link.')); } }]);
}
