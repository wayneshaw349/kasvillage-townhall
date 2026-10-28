// KV_QUOTES: Wayne Shaw's fair-market aphorism, placed where people actually pass -
// agreements, send, receive, workspace. One line, rotating daily through the four tongues
// of the braid (English leads; Kikongo majority; Twi and Yoruba beside it).
import React from 'react';
import { Text } from 'react-native';

const LINES = [
  '“A free market isn’t the goal — a fair market is: equality of power of the people, not money.” — Wayne Shaw',
  '“Lengo kele zandu ya masonga: lulendo ya kiteso mosi ya bantu — kansi ve mbongo.” — Wayne Shaw (Kikongo)',
  '“Edwa a ɛde ne ho nyɛ botaeɛ no — edwa pɛpɛɛpɛ ne botaeɛ no.” — Wayne Shaw (Twi)',
  '“Ọjà òmìnira kọ́ ni àfojúsùn — ọjà òdodo ni.” — Wayne Shaw (Yorùbá)',
];

export default function KvQuote({ color, size }: { color?: string; size?: number }) {
  const line = LINES[Math.floor(Date.now() / 86400000) % LINES.length]; // rotates daily
  return (
    <Text style={{ color: color || '#8a8a8a', fontSize: size || 10, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 18, paddingVertical: 8 }}>
      {line}
    </Text>
  );
}
