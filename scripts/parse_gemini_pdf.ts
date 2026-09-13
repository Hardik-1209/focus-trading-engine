import fs from 'fs';
import pdf from 'pdf-parse';

async function main() {
  const dataBuffer = fs.readFileSync('d:\\Focus Trading Engine\\AI Trading Bot Audit and Improvement Roadmap - Google Gemini.pdf');
  const data = await pdf(dataBuffer);
  
  console.log('Total pages:', data.numpages);
  console.log('Text length:', data.text.length);
  fs.writeFileSync('scripts/gemini_pdf_extracted.txt', data.text, 'utf8');
  console.log('Saved to scripts/gemini_pdf_extracted.txt');
}

main().catch(console.error);
