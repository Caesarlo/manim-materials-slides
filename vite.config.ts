import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'

// manim-web 里有几个“可选”的动态导入（导出 PPTX、Typst 编译器），演示用不到也没安装。
// 用空模块顶替，避免 Vite 预打包时因找不到包而报错。
const OPTIONAL = ['pptxgenjs', '@myriaddreamin/typst.ts', '@myriaddreamin/typst-ts-renderer', '@myriaddreamin/typst-ts-web-compiler']
const stubOptional = (): Plugin => ({
  name: 'stub-optional-deps',
  enforce: 'pre',
  resolveId(id) { return OPTIONAL.includes(id) ? '\0stub:' + id : null },
  load(id) { return id.startsWith('\0stub:') ? 'export default {}; export const __stub = true' : null },
})

export default defineConfig({
  base: './',
  plugins: [stubOptional()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 4100 },
  optimizeDeps: {
    // 预打包阶段（esbuild/rolldown）同样需要被告知这些是外部可选依赖
    rolldownOptions: { plugins: [{ name: 'stub-optional-deps', resolveId(id: string) { return OPTIONAL.includes(id) ? '\0stub:' + id : null }, load(id: string) { return id.startsWith('\0stub:') ? 'export default {}' : null } }] },
  },
  build: { chunkSizeWarningLimit: 4000 },
})
