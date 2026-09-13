const fs = require('fs');
const zlib = require('zlib');

// For docx: it's a zip file. Let's use node's built-in or simple unzipper if available, or write a ps1 script.
