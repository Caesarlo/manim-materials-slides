# Apache ECharts 6.1.0

Official browser distribution, vendored for offline use. No CDN or build step is required.

Source: https://github.com/apache/echarts/tree/6.1.0

- echarts.min.js: https://raw.githubusercontent.com/apache/echarts/6.1.0/dist/echarts.min.js
- LICENSE and NOTICE are copied unchanged from that tag.

Integration: web/echarts.js. New charts use native ECharts option objects; the bridge only handles
slide steps, theme, sizing and lifecycle. SVG rendering preserves chart sharpness when slides scale.
