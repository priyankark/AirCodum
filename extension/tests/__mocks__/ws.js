// Mock WebSocket
const mockWebSocket = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

mockWebSocket.Server = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  close: jest.fn(),
  clients: new Set()
}));

module.exports = mockWebSocket;
