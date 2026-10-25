// 由 tools/cif_to_ts.py 生成，来源：SrTiO3.cif（空间群 P m -3 m，5 个原子/晶胞）。不要手改。
import type { Crystal } from '@/packs/materials/structure'

export const SrTiO3: Crystal = {
  name: 'SrTiO₃',
  lattice: [[3.905, 0.0, 0.0], [0.0, 3.905, 0.0], [0.0, 0.0, 3.905]],
  atoms: [
    { el: 'Sr', frac: [0.0, 0.0, 0.0] },
    { el: 'Ti', frac: [0.5, 0.5, 0.5] },
    { el: 'O', frac: [0.5, 0.5, 0.0] },
    { el: 'O', frac: [0.0, 0.5, 0.5] },
    { el: 'O', frac: [0.5, 0.0, 0.5] },
  ],
}
