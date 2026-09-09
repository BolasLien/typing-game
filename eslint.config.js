import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts', 'vitest.config.ts', 'eslint.config.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // handled strictly by tsc
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
