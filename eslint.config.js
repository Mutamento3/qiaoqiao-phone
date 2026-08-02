// ESLint 9 flat config — 团队质量门禁 (v1.10.234 起)
// 设计原则: 前向拦截, 不阻塞存量。新代码过不了 lint 不准合。
// 分级:
//   error = 必须在合入前修 (debugger / 真正的 undef)
//   warn  = 可见但不阻断 (console.log 先 warn, 清理 sprint 后翻 error)
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    // 不扫构建产物 / 原生壳 / 函数 / 脚本 / 静态资源
    ignores: [
      '**/dist/**',
      '**/dist_*/**',
      '**/old_dist*/**',
      'node_modules/**',
      'android-native/**',
      'functions/**',
      'scripts/**',
      'public/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },

  // JS 基础推荐规则 (no-undef, no-unused-vars, no-dupe-keys 等)
  js.configs.recommended,

  // Vue3 关键正确性规则 (重复属性 / 无效 template root / 未闭合标签等)
  // 用 essential 而非 recommended, 避免一次性报几千条模板风格问题把团队劝退
  ...pluginVue.configs['flat/essential'],

  // .vue 单文件组件用 vue-eslint-parser 解析 <template>
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
    },
  },

  // 全局语言选项 + 自定义规则
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // 构建期由 esbuild define 注入, 运行时存在, lint 期需声明
        process: 'readonly',
        __VUE_OPTIONS_API__: 'readonly',
        __VUE_PROD_DEVTOOLS__: 'readonly',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'readonly',
      },
    },
    rules: {
      // === error: 硬拦截 (存量极少且几乎确定是真 bug) ===
      'no-debugger': 'error', // 调试器永远不该进仓库 (当前 0 处)
      'no-redeclare': 'error', // 重复声明, 必是真 bug
      'no-duplicate-case': 'error', // switch 重复 case, 必是真 bug
      'no-fallthrough': 'error', // case 穿透漏 break, 常见真 bug
      'no-unreachable': 'error', // 死代码
      'no-unsafe-finally': 'error', // finally 里 return/throw

      // === warn: 先暴露, 清理 sprint 后翻 error (存量大, 避免 CI 全红被无视) ===
      'no-empty': 'warn', // 空块 6 处 (部分是有意 catch, 部分藏 bug)
      'no-useless-escape': 'warn', // 多余转义 14 处, 可 --fix 自动修
      'no-constant-condition': 'warn', // while(true)/if(true) 可能是事件循环
      'no-constant-binary-expression': 'warn',
      'no-control-regex': 'warn', // 正则里的控制字符, 轻微安全隐患
      'no-mixed-spaces-and-tabs': 'warn', // 混合缩进 (历史代码常见)
      'no-console': 'warn', // 571 处存量; 清理 sprint 后翻 error
      'no-undef': 'warn', // 未定义变量, 真 typo 会有价值, 但先 warn 防 CI 红
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // === Vue 针对性 (按需放宽, 避免噪音) ===
      'vue/multi-word-component-names': 'off', // 历史单字组件多
      'vue/no-v-html': 'off', // SafeHtmlCard 等有意用 v-html 渲染可信 HTML
      'vue/html-self-closing': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-mutating-props': 'warn',
    },
  },

  // 必须放最后: 关闭所有与 Prettier 冲突的格式化规则
  prettier,
]
