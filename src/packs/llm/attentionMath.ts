// 缩放点积注意力的真实计算（纯逻辑）。权重 = softmax(Q·Kᵀ / √d)，因果时上三角为 0、各行重新归一化。
// Q、K 来自“随机小模型”：对每个词元字符串做确定性哈希 → 伪随机向量（同一词元永远得到同一向量），
// 不是任何真实模型的输出，仅用来演示注意力的计算形状。

export type Matrix = number[][]

/** 数值稳定的 softmax；-Infinity 项权重为 0；全为 -Infinity 时返回全 0 */
export function softmax(xs: readonly number[]): number[] {
  if (xs.length === 0) return []
  const m = Math.max(...xs)
  if (m === -Infinity) return xs.map(() => 0)
  const e = xs.map((x) => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

/** n×n 因果掩码：true = 被遮住（列 > 行，即不能看未来） */
export function causalMask(n: number): boolean[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j > i))
}

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i], 0)

/** 权重矩阵 n×n：softmax(QKᵀ/√d)，causal 时被掩码的格子在 softmax 前置 -Infinity */
export function attention(Q: Matrix, K: Matrix, opts: { causal?: boolean } = {}): Matrix {
  const n = Q.length
  if (K.length !== n) throw new Error('Q 与 K 的词元数必须相同')
  if (n === 0) return []
  const d = Q[0].length
  const mask = opts.causal ? causalMask(n) : null
  return Q.map((q, i) =>
    softmax(K.map((k, j) => (mask && mask[i][j] ? -Infinity : dot(q, k) / Math.sqrt(d)))),
  )
}

/** FNV-1a 32 位哈希 */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 伪随机数发生器，返回 [0,1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 每个词元一个 d 维标准正态向量，仅由（词元字符串, seed）决定 */
export function seededEmbedding(tokens: readonly string[], d: number, seed: number): Matrix {
  return tokens.map((tok) => {
    const rand = mulberry32((hashString(tok) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0)
    return Array.from({ length: d }, () => {
      const u1 = Math.max(rand(), 1e-12)
      const u2 = rand()
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) // Box–Muller
    })
  })
}

/** 确定的 Q、K（两组不同种子的词元向量，相当于两个随机投影） */
export function qkFromTokens(tokens: readonly string[], d: number, seed: number): { Q: Matrix; K: Matrix } {
  return { Q: seededEmbedding(tokens, d, seed), K: seededEmbedding(tokens, d, seed + 7919) }
}
