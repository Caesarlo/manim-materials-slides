import { describe, expect, it } from 'vitest'
import { displayToken, isWordStart, makeTokenizer } from './tokenize'

const vocab = ['un', 'unable', 'able', 'u', 'n', ' the', 'cat']

describe('makeTokenizer', () => {
  const tk = makeTokenizer(vocab)
  it('贪心最长匹配：unable 取整词而不是 un+able', () => {
    expect(tk.encode('unable')).toEqual({ tokens: ['unable'], ids: [1] })
  })
  it('较长的词元不匹配时回退到较短的', () => {
    // "unab"：'unable' 不是前缀，取 'un'；剩下 "ab" 无词元 → 'a'、'b' 均未登录
    const r = tk.encode('unab')
    expect(r.tokens).toEqual(['un', 'a', 'b'])
    expect(r.ids[0]).toBe(0)
  })
  it('未登录字符退化为单字符，id = 词表长度 + 码点', () => {
    const r = tk.encode('x')
    expect(r.tokens).toEqual(['x'])
    expect(r.ids).toEqual([vocab.length + 'x'.codePointAt(0)!])
  })
  it('空串得到空结果', () => {
    expect(tk.encode('')).toEqual({ tokens: [], ids: [] })
    expect(tk.decode([])).toBe('')
  })
  it('id 与词表下标对应', () => {
    const r = tk.encode('able cat')
    // 'able' → 2；单个空格不在词表 → 未登录；'cat' → 6
    expect(r.tokens).toEqual(['able', ' ', 'cat'])
    expect(r.ids[0]).toBe(2)
    expect(r.ids[2]).toBe(6)
    expect(vocab[r.ids[0]]).toBe('able')
  })
  it('decode(encode(x)) === x（含未登录字符、代理对与中文）', () => {
    for (const s of ['unable cat the', ' the cat', 'xyz', '晶格 relax 😀', '']) {
      expect(tk.decode(tk.encode(s).ids)).toBe(s)
    }
  })
  it('重复词元以第一次出现的下标为准，空串被忽略', () => {
    const t = makeTokenizer(['a', '', 'a', 'b'])
    expect(t.encode('ab').ids).toEqual([0, 3])
  })
  it('非法 id 抛错', () => {
    expect(() => tk.decode([-1])).toThrow(RangeError)
  })
})

describe('显示辅助', () => {
  it('isWordStart：首个或带前导空格', () => {
    expect(isWordStart('lat', 0)).toBe(true)
    expect(isWordStart(' was', 3)).toBe(true)
    expect(isWordStart('tice', 2)).toBe(false)
  })
  it('displayToken 去前导空格；纯空格显示 ␣', () => {
    expect(displayToken(' stable')).toBe('stable')
    expect(displayToken('ed')).toBe('ed')
    expect(displayToken(' ')).toBe('␣')
  })
})
