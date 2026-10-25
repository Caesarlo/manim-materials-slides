import { agentSlide } from '@/packs/llm/agentFlow'
import { fromMessages } from '@/packs/llm/agentTrace'
import { session } from '../data/session'

// trace 由手写的消息数组经 fromMessages 生成（同时验证适配器）。
export const researchSession = agentSlide({
  name: '研究助手会话',
  trace: fromMessages(session),
  note: '示意会话（手写数据，格式同 harness 线程）',
  notes: '主 agent 通过 task 工具并行派出 3 个子任务；其中一个超时，主 agent 用同样的任务重试，成功后汇总回答。数据是手写的示意会话，字段与 harness 线程的消息格式一致。',
})
