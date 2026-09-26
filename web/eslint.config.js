import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

// Same rules as app/eslint.config.js, written as an ES module because this
// package is "type": "module".
export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  // Build tooling runs in Node. Portal code runs in the browser only, so Node
  // globals such as `process` stay undefined there (env vars come from
  // import.meta.env - see src/constants/config.js).
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettierConfig,
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
];
