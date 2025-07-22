/**
 * Basic Extension Tests
 * These tests verify core extension functionality
 */

describe('AirCodum Extension', () => {
  describe('Core Functionality', () => {
    it('should be testable', () => {
      expect(true).toBe(true);
    });

    // Skip this test for now due to native module dependencies
    it.skip('should have basic VS Code extension structure', () => {
      const extensionModule = require('../src/extension');
      
      expect(typeof extensionModule.activate).toBe('function');
      expect(typeof extensionModule.deactivate).toBe('function');
    });
  });

  describe('State Management', () => {
    it('should export store module', () => {
      const storeModule = require('../src/state/store');
      expect(storeModule.store).toBeDefined();
      expect(typeof storeModule.store.getState).toBe('function');
      expect(typeof storeModule.store.setState).toBe('function');
    });

    it('should export action creators', () => {
      const actionsModule = require('../src/state/actions');
      expect(typeof actionsModule.setServerRunning).toBe('function');
      expect(typeof actionsModule.setServerAddress).toBe('function');
      expect(typeof actionsModule.setWebviewPanel).toBe('function');
      expect(typeof actionsModule.setWebSocketServer).toBe('function');
    });
  });

  // Skip native module dependent tests for now
  describe('Module Exports', () => {
    it.skip('should export server functions', () => {
      const serverModule = require('../src/server');
      expect(typeof serverModule.startServer).toBe('function');
      expect(typeof serverModule.stopServer).toBe('function');
    });

    it.skip('should export WebSocket handler', () => {
      const wsModule = require('../src/websockets');
      expect(typeof wsModule.handleWebSocketConnection).toBe('function');
    });
  });

  describe('Utilities', () => {
    it('should export utility functions', () => {
      const utilsModule = require('../src/utils');
      expect(typeof utilsModule.getIPAddress).toBe('function');
    });
  });

  describe('AI Module', () => {
    it('should export AI functions', () => {
      const aiModule = require('../src/ai/api');
      expect(typeof aiModule.chatWithOpenAI).toBe('function');
      expect(typeof aiModule.transcribeImage).toBe('function');
      expect(typeof aiModule.handleChat).toBe('function');
    });

    it('should export AI utility functions', () => {
      const aiUtilsModule = require('../src/ai/utils');
      expect(typeof aiUtilsModule.getApiKey).toBe('function');
      expect(typeof aiUtilsModule.saveApiKey).toBe('function');
    });
  });

  describe('File Handling', () => {
    it.skip('should export file utility functions', () => {
      // Skip due to istextorbinary dependency issues in test environment
      const fileUtilsModule = require('../src/files/utils');
      expect(typeof fileUtilsModule.saveFile).toBe('function');
      expect(typeof fileUtilsModule.handleFileUpload).toBe('function');
    });
  });
});
