/**
 * State Store Tests
 */

describe('State Store', () => {
  let store: any;
  
  beforeEach(() => {
    // Dynamically import to avoid module loading issues
    const storeModule = require('../../src/state/store');
    store = storeModule.store;
    
    // Reset store to initial state
    store.setState({
      server: { isRunning: false, address: null, port: 11040 },
      webview: { panel: null },
      websocket: { wss: null, connections: [] },
      currentContext: { messageType: 'none' },
      apiKey: null
    });
  });

  describe('Store Operations', () => {
    it('should have getState method', () => {
      expect(typeof store.getState).toBe('function');
    });

    it('should have setState method', () => {
      expect(typeof store.setState).toBe('function');
    });

    it('should have subscribe method', () => {
      expect(typeof store.subscribe).toBe('function');
    });

    it('should return current state', () => {
      const state = store.getState();
      
      expect(state).toBeDefined();
      expect(state.server).toBeDefined();
      expect(state.webview).toBeDefined();
      expect(state.websocket).toBeDefined();
      expect(state.currentContext).toBeDefined();
    });

    it('should update state correctly', () => {
      store.setState({
        server: {
          isRunning: true,
          address: '127.0.0.1',
          port: 8080
        }
      });

      const state = store.getState();
      expect(state.server.isRunning).toBe(true);
      expect(state.server.address).toBe('127.0.0.1');
      expect(state.server.port).toBe(8080);
    });

    it('should handle state subscriptions', () => {
      const mockListener = jest.fn();
      const unsubscribe = store.subscribe(mockListener);

      store.setState({
        server: { isRunning: true, address: '127.0.0.1', port: 8080 }
      });

      expect(mockListener).toHaveBeenCalled();
      
      // Test unsubscribe
      unsubscribe();
      mockListener.mockClear();
      
      store.setState({
        server: { isRunning: false, address: null, port: 11040 }
      });

      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});
