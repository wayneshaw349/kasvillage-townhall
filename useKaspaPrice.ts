import { useState, useEffect } from 'react';
import {
  getKasPrice,
  refreshPrice,
  startPriceFeed,
  subscribeToPriceUpdates,
  type KasPriceData,
} from './kas_price_feed';

interface UseKasPriceOptions {
  autoStart?: boolean;
  skipInitialFetch?: boolean;
}

export function useKaspaPrice(options: UseKasPriceOptions = {}) {
  const { autoStart = true, skipInitialFetch = false } = options;

  const [price, setPrice] = useState<KasPriceData | null>(getKasPrice());
  const [loading, setLoading] = useState(!skipInitialFetch && !getKasPrice());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToPriceUpdates((data) => {
      setPrice(data);
      setLoading(false);
    });

    let stopFeed: (() => void) | null = null;

    if (autoStart) {
      stopFeed = startPriceFeed();
    } else if (!skipInitialFetch) {
      refreshPrice().catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to fetch price');
        setLoading(false);
      });
    }

    return () => {
      unsub();
      stopFeed?.();
    };
  }, [autoStart, skipInitialFetch]);

  return {
    price,
    loading,
    error,
    formattedPrice: price ? `$${price.usdPerKas.toFixed(4)}` : '$0.0000',
    usdPerKas: price?.usdPerKas ?? 0,
    isStale: price?.isStale ?? false,
  };
}