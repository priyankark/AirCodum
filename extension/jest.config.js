module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/scripts/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.js',
    '@hurdlegroup/robotjs': '<rootDir>/tests/__mocks__/@hurdlegroup/robotjs.js',
    'screenshot-desktop': '<rootDir>/tests/__mocks__/screenshot-desktop.js'
  },
  testTimeout: 10000,
  testPathIgnorePatterns: [
    '<rootDir>/src/scripts/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@hurdlegroup|screenshot-desktop)/)'
  ]
};
