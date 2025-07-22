# AirCodum Extension Tests

This directory contains comprehensive tests for the AirCodum VS Code extension. The test suite is built using Jest and TypeScript.

## Test Structure

```
tests/
├── __mocks__/           # Mock implementations
├── state/               # State management tests
├── basic.test.ts        # Basic functionality tests
├── extension.test.ts    # Extension lifecycle tests
├── setup.ts            # Test setup configuration
└── jest.d.ts           # Jest type definitions
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The test suite covers the following core functionality:

### ✅ Extension Lifecycle
- Extension activation and deactivation
- Command registration
- VS Code API integration

### ✅ State Management
- Application state store
- State actions and updates
- State subscription system

### ✅ Core Module Structure
- Module exports verification
- Basic functionality validation

### 🔄 Planned Test Coverage
- WebSocket communication
- Command handling
- AI integration
- File operations
- Server management

## Mock Configuration

The tests use mocks for external dependencies:

- **VS Code API**: Mocked to avoid VS Code environment requirements
- **WebSocket**: Mocked for network communication testing
- **RobotJS**: Mocked to avoid native module dependencies
- **Screenshot-desktop**: Mocked for screen capture functionality

## Test Configuration

- **Framework**: Jest with TypeScript support
- **Environment**: Node.js
- **Timeout**: 10 seconds per test
- **Coverage**: Source files in `src/` directory

## Notes

Some tests are currently skipped due to complex native dependencies (RobotJS, native modules). These will be addressed in future iterations with more sophisticated mocking strategies.

## Contributing

When adding new functionality:

1. Write tests for new features
2. Update existing tests for modified functionality
3. Ensure all tests pass before submitting PRs
4. Maintain test coverage above 80%
