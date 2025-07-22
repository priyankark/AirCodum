/**
 * State Actions Tests
 */

describe('State Actions', () => {
  let store: any;
  let actions: any;

  beforeEach(() => {
    // Dynamically import to avoid module loading issues
    const storeModule = require('../../src/state/store');
    const actionsModule = require('../../src/state/actions');
    
    store = storeModule.store;
    actions = actionsModule;
    
    // Reset store to initial state
    store.setState({
      server: { isRunning: false, address: null, port: 11040 },
      webview: { panel: null },
      websocket: { wss: null, connections: [] },
      currentContext: { messageType: 'none' },
      apiKey: null
    });
  });

  describe('Action Creators', () => {
    it('should export all action creators', () => {
      expect(typeof actions.setServerRunning).toBe('function');
      expect(typeof actions.setServerAddress).toBe('function');
      expect(typeof actions.setWebviewPanel).toBe('function');
      expect(typeof actions.setWebSocketServer).toBe('function');
      expect(typeof actions.addWebSocketConnection).toBe('function');
      expect(typeof actions.removeWebSocketConnection).toBe('function');
      expect(typeof actions.setCurrentContext).toBe('function');
      expect(typeof actions.setApiKey).toBe('function');
    });

    it('should update server running state', () => {
      actions.setServerRunning(true);
      
      const state = store.getState();
      expect(state.server.isRunning).toBe(true);
    });

    it('should update server address', () => {
      actions.setServerAddress('192.168.1.100');
      
      const state = store.getState();
      expect(state.server.address).toBe('192.168.1.100');
    });

    it('should update API key', () => {
      actions.setApiKey('sk-test-api-key');
      
      const state = store.getState();
      expect(state.apiKey).toBe('sk-test-api-key');
    });

    it('should handle WebSocket connections', () => {
      const mockWebSocket = { id: 'test-connection' };
      
      actions.addWebSocketConnection(mockWebSocket);
      
      let state = store.getState();
      expect(state.websocket.connections).toContain(mockWebSocket);
      expect(state.websocket.connections).toHaveLength(1);
      
      actions.removeWebSocketConnection(mockWebSocket);
      
      state = store.getState();
      expect(state.websocket.connections).not.toContain(mockWebSocket);
      expect(state.websocket.connections).toHaveLength(0);
    });

    it('should update current context', () => {
      const context = {
        messageType: 'text' as any,
        message: 'Hello world'
      };
      
      actions.setCurrentContext(context);
      
      const state = store.getState();
      expect(state.currentContext.messageType).toBe('text');
      expect(state.currentContext.message).toBe('Hello world');
    });
  });
});
