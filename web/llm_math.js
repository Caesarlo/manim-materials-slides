// Pure LLM demonstration logic ported from manim-materials-slides-v0 (MIT).
// Load after deck.js: Deck.llmMath.{tokenize,attention,sampling,embedding,trace}.
// These are educational calculations and trace adapters, not a model or tokenizer from a real model.
(function () {
  'use strict';
  const math = {};
  math.tokenize = (() => {
    const exports = {};
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTokenizer = makeTokenizer;
exports.isWordStart = isWordStart;
exports.displayToken = displayToken;
function makeTokenizer(vocab) {
    const index = new Map();
    vocab.forEach((t, i) => {
        if (t !== '' && !index.has(t))
            index.set(t, i);
    });
    const maxLen = Math.max(1, ...[...index.keys()].map((t) => t.length));
    const base = vocab.length;
    return {
        vocab,
        encode(text) {
            const tokens = [];
            const ids = [];
            let i = 0;
            while (i < text.length) {
                let hit = null;
                for (let len = Math.min(maxLen, text.length - i); len >= 1; len--) {
                    const piece = text.slice(i, i + len);
                    if (index.has(piece)) {
                        hit = piece;
                        break;
                    }
                }
                if (hit !== null) {
                    tokens.push(hit);
                    ids.push(index.get(hit));
                    i += hit.length;
                }
                else {
                    const cp = text.codePointAt(i);
                    const ch = String.fromCodePoint(cp);
                    tokens.push(ch);
                    ids.push(base + cp);
                    i += ch.length;
                }
            }
            return { tokens, ids };
        },
        decode(ids) {
            return ids
                .map((id) => {
                if (id < 0 || !Number.isInteger(id))
                    throw new RangeError(`非法词元 id：${id}`);
                return id < base ? vocab[id] : String.fromCodePoint(id - base);
            })
                .join('');
        },
    };
}
/** 词元是否开启一个新词（第一个词元，或带前导空格） */
function isWordStart(token, i) {
    return i === 0 || token.startsWith(' ');
}
/** 显示用文本：去掉前导空格（全是空格时用 ␣） */
function displayToken(token) {
    const t = token.replace(/^ +/, '');
    return t === '' ? '␣' : t;
}

    return exports;
  })();
  math.attention = (() => {
    const exports = {};
"use strict";
// 缩放点积注意力的真实计算（纯逻辑）。权重 = softmax(Q·Kᵀ / √d)，因果时上三角为 0、各行重新归一化。
// Q、K 来自“随机小模型”：对每个词元字符串做确定性哈希 → 伪随机向量（同一词元永远得到同一向量），
// 不是任何真实模型的输出，仅用来演示注意力的计算形状。
Object.defineProperty(exports, "__esModule", { value: true });
exports.softmax = softmax;
exports.causalMask = causalMask;
exports.attention = attention;
exports.hashString = hashString;
exports.mulberry32 = mulberry32;
exports.seededEmbedding = seededEmbedding;
exports.qkFromTokens = qkFromTokens;
/** 数值稳定的 softmax；-Infinity 项权重为 0；全为 -Infinity 时返回全 0 */
function softmax(xs) {
    if (xs.length === 0)
        return [];
    const m = Math.max(...xs);
    if (m === -Infinity)
        return xs.map(() => 0);
    const e = xs.map((x) => Math.exp(x - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
}
/** n×n 因果掩码：true = 被遮住（列 > 行，即不能看未来） */
function causalMask(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j > i));
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
/** 权重矩阵 n×n：softmax(QKᵀ/√d)，causal 时被掩码的格子在 softmax 前置 -Infinity */
function attention(Q, K, opts = {}) {
    const n = Q.length;
    if (K.length !== n)
        throw new Error('Q 与 K 的词元数必须相同');
    if (n === 0)
        return [];
    const d = Q[0].length;
    const mask = opts.causal ? causalMask(n) : null;
    return Q.map((q, i) => softmax(K.map((k, j) => (mask && mask[i][j] ? -Infinity : dot(q, k) / Math.sqrt(d)))));
}
/** FNV-1a 32 位哈希 */
function hashString(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** mulberry32 伪随机数发生器，返回 [0,1) */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 每个词元一个 d 维标准正态向量，仅由（词元字符串, seed）决定 */
function seededEmbedding(tokens, d, seed) {
    return tokens.map((tok) => {
        const rand = mulberry32((hashString(tok) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0);
        return Array.from({ length: d }, () => {
            const u1 = Math.max(rand(), 1e-12);
            const u2 = rand();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // Box–Muller
        });
    });
}
/** 确定的 Q、K（两组不同种子的词元向量，相当于两个随机投影） */
function qkFromTokens(tokens, d, seed) {
    return { Q: seededEmbedding(tokens, d, seed), K: seededEmbedding(tokens, d, seed + 7919) };
}

    return exports;
  })();
  math.sampling = (() => {
    const exports = {};
"use strict";
// 采样的纯逻辑：温度 softmax、top-k、top-p、熵。不 import 任何带 CSS 的模块，可在 vitest 的 node 环境里测试。
Object.defineProperty(exports, "__esModule", { value: true });
exports.softmaxT = softmaxT;
exports.argmax = argmax;
exports.topK = topK;
exports.entropy = entropy;
exports.topP = topP;
exports.renormalize = renormalize;
/** 带温度的 softmax：p_i = exp(z_i/T) / Σ exp(z_j/T)。减去最大值保证数值稳定；T 必须 > 0。 */
function softmaxT(logits, T = 1) {
    if (!(T > 0))
        throw new RangeError(`温度 T 必须大于 0，收到 ${T}`);
    if (logits.length === 0)
        return [];
    const m = Math.max(...logits);
    const e = logits.map((z) => Math.exp((z - m) / T));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
}
/** 最大值的下标；并列取靠前者 */
function argmax(xs) {
    let best = 0;
    for (let i = 1; i < xs.length; i++)
        if (xs[i] > xs[best])
            best = i;
    return best;
}
/** 概率最高的 k 项（降序）；并列时保持原顺序（稳定排序）。k 超出长度时返回全部。 */
function topK(probs, labels, k) {
    return probs
        .map((p, index) => ({ label: labels[index], p, index }))
        .sort((a, b) => b.p - a.p || a.index - b.index)
        .slice(0, Math.max(0, k));
}
/** 香农熵，以 2 为底，单位 bit；0·log0 记作 0 */
function entropy(probs) {
    let h = 0;
    for (const p of probs)
        if (p > 0)
            h -= p * Math.log2(p);
    return h;
}
/** 核采样（top-p）：按概率降序累加，取累计概率 ≥ p 的最小集合；返回下标（升序）。并列时原顺序靠前者先入选。 */
function topP(probs, p) {
    const order = probs.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i);
    const keep = [];
    let cum = 0;
    for (const { v, i } of order) {
        keep.push(i);
        cum += v;
        if (cum >= p - 1e-12)
            break;
    }
    return keep.sort((a, b) => a - b);
}
/** 只保留 keepIdx 中的项并重新归一化（其余置 0） */
function renormalize(probs, keepIdx) {
    const keep = new Set(keepIdx);
    const s = probs.reduce((a, v, i) => (keep.has(i) ? a + v : a), 0);
    return probs.map((v, i) => (keep.has(i) && s > 0 ? v / s : 0));
}

    return exports;
  })();
  math.embedding = (() => {
    const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dot = dot;
exports.norm = norm;
exports.cosine = cosine;
exports.nearest = nearest;
exports.pca2d = pca2d;
function checkVector(v) {
    if (!v.every(Number.isFinite))
        throw new RangeError('Vectors must contain finite numbers');
}
function checkPair(a, b) {
    checkVector(a);
    checkVector(b);
    if (a.length !== b.length)
        throw new RangeError('Vector dimensions must match');
}
function checkMatrix(vectors) {
    vectors.forEach(v => {
        checkVector(v);
        if (v.length !== vectors[0].length)
            throw new RangeError('Vector dimensions must match');
    });
}
function dot(a, b) {
    checkPair(a, b);
    return a.reduce((sum, value, i) => sum + value * b[i], 0);
}
function norm(v) {
    checkVector(v);
    return Math.hypot(...v);
}
/** Cosine is zero if either vector is zero, including two zero vectors. */
function cosine(a, b) {
    checkPair(a, b);
    const scaleA = Math.max(0, ...a.map(Math.abs)), scaleB = Math.max(0, ...b.map(Math.abs));
    if (!scaleA || !scaleB)
        return 0;
    const aa = a.map(x => x / scaleA), bb = b.map(x => x / scaleB);
    const value = dot(aa, bb) / norm(aa) / norm(bb);
    return Math.max(-1, Math.min(1, value));
}
/** Indices ordered by descending cosine; ties use the lower index. */
function nearest(vectors, queryIndex, k) {
    checkMatrix(vectors);
    if (!Number.isInteger(queryIndex) || queryIndex < 0 || queryIndex >= vectors.length)
        throw new RangeError('Invalid query index');
    if (!Number.isInteger(k) || k < 0)
        throw new RangeError('k must be a nonnegative integer');
    return vectors.map((v, index) => ({ index, similarity: cosine(vectors[queryIndex], v) }))
        .filter(v => v.index !== queryIndex)
        .sort((a, b) => b.similarity - a.similarity || a.index - b.index)
        .slice(0, k).map(v => v.index);
}
/** Centered deterministic PCA scores, one [PC1, PC2] per input row.
 * Power iteration starts at every coordinate axis, then keeps the strongest
 * solution: a single fixed seed can be orthogonal to the leading eigenspace.
 * Missing components (zero data / rank one) have exactly zero scores.
 */
function pca2d(vectors) {
    checkMatrix(vectors);
    const n = vectors.length, d = vectors[0]?.length ?? 0;
    if (!n)
        return [];
    if (!d || n === 1)
        return vectors.map(() => [0, 0]);
    const mean = Array.from({ length: d }, (_, j) => vectors.reduce((s, v) => s + v[j] / n, 0));
    const centered = vectors.map(v => v.map((x, j) => x - mean[j]));
    centered.forEach(checkVector);
    const scale = Math.max(0, ...centered.flat().map(Math.abs));
    if (!scale)
        return vectors.map(() => [0, 0]);
    const rows = centered.map(v => v.map(x => x / scale));
    const covariance = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => rows.reduce((sum, row) => sum + row[i] * row[j] / n, 0)));
    const multiply = (v) => covariance.map(row => dot(row, v));
    const components = [];
    const eigenvalues = [];
    const removePrevious = (v) => {
        // Two passes avoid accumulating a residual along the first component.
        for (let pass = 0; pass < 2; pass++)
            for (const previous of components) {
                const projection = dot(v, previous);
                v = v.map((x, j) => x - projection * previous[j]);
            }
        return v;
    };
    for (let component = 0; component < Math.min(2, d); component++) {
        let best = [], bestValue = 0;
        for (let axis = 0; axis < d; axis++) {
            let v = removePrevious(Array.from({ length: d }, (_, j) => Number(j === axis)));
            for (let iteration = 0; iteration < 512; iteration++) {
                const next = removePrevious(multiply(v)), length = norm(next);
                if (length <= Number.EPSILON) {
                    v = [];
                    break;
                }
                const unit = next.map(x => x / length);
                const delta = norm(unit.map((x, j) => x - v[j]));
                v = unit;
                if (delta < 1e-13)
                    break;
            }
            if (!v.length)
                continue;
            const value = dot(v, multiply(v));
            if (value > bestValue) {
                bestValue = value;
                best = v;
            }
        }
        if (!best.length || bestValue <= (eigenvalues[0] ?? 1) * 1e-12)
            break;
        const pivot = best.reduce((at, x, j) => Math.abs(x) > Math.abs(best[at]) ? j : at, 0);
        if (best[pivot] < 0)
            best = best.map(x => -x);
        components.push(best);
        eigenvalues.push(bestValue);
    }
    return centered.map(row => [components[0] ? dot(row, components[0]) : 0, components[1] ? dot(row, components[1]) : 0]);
}

    return exports;
  })();
  math.trace = (() => {
    const exports = {};
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_ID = exports.USER_ID = void 0;
exports.extractText = extractText;
exports.truncate = truncate;
exports.fromMessages = fromMessages;
exports.tokenUsage = tokenUsage;
exports.actorOf = actorOf;
exports.retriedFrom = retriedFrom;
exports.describeEvent = describeEvent;
exports.eventFlows = eventFlows;
exports.eventActors = eventActors;
exports.actorStatesAt = actorStatesAt;
exports.stepsFromGroups = stepsFromGroups;
exports.USER_ID = 'user';
exports.LEAD_ID = 'lead';
// ───────────── 文本工具 ─────────────
/** 从 string / block 数组里取出正文（跳过 thinking、tool_use 等块），压缩空白 */
function extractText(content) {
    const parts = [];
    const walk = (c) => {
        if (typeof c === 'string')
            parts.push(c);
        else if (Array.isArray(c))
            c.forEach(walk);
        else if (c && typeof c === 'object') {
            const b = c;
            if ((b.type === undefined || b.type === 'text') && typeof b.text === 'string')
                parts.push(b.text);
        }
    };
    walk(content);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
function truncate(s, max = 40) {
    const chars = Array.from(s);
    return chars.length <= max ? s : chars.slice(0, max - 1).join('') + '…';
}
const ERROR_RE = /^\s*(error|exception|traceback|fail(ed|ure)?)\b|^\s*(错误|失败|异常)/i;
function statusOfPlainTool(msg, text) {
    if (msg.status === 'error')
        return 'failed';
    return ERROR_RE.test(text) ? 'failed' : 'ok';
}
function statusOfTask(msg, text) {
    switch (msg.additional_kwargs?.subagent_status) {
        case 'completed': return 'ok';
        case 'failed': return 'failed';
        case 'cancelled': return 'cancelled';
        case 'timed_out':
        case 'polling_timed_out': return 'timed_out';
        default: return statusOfPlainTool(msg, text);
    }
}
/** 一次调用的一句任务描述：task 用 description，其它工具取第一个字符串参数，否则用工具名 */
function callText(name, args) {
    if (name === 'task' && typeof args?.description === 'string')
        return truncate(args.description);
    for (const v of Object.values(args ?? {}))
        if (typeof v === 'string' && v.trim())
            return truncate(v.replace(/\s+/g, ' ').trim());
    return name;
}
/** “同一个任务”的比较键，用于识别重试 */
function callKey(name, args) {
    if (name === 'task')
        return 'task:' + String(args?.description ?? args?.prompt ?? '');
    return name + ':' + JSON.stringify(args ?? {});
}
function fromMessages(messages) {
    const actors = [
        { id: exports.USER_ID, label: '用户', kind: 'user' },
        { id: exports.LEAD_ID, label: '主 agent', kind: 'lead' },
    ];
    const events = [];
    const calls = [];
    const failedKeys = new Map(); // key → 最近一次失败的 actor id
    let workerSeq = 0;
    let anon = 0;
    const toolActor = (name) => {
        const id = `tool:${name}`;
        let a = actors.find((x) => x.id === id);
        if (!a) {
            a = { id, label: name, kind: 'tool' };
            actors.push(a);
        }
        return a;
    };
    for (const msg of messages) {
        const text = extractText(msg.content);
        if (msg.type === 'human') {
            events.push({ type: 'ask', text: truncate(text) });
        }
        else if (msg.type === 'ai') {
            const tcs = msg.tool_calls ?? [];
            if (tcs.length === 0) {
                if (text)
                    events.push({ type: 'answer', text: truncate(text) });
                continue;
            }
            const planned = tcs.map((tc) => {
                const name = tc.name ?? 'tool';
                const key = callKey(name, tc.args);
                return { tc, name, key, text: callText(name, tc.args), retryOf: failedKeys.get(key) };
            });
            const isRetry = planned.every((p) => p.retryOf !== undefined);
            const targets = [];
            const retries = [];
            for (const p of planned) {
                let actor;
                if (p.name === 'task') {
                    workerSeq += 1;
                    const type = typeof p.tc.args?.subagent_type === 'string' ? p.tc.args.subagent_type : 'task';
                    actor = { id: `worker:${workerSeq}`, label: `${type} ${workerSeq}`, kind: 'worker', seq: workerSeq };
                    actors.push(actor);
                }
                else {
                    actor = toolActor(p.name);
                }
                calls.push({ id: p.tc.id ?? `call-${anon++}`, name: p.name, actor: actor.id, key: p.key, done: false });
                targets.push({ actor: actor.id, text: p.text });
                if (p.retryOf !== undefined) {
                    retries.push({ from: p.retryOf, to: actor.id, text: p.text });
                    failedKeys.delete(p.key);
                }
            }
            events.push(isRetry ? { type: 'retry', calls: retries } : { type: 'delegate', calls: targets });
        }
        else if (msg.type === 'tool') {
            let call = msg.tool_call_id ? calls.find((c) => c.id === msg.tool_call_id) : undefined;
            call ?? (call = calls.find((c) => !c.done && c.name === msg.name));
            const actorId = call?.actor ?? (msg.name && msg.name !== 'task' ? toolActor(msg.name).id : undefined);
            if (!actorId)
                continue;
            if (call)
                call.done = true;
            const isTask = (call?.name ?? msg.name) === 'task';
            const status = isTask ? statusOfTask(msg, text) : statusOfPlainTool(msg, text);
            const k = msg.additional_kwargs;
            const summary = isTask ? (k?.subagent_result_brief ?? (status === 'ok' ? text : (k?.subagent_error ?? text))) : text;
            events.push({ type: 'result', actor: actorId, status, text: truncate(summary) });
            if (call && status !== 'ok')
                failedKeys.set(call.key, actorId);
        }
    }
    return { actors, events };
}
/** 汇总 usage_metadata：total 优先取消息自带，缺省为 input+output；calls = 带 usage 的消息数 */
function tokenUsage(messages) {
    let input = 0, output = 0, total = 0, calls = 0;
    for (const m of messages) {
        const u = m.usage_metadata;
        if (!u)
            continue;
        const i = u.input_tokens ?? 0, o = u.output_tokens ?? 0;
        input += i;
        output += o;
        total += u.total_tokens ?? i + o;
        calls += 1;
    }
    return { input, output, total, calls };
}
// ───────────── 旁白 ─────────────
function actorOf(trace, id) {
    return trace.actors.find((a) => a.id === id);
}
function nameOf(trace, id) {
    const a = actorOf(trace, id);
    if (!a)
        return id;
    return a.kind === 'worker' ? `子任务 ${a.seq}` : a.label;
}
/** 某 actor 若在 upTo 事件之前就已是某次重试的目标，返回被重试的那个 actor id（之后才发生的重试不算：首次失败不是“重试仍失败”） */
function retriedFrom(trace, id, upTo) {
    for (const ev of trace.events) {
        if (ev === upTo)
            break;
        if (ev.type === 'retry')
            for (const c of ev.calls)
                if (c.to === id)
                    return c.from;
    }
    return undefined;
}
/** 一句中文旁白（约 20 个汉字以内） */
function describeEvent(ev, trace) {
    switch (ev.type) {
        case 'ask':
            return '用户提出问题';
        case 'delegate': {
            const kinds = ev.calls.map((c) => actorOf(trace, c.actor)?.kind);
            const allWorkers = kinds.every((k) => k === 'worker');
            if (ev.calls.length === 1)
                return allWorkers ? '主 agent 派出一个子任务' : `主 agent 调用 ${nameOf(trace, ev.calls[0].actor)}`;
            return allWorkers ? `主 agent 同时派出 ${ev.calls.length} 个子任务` : `主 agent 同时发起 ${ev.calls.length} 个调用`;
        }
        case 'result': {
            const who = nameOf(trace, ev.actor);
            const again = retriedFrom(trace, ev.actor, ev) !== undefined;
            if (again)
                return ev.status === 'ok' ? `${who} 重试成功` : `${who} 重试仍${ev.status === 'timed_out' ? '超时' : '失败'}`;
            const tool = actorOf(trace, ev.actor)?.kind === 'tool';
            switch (ev.status) {
                case 'ok': return tool ? `${who} 返回结果` : `${who} 完成`;
                case 'failed': return `${who} 失败`;
                case 'cancelled': return `${who} 被取消`;
                case 'timed_out': return `${who} 超时`;
            }
            return who;
        }
        case 'retry':
            return ev.calls.length === 1 ? `重试${nameOf(trace, ev.calls[0].from)}` : `重试 ${ev.calls.length} 个调用`;
        case 'answer':
            return trace.events.some((e) => e.type === 'result') ? '汇总结果，回答用户' : '直接回答用户';
    }
}
function eventFlows(ev) {
    switch (ev.type) {
        case 'ask': return [{ from: exports.USER_ID, to: exports.LEAD_ID }];
        case 'delegate': return ev.calls.map((c) => ({ from: exports.LEAD_ID, to: c.actor }));
        case 'result': return [{ from: ev.actor, to: exports.LEAD_ID }];
        case 'retry': return ev.calls.map((c) => ({ from: exports.LEAD_ID, to: c.to }));
        case 'answer': return [{ from: exports.LEAD_ID, to: exports.USER_ID }];
    }
}
/** 事件涉及的 actor（含两端的用户 / 主 agent） */
function eventActors(ev) {
    const ids = new Set();
    for (const f of eventFlows(ev)) {
        ids.add(f.from);
        ids.add(f.to);
    }
    if (ev.type === 'retry')
        for (const c of ev.calls)
            ids.add(c.from);
    return [...ids];
}
/** 回放到第 at 个事件（0 = 尚未开始）时各 actor 的状态；用户与主 agent 始终为 idle */
function actorStatesAt(trace, at) {
    const st = {};
    for (const a of trace.actors)
        st[a.id] = a.kind === 'user' || a.kind === 'lead' ? 'idle' : 'hidden';
    for (const ev of trace.events.slice(0, Math.max(0, at))) {
        if (ev.type === 'delegate')
            for (const c of ev.calls)
                st[c.actor] = 'running';
        else if (ev.type === 'retry')
            for (const c of ev.calls)
                st[c.to] = 'running';
        else if (ev.type === 'result')
            st[ev.actor] = ev.status;
    }
    return st;
}
// ───────────── 分步 ─────────────
/** 把事件序列切成回放步骤：group 里列出的相邻事件合并为一步，其余各自一步。返回每步覆盖的事件下标闭区间 */
function stepsFromGroups(n, group = []) {
    const spans = group
        .map((g) => g.filter((i) => Number.isInteger(i) && i >= 0 && i < n))
        .filter((g) => g.length > 0)
        .map((g) => ({ from: Math.min(...g), to: Math.max(...g) }))
        .sort((a, b) => a.from - b.from);
    const out = [];
    let i = 0;
    while (i < n) {
        const sp = spans.find((s) => s.from === i);
        if (sp) {
            out.push(sp);
            i = sp.to + 1;
        }
        else {
            out.push({ from: i, to: i });
            i += 1;
        }
    }
    return out;
}

    return exports;
  })();
  window.Deck.llmMath = math;
})();
