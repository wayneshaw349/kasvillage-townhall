// ============================================================================
// KASVILLAGE - UPLOAD QUEUE + SLOTH POISON SYSTEM
// ============================================================================
// Self-regulating upload throttle. Spam uploads → wallet slows down.
// Critical uploads (collateral, agreements) always bypass the queue.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedUpload {
  id: string;
  data: string;           // base64-encoded payload
  tags: { name: string; value: string }[];
  priority: 'critical' | 'normal' | 'low';
  addedAt: number;
  retryCount: number;
  lastError?: string;
}

export interface SlothPoisonState {
  /** 0-100 poison level */
  level: number;
  /** Queued upload count */
  queueLength: number;
  /** Is Sloth Mode active (level >= 75) */
  slothModeActive: boolean;
  /** Uploads this hour */
  uploadsThisHour: number;
  /** Time until next upload allowed (ms) */
  nextAllowedIn: number;
  /** Human-readable status */
  status: 'normal' | 'warming' | 'sluggish' | 'sloth';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QUEUE_KEY = 'kv_upload_queue';
const POISON_KEY = 'kv_sloth_poison';
const COOLDOWN_MS = 120_000;           // 2 min between non-critical uploads
const MAX_PER_HOUR = 30;               // hourly cap for non-critical
const POISON_PER_UPLOAD = 4;           // each upload adds 4 poison points
const POISON_DECAY_PER_MIN = 2;        // decays 2 points per minute
const SLOTH_THRESHOLD = 75;            // sloth mode at 75+
const MAX_QUEUE_SIZE = 50;             // max queued items
const MAX_RETRIES = 3;

// ============================================================================
// STATE (in-memory, persisted to AsyncStorage)
// ============================================================================

let _poison = 0;
let _lastDecayTime = Date.now();
let _lastProcessTime = 0;
let _uploadsThisHour = 0;
let _hourStart = Date.now();
let _queue: QueuedUpload[] = [];
let _processing = false;
let _initialized = false;
let _listeners: ((state: SlothPoisonState) => void)[] = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initUploadQueue(): Promise<void> {
  if (_initialized) return;
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    if (queueJson) _queue = JSON.parse(queueJson);
    const poisonJson = await AsyncStorage.getItem(POISON_KEY);
    if (poisonJson) {
      const saved = JSON.parse(poisonJson);
      _poison = saved.poison || 0;
      _lastDecayTime = saved.lastDecayTime || Date.now();
      _uploadsThisHour = saved.uploadsThisHour || 0;
      _hourStart = saved.hourStart || Date.now();
    }
    _initialized = true;
    // Apply decay since last active
    decayPoison();
    console.log('[SlothQueue] Initialized. Queue:', _queue.length, 'Poison:', _poison.toFixed(0));
  } catch (e) {
    _initialized = true;
    console.warn('[SlothQueue] Init failed:', e);
  }
}

// ============================================================================
// POISON MECHANICS
// ============================================================================

function decayPoison(): void {
  const now = Date.now();
  const minutesElapsed = (now - _lastDecayTime) / 60_000;
  if (minutesElapsed > 0) {
    _poison = Math.max(0, _poison - (minutesElapsed * POISON_DECAY_PER_MIN));
    _lastDecayTime = now;
  }
  // Reset hourly counter
  if (now - _hourStart > 3_600_000) {
    _uploadsThisHour = 0;
    _hourStart = now;
  }
}

function addPoison(amount: number): void {
  _poison = Math.min(100, _poison + amount);
  notifyListeners();
}

export function getSlothState(): SlothPoisonState {
  decayPoison();
  const now = Date.now();
  const elapsed = now - _lastProcessTime;
  const nextAllowedIn = Math.max(0, COOLDOWN_MS - elapsed);
  
  let status: SlothPoisonState['status'] = 'normal';
  if (_poison >= SLOTH_THRESHOLD) status = 'sloth';
  else if (_poison >= 50) status = 'sluggish';
  else if (_poison >= 25) status = 'warming';
  
  return {
    level: Math.round(_poison),
    queueLength: _queue.length,
    slothModeActive: _poison >= SLOTH_THRESHOLD,
    uploadsThisHour: _uploadsThisHour,
    nextAllowedIn,
    status,
  };
}

// ============================================================================
// LISTENER SYSTEM (for UI updates)
// ============================================================================

export function onSlothStateChange(listener: (state: SlothPoisonState) => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter(l => l !== listener);
  };
}

function notifyListeners(): void {
  const state = getSlothState();
  _listeners.forEach(l => {
    try { l(state); } catch (e) {}
  });
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

function isCritical(tags: { name: string; value: string }[]): boolean {
  return tags.some(t =>
    (t.name === 'KV-TxType' && (t.value === 'collateral' || t.value === 'release')) ||
    (t.name === 'KV-Type' && t.value === 'frost-agreement')
  );
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Enqueue an upload. Critical uploads are processed immediately.
 * Non-critical uploads go to the queue and add sloth poison.
 */
export async function enqueueUpload(
  data: string | Uint8Array,
  tags: { name: string; value: string }[],
): Promise<{ queued: boolean; immediate: boolean; position?: number; poisonLevel?: number }> {
  await initUploadQueue();
  
  const dataStr = typeof data === 'string'
    ? btoa(data)
    : btoa(String.fromCharCode(...data));
  
  const critical = isCritical(tags);
  
  if (critical) {
    // Critical — process immediately, no queue, no poison
    return { queued: false, immediate: true };
  }
  
  // Non-critical — add to queue + add poison
  if (_queue.length >= MAX_QUEUE_SIZE) {
    console.log('[SlothQueue] Queue full, dropping oldest');
    _queue.shift();
  }
  
  const item: QueuedUpload = {
    id: generateId(),
    data: dataStr,
    tags,
    priority: 'normal',
    addedAt: Date.now(),
    retryCount: 0,
  };
  
  _queue.push(item);
  addPoison(POISON_PER_UPLOAD);
  
  // Persist
  await saveState();
  
  console.log('[SlothQueue] Queued upload. Queue:', _queue.length, 'Poison:', _poison.toFixed(0));
  
  // Try processing
  processQueue();
  
  return {
    queued: true,
    immediate: false,
    position: _queue.length,
    poisonLevel: Math.round(_poison),
  };
}

/**
 * Process the queue — called automatically and can be called manually.
 * Respects cooldown between uploads.
 */
export async function processQueue(): Promise<void> {
  if (_processing || _queue.length === 0) return;
  _processing = true;
  
  try {
    await initUploadQueue();
    decayPoison();
    
    const now = Date.now();
    const elapsed = now - _lastProcessTime;
    
    // Respect cooldown
    if (elapsed < COOLDOWN_MS) {
      // Schedule next attempt
      const waitMs = COOLDOWN_MS - elapsed + 100;
      setTimeout(() => processQueue(), waitMs);
      _processing = false;
      return;
    }
    
    // Respect hourly limit
    if (_uploadsThisHour >= MAX_PER_HOUR) {
      console.log('[SlothQueue] Hourly limit reached. Queue paused.');
      _processing = false;
      return;
    }
    
    // Get next item
    const item = _queue.shift();
    if (!item) {
      _processing = false;
      return;
    }
    
    // Process
    try {
      const { uploadToTurbo } = await import('./arweave_upload');
      
      // Decode data
      const dataStr = atob(item.data);
      const result = await uploadToTurbo(dataStr, item.tags);
      
      if (result.success) {
        console.log('[SlothQueue] Processed:', result.txId?.slice(0, 16));
        _lastProcessTime = Date.now();
        _uploadsThisHour++;
      } else {
        // Retry
        if (item.retryCount < MAX_RETRIES) {
          item.retryCount++;
          item.lastError = result.error;
          _queue.unshift(item); // Put back at front
          console.log('[SlothQueue] Retry', item.retryCount, ':', result.error);
        } else {
          console.warn('[SlothQueue] Dropped after', MAX_RETRIES, 'retries:', result.error);
        }
      }
    } catch (e) {
      if (item.retryCount < MAX_RETRIES) {
        item.retryCount++;
        item.lastError = String(e);
        _queue.unshift(item);
      }
    }
    
    await saveState();
    notifyListeners();
    
    // Process next if queue not empty
    if (_queue.length > 0) {
      setTimeout(() => processQueue(), COOLDOWN_MS + 100);
    }
  } finally {
    _processing = false;
  }
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function saveState(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(_queue));
    await AsyncStorage.setItem(POISON_KEY, JSON.stringify({
      poison: _poison,
      lastDecayTime: _lastDecayTime,
      uploadsThisHour: _uploadsThisHour,
      hourStart: _hourStart,
    }));
  } catch (e) {
    console.warn('[SlothQueue] Save failed:', e);
  }
}

// ============================================================================
// MANUAL CONTROLS
// ============================================================================

/** Force process queue (user tapped "process now") */
export async function forceProcessQueue(): Promise<void> {
  _lastProcessTime = 0; // Reset cooldown
  await processQueue();
}

/** Clear the queue (user tapped "clear queue") */
export async function clearQueue(): Promise<void> {
  _queue = [];
  await saveState();
  notifyListeners();
  console.log('[SlothQueue] Queue cleared');
}

/** Get queue contents for debug/display */
export function getQueueItems(): QueuedUpload[] {
  return [..._queue];
}

/** Reset poison (for testing only) */
export async function resetPoison(): Promise<void> {
  _poison = 0;
  _uploadsThisHour = 0;
  await saveState();
  notifyListeners();
}
