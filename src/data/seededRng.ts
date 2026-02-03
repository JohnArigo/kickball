export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(items: T[]) => T
  shuffle: <T>(items: T[]) => T[]
}

export const createSeededRng = (seed: number): Rng => {
  let t = seed >>> 0

  const next = () => {
    t += 0x6d2b79f5
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) => {
    return Math.floor(next() * (max - min + 1)) + min
  }

  const pick = <T>(items: T[]) => items[int(0, items.length - 1)]

  const shuffle = <T>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  return { next, int, pick, shuffle }
}
