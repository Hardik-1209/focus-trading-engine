const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'FocusTradingEngine',
  description: '24/7 Focus Trading Engine — single-coin WebSocket crypto trader',
  script: path.join(__dirname, '..', 'dist', 'main.js'),
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }],
  wait: 2,
  grow: 0.5,
  maxRestarts: 999,
});

svc.on('install', function() {
  console.log('✅ Service installed! Starting...');
  svc.start();
});

svc.on('start', function() {
  console.log('✅ Service started!');
  console.log('  Name:    FocusTradingEngine');
  console.log('  Logs:    services.msc → FocusTradingEngine → right-click → Properties');
  process.exit(0);
});

svc.install();
