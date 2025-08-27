import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { FullPermit } from '@shared/schema';

interface CardOptions {
  dpi?: number;
  format?: 'individual' | 'batch';
  cardsPerPage?: number;
}

export async function generatePermitCard(
  permit: FullPermit, 
  qrPayload: string, 
  options: CardOptions = {}
): Promise<Buffer> {
  const { dpi = 300, format = 'individual' } = options;
  
  // Card dimensions in points (1 point = 1/72 inch)
  const cardWidth = 3.375 * 72; // 3.375 inches
  const cardHeight = 2.125 * 72; // 2.125 inches
  
  const doc = new PDFDocument({
    size: [cardWidth, cardHeight],
    margin: 0
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Background gradient
  doc.rect(0, 0, cardWidth, cardHeight)
     .fillAndStroke('#1e40af', '#1e3a8a');

  // Header
  doc.fillColor('white')
     .fontSize(8)
     .font('Helvetica-Bold')
     .text('RÉPUBLIQUE DE CÔTE D\'IVOIRE', 10, 10, { width: cardWidth - 60 })
     .fontSize(10)
     .text('PERMIS DE PÊCHE', 10, 25);

  // Photo placeholder (right side)
  const photoX = cardWidth - 50;
  const photoY = 10;
  const photoWidth = 40;
  const photoHeight = 50;
  
  doc.rect(photoX, photoY, photoWidth, photoHeight)
     .fillAndStroke('rgba(255,255,255,0.2)', 'rgba(255,255,255,0.5)');

  // If photo exists, would draw it here
  if (permit.media?.[0]?.base64Data) {
    try {
      const imageBuffer = Buffer.from(permit.media[0].base64Data.split(',')[1], 'base64');
      doc.image(imageBuffer, photoX + 2, photoY + 2, {
        width: photoWidth - 4,
        height: photoHeight - 4,
        fit: [photoWidth - 4, photoHeight - 4]
      });
    } catch (error) {
      console.error('Error adding photo to card:', error);
    }
  }

  // Permit information
  const infoY = 70;
  const lineHeight = 12;
  
  doc.fontSize(7)
     .font('Helvetica-Bold');

  const info = [
    `Nom: ${permit.fisher.nom} ${permit.fisher.prenoms}`,
    `N° Série: ${permit.numSerie}`,
    `Zone: ${permit.zonePeche}`,
    `Exp: ${new Date(permit.dateExpiration).toLocaleDateString('fr-FR')}`
  ];

  info.forEach((line, index) => {
    doc.text(line, 10, infoY + (index * lineHeight), { width: cardWidth - 120 });
  });

  // QR Code
  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrPayload, {
      width: 48,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
    doc.image(qrBuffer, 10, cardHeight - 58, {
      width: 48,
      height: 48
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback: draw a white rectangle
    doc.rect(10, cardHeight - 58, 48, 48)
       .fillAndStroke('white', 'white');
  }

  // Expiration date (bottom right)
  doc.fontSize(6)
     .text('Valide jusqu\'au', cardWidth - 80, cardHeight - 35, { width: 70, align: 'right' })
     .fontSize(8)
     .font('Helvetica-Bold')
     .text(new Date(permit.dateExpiration).toLocaleDateString('fr-FR'), 
           cardWidth - 80, cardHeight - 20, { width: 70, align: 'right' });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function generateBatchCards(
  permits: FullPermit[], 
  qrPayloads: string[], 
  options: CardOptions = {}
): Promise<Buffer> {
  const { cardsPerPage = 10, dpi = 300 } = options;
  
  // A4 page size
  const pageWidth = 595.28; // 210mm
  const pageHeight = 841.89; // 297mm
  
  const doc = new PDFDocument({
    size: 'A4',
    margin: 20
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const cardWidth = (pageWidth - 60) / 2; // 2 columns
  const cardHeight = (pageHeight - 100) / 5; // 5 rows
  
  for (let i = 0; i < permits.length; i++) {
    const pageIndex = Math.floor(i / cardsPerPage);
    const cardIndex = i % cardsPerPage;
    
    if (cardIndex === 0 && i > 0) {
      doc.addPage();
    }
    
    const col = cardIndex % 2;
    const row = Math.floor(cardIndex / 2);
    
    const x = 30 + (col * (cardWidth + 20));
    const y = 30 + (row * (cardHeight + 10));
    
    // Draw card background
    doc.rect(x, y, cardWidth, cardHeight)
       .fillAndStroke('#1e40af', '#1e3a8a');
    
    // Add permit information (simplified for batch)
    doc.fillColor('white')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('PERMIS DE PÊCHE', x + 5, y + 5)
       .fontSize(7)
       .text(`${permits[i].fisher.nom} ${permits[i].fisher.prenoms}`, x + 5, y + 20)
       .text(`N°: ${permits[i].numSerie}`, x + 5, y + 35)
       .text(`Zone: ${permits[i].zonePeche}`, x + 5, y + 50);
    
    // Add small QR code
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrPayloads[i], {
        width: 30,
        margin: 0
      });
      
      const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
      doc.image(qrBuffer, x + cardWidth - 35, y + cardHeight - 35, {
        width: 30,
        height: 30
      });
    } catch (error) {
      console.error('Error generating QR code for batch:', error);
    }
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}
