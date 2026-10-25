// Agent 编排回放的纯逻辑：通用 trace 格式 + LangChain 风格消息适配器 + 中文旁白 + 回放时刻的状态推导。
// 不 import 任何带 CSS / DOM 的模块，vitest 的 node 环境可直接加载。
//
//   const trace = fromMessages(messages)          // harness 线程消息 → AgentTrace
//   describeEvent(trace.events[1], trace)         // '主 agent 同时派出 3 个子任务'
//   actorStatesAt(trace, 3)                       // 回放到第 3 个事件时各 actor 的状态
//   tokenUsage(messages)                          // { input, output, total, calls }
//
// 适配规则（fromMessages）：
// - human → ask；system 忽略；reasoning_content 不展示。
// - ai 且有 tool_calls → 一个 delegate（同一条消息里的并行调用合成一个事件）。
//   name==='task' 的调用目标是新建的 worker actor，标签 = subagent_type + 全局序号（如 'bash 3'）；
//   其它工具的目标是同名 tool actor（同名工具复用同一个 actor）。
// - tool 消息 → result，按 tool_call_id 配对（缺失时按名字配第一个未返回的调用）。
//   task 的状态取自 additional_kwargs.subagent_status：completed → ok，failed → failed，cancelled → cancelled，
//   timed_out / polling_timed_out → timed_out；缺省时按普通工具规则。
//   普通工具：消息 status==='error'，或正文以 error / exception / traceback / failed（不分大小写）或 错误 / 失败 / 异常 开头 → failed，否则 ok。
// - 重试：某条 ai 消息里的调用全部与“之前失败/取消/超时的调用”同名同任务（task 比 description，其它工具比 args）→ 一个 retry 事件。
// - 无 tool_calls 且有正文的 ai → answer。

// ───────────── 类型 ─────────────

export type ActorKind = 'user' | 'lead' | 'worker' | 'tool'
export interface Actor { id: string; label: string; kind: ActorKind; /** worker 的序号（1 起） */ seq?: number }

export type ResultStatus = 'ok' | 'failed' | 'cancelled' | 'timed_out'
export interface CallTarget { actor: string; text: string }
export interface RetryCall { from: string; to: string; text: string }

export type AgentEvent =
  | { type: 'ask'; text: string }
  | { type: 'delegate'; calls: CallTarget[] }
  | { type: 'result'; actor: string; status: ResultStatus; text: string }
  | { type: 'retry'; calls: RetryCall[] }
  | { type: 'answer'; text: string }

export interface AgentTrace { title?: string; actors: Actor[]; events: AgentEvent[] }

export const USER_ID = 'user'
export const LEAD_ID = 'lead'

/** LangChain 风格消息；字段宽松、全部可选，容忍真实数据 */
export interface LcToolCall { id?: string; name?: string; args?: Record<string, unknown> }
export interface LcUsage { input_tokens?: number; output_tokens?: number; total_tokens?: number }
export interface LcMessage {
  type?: string
  content?: unknown
  id?: string
  name?: string
  status?: string
  tool_calls?: LcToolCall[]
  tool_call_id?: string
  additional_kwargs?: {
    reasoning_content?: string
    subagent_status?: string
    subagent_stop_reason?: string
    subagent_error?: string
    subagent_result_brief?: string
    [k: string]: unknown
  }
  usage_metadata?: LcUsage
}

// ───────────── 文本工具 ─────────────

/** 从 string / block 数组里取出正文（跳过 thinking、tool_use 等块），压缩空白 */
export function extractText(content: unknown): string {
  const parts: string[] = []
  const walk = (c: unknown) => {
    if (typeof c === 'string') parts.push(c)
    else if (Array.isArray(c)) c.forEach(walk)
    else if (c && typeof c === 'object') {
      const b = c as { type?: string; text?: unknown }
      if ((b.type === undefined || b.type === 'text') && typeof b.text === 'string') parts.push(b.text)
    }
  }
  walk(content)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function truncate(s: string, max = 40): string {
  const chars = Array.from(s)
  return chars.length <= max ? s : chars.slice(0, max - 1).join('') + '…'
}

const ERROR_RE = /^\s*(error|exception|traceback|fail(ed|ure)?)\b|^\s*(错误|失败|异常)/i

function statusOfPlainTool(msg: LcMessage, text: string): ResultStatus {
  if (msg.status === 'error') return 'failed'
  return ERROR_RE.test(text) ? 'failed' : 'ok'
}

function statusOfTask(msg: LcMessage, text: string): ResultStatus {
  switch (msg.additional_kwargs?.subagent_status) {
    case 'completed': return 'ok'
    case 'failed': return 'failed'
    case 'cancelled': return 'cancelled'
    case 'timed_out':
    case 'polling_timed_out': return 'timed_out'
    default: return statusOfPlainTool(msg, text)
  }
}

/** 一次调用的一句任务描述：task 用 description，其它工具取第一个字符串参数，否则用工具名 */
function callText(name: string, args: Record<string, unknown> | undefined): string {
  if (name === 'task' && typeof args?.description === 'string') return truncate(args.description)
  for (const v of Object.values(args ?? {})) if (typeof v === 'string' && v.trim()) return truncate(v.replace(/\s+/g, ' ').trim())
  return name
}

/** “同一个任务”的比较键，用于识别重试 */
function callKey(name: string, args: Record<string, unknown> | undefined): string {
  if (name === 'task') return 'task:' + String(args?.description ?? args?.prompt ?? '')
  return name + ':' + JSON.stringify(args ?? {})
}

// ───────────── 适配器 ─────────────

interface PendingCall { id: string; name: string; actor: string; key: string; done: boolean }

export function fromMessages(messages: LcMessage[]): AgentTrace {
  const actors: Actor[] = [
    { id: USER_ID, label: '用户', kind: 'user' },
    { id: LEAD_ID, label: '主 agent', kind: 'lead' },
  ]
  const events: AgentEvent[] = []
  const calls: PendingCall[] = []
  const failedKeys = new Map<string, string>() // key → 最近一次失败的 actor id
  let workerSeq = 0
  let anon = 0

  const toolActor = (name: string): Actor => {
    const id = `tool:${name}`
    let a = actors.find((x) => x.id === id)
    if (!a) { a = { id, label: name, kind: 'tool' }; actors.push(a) }
    return a
  }

  for (const msg of messages) {
    const text = extractText(msg.content)
    if (msg.type === 'human') {
      events.push({ type: 'ask', text: truncate(text) })
    } else if (msg.type === 'ai') {
      const tcs = msg.tool_calls ?? []
      if (tcs.length === 0) {
        if (text) events.push({ type: 'answer', text: truncate(text) })
        continue
      }
      const planned = tcs.map((tc) => {
        const name = tc.name ?? 'tool'
        const key = callKey(name, tc.args)
        return { tc, name, key, text: callText(name, tc.args), retryOf: failedKeys.get(key) }
      })
      const isRetry = planned.every((p) => p.retryOf !== undefined)
      const targets: CallTarget[] = []
      const retries: RetryCall[] = []
      for (const p of planned) {
        let actor: Actor
        if (p.name === 'task') {
          workerSeq += 1
          const type = typeof p.tc.args?.subagent_type === 'string' ? (p.tc.args.subagent_type as string) : 'task'
          actor = { id: `worker:${workerSeq}`, label: `${type} ${workerSeq}`, kind: 'worker', seq: workerSeq }
          actors.push(actor)
        } else {
          actor = toolActor(p.name)
        }
        calls.push({ id: p.tc.id ?? `call-${anon++}`, name: p.name, actor: actor.id, key: p.key, done: false })
        targets.push({ actor: actor.id, text: p.text })
        if (p.retryOf !== undefined) {
          retries.push({ from: p.retryOf, to: actor.id, text: p.text })
          failedKeys.delete(p.key)
        }
      }
      events.push(isRetry ? { type: 'retry', calls: retries } : { type: 'delegate', calls: targets })
    } else if (msg.type === 'tool') {
      let call = msg.tool_call_id ? calls.find((c) => c.id === msg.tool_call_id) : undefined
      call ??= calls.find((c) => !c.done && c.name === msg.name)
      const actorId = call?.actor ?? (msg.name && msg.name !== 'task' ? toolActor(msg.name).id : undefined)
      if (!actorId) continue
      if (call) call.done = true
      const isTask = (call?.name ?? msg.name) === 'task'
      const status = isTask ? statusOfTask(msg, text) : statusOfPlainTool(msg, text)
      const k = msg.additional_kwargs
      const summary = isTask ? (k?.subagent_result_brief ?? (status === 'ok' ? text : (k?.subagent_error ?? text))) : text
      events.push({ type: 'result', actor: actorId, status, text: truncate(summary) })
      if (call && status !== 'ok') failedKeys.set(call.key, actorId)
    }
  }
  return { actors, events }
}

/** 汇总 usage_metadata：total 优先取消息自带，缺省为 input+output；calls = 带 usage 的消息数 */
export function tokenUsage(messages: LcMessage[]): { input: number; output: number; total: number; calls: number } {
  let input = 0, output = 0, total = 0, calls = 0
  for (const m of messages) {
    const u = m.usage_metadata
    if (!u) continue
    const i = u.input_tokens ?? 0, o = u.output_tokens ?? 0
    input += i
    output += o
    total += u.total_tokens ?? i + o
    calls += 1
  }
  return { input, output, total, calls }
}

// ───────────── 旁白 ─────────────

export function actorOf(trace: AgentTrace, id: string): Actor | undefined {
  return trace.actors.find((a) => a.id === id)
}

function nameOf(trace: AgentTrace, id: string): string {
  const a = actorOf(trace, id)
  if (!a) return id
  return a.kind === 'worker' ? `子任务 ${a.seq}` : a.label
}

/** 某 actor 若是某次重试的目标，返回被重试的那个 actor id */
function retriedFrom(trace: AgentTrace, id: string): string | undefined {
  for (const ev of trace.events) if (ev.type === 'retry') for (const c of ev.calls) if (c.to === id) return c.from
  return undefined
}

/** 一句中文旁白（约 20 个汉字以内） */
export function describeEvent(ev: AgentEvent, trace: AgentTrace): string {
  switch (ev.type) {
    case 'ask':
      return '用户提出问题'
    case 'delegate': {
      const kinds = ev.calls.map((c) => actorOf(trace, c.actor)?.kind)
      const allWorkers = kinds.every((k) => k === 'worker')
      if (ev.calls.length === 1) return allWorkers ? '主 agent 派出一个子任务' : `主 agent 调用 ${nameOf(trace, ev.calls[0].actor)}`
      return allWorkers ? `主 agent 同时派出 ${ev.calls.length} 个子任务` : `主 agent 同时发起 ${ev.calls.length} 个调用`
    }
    case 'result': {
      const who = nameOf(trace, ev.actor)
      const again = retriedFrom(trace, ev.actor) !== undefined
      if (again) return ev.status === 'ok' ? `${who} 重试成功` : `${who} 重试仍${ev.status === 'timed_out' ? '超时' : '失败'}`
      const tool = actorOf(trace, ev.actor)?.kind === 'tool'
      switch (ev.status) {
        case 'ok': return tool ? `${who} 返回结果` : `${who} 完成`
        case 'failed': return `${who} 失败`
        case 'cancelled': return `${who} 被取消`
        case 'timed_out': return `${who} 超时`
      }
      return who
    }
    case 'retry':
      return ev.calls.length === 1 ? `重试${nameOf(trace, ev.calls[0].from)}` : `重试 ${ev.calls.length} 个调用`
    case 'answer':
      return trace.events.some((e) => e.type === 'result') ? '汇总结果，回答用户' : '直接回答用户'
  }
}

// ───────────── 回放状态 ─────────────

export type ActorState = 'hidden' | 'idle' | 'running' | ResultStatus

/** 一个事件里信息的流向（from → to，均为 actor id） */
export interface Flow { from: string; to: string }

export function eventFlows(ev: AgentEvent): Flow[] {
  switch (ev.type) {
    case 'ask': return [{ from: USER_ID, to: LEAD_ID }]
    case 'delegate': return ev.calls.map((c) => ({ from: LEAD_ID, to: c.actor }))
    case 'result': return [{ from: ev.actor, to: LEAD_ID }]
    case 'retry': return ev.calls.map((c) => ({ from: LEAD_ID, to: c.to }))
    case 'answer': return [{ from: LEAD_ID, to: USER_ID }]
  }
}

/** 事件涉及的 actor（含两端的用户 / 主 agent） */
export function eventActors(ev: AgentEvent): string[] {
  const ids = new Set<string>()
  for (const f of eventFlows(ev)) { ids.add(f.from); ids.add(f.to) }
  if (ev.type === 'retry') for (const c of ev.calls) ids.add(c.from)
  return [...ids]
}

/** 回放到第 at 个事件（0 = 尚未开始）时各 actor 的状态；用户与主 agent 始终为 idle */
export function actorStatesAt(trace: AgentTrace, at: number): Record<string, ActorState> {
  const st: Record<string, ActorState> = {}
  for (const a of trace.actors) st[a.id] = a.kind === 'user' || a.kind === 'lead' ? 'idle' : 'hidden'
  for (const ev of trace.events.slice(0, Math.max(0, at))) {
    if (ev.type === 'delegate') for (const c of ev.calls) st[c.actor] = 'running'
    else if (ev.type === 'retry') for (const c of ev.calls) st[c.to] = 'running'
    else if (ev.type === 'result') st[ev.actor] = ev.status
  }
  return st
}

// ───────────── 分步 ─────────────

/** 把事件序列切成回放步骤：group 里列出的相邻事件合并为一步，其余各自一步。返回每步覆盖的事件下标闭区间 */
export function stepsFromGroups(n: number, group: number[][] = []): { from: number; to: number }[] {
  const spans = group
    .map((g) => g.filter((i) => Number.isInteger(i) && i >= 0 && i < n))
    .filter((g) => g.length > 0)
    .map((g) => ({ from: Math.min(...g), to: Math.max(...g) }))
    .sort((a, b) => a.from - b.from)
  const out: { from: number; to: number }[] = []
  let i = 0
  while (i < n) {
    const sp = spans.find((s) => s.from === i)
    if (sp) { out.push(sp); i = sp.to + 1 } else { out.push({ from: i, to: i }); i += 1 }
  }
  return out
}
