import { pingAllGeminiKeys } from '../src/gemini-client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Pinging Gemini keys...');
  const res = await pingAllGeminiKeys();
  console.log('Results:', JSON.stringify(res, null, 2));
}
run();
