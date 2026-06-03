// ============================================================================
// KasVillage Game Screen — React Native Component
// Canvas game view + drag pad input + loading/countdown/gameover overlays
// Drop into Expo Router as a screen
// ============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import Canvas from 'react-native-canvas';

import {
  GameController,
  GamePhase,
  GameInitOptions,
  createGameController,
  startGameLoop,
  stopGameLoop,
  pauseGame,
  resumeGame,
  restartGame,
} from './kasvillage_game_loop';

import {
  DragPadState,
  createDragPad,
  padTouchStart,
  padTouchMove,
  padTouchEnd,
  getDragPadPanResponderHandlers,
} from './kasvillage_touch_input';

// ============================================================================
// PROPS
// ============================================================================

interface GameScreenProps {
  /** Spotify access token (null = offline BPM mode) */
  spotifyToken?: string | null;
  /** Spotify track ID (null = use currently playing) */
  trackId?: string | null;
  /** Manual BPM fallback */
  fallbackBpm?: number;
  /** Use demo avatar (no wallet required) */
  demo?: boolean;
  /** Called when player exits game */
  onExit?: () => void;
  /** Called on victory */
  onVictory?: (time: number, maxChain: number) => void;
  /** Called on game over */
  onGameOver?: (time: number, maxChain: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GameScreen({
  spotifyToken = null,
  trackId = null,
  fallbackBpm = 120,
  demo = false,
  onExit,
  onVictory,
  onGameOver,
}: GameScreenProps) {
  const canvasRef = useRef<any>(null);
  const controllerRef = useRef<GameController | null>(null);
  const dragPadRef = useRef<DragPadState>(createDragPad());

  const [phase, setPhase] = useState<GamePhase>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  const { width: screenW, height: screenH } = Dimensions.get('window');

  // ── Initialize game ──
  const initGame = useCallback(async (canvas: any) => {
    if (!canvas) return;

    try {
      // Set canvas size
      canvas.width = screenW;
      canvas.height = screenH;

      setLoadingMsg('Loading avatar...');

      const controller = await createGameController({
        spotifyToken,
        trackId,
        fallbackBpm,
        demo,
        canvas,
        onPhaseChange: (p) => setPhase(p),
        onVictory: (time, chain) => onVictory?.(time, chain),
        onGameOver: (time, chain) => onGameOver?.(time, chain),
      });

      // Wire drag pad to controller
      controller.input = dragPadRef.current;
      controllerRef.current = controller;

      setLoadingMsg('');
      startGameLoop(controller);
    } catch (e: any) {
      setError(e.message || 'Failed to start game');
      setPhase('error');
    }
  }, [spotifyToken, trackId, fallbackBpm, demo, screenW, screenH]);

  // ── Canvas ref callback ──
  const handleCanvas = useCallback((canvas: any) => {
    if (canvas && !controllerRef.current) {
      canvasRef.current = canvas;
      initGame(canvas);
    }
  }, [initGame]);

  // ── App state (pause on background) ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const c = controllerRef.current;
      if (!c) return;
      if (state === 'background' || state === 'inactive') {
        pauseGame(c);
      } else if (state === 'active') {
        resumeGame(c);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        stopGameLoop(controllerRef.current);
      }
    };
  }, []);

  // ── PanResponder for drag pad ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY, force } = evt.nativeEvent;
        padTouchStart(dragPadRef.current, pageX, pageY, force);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY, force } = evt.nativeEvent;
        padTouchMove(dragPadRef.current, pageX, pageY, force);
      },
      onPanResponderRelease: () => {
        padTouchEnd(dragPadRef.current);
      },
      onPanResponderTerminate: () => {
        padTouchEnd(dragPadRef.current);
      },
    })
  ).current;

  // ── Restart handler ──
  const handleRestart = useCallback(() => {
    const c = controllerRef.current;
    if (c && (phase === 'game_over' || phase === 'victory')) {
      restartGame(c);
    }
  }, [phase]);

  // ── Pause/resume handler ──
  const handlePauseToggle = useCallback(() => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.phase === 'playing') pauseGame(c);
    else if (c.phase === 'paused') resumeGame(c);
  }, []);

  return (
    <View style={styles.container}>
      {/* Canvas — full screen */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Canvas ref={handleCanvas} style={styles.canvas} />
      </View>

      {/* Loading overlay */}
      {phase === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
        </View>
      )}

      {/* Error overlay */}
      {phase === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={onExit}>
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game over / victory tap to restart */}
      {(phase === 'game_over' || phase === 'victory') && (
        <TouchableOpacity
          style={styles.restartTouchable}
          onPress={handleRestart}
          activeOpacity={1}
        />
      )}

      {/* Pause button (top-left, small) */}
      {(phase === 'playing' || phase === 'paused') && (
        <TouchableOpacity style={styles.pauseButton} onPress={handlePauseToggle}>
          <Text style={styles.pauseText}>{phase === 'paused' ? '▶' : '⏸'}</Text>
        </TouchableOpacity>
      )}

      {/* Exit button (top-right during pause) */}
      {phase === 'paused' && (
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitText}>EXIT</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  loadingText: {
    color: '#AAAAAA',
    fontFamily: 'monospace',
    fontSize: 14,
    marginTop: 16,
  },
  errorText: {
    color: '#FF4444',
    fontFamily: 'monospace',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  restartTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  pauseButton: {
    position: 'absolute',
    top: 44,
    left: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
  },
  pauseText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  exitButton: {
    position: 'absolute',
    top: 44,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(80,0,0,0.6)',
    borderRadius: 8,
  },
  exitText: {
    color: '#FF6644',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
