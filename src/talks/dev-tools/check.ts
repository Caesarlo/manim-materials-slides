// 仅用于验证 csv_to_ts.py 生成的数据模块能通过 tsc（不依赖任何其它模块）。
import { zTData } from './data/zt'

export const ok: boolean =
  zTData.series.length > 0 &&
  zTData.series.every((s) => s.y.length === zTData.x.length) &&
  zTData.series[0].y.length === zTData.x.length
