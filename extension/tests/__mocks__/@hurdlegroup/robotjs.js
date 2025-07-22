// Mock RobotJS
const mockRobot = {
  keyTap: jest.fn(),
  typeString: jest.fn(),
  moveMouse: jest.fn(),
  mouseClick: jest.fn(),
  mouseToggle: jest.fn(),
  getScreenSize: jest.fn(() => ({ width: 1920, height: 1080 })),
  getPixelColor: jest.fn(),
  screen: {
    capture: jest.fn(() => Buffer.from('mock-screenshot'))
  }
};

module.exports = mockRobot;
