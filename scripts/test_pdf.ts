import PDFDocument from 'pdfkit';
import fs from 'fs';

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('scripts/test.pdf'));
doc.fontSize(25).text('Test PDF', 100, 100);
doc.end();
console.log('PDF generated');
