// .eslintrc.js
module.exports = {
    root: true,
    env: {
      node: true,
    },
    extends: [
      'plugin:vue/vue3-essential',
      'eslint:recommended',
    ],
    parserOptions: {
      parser: '@babel/eslint-parser',
      requireConfigFile: false,
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-undef': 'off', // 关闭未定义变量的报错检查
      'no-unused-vars': 'off', // 关闭未使用变量的报错检查
      'vue/multi-word-component-names': 'off', // 添加这一行禁用多词组件名称规则
    },
  };
  