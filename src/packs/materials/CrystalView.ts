// 三维晶体视图（three.js）：球棍 + 晶胞线 + 配位多面体，带“相机运镜”。
//
//   const view = new CrystalView(host, build(SrTiO3, SrTiO3_opts))
//   view.show({ cell: 1, atoms: 1, bonds: 0, polyhedra: 0 })        // 各部分的目标可见度 0..1，平滑过渡
//   view.dim(['Sr'], 0.1)                                           // 压暗某些元素，聚焦别的
//   await view.flyTo({ dir: [1, 0.6, 0.5], zoom: 1.4 }, 1400)      // 相机沿 dir 方向（z 轴朝上），zoom>1 为推近
//   view.onRender = () => { const p = view.project(pos) }           // 给 HTML 标签定位
//   view.setLabels(1, ['Sr','Ti'])                                  // 元素标签（每种元素一个代表原子），els 缺省 = 全部
//   view.setAxes(1)                                                 // a、b、c 晶格矢量箭头（从超胞原点出发）
//   view.highlight({ els: ['Ti'], indices: [3] })                   // 点名强调：放大 1.25 倍 + 描边，其余不变暗；null 取消
//   view.focusLayer({ axis: 'z', from: 0.2, to: 0.47 })             // 按层聚焦：区间外压暗到 0.1；null 取消
//   view.dispose()                                                  // 必须在 destroy 里调用
//
// 构造时可传 { orientation: [rx, ry, rz] }（弧度，欧拉角 XYZ）整体旋转模型：例如很“高”的层状晶胞（c 轴 30 Å）
// 在横向画面里又窄又小，绕 y 轴转 90° 让 c 轴横过画面即可铺满宽度。之后 flyTo 的 dir/target 都是旋转后的场景坐标。
//
// 单位是 Å，场景原点在超胞中心。拖动旋转、滚轮缩放（OrbitControls）；点击不影响翻页（deck 会区分拖动）。
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import { palette } from '@/runtime/palette'
import { layerMask, type Built, type LayerSpec, type Vec3 } from './structure'
import { elementsOf, layoutRow, pickLabelAtom, resolveHighlight, type HighlightSpec, type ScreenAtom } from './labels'

export type Parts = 'cell' | 'atoms' | 'bonds' | 'polyhedra'

const RADIUS: Record<string, number> = { O: 0.42, Ti: 0.5, Sr: 0.7, Ba: 0.75, Bi: 0.68, Te: 0.62, Se: 0.55, Pb: 0.7, Sn: 0.6, Si: 0.5 }
const HL_SCALE = 0.25 // 高亮放大 1.25 倍
const LAYER_DIM = 0.1
const AXIS_COLORS = [palette.accent, palette.amber, palette.teal]
const AXIS_NAMES = ['a', 'b', 'c']
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class CrystalView {
  onRender: (() => void) | null = null
  readonly built: Built
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500)
  private controls: OrbitControls
  private host: HTMLElement
  private raf = 0
  private orient: THREE.Euler
  private last = performance.now()
  private ro: ResizeObserver
  private fly: { t0: number; ms: number; p0: THREE.Vector3; p1: THREE.Vector3; c0: THREE.Vector3; c1: THREE.Vector3; done: () => void } | null = null

  private vis: Record<Parts, { cur: number; to: number }> = {
    cell: { cur: 1, to: 1 }, atoms: { cur: 1, to: 1 }, bonds: { cur: 0, to: 0 }, polyhedra: { cur: 0, to: 0 },
  }
  private elOp = new Map<string, { cur: number; to: number }>()
  private atomMats: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; el: string }[] = []
  private bondMats: { mat: THREE.MeshStandardMaterial; el: string; atom: number }[] = []
  private polyMats: { mat: THREE.Material; base: number; center: string; atom: number }[] = []
  // 高亮 / 按层聚焦：每个原子一个平滑量
  private hl: { cur: number; to: number }[] = []
  private lay: { cur: number; to: number }[] = []
  private layerMaskNow: boolean[] = []
  private atomO: number[] = [] // 每个原子当前的有效不透明度
  private shells: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = []
  // 标签与晶格矢量
  private labelVis = { cur: 0, to: 0 }
  private labelEls = new Map<string, { div: HTMLElement; cur: number; to: number }>()
  private leaders = new Map<string, SVGGElement>()
  private axesVis = { cur: 0, to: 0 }
  private axesGroup = new THREE.Group()
  private axesMats: THREE.MeshStandardMaterial[] = []
  private axisLabels: { div: HTMLElement; tip: THREE.Vector3 }[] = []
  private cellMat = new THREE.LineBasicMaterial({ color: palette.muted, transparent: true })

  constructor(host: HTMLElement, built: Built, opts: { orientation?: Vec3 } = {}) {
    this.host = host
    this.built = built
    this.orient = new THREE.Euler(...(opts.orientation ?? [0, 0, 0]))
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setClearColor(0xffffff, 0)
    host.append(this.renderer.domElement)

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd3da, 1.7))
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(6, 10, 8)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.set(-8, -4, -6)
    this.scene.add(fill)

    const c = new THREE.Vector3(...built.center)
    const outer = new THREE.Group() // 绕超胞中心整体旋转
    outer.rotation.copy(this.orient)
    this.scene.add(outer)
    const group = new THREE.Group()
    group.position.copy(c).multiplyScalar(-1) // 原点放在超胞中心
    outer.add(group)
    this.buildCell(group)
    this.buildAtoms(group)
    this.buildBonds(group)
    this.buildPolyhedra(group)
    this.layerMaskNow = this.built.atoms.map(() => true)
    this.buildAxes(group)
    this.buildLabels()

    this.camera.up.set(0, 0, 1) // 晶体学约定：c 轴朝上（必须在创建 OrbitControls 之前设置）
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = built.radius * 1.2
    this.controls.maxDistance = built.radius * 8

    const d = this.fitDistance(1)
    this.camera.position.set(1, 0.75, 0.55).normalize().multiplyScalar(d)
    this.controls.target.set(0, 0, 0)
    this.controls.update()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.last = performance.now()
    this.loop()
  }

  // ---- 构建 ------------------------------------------------------------
  private buildCell(g: THREE.Group) {
    // 角点下标是 ijk 三位二进制，只差一位的两个角点之间就是一条棱
    const k = this.built.corners.map((p) => new THREE.Vector3(...p))
    const pts: THREE.Vector3[] = []
    for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) pts.push(k[a], k[a | bit])
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), this.cellMat)
    g.add(lines)
    this.cell = lines
  }
  private cell!: THREE.Object3D

  private buildAtoms(g: THREE.Group) {
    const geo = new THREE.SphereGeometry(1, 40, 28)
    for (const a of this.built.atoms) {
      const mat = new THREE.MeshStandardMaterial({ color: palette.cpk[a.el] ?? palette.muted, roughness: 0.45, metalness: 0.05, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...a.pos)
      mesh.scale.setScalar(RADIUS[a.el] ?? 0.5)
      g.add(mesh)
      this.atomMats.push({ mesh, mat, el: a.el })
      this.hl.push({ cur: 0, to: 0 })
      this.lay.push({ cur: 1, to: 1 })
      // 高亮描边：略大的背面外壳球（只露出一圈轮廓）
      const sm = new THREE.MeshBasicMaterial({ color: palette.fg, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false })
      const shell = new THREE.Mesh(geo, sm)
      shell.position.set(...a.pos)
      shell.visible = false
      g.add(shell)
      this.shells.push({ mesh: shell, mat: sm })
      if (!this.elOp.has(a.el)) this.elOp.set(a.el, { cur: 1, to: 1 })
    }
  }

  private buildBonds(g: THREE.Group) {
    // 每根键从中点分成两半，各取所连原子的颜色（VESTA 风格）；每一半随自己那端原子的元素一起压暗
    const geo = new THREE.CylinderGeometry(0.09, 0.09, 1, 16)
    const up = new THREE.Vector3(0, 1, 0)
    for (const [p, q] of this.built.bonds) {
      const A = new THREE.Vector3(...this.built.atoms[p].pos)
      const B = new THREE.Vector3(...this.built.atoms[q].pos)
      const M = A.clone().add(B).multiplyScalar(0.5)
      const halves: [THREE.Vector3, THREE.Vector3, string][] = [
        [A, M, this.built.atoms[p].el],
        [B, M, this.built.atoms[q].el],
      ]
      for (const [from, to, el] of halves) {
        const mat = new THREE.MeshStandardMaterial({ color: palette.cpk[el] ?? '#8a8f99', roughness: 0.5, transparent: true, opacity: 0 })
        const m = new THREE.Mesh(geo, mat)
        m.position.copy(from).add(to).multiplyScalar(0.5)
        m.scale.set(1, from.distanceTo(to), 1)
        m.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize())
        g.add(m)
        this.bondMats.push({ mat, el, atom: from === A ? p : q })
      }
    }
  }

  private buildPolyhedra(g: THREE.Group) {
    for (const poly of this.built.polyhedra) {
      const center = this.built.atoms[poly.center].el
      const color = palette.cpk[center] ?? palette.muted
      const pts = poly.ligands.map((i) => new THREE.Vector3(...this.built.atoms[i].pos))
      const geo = new ConvexGeometry(pts)
      const face = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0, roughness: 0.7, side: THREE.DoubleSide, depthWrite: false })
      const edge = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 })
      g.add(new THREE.Mesh(geo, face))
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge))
      this.polyMats.push({ mat: face, base: 0.22, center, atom: poly.center }, { mat: edge, base: 0.9, center, atom: poly.center })
    }
  }

  private buildAxes(g: THREE.Group) {
    // 从超胞原点（corners[0]）画出 a、b、c 三个晶格矢量（单个晶胞的长度）：圆柱 + 圆锥
    const up = new THREE.Vector3(0, 1, 0)
    const O = new THREE.Vector3(...this.built.corners[0])
    this.built.lattice.forEach((v, i) => {
      const vec = new THREE.Vector3(...v)
      const len = vec.length()
      const dir = vec.clone().normalize()
      const headLen = Math.min(0.9, len * 0.3)
      const mat = new THREE.MeshStandardMaterial({ color: AXIS_COLORS[i], roughness: 0.5, transparent: true, opacity: 0 })
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 16), mat)
      const shaftLen = len - headLen
      shaft.scale.set(1, shaftLen, 1)
      shaft.position.copy(O).addScaledVector(dir, shaftLen / 2)
      shaft.quaternion.setFromUnitVectors(up, dir)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.36, headLen, 20), mat)
      head.position.copy(O).addScaledVector(dir, shaftLen + headLen / 2)
      head.quaternion.setFromUnitVectors(up, dir)
      this.axesGroup.add(shaft, head)
      this.axesMats.push(mat)
      const div = this.makeLabel(AXIS_NAMES[i], AXIS_COLORS[i])
      div.style.fontStyle = 'italic'
      this.axisLabels.push({ div, tip: O.clone().addScaledVector(dir, len + 0.9) })
    })
    this.axesGroup.visible = false
    g.add(this.axesGroup)
  }

  private makeLabel(text: string, color: string): HTMLElement {
    const div = document.createElement('div')
    div.className = 'label3d'
    div.textContent = text
    div.style.cssText = `color:${color};opacity:0;transition:none;-webkit-text-stroke:calc(var(--u) * 0.7) ${palette.bg};paint-order:stroke fill;`
    this.host.append(div)
    return div
  }

  private buildLabels() {
    // 引线放在标签下面：一层 SVG，每种元素一组 线 + 端点圆点
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;'
    this.host.append(svg)
    this.leaderSvg = svg
    for (const el of elementsOf(this.built)) {
      const color = palette.cpk[el] ?? palette.muted
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('opacity', '0')
      const line = document.createElementNS(NS, 'line')
      line.setAttribute('stroke', color); line.setAttribute('stroke-width', '3')
      const dot = document.createElementNS(NS, 'circle')
      dot.setAttribute('r', '7'); dot.setAttribute('fill', color); dot.setAttribute('stroke', palette.bg); dot.setAttribute('stroke-width', '2.5')
      g.append(line, dot)
      svg.append(g)
      this.leaders.set(el, g)
      this.labelEls.set(el, { div: this.makeLabel(el, color), cur: 0, to: 0 })
    }
  }
  private leaderSvg?: SVGSVGElement


  // ---- 控制 ------------------------------------------------------------
  /** 各部分的目标可见度；缺省的部分不变 */
  show(parts: Partial<Record<Parts, number>>) {
    for (const [k, v] of Object.entries(parts)) this.vis[k as Parts].to = v
  }

  /** 把 elements 压暗到 opacity，其余恢复 */
  dim(elements: string[], opacity = 0.1) {
    for (const [el, s] of this.elOp) s.to = elements.includes(el) ? opacity : 1
  }

  /** 元素标签：vis 为 0..1；els 缺省 = 全部元素（每种元素标一个代表原子） */
  setLabels(vis: number, els?: string[]) {
    this.labelVis.to = vis
    for (const [el, l] of this.labelEls) l.to = !els || els.includes(el) ? 1 : 0
  }

  /** a、b、c 晶格矢量箭头的可见度 0..1 */
  setAxes(vis: number) { this.axesVis.to = vis }

  /** 点名强调（放大 1.25 倍 + 描边，其余不变暗）；null / 空 = 取消 */
  highlight(spec: HighlightSpec | null) {
    resolveHighlight(this.built, spec).forEach((on, i) => { this.hl[i].to = on ? 1 : 0 })
  }

  /** 按层聚焦：区间外的原子/键/多面体压暗到 0.1；null = 取消 */
  focusLayer(layer: LayerSpec | null) {
    this.layerMaskNow = layerMask(this.built, layer)
    this.layerMaskNow.forEach((on, i) => { this.lay[i].to = on ? 1 : LAYER_DIM })
  }

  private smooths(): { cur: number; to: number }[] {
    return [...this.hl, ...this.lay, this.labelVis, this.axesVis, ...this.labelEls.values()]
  }

  /** 立即到位（跳转用，不做过渡） */
  snap() {
    for (const v of Object.values(this.vis)) v.cur = v.to
    for (const s of this.elOp.values()) s.cur = s.to
    for (const s of this.smooths()) s.cur = s.to
    this.applyOpacity()
    this.updateOverlays()
  }

  private fitDistance(zoom: number) {
    const half = (this.camera.fov * Math.PI) / 360
    const fitV = this.built.radius / Math.sin(half)
    const fitH = this.built.radius / Math.sin(Math.atan(Math.tan(half) * this.camera.aspect))
    return (Math.max(fitV, fitH) * 1.3) / zoom
  }

  /** 相机沿 dir 方向看向 target（Å，相对超胞中心），zoom>1 推近。ms=0 为立即到位。 */
  flyTo({ dir = [1, 0.75, 0.55], target = [0, 0, 0], zoom = 1 }: { dir?: Vec3; target?: Vec3; zoom?: number }, ms = 1400): Promise<void> {
    const c1 = new THREE.Vector3(...target)
    const p1 = new THREE.Vector3(...dir).normalize().multiplyScalar(this.fitDistance(zoom)).add(c1)
    if (!ms) {
      this.camera.position.copy(p1)
      this.controls.target.copy(c1)
      this.controls.update()
      this.updateOverlays()
      return Promise.resolve()
    }
    return new Promise((done) => {
      this.fly = { t0: performance.now(), ms, p0: this.camera.position.clone(), p1, c0: this.controls.target.clone(), c1, done }
    })
  }

  /** 超胞中心坐标系下的点 → host 内像素（用于 HTML 标签） */
  project(p: Vec3): { x: number; y: number; visible: boolean } {
    return this.toScreen(new THREE.Vector3(...p))
  }

  private toScreen(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().sub(new THREE.Vector3(...this.built.center)).applyEuler(this.orient).project(this.camera)
    const w = this.host.clientWidth, h = this.host.clientHeight
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 }
  }

  /** 把 HTML 标签（元素标签、a/b/c）放到跟随相机的屏幕位置 */
  private updateOverlays() {
    this.camera.updateMatrixWorld()
    const h = this.host.clientHeight
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360)
    const showLabels = this.labelVis.cur > 0.01
    const hide = () => { for (const l of this.labelEls.values()) l.div.style.opacity = '0'; for (const g of this.leaders.values()) g.setAttribute('opacity', '0') }
    if (!showLabels) hide()
    else {
      // 所有原子的屏幕位置、半径、深度（用来避开被挡住的原子）
      const scr: ScreenAtom[] = this.built.atoms.map((a, i) => {
        const s = this.toScreen(new THREE.Vector3(...a.pos))
        const w = new THREE.Vector3(...a.pos).sub(new THREE.Vector3(...this.built.center)).applyEuler(this.orient).applyMatrix4(this.camera.matrixWorldInverse)
        const depth = Math.max(-w.z, 1e-3)
        const r = (RADIUS[a.el] ?? 0.5) * (1 + HL_SCALE * this.hl[i].cur)
        return { x: s.x, y: s.y, r: (r * (h / 2)) / (depth * tanHalf), depth, shown: this.atomO[i] > 0.4 }
      })
      // 标签排成一行放在结构上方，用引线连到各自的原子（引线细、颜色同元素）
      const shownAtoms = scr.filter((a) => a.shown)
      const top = shownAtoms.length ? Math.min(...shownAtoms.map((a) => a.y - a.r)) : h * 0.1
      const tips = this.axesVis.cur > 0.01 ? this.axisLabels.map((al) => this.toScreen(al.tip)) : []
      const items: { el: string; i: number; o: number }[] = []
      for (const [el, l] of this.labelEls) {
        const pool = this.built.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0)
        const inLayer = pool.filter((i) => this.layerMaskNow[i])
        // 避开 a/b/c 箭头末端正下方的原子（否则竖直引线会穿过 a/b/c 标签）
        const base = inLayer.length ? inLayer : pool
        const clear = base.filter((k) => !tips.some((t) => Math.abs(scr[k].x - t.x) < h * 0.035 && scr[k].y > t.y))
        const i = pickLabelAtom(clear.length ? clear : base, scr)
        if (i === undefined || (l.to === 0 && l.cur < 0.01)) { l.div.style.opacity = '0'; this.leaders.get(el)?.setAttribute('opacity', '0'); continue }
        const dimmed = this.elOp.get(el)?.cur ?? 1
        items.push({ el, i, o: l.cur * this.labelVis.cur * this.vis.atoms.cur * (0.15 + 0.85 * dimmed) * (0.15 + 0.85 * this.lay[i].cur) })
      }
      const W = this.host.clientWidth
      const sizes = items.map((it) => { const d = this.labelEls.get(it.el)!.div; return { w: d.offsetWidth, h: d.offsetHeight } })
      const rowH = sizes.reduce((m, z) => Math.max(m, z.h), 0)
      const rowY = Math.max(top - h * 0.045 - rowH / 2, rowH / 2 + 4)
      const blocked = this.axesVis.cur > 0.01
        ? this.axisLabels.map((al) => ({ s: this.toScreen(al.tip), w: al.div.offsetWidth, h: al.div.offsetHeight }))
            .filter((b) => Math.abs(b.s.y - rowY) < (b.h + rowH) / 2).map((b) => ({ x0: b.s.x - b.w / 2, x1: b.s.x + b.w / 2 }))
        : []
      const xs = layoutRow(items.map((it, k) => ({ x: scr[it.i].x, w: sizes[k].w })), h * 0.015, W, blocked)
      items.forEach((it, k) => {
        const d = this.labelEls.get(it.el)!.div
        d.style.left = `${xs[k]}px`
        d.style.top = `${rowY}px`
        d.style.opacity = String(it.o)
        const ln = this.leaders.get(it.el)
        if (ln) {
          const a = scr[it.i]
          ln.setAttribute('opacity', String(it.o))
          const line = ln.querySelector('line')!, dot = ln.querySelector('circle')!
          line.setAttribute('x1', String(xs[k])); line.setAttribute('y1', String(rowY + sizes[k].h / 2 - 2))
          line.setAttribute('x2', String(a.x)); line.setAttribute('y2', String(a.y))
          dot.setAttribute('cx', String(a.x)); dot.setAttribute('cy', String(a.y))
        }
      })
    }
    for (const al of this.axisLabels) {
      const s = this.toScreen(al.tip)
      al.div.style.left = `${s.x}px`
      al.div.style.top = `${s.y}px`
      al.div.style.opacity = s.visible ? String(this.axesVis.cur) : '0'
    }
  }

  /** 原子在超胞中心坐标系下的位置 */
  localPos(i: number): Vec3 {
    const a = this.built.atoms[i].pos, c = this.built.center
    return [a[0] - c[0], a[1] - c[1], a[2] - c[2]]
  }

  // ---- 循环 ------------------------------------------------------------
  private applyOpacity() {
    this.cellMat.opacity = this.vis.cell.cur * 0.8
    this.cell.visible = this.vis.cell.cur > 0.01
    const A = this.vis.atoms.cur
    this.atomMats.forEach((a, i) => {
      const o = (this.elOp.get(a.el)?.cur ?? 1) * this.lay[i].cur * A
      a.mat.opacity = o
      this.atomO[i] = o
      a.mesh.visible = o > 0.01
      a.mat.depthWrite = o > 0.95
      const k = this.hl[i].cur
      const sc = (RADIUS[a.el] ?? 0.5) * (1 + HL_SCALE * k)
      a.mesh.scale.setScalar(sc)
      const sh = this.shells[i]
      sh.mesh.scale.setScalar(sc * 1.16)
      sh.mat.opacity = k * 0.75 * Math.min(1, o * 1.5)
      sh.mesh.visible = sh.mat.opacity > 0.01
    })
    for (const b of this.bondMats) {
      b.mat.opacity = this.vis.bonds.cur * (this.elOp.get(b.el)?.cur ?? 1) * this.lay[b.atom].cur * A
    }
    for (const p of this.polyMats) p.mat.opacity = this.vis.polyhedra.cur * p.base * (this.elOp.get(p.center)?.cur ?? 1) * this.lay[p.atom].cur
    for (const m of this.axesMats) m.opacity = this.axesVis.cur
    this.axesGroup.visible = this.axesVis.cur > 0.01
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    const k = 1 - Math.exp(-dt * 5)
    for (const v of Object.values(this.vis)) v.cur += (v.to - v.cur) * k
    for (const s of this.elOp.values()) s.cur += (s.to - s.cur) * k
    for (const s of this.smooths()) s.cur += (s.to - s.cur) * k
    this.applyOpacity()
    if (this.fly) {
      const f = this.fly
      const t = Math.min((now - f.t0) / f.ms, 1)
      const e = ease(t)
      this.camera.position.lerpVectors(f.p0, f.p1, e)
      this.controls.target.lerpVectors(f.c0, f.c1, e)
      if (t >= 1) { this.fly = null; f.done() }
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.updateOverlays()
    this.onRender?.()
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // 整体上移约 5%，给底部旁白留出空间
    this.camera.setViewOffset(w, h, 0, Math.round(h * 0.05), w, h)
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.controls.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose?.()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const l of this.labelEls.values()) l.div.remove()
    this.leaderSvg?.remove()
    for (const al of this.axisLabels) al.div.remove()
  }
}
