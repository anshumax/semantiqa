import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

const commonGlobals = {
  ...globals.browser,
  ...globals.node,
  ...globals.es2021,
};

const importOrderRule = [
  'warn',
  {
    groups: [
      ['builtin', 'external'],
      ['internal', 'parent', 'sibling', 'index'],
    ],
    'newlines-between': 'always',
    alphabetize: { order: 'asc', caseInsensitive: true },
  },
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**'],
  },
  {
    languageOptions: {
      globals: commonGlobals,
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.base.json',
        },
      },
    },
    rules: {
      'import/order': importOrderRule,
    },
    extends: [js.configs.recommended],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: commonGlobals,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/order': importOrderRule,
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    languageOptions: {
      globals: commonGlobals,
      sourceType: 'module',
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    extends: [
      reactPlugin.configs.flat.recommended,
      jsxA11yPlugin.configs.flat.recommended,
    ],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);

