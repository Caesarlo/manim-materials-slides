// manim-web 场景，按点击一步一步演：
// 你描述“有哪些对象”（build）和“每一步做什么”（steps），舞台负责：
//  - 向前一步：播放该步动画
//  - 其他情况（回退/跳转/换页回来）：重建对象，并把 1..k 步瞬间应用到终态
// 所以无论怎么到达某一步，画面都一样。build 必须每次创建**全新**对象，不要把 mobject 放在模块变量里。
//
//   const stage = manimStage(host, {
//     build: ({ M, P }) => ({ a: new M.Circle({ color: P.accent }) }),
//     steps: [
//       ({ a }, { M }) => [new M.Create(a)],                       // 返回要一起播放的动画
//       async ({ a }, { M, play, wait }) => { await play(new M.Indicate(a)); await wait(0.3) },
//     ],
//   })
//   // 在 slide 的 mount() 里： return { enter: stage.go, destroy: stage.dispose }
import * as M from 'manim-web'
import { palette, type Palette } from './palette'

type Mob = InstanceType<typeof M.Mobject>
type Anim = InstanceType<typeof M.Animation>

export interface StageHelpers {
  M: typeof M
  P: Palette
  play(...anims: Anim[]): Promise<void>
  wait(seconds: number): Promise<void>
  add(...mobs: Mob[]): void
  remove(...mobs: Mob[]): void
  /** 跳转/回退时为 true：此时 play 会直接到终态 */
  fast: boolean
  /**
   * 公式逐项变形：相同的部分移动到新位置，不同的部分淡入淡出。结束后场景里只剩干净的 to。
   * （manim-web 的 TransformMatchingTex 会就地改写源公式，且不会把目标加入场景，直接用会留下叠影。）
   */
  morphTex(from: Mob, to: Mob, opts?: { duration?: number; transformMismatches?: boolean }): Promise<void>
}

export interface StageSpec<O extends Record<string, unknown>> {
  build(h: { M: typeof M; P: Palette }): O
  /** 可选：build 之后、所有 MathTex 渲染完成之后调用（getPart / 上色等必须等字形渲染完才能用） */
  prepare?(objects: O, h: { M: typeof M; P: Palette }): void
  steps: Array<(objects: O, h: StageHelpers) => Anim[] | Promise<void> | void>
  scene?: Partial<ConstructorParameters<typeof M.Scene>[1]>
}

/** 展开 AnimationGroup / LaggedStart 等，取出叶子动画 */
const leaves = (a: any): any[] => (a && Array.isArray(a.animations) ? a.animations.flatMap(leaves) : [a])

export function manimStage<O extends Record<string, unknown>>(host: HTMLElement, spec: StageSpec<O>) {
  const scene = new M.Scene(host, { backgroundOpacity: 0, frameWidth: 16, frameHeight: 9, ...spec.scene })
  let objects: O | null = null
  let at = 0
  let dead = false

  /** 等所有 MathTex 渲染完成（KaTeX → 纹理是异步的），否则变形时拿不到字形 */
  const ready = async (o: O) => {
    const jobs: Promise<void>[] = []
    for (const v of Object.values(o)) {
      const list = Array.isArray(v) ? v : [v]
      for (const m of list as any[]) if (m && typeof m.waitForRender === 'function') jobs.push(m.waitForRender())
    }
    await Promise.all(jobs)
  }

  // 瞬间应用：让每个动画走到终点并收尾（FadeOut 会移除、ReplacementTransform 会换位）
  const instant = (...anims: Anim[]) => {
    for (const a of anims.flat() as any[]) {
      for (const leaf of leaves(a)) if (leaf.mobject && !leaf.remover) scene.add(leaf.mobject)
      a.begin()
      a.interpolate(1)
      a.finish()
      for (const leaf of leaves(a)) leaf.cleanUpFromScene(scene)
    }
    return Promise.resolve()
  }
  const live = (...anims: Anim[]) => (dead ? Promise.resolve() : scene.play(...anims.flat()))
  const add = (...mobs: Mob[]) => { scene.add(...mobs.flat()) }
  const remove = (...mobs: Mob[]) => { scene.remove(...mobs.flat()) }

  async function apply(k: number, fast: boolean) {
    const h: StageHelpers = {
      M, P: palette, add, remove, fast,
      play: fast ? instant : live,
      wait: fast ? () => Promise.resolve() : (s) => (dead ? Promise.resolve() : scene.wait(s)),
      async morphTex(from, to, opts = {}) {
        if (!fast && !dead) {
          // 先放进一个组里：TransformMatchingTex 会把“新增部分”挂到源的父级上
          const holder = new M.VGroup()
          remove(from)
          holder.add(from as any)
          add(holder as unknown as Mob)
          await scene.play(new M.TransformMatchingTex(from as any, to as any, { duration: 1.2, ...opts }))
          remove(holder as unknown as Mob)
        } else remove(from)
        add(to)
      },
    }
    const out = spec.steps[k - 1](objects as O, h)
    if (Array.isArray(out)) await h.play(...out)
    else await out
  }

  async function go(step: number, animate: boolean) {
    if (dead) return
    if (objects && animate && step === at + 1) {
      await apply(step, false)
      at = step
      return
    }
    scene.clear({ render: false })
    objects = spec.build({ M, P: palette })
    await ready(objects)
    spec.prepare?.(objects, { M, P: palette })
    at = 0
    for (let k = 1; k <= step; k++) await apply(k, true)
    at = step
    scene.render()
  }

  return {
    go,
    freeze: () => scene.render(),
    dispose: () => { dead = true; scene.dispose() },
    scene,
  }
}
