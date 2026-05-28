/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@vi/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@vi/ai$': '<rootDir>/../../packages/ai/src/index.ts',
    '^@vi/game-engine$': '<rootDir>/../../packages/game-engine/src/index.ts',
    '^@vi/observability$': '<rootDir>/../../packages/observability/src/index.ts',
  },
};