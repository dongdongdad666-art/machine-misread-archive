export function seedFromParts(parts: string[]): number {
  let hash = 0x811c9dc5;

  for (const character of parts.join("\u241f")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0 || 1;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
