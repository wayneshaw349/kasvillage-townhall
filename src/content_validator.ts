// ============================================================================
// CONTENT VALIDATOR - Exploitation phrase detection
// Shared across FROST flow, Workspace, Storefront
// Server enforces too — this is UX only
// ============================================================================

const EXPLOITATION_PATTERNS = [
  /\b(buy|sell|rent|hire|order)\s+(girl|boy|child|minor|teen|kid|infant)\b/i,
  /\b(young|underage|minor)\s+(female|male|escort|companion|model)\b/i,
  /\b(child|kid|minor|teen)\s+(for\s+sale|available|services|labor)\b/i,
  /\b(sex|slave|traffic)\s*(child|minor|girl|boy|teen|kid)\b/i,
  /\b(child|minor|teen|kid)\s*(sex|slave|traffic|bride|groom)\b/i,
  /\b(lolita|jailbait|pedo|paedo)\b/i,
  /\b(fresh|new|virgin)\s+(meat|girl|boy|stock)\b/i,
  /\b(human\s+trafficking|sex\s+trade|flesh\s+trade)\b/i,
];

export function validateContentText(text: string): string | null {
  if (!text) return null;
  for (const re of EXPLOITATION_PATTERNS) {
    if (re.test(text)) return 'Content rejected: prohibited phrase detected';
  }
  return null;
}
