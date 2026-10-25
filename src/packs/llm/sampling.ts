// 采样的纯逻辑：温度 softmax、top-k、top-p、熵。不 import 任何带 CSS 的模块，可在 vitest 的 node 环境里测试。

/** 带温度的 softmax：p_i = exp(z_i/T) / Σ exp(z_j/T)。减去最大值保证数值稳定；T 必须 > 0。 */
export function softmaxT(logits: readonly number[], T = 1): number[] {
  if (!(T > 0)) throw new RangeError(`温度 T 必须大于 0，收到 ${T}`)
  if (logits.length === 0) return []
  const m = Math.max(...logits)
  const e = logits.map((z) => Math.exp((z - m) / T))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

/** 最大值的下标；并列取靠前者 */
export function argmax(xs: readonly number[]): number {
  let best = 0
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[best]) best = i
  return best
}

export interface TopItem { label: string; p: number; index: number }

/** 概率最高的 k 项（降序）；并列时保持原顺序（稳定排序）。k 超出长度时返回全部。 */
export function topK(probs: readonly number[], labels: readonly string[], k: number): TopItem[] {
  return probs
    .map((p, index) => ({ label: labels[index], p, index }))
    .sort((a, b) => b.p - a.p || a.index - b.index)
    .slice(0, Math.max(0, k))
}

/** 香农熵，以 2 为底，单位 bit；0·log0 记作 0 */
export function entropy(probs: readonly number[]): number {
  let h = 0
  for (const p of probs) if (p > 0) h -= p * Math.log2(p)
  return h
}

/** 核采样（top-p）：按概率降序累加，取累计概率 ≥ p 的最小集合；返回下标（升序）。并列时原顺序靠前者先入选。 */
export function topP(probs: readonly number[], p: number): number[] {
  const order = probs.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i)
  const keep: number[] = []
  let cum = 0
  for (const { v, i } of order) {
    keep.push(i)
    cum += v
    if (cum >= p - 1e-12) break
  }
  return keep.sort((a, b) => a - b)
}

/** 只保留 keepIdx 中的项并重新归一化（其余置 0） */
export function renormalize(probs: readonly number[], keepIdx: readonly number[]): number[] {
  const keep = new Set(keepIdx)
  const s = probs.reduce((a, v, i) => (keep.has(i) ? a + v : a), 0)
  return probs.map((v, i) => (keep.has(i) && s > 0 ? v / s : 0))
}
