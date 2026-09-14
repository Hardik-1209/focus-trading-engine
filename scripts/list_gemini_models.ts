import dotenv from 'dotenv';
dotenv.config();

const keys = [
  process.env.gemini_api_key,
  process.env.gemini_api_key2,
  process.env.gemini_api_key3,
  process.env.gemini_api_key4,
  process.env.gemini_api_key5,
  process.env.gemini_api_key6,
].filter(Boolean) as string[];

async function run() {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const json = await res.json() as any;
      if (json.models) {
        console.log(`Key #${i + 1} (${key.slice(0, 8)}...) models (${json.models.length}):`, json.models.map((m: any) => m.name.replace('models/', '')).slice(0, 8));
      } else {
        console.log(`Key #${i + 1} error:`, json);
      }
    } catch (err: any) {
      console.log(`Key #${i + 1} error:`, err.message);
    }
  }
}
run();
