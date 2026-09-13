const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const dataBuffer = fs.readFileSync('d:\\Focus Trading Engine\\AI Trading Bot Audit and Improvement Roadmap - Google Gemini.pdf');
  const parser = new PDFParse({ data: dataBuffer });
  await parser.load();
  const text = await parser.getText();
  
  console.log('Text length:', text.length);
  fs.writeFileSync('scripts/gemini_pdf_extracted.txt', text, 'utf8');
  console.log('Saved to scripts/gemini_pdf_extracted.txt');
}

main().catch(console.error);
