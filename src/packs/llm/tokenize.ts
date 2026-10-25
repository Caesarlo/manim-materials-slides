// 玩具分词器（纯逻辑，教学用；词表为示意，不是任何真实模型的词表）。
//
//   const tk = makeTokenizer(['The', ' lat', 'tice', ' was'])
//   tk.encode('The lattice')  // { tokens: ['The',' lat','tice'], ids: [0,1,2] }
//
// 约定：
// - 词元 id = 词表下标（重复项以第一次出现为准，空串忽略）。
// - 切分 = 贪心最长匹配：每个位置取词表里能匹配的最长词元。
// - 子词写法沿用 GPT 风格：词首带前导空格（' lat'），词内续接的子词不带（'tice'）；
//   所以“是否开新词”看词元是否以空格开头（见 isWordStart）。
// - 词表里没有的字符退化为单字符词元，id = 词表长度 + 码点（类似字节回退），因此 decode 总能还原。

export interface Tokenizer {
  readonly vocab: readonly string[]
  encode(text: string): { tokens: string[]; ids: number[] }
  decode(ids: readonly number[]): string
}

export function makeTokenizer(vocab: readonly string[]): Tokenizer {
  const index = new Map<string, number>()
  vocab.forEach((t, i) => {
    if (t !== '' && !index.has(t)) index.set(t, i)
  })
  const maxLen = Math.max(1, ...[...index.keys()].map((t) => t.length))
  const base = vocab.length

  return {
    vocab,
    encode(text) {
      const tokens: string[] = []
      const ids: number[] = []
      let i = 0
      while (i < text.length) {
        let hit: string | null = null
        for (let len = Math.min(maxLen, text.length - i); len >= 1; len--) {
          const piece = text.slice(i, i + len)
          if (index.has(piece)) { hit = piece; break }
        }
        if (hit !== null) {
          tokens.push(hit)
          ids.push(index.get(hit)!)
          i += hit.length
        } else {
          const cp = text.codePointAt(i)!
          const ch = String.fromCodePoint(cp)
          tokens.push(ch)
          ids.push(base + cp)
          i += ch.length
        }
      }
      return { tokens, ids }
    },
    decode(ids) {
      return ids
        .map((id) => {
          if (id < 0 || !Number.isInteger(id)) throw new RangeError(`非法词元 id：${id}`)
          return id < base ? vocab[id] : String.fromCodePoint(id - base)
        })
        .join('')
    },
  }
}

/** 词元是否开启一个新词（第一个词元，或带前导空格） */
export function isWordStart(token: string, i: number): boolean {
  return i === 0 || token.startsWith(' ')
}

/** 显示用文本：去掉前导空格（全是空格时用 ␣） */
export function displayToken(token: string): string {
  const t = token.replace(/^ +/, '')
  return t === '' ? '␣' : t
}
