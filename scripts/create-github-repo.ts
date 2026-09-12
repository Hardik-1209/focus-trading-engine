import dotenv from 'dotenv';
dotenv.config();

async function createRepo() {
  const token = process.env.github_pat_token;
  if (!token) throw new Error('Missing github_pat_token');

  console.log('[GitHub] Creating repository Hardik-1209/focus-trading-engine...');
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FocusDeployer',
    },
    body: JSON.stringify({
      name: 'focus-trading-engine',
      description: '24/7 Cloud-Native Focus Trading Engine with Groq Cloud LLM Array & Real-Time Dashboard',
      private: false,
    }),
  });

  const data = await res.json() as any;
  if (res.ok) {
    console.log('✅ [GitHub] Repository created successfully:', data.html_url);
    console.log('Clone URL:', data.clone_url);
  } else if (data.errors?.[0]?.message?.includes('already exists') || data.message?.includes('already exists')) {
    console.log('ℹ️ [GitHub] Repository already exists: https://github.com/Hardik-1209/focus-trading-engine');
  } else {
    console.error('❌ [GitHub] Failed to create repo:', data);
  }
}

createRepo().catch(console.error);
