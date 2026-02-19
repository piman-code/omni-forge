export type HashEmbedConfig = {
  dimension: number;
  seedIndex: number;
  seedSign: number;
};

function hash32(input: string, seed: number): number {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function l2Normalize(vec: number[]): number[] {
  const out = vec.slice();
  let normSq = 0;
  for (let i = 0; i < out.length; i += 1) {
    normSq += out[i] * out[i];
  }
  if (normSq <= 0) {
    return out;
  }
  const invNorm = 1 / Math.sqrt(normSq);
  for (let i = 0; i < out.length; i += 1) {
    out[i] *= invNorm;
  }
  return out;
}

export function hashEmbed(tokens: string[], config: HashEmbedConfig): number[] {
  const vector = new Array<number>(config.dimension).fill(0);

  for (const rawToken of tokens) {
    const token = String(rawToken);
    const index = hash32(token, config.seedIndex) % config.dimension;
    const sign = (hash32(token, config.seedSign) & 1) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  // TODO(PR2-Step2): add token weighting and n-gram features.
  return l2Normalize(vector);
}
