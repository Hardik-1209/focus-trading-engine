const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'FocusTradingEngine',
  description: '24/7 Focus Trading Engine — single-coin WebSocket crypto trader',
  script: path.join(__dirname, '..', 'dist', 'main.js')
});

svc.on('uninstall', function() {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

svc.uninstall();
