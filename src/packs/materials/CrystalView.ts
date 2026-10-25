// 三维晶体视图（three.js）：球棍 + 晶胞线 + 配位多面体，带“相机运镜”。
//
//   const view = new CrystalView(host, build(SrTiO3, SrTiO3_opts))
//   view.show({ cell: 1, atoms: 1, bonds: 0, polyhedra: 0 })        // 各部分的目标可见度 0..1，平滑过渡
//   view.dim(['Sr'], 0.1)                                           // 压暗某些元素，聚焦别的
//   await view.flyTo({ dir: [1, 0.6, 0.5], zoom: 1.4 }, 1400)      // 相机沿 dir 方向（z 轴朝上），zoom>1 为推近
//   view.onRender = () => { const p = view.project(pos) }           // 给 HTML 标签定位
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
import type { Built, Vec3 } from './structure'

export type Parts = 'cell' | 'atoms' | 'bonds' | 'polyhedra'

const RADIUS: Record<string, number> = { O: 0.42, Ti: 0.5, Sr: 0.7, Ba: 0.75, Bi: 0.68, Te: 0.62, Se: 0.55, Pb: 0.7, Sn: 0.6, Si: 0.5 }
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
  private bondMats: { mat: THREE.MeshStandardMaterial; el: string }[] = []
  private polyMats: { mat: THREE.Material; base: number; center: string }[] = []
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
        this.bondMats.push({ mat, el })
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
      this.polyMats.push({ mat: face, base: 0.22, center }, { mat: edge, base: 0.9, center })
    }
  }

  // ---- 控制 ------------------------------------------------------------
  /** 各部分的目标可见度；缺省的部分不变 */
  show(parts: Partial<Record<Parts, number>>) {
    for (const [k, v] of Object.entries(parts)) this.vis[k as Parts].to = v
  }

  /** 把 elements 压暗到 opacity，其余恢复 */
  dim(elements: string[], opacity = 0.1) {
    for (const [el, s] of this.elOp) s.to = elements.includes(el) ? opacity : 1
  }

  /** 立即到位（跳转用，不做过渡） */
  snap() {
    for (const v of Object.values(this.vis)) v.cur = v.to
    for (const s of this.elOp.values()) s.cur = s.to
    this.applyOpacity()
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
      return Promise.resolve()
    }
    return new Promise((done) => {
      this.fly = { t0: performance.now(), ms, p0: this.camera.position.clone(), p1, c0: this.controls.target.clone(), c1, done }
    })
  }

  /** 超胞中心坐标系下的点 → host 内像素（用于 HTML 标签） */
  project(p: Vec3): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(...p).sub(new THREE.Vector3(...this.built.center)).applyEuler(this.orient).project(this.camera)
    const r = this.host.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, visible: v.z < 1 }
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
    for (const a of this.atomMats) {
      const o = (this.elOp.get(a.el)?.cur ?? 1) * A
      a.mat.opacity = o
      a.mesh.visible = o > 0.01
      a.mat.depthWrite = o > 0.95
    }
    for (const b of this.bondMats) {
      b.mat.opacity = this.vis.bonds.cur * (this.elOp.get(b.el)?.cur ?? 1) * A
    }
    for (const p of this.polyMats) p.mat.opacity = this.vis.polyhedra.cur * p.base * (this.elOp.get(p.center)?.cur ?? 1)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    const k = 1 - Math.exp(-dt * 5)
    for (const v of Object.values(this.vis)) v.cur += (v.to - v.cur) * k
    for (const s of this.elOp.values()) s.cur += (s.to - s.cur) * k
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
  }
}
