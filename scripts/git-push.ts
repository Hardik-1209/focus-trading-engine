import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.github_pat_token;
if (!token) {
  console.error('Missing github_pat_token in .env');
  process.exit(1);
}

const remoteUrl = `https://${token}@github.com/Hardik-1209/focus-trading-engine.git`;

console.log('[Git] Adding modified and new files...');
execSync('git add -A', { stdio: 'inherit' });

const commitMsg = 'feat(v3.1): Dual-Engine LLM Architecture (Gemini 3.6 Flash primary 6-key array + Groq failover), ~3-4 trades/15m frequency, futuristic Gemini glassmorphism UI, and AI Key Cluster diagnostics';
try {
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
} catch {
  console.log('No new changes to commit.');
}

console.log('[Git] Pushing to GitHub main branch...');
execSync(`git push "${remoteUrl}" main`, { stdio: 'inherit' });
console.log('✅ [Git] Push to GitHub completed successfully!');
