/**
 * Extension tests
 */
import * as vscode from 'vscode';

// Mock the dependencies
jest.mock('../src/server', () => ({
  startServer: jest.fn().mockResolvedValue(undefined),
  stopServer: jest.fn()
}));

jest.mock('../src/webview', () => ({
  createWebviewPanel: jest.fn()
}));

jest.mock('../src/utils', () => ({
  getIPAddress: jest.fn().mockReturnValue('127.0.0.1')
}));

jest.mock('../src/state/store', () => ({
  store: {
    getState: jest.fn().mockReturnValue({
      server: { isRunning: false, address: null, port: 11040 },
      webview: { panel: null },
      websocket: { wss: null, connections: [] },
      currentContext: { messageType: 'none' },
      apiKey: null
    }),
    setState: jest.fn(),
    subscribe: jest.fn(() => jest.fn()) // Returns unsubscribe function
  }
}));

describe('Extension', () => {
  let mockContext: Partial<vscode.ExtensionContext>;
  
  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      asAbsolutePath: jest.fn((path: string) => `/test/extension/${path}`)
    };
    
    jest.clearAllMocks();
  });

  describe('Extension module', () => {
    it('should export activate function', () => {
      const extension = require('../src/extension');
      expect(typeof extension.activate).toBe('function');
    });

    it('should export deactivate function', () => {
      const extension = require('../src/extension');
      expect(typeof extension.deactivate).toBe('function');
    });

    it('should handle activation without errors', () => {
      const extension = require('../src/extension');
      
      expect(() => {
        extension.activate(mockContext as vscode.ExtensionContext);
      }).not.toThrow();
    });

    it('should register VS Code commands during activation', () => {
      const extension = require('../src/extension');
      
      extension.activate(mockContext as vscode.ExtensionContext);
      
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'extension.startAirCodumServer',
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'extension.stopAirCodumServer',
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'extension.openAirCodumWebview',
        expect.any(Function)
      );
    });

    it('should handle deactivation without errors', () => {
      const extension = require('../src/extension');
      
      expect(() => {
        extension.deactivate();
      }).not.toThrow();
    });
  });

  describe('Command functionality', () => {
    it('should handle server start command', async () => {
      const { startServer } = require('../src/server');
      const { createWebviewPanel } = require('../src/webview');
      const extension = require('../src/extension');
      
      extension.activate(mockContext as vscode.ExtensionContext);
      
      // Get the registered command handler
      const startCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'extension.startAirCodumServer');
      
      if (startCommand) {
        await startCommand[1](); // Call the command handler
        
        expect(startServer).toHaveBeenCalledWith('0.0.0.0');
        expect(createWebviewPanel).toHaveBeenCalled();
      }
    });

    it('should handle server stop command', () => {
      const { stopServer } = require('../src/server');
      const extension = require('../src/extension');
      
      extension.activate(mockContext as vscode.ExtensionContext);
      
      // Get the registered command handler
      const stopCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(call => call[0] === 'extension.stopAirCodumServer');
      
      if (stopCommand) {
        stopCommand[1](); // Call the command handler
        
        expect(stopServer).toHaveBeenCalled();
      }
    });
  });
});
