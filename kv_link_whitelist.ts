// kv_link_whitelist.ts — the ONLY outside sites a store/listing may link to (moderated big
// platforms). Host must equal the domain or be a subdomain of it; https only.
export const ALLOWED_LINK_DOMAINS = [
  'instagram.com', 'cdninstagram.com', 'fbcdn.net',
  'tiktok.com', 'tiktokcdn.com',
  'etsy.com', 'etsystatic.com',
  'pinterest.com', 'pinimg.com',
  'youtube.com', 'youtu.be', 'ytimg.com', 'ggpht.com',
  'facebook.com',
];

export function isWhitelistedUrl(url: string): boolean {
  const m = /^https:\/\/([^\/?#:@]+)(?::\d+)?(?:[\/?#]|$)/i.exec(String(url || '').trim());
  if (!m) return false;
  const host = m[1].toLowerCase().replace(/\.$/, '');
  return ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

/** Open only whitelisted links; anything else is refused with a short note. */
export function openWhitelisted(raw: string): void {
  const { Alert, Linking } = require('react-native');
  const u = String(raw || '').trim();
  const url = /^https?:\/\//i.test(u) ? u.replace(/^http:/i, 'https:') : 'https://' + u.replace(/^\/+/, '');
  if (!isWhitelistedUrl(url)) {
    Alert.alert('Link not opened', 'Stores can only link to Instagram, TikTok, Etsy, Pinterest, YouTube or Facebook.\n\n' + u);
    return;
  }
  Linking.openURL(url).catch(() => {});
}
