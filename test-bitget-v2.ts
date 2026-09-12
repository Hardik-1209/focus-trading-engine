import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.BITGET_API_KEY || '';
const SECRET_KEY = process.env.BITGET_SECRET_KEY || '';
const PASSPHRASE = process.env.BITGET_PASSPHRASE || '';
const BASE_URL = 'https://api.bitget.com';

function sign(method: string, path: string, body: any) {
  const timestamp = Date.now().toString();
  const bodyStr = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const message = `${timestamp}${method}${path}${bodyStr}`;
  
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('base64');
  
  return {
    'ACCESS-KEY': API_KEY,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json',
    'locale': 'en-US'
  };
}

async function request(method: string, path: string, body: any = {}) {
  const headers = sign(method, path, body);
  const options: RequestInit = { method, headers };
  if (method !== 'GET') options.body = JSON.stringify(body);
  
  const res = await fetch(BASE_URL + path, options);
  const json = await res.json();
  console.log(`[${method}] ${path}`, JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  // 1. Get Wallet Balance
  await request('GET', '/api/v2/mix/account/account?productType=USDT-FUTURES');
  
  // 2. Get Coin Info for ALLOUSDT
  await request('GET', '/api/v2/mix/market/contracts?productType=USDT-FUTURES&symbol=ALLOUSDT');
}

main().catch(console.error);
