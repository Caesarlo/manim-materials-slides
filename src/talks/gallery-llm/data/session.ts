// 示意会话（手写数据，字段名与 harness 线程的消息格式一致，不是真实日志）。
// 流程：用户提问 → 主 agent 并行派出 3 个子任务 → 其中 1 个超时 → 同样的任务重试成功 → 汇总回答。
import type { LcMessage } from '@/packs/llm/agentTrace'

export const session: LcMessage[] = [
  { type: 'human', id: 'm1', content: '估算材料 A 在 600 K 的 zT，并核对已有文献' },
  {
    type: 'ai',
    id: 'm2',
    content: '',
    additional_kwargs: { reasoning_content: '三件事互不依赖，可以并行：查文献、读本地数据、做计算。' },
    tool_calls: [
      { id: 'call_1', name: 'task', args: { description: '检索材料 A 的文献', prompt: '查找材料 A 的热电性能文献', subagent_type: 'general-purpose' } },
      { id: 'call_2', name: 'task', args: { description: '读取本地数据表', prompt: '读取 σ、S、κ 数据表', subagent_type: 'general-purpose' } },
      { id: 'call_3', name: 'task', args: { description: '运行 zT 计算', prompt: '用数据表算出 600 K 的 zT', subagent_type: 'bash' } },
    ],
    usage_metadata: { input_tokens: 1200, output_tokens: 180, total_tokens: 1380 },
  },
  {
    type: 'tool', name: 'task', tool_call_id: 'call_1', content: '已找到若干相关文献的摘要',
    additional_kwargs: { subagent_status: 'completed', subagent_result_brief: '找到相关文献' },
  },
  {
    type: 'tool', name: 'task', tool_call_id: 'call_2', content: '数据表已读取',
    additional_kwargs: { subagent_status: 'completed', subagent_result_brief: '读到数据表' },
  },
  {
    type: 'tool', name: 'task', tool_call_id: 'call_3', content: '',
    additional_kwargs: { subagent_status: 'timed_out', subagent_error: '执行超时' },
  },
  {
    type: 'ai',
    id: 'm6',
    content: '计算子任务超时，换一个新的子任务再试一次。',
    tool_calls: [
      { id: 'call_4', name: 'task', args: { description: '运行 zT 计算', prompt: '用数据表算出 600 K 的 zT', subagent_type: 'bash' } },
    ],
    usage_metadata: { input_tokens: 1800, output_tokens: 90, total_tokens: 1890 },
  },
  {
    type: 'tool', name: 'task', tool_call_id: 'call_4', content: '计算完成',
    additional_kwargs: { subagent_status: 'completed', subagent_result_brief: '算出 zT' },
  },
  {
    type: 'ai',
    id: 'm8',
    content: [{ type: 'text', text: '已结合文献与本地数据，估算出 zT 并给出结论。' }],
    usage_metadata: { input_tokens: 2100, output_tokens: 220, total_tokens: 2320 },
  },
]
