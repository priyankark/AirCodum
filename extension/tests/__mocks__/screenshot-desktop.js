// Mock screenshot-desktop
const mockScreenshot = jest.fn().mockImplementation(() => 
  Promise.resolve(Buffer.from('mock-screenshot-data'))
);

mockScreenshot.listDisplays = jest.fn().mockResolvedValue([
  { id: '0', name: 'Display 1' }
]);

module.exports = mockScreenshot;
