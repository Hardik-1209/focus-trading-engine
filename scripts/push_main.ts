import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.github_pat_token;
if (!token) {
  console.error('Missing github_pat_token');
  process.exit(1);
}

const remoteUrl = `https://${token}@github.com/Hardik-1209/focus-trading-engine.git`;
console.log('Pushing commit to GitHub main...');
try {
  execSync(`git push "${remoteUrl}" main`, { stdio: 'inherit' });
  console.log('✅ Push succeeded!');
} catch (err: any) {
  console.error('Push failed:', err.message);
}
