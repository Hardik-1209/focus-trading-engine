import dotenv from 'dotenv';
dotenv.config();
import { executeCleanSlateReset } from '../src/version-manager';
import { CONFIG } from '../src/config';

async function run() {
  console.log(`Starting clean slate data and in-memory reset for v${CONFIG.VERSION}...`);
  const result = await executeCleanSlateReset(CONFIG.VERSION, true);
  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
}

run();
