import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { generateQRPayload, verifyQRSignature, getPublicKey } from "./services/qr-crypto";
import { generatePermitCard, generateBatchCards } from "./services/pdf-generator";
import { createPermitSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware (simplified)
  const requireAuth = (req: any, res: any, next: any) => {
    // In a real app, implement proper JWT/session authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    // For demo, accept any bearer token
    next();
  };

  // Public key endpoint for QR verification
  app.get('/api/public-key', (req, res) => {
    res.json({ publicKey: getPublicKey() });
  });

  // Statistics endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get statistics' });
    }
  });

  // Create permit
  app.post('/api/permits', upload.single('photo'), async (req, res) => {
    try {
      // Parse form data
      const permitData = JSON.parse(req.body.permitData);
      
      // Add photo if uploaded
      if (req.file) {
        permitData.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      // Validate data
      const validatedData = createPermitSchema.parse(permitData);
      
      // Create permit
      const permit = await storage.createPermit(validatedData);
      
      // Generate QR code
      const { payload, signature } = generateQRPayload(permit.id);
      
      // Create card record
      const card = await storage.createCard({
        permitId: permit.id,
        qrPayload: payload,
        qrSignature: signature,
        version: 1
      });

      res.json({ ...permit, card });
    } catch (error) {
      console.error('Error creating permit:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create permit' });
      }
    }
  });

  // Get permits
  app.get('/api/permits', async (req, res) => {
    try {
      const { zone, status, search, limit = '50', offset = '0' } = req.query;
      
      const permits = await storage.getPermits({
        zone: zone as string,
        status: status as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json(permits);
    } catch (error) {
      console.error('Error getting permits:', error);
      res.status(500).json({ message: 'Failed to get permits' });
    }
  });

  // Get single permit
  app.get('/api/permits/:id', async (req, res) => {
    try {
      const permit = await storage.getPermit(req.params.id);
      if (!permit) {
        return res.status(404).json({ message: 'Permit not found' });
      }
      res.json(permit);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get permit' });
    }
  });

  // Update permit
  app.put('/api/permits/:id', async (req, res) => {
    try {
      const updatedPermit = await storage.updatePermit(req.params.id, req.body);
      if (!updatedPermit) {
        return res.status(404).json({ message: 'Permit not found' });
      }
      res.json(updatedPermit);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update permit' });
    }
  });

  // Delete permit
  app.delete('/api/permits/:id', async (req, res) => {
    try {
      const success = await storage.deletePermit(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Permit not found' });
      }
      res.json({ message: 'Permit deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete permit' });
    }
  });

  // Generate card PDF
  app.get('/api/cards/:permitId/pdf', async (req, res) => {
    try {
      const permit = await storage.getPermit(req.params.permitId);
      if (!permit) {
        return res.status(404).json({ message: 'Permit not found' });
      }

      const card = await storage.getCardByPermitId(req.params.permitId);
      if (!card) {
        return res.status(404).json({ message: 'Card not found' });
      }

      const qrPayload = `peche://verify?d=${card.qrPayload}&s=${card.qrSignature}`;
      const pdfBuffer = await generatePermitCard(permit, qrPayload);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="permit-${permit.numSerie}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Generate batch PDF
  app.post('/api/cards/batch-pdf', async (req, res) => {
    try {
      const { permitIds } = req.body;
      
      if (!Array.isArray(permitIds) || permitIds.length === 0) {
        return res.status(400).json({ message: 'Invalid permit IDs' });
      }

      const permits = [];
      const qrPayloads = [];

      for (const permitId of permitIds) {
        const permit = await storage.getPermit(permitId);
        const card = await storage.getCardByPermitId(permitId);
        
        if (permit && card) {
          permits.push(permit);
          qrPayloads.push(`peche://verify?d=${card.qrPayload}&s=${card.qrSignature}`);
        }
      }

      if (permits.length === 0) {
        return res.status(404).json({ message: 'No valid permits found' });
      }

      const pdfBuffer = await generateBatchCards(permits, qrPayloads);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="permits-batch.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating batch PDF:', error);
      res.status(500).json({ message: 'Failed to generate batch PDF' });
    }
  });

  // Verify QR code
  app.post('/api/scans/verify', async (req, res) => {
    try {
      const { qrData } = req.body;
      
      // Parse QR data URL
      const url = new URL(qrData);
      if (url.protocol !== 'peche:' || url.hostname !== 'verify') {
        return res.status(400).json({ message: 'Invalid QR code format' });
      }

      const payload = url.searchParams.get('d');
      const signature = url.searchParams.get('s');

      if (!payload || !signature) {
        return res.status(400).json({ message: 'Missing QR code data' });
      }

      // Verify signature
      const qrPayload = verifyQRSignature(payload, signature);
      if (!qrPayload) {
        return res.status(400).json({ 
          message: 'Invalid QR code signature',
          result: 'invalid'
        });
      }

      // Get permit data
      const permit = await storage.getPermit(qrPayload.id);
      if (!permit) {
        return res.status(404).json({ 
          message: 'Permit not found',
          result: 'invalid'
        });
      }

      // Check expiration
      const now = new Date();
      const expiration = new Date(permit.dateExpiration);
      const isExpired = expiration <= now;

      // Log scan
      await storage.createScanLog({
        cardId: permit.card?.id || null,
        agentId: null, // Would get from auth
        result: isExpired ? 'expired' : 'valid',
        mode: 'online'
      });

      res.json({
        result: isExpired ? 'expired' : 'valid',
        permit: {
          fisher: permit.fisher,
          numSerie: permit.numSerie,
          zonePeche: permit.zonePeche,
          dateExpiration: permit.dateExpiration,
          typePeche: permit.typePeche
        },
        isExpired,
        message: isExpired ? 'Permit has expired' : 'Valid permit'
      });
    } catch (error) {
      console.error('Error verifying QR:', error);
      res.status(500).json({ message: 'Failed to verify QR code' });
    }
  });

  // Export data
  app.get('/api/export/csv', async (req, res) => {
    try {
      const permits = await storage.getPermits();
      
      // Generate CSV
      const headers = [
        'Serial Number', 'Fisher Name', 'Phone', 'Zone', 'Type', 
        'Issue Date', 'Expiration Date', 'Status'
      ];
      
      const rows = permits.map(permit => {
        const isExpired = new Date(permit.dateExpiration) <= new Date();
        return [
          permit.numSerie,
          `${permit.fisher.nom} ${permit.fisher.prenoms}`,
          permit.fisher.telephone,
          permit.zonePeche,
          permit.typePeche,
          permit.dateDelivrance,
          permit.dateExpiration,
          isExpired ? 'Expired' : 'Active'
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="permits-export.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  // Serve media files
  app.get('/api/media/:id', async (req, res) => {
    try {
      const media = await storage.getMediaByPermitId(req.params.id);
      const photo = media.find(m => m.type === 'photo_identite');
      
      if (!photo || !photo.base64Data) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      const [header, data] = photo.base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const buffer = Buffer.from(data, 'base64');

      res.setHeader('Content-Type', mimeType);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to serve media' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
