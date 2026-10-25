import { describe, expect, it } from 'vitest'
import {
  actorStatesAt, describeEvent, eventActors, eventFlows, extractText, fromMessages, stepsFromGroups, tokenUsage, truncate,
  type LcMessage,
} from './agentTrace'
import { session } from '../../talks/gallery-llm/data/session'

const task = (id: string, desc: string, type = 'general-purpose') => ({ id, name: 'task', args: { description: desc, prompt: desc, subagent_type: type } })

describe('extractText / truncate', () => {
  it('从 block 数组取正文，跳过 thinking 与 tool_use', () => {
    const c = [{ type: 'thinking', text: '秘密' }, { type: 'text', text: '你好' }, { type: 'tool_use', id: 'x' }, '世界']
    expect(extractText(c)).toBe('你好 世界')
    expect(extractText(undefined)).toBe('')
    expect(extractText('  a \n b ')).toBe('a b')
  })
  it('按字符截断并加省略号', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abcd', 4)).toBe('abcd')
  })
})

describe('fromMessages：并行派出 + 超时 + 重试 + 回答', () => {
  const trace = fromMessages(session)
  it('actor：用户、主 agent、4 个 worker（标签 = 类型 + 全局序号）', () => {
    expect(trace.actors.map((a) => a.label)).toEqual(['用户', '主 agent', 'general-purpose 1', 'general-purpose 2', 'bash 3', 'bash 4'])
    expect(trace.actors.map((a) => a.kind)).toEqual(['user', 'lead', 'worker', 'worker', 'worker', 'worker'])
  })
  it('事件序列：ask, delegate(3), result×3, retry, result, answer', () => {
    expect(trace.events.map((e) => e.type)).toEqual(['ask', 'delegate', 'result', 'result', 'result', 'retry', 'result', 'answer'])
    const d = trace.events[1]
    expect(d.type === 'delegate' && d.calls.map((c) => c.actor)).toEqual(['worker:1', 'worker:2', 'worker:3'])
  })
  it('子任务状态：completed→ok，timed_out→timed_out；摘要优先取 brief，失败取 error', () => {
    const r = trace.events.filter((e) => e.type === 'result')
    expect(r.map((e) => e.type === 'result' && e.status)).toEqual(['ok', 'ok', 'timed_out', 'ok'])
    expect(r[0].type === 'result' && r[0].text).toBe('找到相关文献')
    expect(r[2].type === 'result' && r[2].text).toBe('执行超时')
  })
  it('重试：同描述的 task 再次调用被识别为 retry，from = 超时的 worker', () => {
    const e = trace.events[5]
    expect(e.type === 'retry' && e.calls).toEqual([{ from: 'worker:3', to: 'worker:4', text: '运行 zT 计算' }])
  })
  it('回答来自 block 数组正文；reasoning_content 不出现在任何事件里', () => {
    const a = trace.events[7]
    expect(a.type === 'answer' && a.text).toBe('已结合文献与本地数据，估算出 zT 并给出结论。')
    expect(JSON.stringify(trace)).not.toContain('互不依赖')
  })
})

describe('fromMessages：其它情形', () => {
  it('普通工具：同名复用同一 tool actor，错误正文判为 failed，重试走 retry（from = to）', () => {
    const msgs: LcMessage[] = [
      { type: 'human', content: 'q' },
      { type: 'ai', content: '', tool_calls: [{ id: 'a', name: 'web_search', args: { query: 'zT' } }] },
      { type: 'tool', name: 'web_search', tool_call_id: 'a', content: 'Error: 429 too many requests' },
      { type: 'ai', content: '', tool_calls: [{ id: 'b', name: 'web_search', args: { query: 'zT' } }] },
      { type: 'tool', name: 'web_search', tool_call_id: 'b', content: '3 条结果' },
      { type: 'ai', content: '完毕' },
    ]
    const t = fromMessages(msgs)
    expect(t.actors.filter((a) => a.kind === 'tool')).toHaveLength(1)
    expect(t.events.map((e) => e.type)).toEqual(['ask', 'delegate', 'result', 'retry', 'result', 'answer'])
    const r = t.events[2], rt = t.events[3], ok = t.events[4]
    expect(r.type === 'result' && r.status).toBe('failed')
    expect(rt.type === 'retry' && rt.calls[0]).toMatchObject({ from: 'tool:web_search', to: 'tool:web_search' })
    expect(ok.type === 'result' && ok.status).toBe('ok')
  })
  it('一条 ai 消息里的 task 与普通工具并行 → 一个 delegate；不同任务不是 retry', () => {
    const t = fromMessages([
      { type: 'ai', tool_calls: [task('1', 'A'), { id: '2', name: 'read_file', args: { path: '/a.csv' } }] },
      { type: 'tool', name: 'task', tool_call_id: '1', additional_kwargs: { subagent_status: 'failed', subagent_error: '崩了' } },
      { type: 'ai', tool_calls: [task('3', 'B')] },
    ])
    expect(t.events.map((e) => e.type)).toEqual(['delegate', 'result', 'delegate'])
    const d = t.events[0]
    expect(d.type === 'delegate' && d.calls).toEqual([{ actor: 'worker:1', text: 'A' }, { actor: 'tool:read_file', text: '/a.csv' }])
  })
  it('cancelled / polling_timed_out 映射；缺少 tool_call_id 时按名字配对第一个未返回的调用', () => {
    const t = fromMessages([
      { type: 'ai', tool_calls: [task('1', 'A'), task('2', 'B')] },
      { type: 'tool', name: 'task', additional_kwargs: { subagent_status: 'cancelled' } },
      { type: 'tool', name: 'task', additional_kwargs: { subagent_status: 'polling_timed_out' } },
    ])
    const rs = t.events.filter((e) => e.type === 'result')
    expect(rs.map((e) => e.type === 'result' && [e.actor, e.status])).toEqual([['worker:1', 'cancelled'], ['worker:2', 'timed_out']])
  })
  it('空的 ai 消息和 system 消息被忽略', () => {
    const t = fromMessages([{ type: 'system', content: 's' }, { type: 'ai', content: '' }, { type: 'human', content: 'hi' }])
    expect(t.events).toEqual([{ type: 'ask', text: 'hi' }])
  })
})

describe('describeEvent', () => {
  const trace = fromMessages(session)
  it('逐事件旁白', () => {
    expect(trace.events.map((e) => describeEvent(e, trace))).toEqual([
      '用户提出问题',
      '主 agent 同时派出 3 个子任务',
      '子任务 1 完成',
      '子任务 2 完成',
      '子任务 3 超时',
      '重试子任务 3',
      '子任务 4 重试成功',
      '汇总结果，回答用户',
    ])
  })
  it('旁白不超过 20 个字符', () => {
    for (const e of trace.events) expect(Array.from(describeEvent(e, trace)).length).toBeLessThanOrEqual(20)
  })
  it('没有 result 时直接回答；工具的旁白用工具名', () => {
    const t = fromMessages([
      { type: 'ai', tool_calls: [{ id: 'a', name: 'bash', args: { command: 'ls' } }] },
      { type: 'tool', name: 'bash', tool_call_id: 'a', content: 'ok' },
    ])
    expect(describeEvent(t.events[0], t)).toBe('主 agent 调用 bash')
    expect(describeEvent(t.events[1], t)).toBe('bash 返回结果')
    expect(describeEvent({ type: 'answer', text: 'x' }, { actors: [], events: [{ type: 'answer', text: 'x' }] })).toBe('直接回答用户')
  })
})

describe('tokenUsage', () => {
  it('汇总 input / output / total，缺 total 时取 input+output', () => {
    expect(tokenUsage(session)).toEqual({ input: 5100, output: 490, total: 5590, calls: 3 })
    expect(tokenUsage([{ usage_metadata: { input_tokens: 10, output_tokens: 5 } }, { type: 'human' }])).toEqual({ input: 10, output: 5, total: 15, calls: 1 })
    expect(tokenUsage([])).toEqual({ input: 0, output: 0, total: 0, calls: 0 })
  })
})

describe('回放状态', () => {
  const trace = fromMessages(session)
  it('eventFlows / eventActors', () => {
    expect(eventFlows(trace.events[0])).toEqual([{ from: 'user', to: 'lead' }])
    expect(eventFlows(trace.events[1]).map((f) => f.to)).toEqual(['worker:1', 'worker:2', 'worker:3'])
    expect(eventFlows(trace.events[4])).toEqual([{ from: 'worker:3', to: 'lead' }])
    expect(eventActors(trace.events[5]).sort()).toEqual(['lead', 'worker:3', 'worker:4'])
  })
  it('actorStatesAt：逐步推进', () => {
    const w = (at: number) => {
      const s = actorStatesAt(trace, at)
      return ['worker:1', 'worker:2', 'worker:3', 'worker:4'].map((id) => s[id])
    }
    expect(w(0)).toEqual(['hidden', 'hidden', 'hidden', 'hidden'])
    expect(w(2)).toEqual(['running', 'running', 'running', 'hidden'])
    expect(w(5)).toEqual(['ok', 'ok', 'timed_out', 'hidden'])
    expect(w(6)).toEqual(['ok', 'ok', 'timed_out', 'running'])
    expect(w(8)).toEqual(['ok', 'ok', 'timed_out', 'ok'])
    expect(actorStatesAt(trace, 0).user).toBe('idle')
  })
  it('同一个工具重试时状态从 failed 回到 running', () => {
    const t = fromMessages([
      { type: 'ai', tool_calls: [{ id: 'a', name: 'bash', args: { c: 1 } }] },
      { type: 'tool', name: 'bash', tool_call_id: 'a', status: 'error', content: 'x' },
      { type: 'ai', tool_calls: [{ id: 'b', name: 'bash', args: { c: 1 } }] },
    ])
    expect(actorStatesAt(t, 2)['tool:bash']).toBe('failed')
    expect(actorStatesAt(t, 3)['tool:bash']).toBe('running')
  })
})

describe('stepsFromGroups', () => {
  it('默认一事件一步；group 合并相邻事件', () => {
    expect(stepsFromGroups(3)).toEqual([{ from: 0, to: 0 }, { from: 1, to: 1 }, { from: 2, to: 2 }])
    expect(stepsFromGroups(5, [[1, 2, 3]])).toEqual([{ from: 0, to: 0 }, { from: 1, to: 3 }, { from: 4, to: 4 }])
  })
  it('越界下标被忽略，重叠的分组以先出现者为准', () => {
    expect(stepsFromGroups(3, [[2, 9]])).toEqual([{ from: 0, to: 0 }, { from: 1, to: 1 }, { from: 2, to: 2 }])
    expect(stepsFromGroups(4, [[0, 1], [1, 2]])).toEqual([{ from: 0, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }])
  })
})
