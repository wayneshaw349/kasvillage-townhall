// ============================================================================
// KasVillage Spotify Auth — OAuth PKCE Flow for Expo
// No client secret needed (PKCE). Stores tokens in SecureStore.
// Scopes: user-read-playback-state, user-read-currently-playing
// ============================================================================

import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, useCallback, useRef } from 'react';

// ============================================================================
// CONFIG — replace with your Spotify app credentials
// ============================================================================

const SPOTIFY_CONFIG = {
  clientId: 'YOUR_SPOTIFY_CLIENT_ID', // from developer.spotify.com
  scopes: [
    'user-read-playback-state',
    'user-read-currently-playing',
  ],
  redirectUri: AuthSession.makeRedirectUri({
    scheme: 'kasvillage',
    path: 'spotify-callback',
  }),
  authEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// SecureStore keys
const STORE_KEYS = {
  accessToken: 'kv_spotify_access_token',
  refreshToken: 'kv_spotify_refresh_token',
  expiresAt: 'kv_spotify_expires_at',
};

// Dismiss browser after auth
WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// TOKEN STORAGE
// ============================================================================

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // unix ms
}

async function saveTokens(tokens: SpotifyTokens): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEYS.accessToken, tokens.accessToken);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(STORE_KEYS.refreshToken, tokens.refreshToken);
  }
  await SecureStore.setItemAsync(STORE_KEYS.expiresAt, String(tokens.expiresAt));
}

async function loadTokens(): Promise<SpotifyTokens | null> {
  const accessToken = await SecureStore.getItemAsync(STORE_KEYS.accessToken);
  if (!accessToken) return null;

  const refreshToken = await SecureStore.getItemAsync(STORE_KEYS.refreshToken);
  const expiresAtStr = await SecureStore.getItemAsync(STORE_KEYS.expiresAt);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

  return { accessToken, refreshToken, expiresAt };
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEYS.accessToken);
  await SecureStore.deleteItemAsync(STORE_KEYS.refreshToken);
  await SecureStore.deleteItemAsync(STORE_KEYS.expiresAt);
}

// ============================================================================
// PKCE HELPERS
// ============================================================================

function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const random = new Uint8Array(64);
  crypto.getRandomValues(random);
  for (let i = 0; i < 64; i++) {
    result += chars[random[i] % chars.length];
  }
  return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64;
}

// ============================================================================
// AUTH FLOW
// ============================================================================

/**
 * Start Spotify OAuth PKCE flow.
 * Opens browser, user authorizes, returns tokens.
 */
export async function authorizeSpotify(): Promise<SpotifyTokens | null> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Build auth URL
  const params = new URLSearchParams({
    client_id: SPOTIFY_CONFIG.clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    scope: SPOTIFY_CONFIG.scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'false',
  });

  const authUrl = `${SPOTIFY_CONFIG.authEndpoint}?${params.toString()}`;

  // Open browser
  const result = await WebBrowser.openAuthSessionAsync(authUrl, SPOTIFY_CONFIG.redirectUri);

  if (result.type !== 'success' || !result.url) return null;

  // Extract code from redirect URL
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) return null;

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  if (tokens) {
    await saveTokens(tokens);
  }
  return tokens;
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<SpotifyTokens | null> {
  try {
    const response = await fetch(SPOTIFY_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CONFIG.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens | null> {
  try {
    const response = await fetch(SPOTIFY_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CONFIG.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) return null;
    const data = await response.json();

    const tokens: SpotifyTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Spotify may rotate
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    await saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

// ============================================================================
// GET VALID TOKEN — auto-refreshes if expired
// ============================================================================

/**
 * Get a valid access token. Refreshes automatically if expired.
 * Returns null if not authenticated.
 */
export async function getValidToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  // 5 minute buffer before expiry
  if (Date.now() < tokens.expiresAt - 300_000) {
    return tokens.accessToken;
  }

  // Expired — try refresh
  if (tokens.refreshToken) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed) return refreshed.accessToken;
  }

  // Refresh failed — clear and return null
  await clearTokens();
  return null;
}

// ============================================================================
// LOGOUT
// ============================================================================

export async function logoutSpotify(): Promise<void> {
  await clearTokens();
}

// ============================================================================
// CHECK STATUS
// ============================================================================

export async function isSpotifyConnected(): Promise<boolean> {
  const token = await getValidToken();
  return token !== null;
}

// ============================================================================
// REACT HOOK — useSpotifyAuth
// ============================================================================

export interface SpotifyAuthState {
  /** Whether Spotify is connected and token is valid */
  connected: boolean;
  /** Current access token (null if not connected) */
  token: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Currently playing track info */
  nowPlaying: {
    trackName: string;
    artistName: string;
    trackId: string;
  } | null;
  /** Start OAuth flow */
  connect: () => Promise<void>;
  /** Disconnect */
  disconnect: () => Promise<void>;
  /** Refresh now-playing info */
  refreshNowPlaying: () => Promise<void>;
}

export function useSpotifyAuth(): SpotifyAuthState {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<SpotifyAuthState['nowPlaying']>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check existing tokens on mount
  useEffect(() => {
    (async () => {
      try {
        const t = await getValidToken();
        if (t) {
          setToken(t);
          setConnected(true);
        }
      } catch { /* not connected */ }
      setLoading(false);
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll now-playing when connected
  useEffect(() => {
    if (!connected || !token) return;

    const poll = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && res.status !== 204) {
          const data = await res.json();
          if (data?.item) {
            setNowPlaying({
              trackName: data.item.name,
              artistName: data.item.artists?.[0]?.name || 'Unknown',
              trackId: data.item.id,
            });
          }
        }
      } catch { /* silent */ }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, token]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await authorizeSpotify();
      if (tokens) {
        setToken(tokens.accessToken);
        setConnected(true);
      } else {
        setError('Authorization cancelled or failed');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect');
    }
    setLoading(false);
  }, []);

  const disconnect = useCallback(async () => {
    await logoutSpotify();
    setToken(null);
    setConnected(false);
    setNowPlaying(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const refreshNowPlaying = useCallback(async () => {
    if (!token) return;
    try {
      const t = await getValidToken(); // auto-refresh if needed
      if (t && t !== token) setToken(t);

      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${t || token}` },
      });
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        if (data?.item) {
          setNowPlaying({
            trackName: data.item.name,
            artistName: data.item.artists?.[0]?.name || 'Unknown',
            trackId: data.item.id,
          });
        }
      }
    } catch { /* silent */ }
  }, [token]);

  return { connected, token, loading, error, nowPlaying, connect, disconnect, refreshNowPlaying };
}

// ============================================================================
// GAME INTEGRATION — pre-game screen flow
// ============================================================================

/**
 * Full flow: check Spotify → get token → pass to GameScreen.
 *
 * Usage in navigation:
 *
 *   function PreGameScreen() {
 *     const spotify = useSpotifyAuth();
 *
 *     if (spotify.loading) return <Loading />;
 *
 *     if (!spotify.connected) {
 *       return (
 *         <View>
 *           <Text>Connect Spotify to play to your music</Text>
 *           <Button onPress={spotify.connect} title="Connect Spotify" />
 *           <Button onPress={() => startGame(null)} title="Play without Spotify" />
 *         </View>
 *       );
 *     }
 *
 *     return (
 *       <View>
 *         <Text>Now Playing: {spotify.nowPlaying?.trackName}</Text>
 *         <Text>{spotify.nowPlaying?.artistName}</Text>
 *         <Button onPress={() => startGame(spotify.token)} title="Start Game" />
 *         <Button onPress={spotify.disconnect} title="Disconnect" />
 *       </View>
 *     );
 *   }
 *
 *   function startGame(token: string | null) {
 *     navigation.navigate('Game', { spotifyToken: token });
 *   }
 */

// ============================================================================
// APP.JSON CONFIG NEEDED
// ============================================================================
//
// Add to app.json:
//
// {
//   "expo": {
//     "scheme": "kasvillage",
//     "plugins": [
//       "expo-auth-session",
//       "expo-secure-store",
//       "expo-web-browser"
//     ]
//   }
// }
//
// Spotify Dashboard (developer.spotify.com):
//   Redirect URI: kasvillage://spotify-callback
//   (or exp://YOUR_IP:8081/--/spotify-callback for dev)
//
// ============================================================================

// ============================================================================
// EXPORTS
// ============================================================================
// authorizeSpotify()           — start OAuth PKCE flow
// refreshAccessToken(token)    — refresh expired token
// getValidToken()              — get token, auto-refresh
// logoutSpotify()              — clear stored tokens
// isSpotifyConnected()         — check status
// useSpotifyAuth()             — React hook (connected, token, connect, disconnect, nowPlaying)
// SPOTIFY_CONFIG               — config (replace clientId)
// ============================================================================
