import { FullPermit } from '@shared/schema';
import { Card } from '@/components/ui/card';

interface PermitCardProps {
  permit: FullPermit;
  showActions?: boolean;
  onDownload?: () => void;
  onShare?: () => void;
}

export default function PermitCard({ permit, showActions = true, onDownload, onShare }: PermitCardProps) {
  const isExpired = new Date(permit.dateExpiration) <= new Date();

  return (
    <div className="space-y-6">
      {/* Generated Permit Card */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Carte Générée</h3>
        <div className="permit-card p-6 rounded-xl text-white max-w-sm mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-xs font-medium opacity-80">RÉPUBLIQUE DE CÔTE D'IVOIRE</h4>
              <h3 className="text-sm font-bold">PERMIS DE PÊCHE</h3>
            </div>
            <div className="w-16 h-20 bg-white/20 rounded border-2 border-white/50 flex items-center justify-center">
              {permit.media?.[0] ? (
                <img 
                  src={permit.media[0].url} 
                  alt="Photo d'identité" 
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <i className="fas fa-user text-white/60"></i>
              )}
            </div>
          </div>
          
          <div className="space-y-2 text-xs">
            <div><strong>Nom:</strong> {permit.fisher.nom} {permit.fisher.prenoms}</div>
            <div><strong>N° Série:</strong> {permit.numSerie}</div>
            <div><strong>Zone:</strong> {permit.zonePeche}</div>
            <div><strong>Exp:</strong> {new Date(permit.dateExpiration).toLocaleDateString('fr-FR')}</div>
          </div>
          
          <div className="mt-4 flex justify-between items-end">
            <div className="w-12 h-12 bg-white rounded flex items-center justify-center">
              <i className="fas fa-qrcode text-primary text-lg"></i>
            </div>
            <div className="text-right text-xs">
              <div className="opacity-80">Valide jusqu'au</div>
              <div className={`font-bold ${isExpired ? 'text-red-300' : ''}`}>
                {new Date(permit.dateExpiration).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      {showActions && (
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onDownload}
            className="bg-secondary text-secondary-foreground py-3 rounded-lg hover:bg-secondary/90 transition-colors"
            data-testid="button-download-pdf"
          >
            <i className="fas fa-download mr-2"></i>
            Exporter PDF
          </button>
          <button 
            onClick={onShare}
            className="bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors"
            data-testid="button-share-card"
          >
            <i className="fas fa-share mr-2"></i>
            Partager
          </button>
        </div>
      )}
    </div>
  );
}
