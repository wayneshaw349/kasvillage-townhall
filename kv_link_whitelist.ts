// kv_link_whitelist.ts — the ONLY outside places a listing (store, DApp, academic, game card,
// contact button) may send someone. Host must equal a listed domain or be a subdomain of it;
// https only; plus mailto:. X/Twitter is deliberately NOT listed.
export const MEDIA_DOMAINS = [
  'instagram.com', 'cdninstagram.com', 'fbcdn.net',
  'tiktok.com', 'tiktokcdn.com',
  'etsy.com', 'etsystatic.com',
  'pinterest.com', 'pinimg.com',
  'youtube.com', 'youtu.be', 'ytimg.com', 'ggpht.com',
  'facebook.com', 'twitch.tv',
];
export const CONTACT_DOMAINS = [
  't.me', 'telegram.me',          // Telegram
  'wa.me', 'whatsapp.com',        // WhatsApp
  'ig.me',                        // Instagram DM
  'm.me', 'messenger.com',        // FB Messenger
  'signal.me',                    // Signal
  'discord.gg', 'discord.com',    // Discord
];
// Academic papers: any university (.edu) plus the standard open repositories.
export const ACADEMIC_DOMAINS = ['arxiv.org', 'doi.org', 'zenodo.org', 'ssrn.com', 'osf.io', 'researchgate.net', 'semanticscholar.org'];
export const ALLOWED_LINK_DOMAINS = [...MEDIA_DOMAINS, ...CONTACT_DOMAINS, ...ACADEMIC_DOMAINS];

export function isWhitelistedUrl(url: string): boolean {
  const u = String(url || '').trim();
  // AUDIT pass 3: browsers treat "\" as "/" and strip tabs/newlines, so "https://evil.com\.youtube.com"
  // opened evil.com. Refuse backslashes, whitespace, control and non-ASCII characters anywhere.
  if (/[\\\s\u0000-\u001f\u007f-\uffff]/.test(u)) return false;
  if (/^mailto:[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(u)) return true;
  const m = /^https:\/\/([^\/?#:@]+)(?::\d+)?(?:[\/?#]|$)/i.exec(u);
  if (!m) return false;
  const host = m[1].toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  if (host === 'edu' || /\.edu$/.test(host)) return true;
  return ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

/** Open only whitelisted links (https or mailto); anything else is refused with a short note. */
export function openWhitelisted(raw: string): Promise<void> {  // returns a promise so callers' .catch() still works
  const { Alert, Linking } = require('react-native');
  const u = String(raw || '').trim();
  const url = /^mailto:/i.test(u) ? u : /^https?:\/\//i.test(u) ? u.replace(/^http:/i, 'https:') : 'https://' + u.replace(/^\/+/, '');
  if (!isWhitelistedUrl(url)) {
    return Promise.resolve(Alert.alert('Link not opened', 'Listings can only link to approved sites: Instagram, TikTok, Etsy, Pinterest, YouTube, Facebook, Twitch, a chat app (Telegram, WhatsApp, Messenger, Signal, Discord), email, or a university / paper repository.\n\nUse TownHall → Check a link if you want to look at it anyway.\n\n' + u));
  }
  return Linking.openURL(url).catch(() => {});
}

