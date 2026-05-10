/**
 * Deterministic RNG (Mulberry32).
 * Same seed → identical sequences across machines for reproducible demos.
 */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return {
    /** [0, 1) */
    next(): number {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[this.nextInt(0, arr.length - 1)]!;
    },
    shuffleInPlace<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    },
    /** Gaussian-ish via Box-Muller (deterministic pair consumption). */
    nextGaussian(mean = 0, std = 1): number {
      const u1 = this.next();
      const u2 = this.next();
      const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    },
    bernoulli(p: number): boolean {
      return this.next() < p;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
