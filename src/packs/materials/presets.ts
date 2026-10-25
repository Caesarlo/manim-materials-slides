// 常见结构的成键/配位规则。晶体数据本身由 tools/cif_to_ts.py 从 CIF 生成（见 src/talk/data/）。
import type { BuildOptions } from './structure'

/** 钙钛矿 ABO3：B 位八面体 */
export const perovskite = (b: string, o = 'O', max = 2.2): BuildOptions => ({ polyhedra: [{ center: b, ligand: o, max }] })

export const SrTiO3_opts: BuildOptions = perovskite('Ti')
/** Bi2Te3：BiTe6 八面体（Bi–Te 约 3.07 / 3.25 Å，范德华间隙处的 Te–Te 约 3.7 Å 不成键） */
export const Bi2Te3_opts: BuildOptions = { polyhedra: [{ center: 'Bi', ligand: 'Te', max: 3.45 }] }
