// ESLint flat config.
// Policy: start lenient (warnings for legacy noise) so CI stays green
// while new code gets gated. Tighten severities over time.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '.netlify/**',
      '.claude/**',
      '.superpowers/**',
      'public/**',
      'scripts/**',
      'check.cjs',
      'dev-server.log',
      'dev-server.err.log',
      'repomix-output.xml',
      '**/*.bak',
    ],
  },

  // Base JS + TS rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Repo-wide downgrades: keep these signals visible (warn) without breaking CI
  // on legacy code. Fix incrementally and tighten later.
  {
    rules: {
      'no-useless-assignment': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-constant-condition': 'warn',
      'prefer-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // Browser/React source
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Hook bugs are real; keep these strict.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // HMR safety for Vite.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Legacy noise — warn now, tighten later.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Stylistic / pedantic things we don't want to fight right now.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Node-side: dev server, netlify functions, server scripts
  {
    files: ['server.ts', 'netlify/functions/**/*.{ts,mts,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Server logs are fine.
      'no-console': 'off',
    },
  },

  // Test files
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Config files at repo root
  {
    files: ['*.config.{ts,js,mjs,cjs}', 'vite.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
