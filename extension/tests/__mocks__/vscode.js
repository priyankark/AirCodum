// VS Code API mock
const vscode = {
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    activeTextEditor: {
      selection: undefined,
      revealRange: jest.fn(),
      document: {
        getText: jest.fn(),
        lineCount: 100
      }
    },
    showTextDocument: jest.fn()
  },
  workspace: {
    workspaceFolders: [{
      uri: {
        fsPath: '/test/workspace'
      },
      name: 'test-workspace',
      index: 0
    }],
    openTextDocument: jest.fn()
  },
  WebviewPanel: jest.fn(),
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
    parse: jest.fn()
  },
  Position: jest.fn((line, character) => ({ line, character })),
  Range: jest.fn((start, end) => ({ start, end })),
  Selection: jest.fn((start, end) => ({ start, end })),
  ExtensionContext: jest.fn(),
  Disposable: jest.fn(() => ({ dispose: jest.fn() })),
  EventEmitter: jest.fn(() => ({
    fire: jest.fn(),
    event: jest.fn()
  }))
};

module.exports = vscode;
