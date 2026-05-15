// ============================================================================
// KASVILLAGE EXPO - STOREFRONT VIEWER COMPONENT
// ============================================================================
// Migrated from frontend.jsx StorefrontViewer
// What buyers see when visiting a store
// Includes:
// - Whitelist image domain validation
// - Hero/brand bar/product cards/social blocks
// - Coupons section with social links
// - Stash items display
// - Neighbor Agreement CTA
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Image,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  X,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ShoppingBag,
  MessageCircle,
  Handshake,
  Store,
  Tag,
  Package,
} from 'lucide-react-native';

// ============================================================================
// RESPONSIVE SCALER
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.2);

const rs = {
  s: (size: number) => Math.round(size * scale),
  font: (size: number) => Math.round(size * scale * (PixelRatio.getFontScale() > 1 ? 0.9 : 1)),
  w: (pct: number) => Math.round((SCREEN_WIDTH * pct) / 100),
};

// ============================================================================
// COLORS
// ============================================================================
const COLORS = {
  cardBg: '#FFF8F0',
  white: '#FFFFFF',
  black: '#000000',
  
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber300: '#fcd34d',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  amber900: '#78350f',
  
  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange200: '#fed7aa',
  orange500: '#f97316',
  orange600: '#ea580c',
  
  purple500: '#a855f7',
  purple600: '#9333ea',
  
  pink500: '#ec4899',
  
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  
  green100: '#dcfce7',
  green500: '#22c55e',
  green600: '#16a34a',
  
  red500: '#ef4444',
  red600: '#dc2626',
  
  sky500: '#0ea5e9',
};

// ============================================================================
// WHITELISTED IMAGE DOMAINS
// For safety, only moderated Big Tech platforms allowed
// ============================================================================
const ALLOWED_IMAGE_DOMAINS: Record<string, string> = {
  Instagram: 'instagram.com',
  TikTok: 'tiktok.com',
  Etsy: 'etsy.com',
  Pinterest: 'pinterest.com',
  YouTube: 'youtube.com',
  Facebook: 'facebook.com',
};

// Alternative domain patterns (CDNs, etc.)
const ALLOWED_DOMAIN_PATTERNS = [
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  'tiktok.com',
  'tiktokcdn.com',
  'etsy.com',
  'etsystatic.com',
  'pinterest.com',
  'pinimg.com',
  'youtube.com',
  'ytimg.com',
  'ggpht.com',
  'facebook.com',
];

/**
 * Validate if URL is from a whitelisted domain
 */
const isWhitelistedUrl = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return ALLOWED_DOMAIN_PATTERNS.some(domain => lowerUrl.includes(domain));
};

/**
 * Get platform name from URL
 */
const getPlatformFromUrl = (url: string): string | null => {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('cdninstagram.com') || lowerUrl.includes('fbcdn.net')) {
    return 'Instagram';
  }
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('tiktokcdn.com')) {
    return 'TikTok';
  }
  if (lowerUrl.includes('etsy.com') || lowerUrl.includes('etsystatic.com')) {
    return 'Etsy';
  }
  if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pinimg.com')) {
    return 'Pinterest';
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('ytimg.com') || lowerUrl.includes('ggpht.com')) {
    return 'YouTube';
  }
  if (lowerUrl.includes('facebook.com')) {
    return 'Facebook';
  }
  return null;
};

// ============================================================================
// SOCIAL PLATFORM STYLING
// ============================================================================
const PLATFORM_STYLES: Record<string, { bg: string; emoji: string }> = {
  Instagram: { bg: '#E1306C', emoji: '📸' },
  TikTok: { bg: '#000000', emoji: '🎵' },
  Etsy: { bg: '#F56400', emoji: '🛍' },
  Pinterest: { bg: '#E60023', emoji: '📌' },
  YouTube: { bg: '#FF0000', emoji: '▶' },
  Facebook: { bg: '#1877F2', emoji: '📘' },
};

// ============================================================================
// COMMUNICATION CHANNELS (for contacting seller)
// ============================================================================
const COMMUNICATION_CHANNELS = [
  { id: 'telegram', label: 'Telegram', emoji: '✈️', bg: '#0088cc' },
  { id: 'messenger', label: 'FB Messenger', emoji: '💬', bg: '#0084FF' },
  { id: 'instagram_dm', label: 'Instagram DM', emoji: '📸', bg: '#E1306C' },
];

// ============================================================================
// DEFAULT THEME
// ============================================================================
const DEFAULT_THEME = {
  primary: '#78350f',
  accent: '#f97316',
  secondary: '#fef3c7',
  background: '#ffffff',
};

// ============================================================================
// CITADEL BUYER CHECK (9 traits = Resident)
// ============================================================================
const CITADEL_BUYER_THRESHOLD = 9;

const AVATAR_TO_TRAIT_MAP: Record<string, string> = {
  name: 'name',
  race: 'race',
  class: 'class',
  personality: 'personality',
  occupation: 'occupation',
  animal: 'animal',
  originStory: 'origin_story',
  definingMoment: 'defining_moment',
  formativeMemory: 'formative_memory',
  lifePhilosophy: 'life_philosophy',
  weakness: 'weakness',
  signatureMove: 'signature_move',
  combatStyle: 'combat_style',
  loreOrigin: 'lore_origin',
  powerSpike: 'power_spike',
  voiceLine: 'voice_line',
  mutant: 'mutant',
  mutate: 'mutate',
};

// ============================================================================
// SECTION PREVIEW COMPONENTS
// ============================================================================
interface SectionPreviewProps {
  section: any;
  theme: typeof DEFAULT_THEME;
  storefront: any;
}

const HeroSection: React.FC<SectionPreviewProps> = ({ section, theme }) => (
  <View style={[sectionStyles.hero, { backgroundColor: theme.primary }]}>
    <Text style={sectionStyles.heroTitle}>{section.title || 'Store Name'}</Text>
    <Text style={sectionStyles.heroSubtitle}>{section.subtitle || 'Welcome to our store'}</Text>
  </View>
);

const BrandBarSection: React.FC<SectionPreviewProps> = ({ section, theme, storefront }) => (
  <View style={sectionStyles.brandBar}>
    {storefront?.logoUrl && isWhitelistedUrl(storefront.logoUrl) ? (
      <Image
        source={{ uri: storefront.logoUrl }}
        style={[
          sectionStyles.brandLogo,
          storefront.logoShape === 'square' ? { borderRadius: rs.s(8) } : { borderRadius: rs.s(20) }
        ]}
      />
    ) : (
      <View style={sectionStyles.brandLogoPlaceholder}>
        <Store size={rs.s(20)} color={COLORS.stone500} />
      </View>
    )}
    <View>
      <Text style={[sectionStyles.brandName, { color: theme.primary }]}>
        {section.brandName || storefront?.brandName || 'Store Name'}
      </Text>
      <Text style={sectionStyles.brandTagline}>{section.tagline || 'Quality products'}</Text>
    </View>
  </View>
);

const ProductCardSection: React.FC<SectionPreviewProps> = ({ section, theme, storefront }) => {
  const platform = section.visualsPlatform || getPlatformFromUrl(section.visualsUrl);
  const platformStyle = platform ? PLATFORM_STYLES[platform] : null;
  
  const handleViewOnSocial = () => {
    if (section.visualsUrl && isWhitelistedUrl(section.visualsUrl)) {
      Linking.openURL(section.visualsUrl);
    } else if (section.visualsUrl) {
      Alert.alert('Invalid Link', 'This link is not from an approved platform.');
    }
  };
  
  return (
    <View style={sectionStyles.productCard}>
      <Text style={[sectionStyles.productName, { color: theme.primary }]}>
        {section.name || 'Product Name'}
      </Text>
      <Text style={sectionStyles.productDescription}>
        {section.description || 'Short description of your product'}
      </Text>
      {section.price && (
        <Text style={[sectionStyles.productPrice, { color: theme.accent }]}>
          {section.price}
        </Text>
      )}
      
      {section.visualsUrl && isWhitelistedUrl(section.visualsUrl) ? (
        <TouchableOpacity
          style={[sectionStyles.viewButton, { backgroundColor: platformStyle?.bg || COLORS.stone700 }]}
          onPress={handleViewOnSocial}
        >
          <Text style={sectionStyles.viewButtonText}>
            {platformStyle?.emoji || '🔗'} View on {platform || 'Social'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={sectionStyles.noLinkNotice}>
          <Text style={sectionStyles.noLinkText}>
            Link a stash item to add a social link
          </Text>
        </View>
      )}
      
      <View style={sectionStyles.dmNotice}>
        <Text style={sectionStyles.dmNoticeTitle}>💬 DM the seller to express interest</Text>
        <Text style={sectionStyles.dmNoticeSubtitle}>
          Then use Neighbor Agreement to complete purchase on L2
        </Text>
      </View>
    </View>
  );
};

const SocialBlockSection: React.FC<SectionPreviewProps> = ({ section, theme, storefront }) => {
  const socialLinks = storefront?.socialLinks || {};
  
  const platforms = [
    { id: 'instagram', emoji: '📸', label: 'Instagram' },
    { id: 'tiktok', emoji: '🎵', label: 'TikTok' },
    { id: 'etsy', emoji: '🛍️', label: 'Etsy' },
    { id: 'pinterest', emoji: '📌', label: 'Pinterest' },
    { id: 'youtube', emoji: '▶️', label: 'YouTube' },
  ];
  
  return (
    <View style={[sectionStyles.socialBlock, { backgroundColor: theme.secondary }]}>
      <Text style={[sectionStyles.socialTitle, { color: theme.primary }]}>
        {section.title || 'View Our Products'}
      </Text>
      <Text style={sectionStyles.socialSubtitle}>
        {section.subtitle || 'Click to browse our full catalog'}
      </Text>
      <View style={sectionStyles.socialIcons}>
        {platforms.map(p => {
          const url = socialLinks[p.id];
          const hasLink = url && isWhitelistedUrl(url);
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                sectionStyles.socialIcon,
                { backgroundColor: hasLink ? (PLATFORM_STYLES[p.label]?.bg || COLORS.stone700) : COLORS.stone200 }
              ]}
              onPress={() => hasLink && Linking.openURL(url)}
              disabled={!hasLink}
            >
              <Text style={[sectionStyles.socialEmoji, !hasLink && { opacity: 0.3 }]}>
                {p.emoji}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const TextBlockSection: React.FC<SectionPreviewProps> = ({ section }) => (
  <View style={sectionStyles.textBlock}>
    <Text style={[sectionStyles.textContent, { textAlign: section.alignment || 'left' }]}>
      {section.content || 'Your custom text here'}
    </Text>
  </View>
);

const SpacerSection: React.FC<{ section: any }> = ({ section }) => (
  <View style={{ height: section.height || rs.s(32) }} />
);

const SectionPreview: React.FC<SectionPreviewProps> = ({ section, theme, storefront }) => {
  switch (section.type) {
    case 'hero':
      return <HeroSection section={section} theme={theme} storefront={storefront} />;
    case 'brand_bar':
      return <BrandBarSection section={section} theme={theme} storefront={storefront} />;
    case 'product_card':
      return <ProductCardSection section={section} theme={theme} storefront={storefront} />;
    case 'social_block':
      return <SocialBlockSection section={section} theme={theme} storefront={storefront} />;
    case 'text_block':
      return <TextBlockSection section={section} theme={theme} storefront={storefront} />;
    case 'spacer':
      return <SpacerSection section={section} />;
    default:
      return null;
  }
};

const sectionStyles = StyleSheet.create({
  // Hero
  hero: {
    padding: rs.s(32),
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: rs.font(24),
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: rs.s(4),
  },
  heroSubtitle: {
    fontSize: rs.font(14),
    color: COLORS.white,
    opacity: 0.9,
  },
  
  // Brand Bar
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(12),
    padding: rs.s(12),
    backgroundColor: 'rgba(255,248,240,0.8)',
  },
  brandLogo: {
    width: rs.s(40),
    height: rs.s(40),
  },
  brandLogoPlaceholder: {
    width: rs.s(40),
    height: rs.s(40),
    borderRadius: rs.s(20),
    backgroundColor: COLORS.stone200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
  },
  brandTagline: {
    fontSize: rs.font(11),
    color: COLORS.stone600,
  },
  
  // Product Card
  productCard: {
    margin: rs.s(12),
    padding: rs.s(16),
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    borderWidth: 1,
    borderColor: COLORS.stone200,
  },
  productName: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    marginBottom: rs.s(4),
  },
  productDescription: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
    marginBottom: rs.s(8),
  },
  productPrice: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    marginBottom: rs.s(12),
  },
  viewButton: {
    paddingVertical: rs.s(12),
    borderRadius: rs.s(12),
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  viewButtonText: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  noLinkNotice: {
    padding: rs.s(8),
    alignItems: 'center',
  },
  noLinkText: {
    fontSize: rs.font(10),
    color: COLORS.stone400,
    fontStyle: 'italic',
  },
  dmNotice: {
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(8),
    borderWidth: 1,
    borderColor: COLORS.amber200,
    padding: rs.s(8),
    alignItems: 'center',
  },
  dmNoticeTitle: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.amber700,
  },
  dmNoticeSubtitle: {
    fontSize: rs.font(9),
    color: COLORS.stone500,
    marginTop: rs.s(2),
  },
  
  // Social Block
  socialBlock: {
    padding: rs.s(24),
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    marginBottom: rs.s(4),
  },
  socialSubtitle: {
    fontSize: rs.font(12),
    color: COLORS.stone600,
    marginBottom: rs.s(16),
  },
  socialIcons: {
    flexDirection: 'row',
    gap: rs.s(12),
  },
  socialIcon: {
    width: rs.s(48),
    height: rs.s(48),
    borderRadius: rs.s(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialEmoji: {
    fontSize: rs.font(20),
  },
  
  // Text Block
  textBlock: {
    padding: rs.s(16),
    backgroundColor: COLORS.cardBg,
  },
  textContent: {
    fontSize: rs.font(14),
    color: COLORS.stone700,
  },
});

// ============================================================================
// COUPON CARD
// ============================================================================
interface CouponCardProps {
  coupon: any;
  storefront: any;
  onStartAgreement: (coupon: any) => void;
}

const CouponCard: React.FC<CouponCardProps> = ({ coupon, storefront, onStartAgreement }) => {
  const socialLinks = storefront?.socialLinks || {};
  const hasSocial = Object.values(socialLinks).some(v => v && isWhitelistedUrl(v as string));
  
  const platforms = [
    { key: 'instagram', label: '📸 Instagram', bg: '#E1306C' },
    { key: 'tiktok', label: '🎵 TikTok', bg: '#000000' },
    { key: 'etsy', label: '🛍 Etsy', bg: '#F56400' },
    { key: 'pinterest', label: '📌 Pinterest', bg: '#E60023' },
    { key: 'youtube', label: '▶ YouTube', bg: '#FF0000' },
  ];
  
  const handleViewOnPlatform = () => {
    if (coupon.visualsUrl && isWhitelistedUrl(coupon.visualsUrl)) {
      Linking.openURL(coupon.visualsUrl);
    }
  };
  
  return (
    <View style={couponStyles.card}>
      {/* Header */}
      <View style={couponStyles.header}>
        <View style={couponStyles.headerLeft}>
          <Text style={couponStyles.description}>{coupon.description}</Text>
          <Text style={couponStyles.code}>Code: {coupon.code}</Text>
        </View>
        <View style={couponStyles.headerRight}>
          {coupon.discountPercent > 0 && (
            <Text style={couponStyles.discount}>{coupon.discountPercent}% OFF</Text>
          )}
          {coupon.discountedKaspa > 0 && (
            <Text style={couponStyles.kasPrice}>{coupon.discountedKaspa} KAS</Text>
          )}
        </View>
      </View>
      
      {/* Social Links */}
      {hasSocial && (
        <View style={couponStyles.socialSection}>
          <Text style={couponStyles.socialLabel}>VIEW ITEM ON:</Text>
          <View style={couponStyles.socialButtons}>
            {platforms.map(({ key, label, bg }) => {
              const url = socialLinks[key];
              if (!url || !isWhitelistedUrl(url as string)) return null;
              return (
                <TouchableOpacity
                  key={key}
                  style={[couponStyles.socialButton, { backgroundColor: bg }]}
                  onPress={() => Linking.openURL(url as string)}
                >
                  <Text style={couponStyles.socialButtonText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      
      {/* View Item Button */}
      {coupon.visualsUrl && isWhitelistedUrl(coupon.visualsUrl) && (
        <TouchableOpacity
          style={[
            couponStyles.viewItemButton,
            { backgroundColor: PLATFORM_STYLES[coupon.visualsPlatform]?.bg || COLORS.stone700 }
          ]}
          onPress={handleViewOnPlatform}
        >
          <Text style={couponStyles.viewItemText}>
            {PLATFORM_STYLES[coupon.visualsPlatform]?.emoji || '🔗'} View Item on {coupon.visualsPlatform || 'Social'}
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Communication Channels */}
      <View style={couponStyles.commSection}>
        <Text style={couponStyles.commLabel}>CONTACT SELLER VIA:</Text>
        <View style={couponStyles.commButtons}>
          {COMMUNICATION_CHANNELS.map(ch => (
            <View key={ch.id} style={[couponStyles.commButton, { backgroundColor: ch.bg }]}>
              <Text style={couponStyles.commButtonText}>{ch.emoji} {ch.label}</Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* DM Notice */}
      <View style={couponStyles.dmBox}>
        <Text style={couponStyles.dmTitle}>💬 Message the seller to express interest</Text>
        <Text style={couponStyles.dmSubtitle}>Then use Neighbor Agreement to pay safely on KasVillage L2</Text>
      </View>
      
      {/* Neighbor Agreement CTA */}
      <TouchableOpacity
        style={couponStyles.agreementButton}
        onPress={() => onStartAgreement(coupon)}
      >
        <Handshake size={rs.s(16)} color={COLORS.white} />
        <Text style={couponStyles.agreementButtonText}>Start Neighbor Agreement</Text>
      </TouchableOpacity>
    </View>
  );
};

const couponStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    borderWidth: 1,
    borderColor: COLORS.amber200,
    padding: rs.s(16),
    marginBottom: rs.s(12),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(12),
  },
  headerLeft: {
    flex: 1,
  },
  description: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone800,
  },
  code: {
    fontSize: rs.font(11),
    fontFamily: 'monospace',
    color: COLORS.amber700,
    marginTop: rs.s(2),
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  discount: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.green600,
  },
  kasPrice: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
  },
  socialSection: {
    marginBottom: rs.s(12),
  },
  socialLabel: {
    fontSize: rs.font(9),
    fontWeight: 'bold',
    color: COLORS.stone500,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
  },
  socialButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs.s(8),
  },
  socialButton: {
    paddingHorizontal: rs.s(10),
    paddingVertical: rs.s(6),
    borderRadius: rs.s(6),
  },
  socialButtonText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  viewItemButton: {
    paddingVertical: rs.s(12),
    borderRadius: rs.s(12),
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  viewItemText: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  dmBox: {
    backgroundColor: COLORS.amber50,
    borderRadius: rs.s(8),
    borderWidth: 1,
    borderColor: COLORS.amber200,
    padding: rs.s(8),
    alignItems: 'center',
    marginBottom: rs.s(12),
  },
  dmTitle: {
    fontSize: rs.font(10),
    fontWeight: 'bold',
    color: COLORS.amber800,
  },
  dmSubtitle: {
    fontSize: rs.font(9),
    color: COLORS.stone500,
    marginTop: rs.s(2),
  },
  commSection: {
    marginBottom: rs.s(12),
  },
  commLabel: {
    fontSize: rs.font(9),
    fontWeight: 'bold',
    color: COLORS.stone500,
    textTransform: 'uppercase',
    marginBottom: rs.s(8),
  },
  commButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs.s(8),
  },
  commButton: {
    paddingHorizontal: rs.s(10),
    paddingVertical: rs.s(6),
    borderRadius: rs.s(6),
  },
  commButtonText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.white,
  },
  agreementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs.s(8),
    backgroundColor: COLORS.indigo600,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(14),
  },
  agreementButtonText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

// ============================================================================
// STASH ITEM CARD
// ============================================================================
interface StashItemCardProps {
  item: any;
}

const StashItemCard: React.FC<StashItemCardProps> = ({ item }) => {
  const platform = item.visualsPlatform || getPlatformFromUrl(item.visualsUrl);
  const platformStyle = platform ? PLATFORM_STYLES[platform] : null;
  
  return (
    <View style={stashStyles.card}>
      <Text style={stashStyles.name}>{item.name || item.title}</Text>
      {item.description && (
        <Text style={stashStyles.description}>{item.description}</Text>
      )}
      {item.kaspaPrice > 0 && (
        <Text style={stashStyles.price}>{item.kaspaPrice.toLocaleString()} KAS</Text>
      )}
      {item.visualsUrl && isWhitelistedUrl(item.visualsUrl) && (
        <TouchableOpacity
          style={[stashStyles.viewButton, { backgroundColor: platformStyle?.bg || COLORS.stone700 }]}
          onPress={() => Linking.openURL(item.visualsUrl)}
        >
          <Text style={stashStyles.viewButtonText}>
            {platformStyle?.emoji || '🔗'} View on {platform || 'Social'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const stashStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: rs.s(12),
    borderWidth: 1,
    borderColor: COLORS.stone200,
    padding: rs.s(12),
    margin: rs.s(4),
  },
  name: {
    fontSize: rs.font(13),
    fontWeight: 'bold',
    color: COLORS.stone800,
    marginBottom: rs.s(4),
  },
  description: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
    marginBottom: rs.s(8),
  },
  price: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.amber600,
    marginBottom: rs.s(8),
  },
  viewButton: {
    paddingVertical: rs.s(8),
    borderRadius: rs.s(8),
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: rs.font(11),
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

// ============================================================================
// CITADEL GATE (9 traits for buyers)
// ============================================================================
interface CitadelGateProps {
  filledTraits: number;
  onClose: () => void;
}

const CitadelGate: React.FC<CitadelGateProps> = ({ filledTraits, onClose }) => (
  <View style={gateStyles.container}>
    <View style={gateStyles.iconContainer}>
      <ShieldCheck size={rs.s(40)} color={COLORS.amber600} />
    </View>
    <Text style={gateStyles.title}>🏰 Citadel Resident Required</Text>
    <Text style={gateStyles.subtitle}>
      Complete at least 9 Avatar traits to browse storefronts and make purchases.
    </Text>
    
    {/* Progress */}
    <View style={gateStyles.progressContainer}>
      <View style={gateStyles.progressHeader}>
        <Text style={gateStyles.progressLabel}>Progress</Text>
        <Text style={[gateStyles.progressCount, filledTraits >= 9 && { color: COLORS.green600 }]}>
          {filledTraits}/9
        </Text>
      </View>
      <View style={gateStyles.progressBar}>
        <View style={[
          gateStyles.progressFill,
          { width: `${Math.min(100, (filledTraits / 9) * 100)}%` }
        ]} />
      </View>
    </View>
    
    <Text style={gateStyles.footer}>
      Go to your Avatar profile to complete your identity.
    </Text>
    
    <TouchableOpacity style={gateStyles.closeBtn} onPress={onClose}>
      <Text style={gateStyles.closeBtnText}>Close</Text>
    </TouchableOpacity>
  </View>
);

const gateStyles = StyleSheet.create({
  container: {
    padding: rs.s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: rs.s(80),
    height: rs.s(80),
    backgroundColor: COLORS.amber100,
    borderRadius: rs.s(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rs.s(24),
  },
  title: {
    fontSize: rs.font(20),
    fontWeight: '900',
    color: COLORS.amber900,
    marginBottom: rs.s(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: rs.font(13),
    color: COLORS.stone600,
    textAlign: 'center',
    marginBottom: rs.s(24),
    paddingHorizontal: rs.s(16),
  },
  progressContainer: {
    width: '100%',
    maxWidth: rs.s(240),
    marginBottom: rs.s(24),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: rs.s(4),
  },
  progressLabel: {
    fontSize: rs.font(12),
    color: COLORS.stone500,
  },
  progressCount: {
    fontSize: rs.font(12),
    fontWeight: 'bold',
    color: COLORS.amber600,
  },
  progressBar: {
    height: rs.s(12),
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(6),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.amber500,
    borderRadius: rs.s(6),
  },
  footer: {
    fontSize: rs.font(11),
    color: COLORS.stone400,
    textAlign: 'center',
    marginBottom: rs.s(24),
  },
  closeBtn: {
    backgroundColor: COLORS.stone200,
    borderRadius: rs.s(12),
    paddingVertical: rs.s(12),
    paddingHorizontal: rs.s(32),
  },
  closeBtnText: {
    fontSize: rs.font(14),
    fontWeight: 'bold',
    color: COLORS.stone700,
  },
});

// ============================================================================
// MAIN STOREFRONT VIEWER COMPONENT
// ============================================================================
export interface StorefrontViewerProps {
  visible: boolean;
  hostId: string;
  hostName: string;
  visitorPubkey?: string;
  onClose: () => void;
  onStartNeighborAgreement?: (coupon: any, hostId: string) => void;
}

export const StorefrontViewer: React.FC<StorefrontViewerProps> = ({
  visible,
  hostId,
  hostName,
  visitorPubkey,
  onClose,
  onStartNeighborAgreement,
}) => {
  const [storefront, setStorefront] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filledTraits, setFilledTraits] = useState(0);
  const [hasResidentAccess, setHasResidentAccess] = useState(false);
  
  // Load avatar and check Citadel status
  useEffect(() => {
    const checkCitadel = async () => {
      try {
        const avatarJson = await SecureStore.getItemAsync('kv_avatar');
        if (avatarJson) {
          const avatar = JSON.parse(avatarJson);
          const filled = Object.entries(AVATAR_TO_TRAIT_MAP)
            .filter(([avatarKey]) => avatar[avatarKey] && avatar[avatarKey].length > 2)
            .length;
          setFilledTraits(filled);
          setHasResidentAccess(filled >= CITADEL_BUYER_THRESHOLD);
        }
      } catch (e) {
        console.error('Failed to check Citadel status:', e);
      }
    };
    checkCitadel();
  }, []);
  
  // Load storefront data
  useEffect(() => {
    const loadStorefront = async () => {
      if (!hostId) return;
      setLoading(true);
      
      try {
        // Try SecureStore cache first
        const cacheKey = `storefront_${hostId}`;
        const stored = await SecureStore.getItemAsync(cacheKey);
        
        if (stored) {
          const cached = JSON.parse(stored);
          const age = Date.now() - (cached.cachedAt || 0);
          
          // Use cache if fresh (< 5 min)
          if (age < 5 * 60 * 1000) {
            setStorefront(cached.data);
            setLoading(false);
            
            // Record visit in background
            if (visitorPubkey) {
              recordVisitAsync(hostId, visitorPubkey);
            }
            return;
          }
        }
        
        // Fetch from TownHall API
        const response = await fetch(
          `https://townhall.kasvillage.dev/api/storefront/${hostId}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.storefront) {
            setStorefront(data.storefront);
            
            // Cache it
            await SecureStore.setItemAsync(cacheKey, JSON.stringify({
              data: data.storefront,
              cachedAt: Date.now(),
            }));
          }
        } else if (stored) {
          // Fallback to stale cache
          setStorefront(JSON.parse(stored).data);
        }
        
        // Record visit
        if (visitorPubkey) {
          recordVisitAsync(hostId, visitorPubkey);
        }
      } catch (e) {
        console.error('Failed to load storefront:', e);
        
        // Try stale cache on error
        try {
          const stored = await SecureStore.getItemAsync(`storefront_${hostId}`);
          if (stored) {
            setStorefront(JSON.parse(stored).data);
          }
        } catch {}
      }
      
      setLoading(false);
    };
    
    if (visible) {
      loadStorefront();
    }
  }, [visible, hostId, visitorPubkey]);
  
  // Record visit in background (non-blocking)
  const recordVisitAsync = async (storefrontPubkey: string, visitorPubkey: string) => {
    try {
      const timestamp = Date.now();
      const message = `VISIT:${storefrontPubkey}:${visitorPubkey}:${timestamp}`;
      
      // Sign the visit (requires private key)
      const privKeyHex = await SecureStore.getItemAsync('kv_l1_privkey_enc');
      if (!privKeyHex) return;
      
      const { secp256k1 } = await import('@noble/curves/secp256k1');
      const { sha256 } = await import('@noble/hashes/sha256');
      
      const privKey = Uint8Array.from(Buffer.from(privKeyHex, 'hex'));
      const msgHash = sha256(new TextEncoder().encode(message));
      const sig = secp256k1.sign(msgHash, privKey);
      const signature = Buffer.from(sig.toCompactRawBytes()).toString('hex');
      
      await fetch(
        `https://townhall.kasvillage.dev/api/storefront/${storefrontPubkey}/visit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitor_pubkey: visitorPubkey,
            timestamp,
            source: 'direct',
            signature,
          }),
        }
      );
      
      // Track locally
      const historyJson = await SecureStore.getItemAsync('kv_storefront_visits');
      let history: { pubkey: string; lastVisit: number }[] = historyJson 
        ? JSON.parse(historyJson) 
        : [];
      
      const existing = history.find(h => h.pubkey === storefrontPubkey);
      if (existing) {
        existing.lastVisit = Date.now();
      } else {
        history.unshift({ pubkey: storefrontPubkey, lastVisit: Date.now() });
      }
      history = history.slice(0, 50);
      
      await SecureStore.setItemAsync('kv_storefront_visits', JSON.stringify(history));
    } catch (e) {
      console.warn('[StorefrontViewer] Visit record failed:', e);
    }
  };
  
  const handleStartAgreement = (coupon: any) => {
    if (onStartNeighborAgreement) {
      onStartNeighborAgreement(coupon, hostId);
    }
    onClose();
  };
  
  const theme = storefront?.theme || DEFAULT_THEME;
  
  // Filter out deployment coupons
  const activeCoupons = storefront?.coupons?.filter(
    (c: any) => c.type !== 'Deployment' && !c.code?.startsWith('DEPLOY-')
  ) || [];
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.background || COLORS.white }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.primary }]}>
            <View style={styles.headerLeft}>
              {storefront?.logoUrl && isWhitelistedUrl(storefront.logoUrl) ? (
                <Image
                  source={{ uri: storefront.logoUrl }}
                  style={[
                    styles.headerLogo,
                    storefront.logoShape === 'square' ? { borderRadius: rs.s(8) } : { borderRadius: rs.s(20) }
                  ]}
                />
              ) : null}
              <Text style={styles.headerTitle}>
                {storefront?.brandName || hostName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={rs.s(24)} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <ScrollView style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.amber600} />
                <Text style={styles.loadingText}>Loading storefront...</Text>
              </View>
            ) : !hasResidentAccess ? (
              <CitadelGate filledTraits={filledTraits} onClose={onClose} />
            ) : storefront ? (
              <View>
                {/* Sections */}
                {storefront.sections?.map((section: any, idx: number) => {
                  const enriched = section.type === 'hero'
                    ? { ...section, title: storefront.brandName || section.title }
                    : section.type === 'brand_bar'
                    ? { ...section, brandName: storefront.brandName || section.brandName }
                    : section;
                  return (
                    <SectionPreview
                      key={idx}
                      section={enriched}
                      theme={theme}
                      storefront={storefront}
                    />
                  );
                })}
                
                {(!storefront.sections || storefront.sections.length === 0) && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Storefront layout not yet configured.</Text>
                  </View>
                )}
                
                {/* Coupons Section */}
                {activeCoupons.length > 0 && (
                  <View style={styles.couponsSection}>
                    <Text style={styles.sectionTitle}>🎟️ Active Coupons</Text>
                    {activeCoupons.map((coupon: any, i: number) => (
                      <CouponCard
                        key={i}
                        coupon={coupon}
                        storefront={storefront}
                        onStartAgreement={handleStartAgreement}
                      />
                    ))}
                  </View>
                )}
                
                {/* Stash Section */}
                {storefront.stash?.length > 0 && (
                  <View style={styles.stashSection}>
                    <Text style={styles.sectionTitle}>📦 Items For Sale</Text>
                    <View style={styles.stashGrid}>
                      {storefront.stash.map((item: any, i: number) => (
                        <StashItemCard key={i} item={item} />
                      ))}
                    </View>
                  </View>
                )}
                
                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Powered by KasVillage L2</Text>
                </View>
              </View>
            ) : (
              <View style={styles.errorContainer}>
                <AlertTriangle size={rs.s(32)} color={COLORS.amber500} />
                <Text style={styles.errorText}>Could not load storefront. Please try again.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs.s(16),
  },
  modal: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: rs.s(24),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: rs.s(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs.s(12),
    flex: 1,
  },
  headerLogo: {
    width: rs.s(40),
    height: rs.s(40),
  },
  headerTitle: {
    fontSize: rs.font(18),
    fontWeight: '900',
    color: COLORS.white,
    flex: 1,
  },
  closeBtn: {
    width: rs.s(40),
    height: rs.s(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: rs.s(48),
    alignItems: 'center',
  },
  loadingText: {
    fontSize: rs.font(14),
    color: COLORS.stone600,
    marginTop: rs.s(12),
  },
  emptyContainer: {
    padding: rs.s(48),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
  },
  errorContainer: {
    padding: rs.s(48),
    alignItems: 'center',
  },
  errorText: {
    fontSize: rs.font(14),
    color: COLORS.stone500,
    marginTop: rs.s(12),
    textAlign: 'center',
  },
  couponsSection: {
    padding: rs.s(16),
    backgroundColor: COLORS.amber50,
    borderTopWidth: 1,
    borderTopColor: COLORS.amber200,
  },
  sectionTitle: {
    fontSize: rs.font(16),
    fontWeight: 'bold',
    color: COLORS.amber900,
    marginBottom: rs.s(12),
  },
  stashSection: {
    padding: rs.s(16),
    backgroundColor: COLORS.stone50,
    borderTopWidth: 1,
    borderTopColor: COLORS.stone200,
  },
  stashGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: rs.s(-4),
  },
  footer: {
    padding: rs.s(24),
    backgroundColor: COLORS.orange50,
    borderTopWidth: 1,
    borderTopColor: COLORS.orange200,
    alignItems: 'center',
  },
  footerText: {
    fontSize: rs.font(11),
    color: COLORS.stone500,
  },
});

export default StorefrontViewer;