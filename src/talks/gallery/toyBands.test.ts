import { describe, expect, it } from 'vitest'
import { findGap } from '@/packs/plot/bandMath'
import { toyMetal, toySemiconductor } from './toyBands'

describe('玩具能带', () => {
  it('半导体：间接带隙 0.80 eV，VBM 在 Γ，CBM 在 X', () => {
    const g = findGap(toySemiconductor.bands, toySemiconductor.k)
    expect(g.metal).toBe(false)
    expect(g.direct).toBe(false)
    expect(g.gap).toBeCloseTo(0.8, 10)
    expect(g.vbm?.k).toBe(0)
    expect(g.cbm?.k).toBeCloseTo(1 / 3, 10)
  })
  it('金属：有能带穿过费米能级', () => {
    expect(findGap(toyMetal.bands, toyMetal.k).metal).toBe(true)
  })
})
