import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { createPermitSchema } from '@shared/schema';
import { offlineStorage } from '@/lib/offline-storage';
import PermitCard from '@/components/permit-card';

type PermitFormData = z.infer<typeof createPermitSchema>;

export default function PermitForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [createdPermit, setCreatedPermit] = useState<any>(null);
  const totalSteps = 6;

  const form = useForm<PermitFormData>({
    resolver: zodResolver(createPermitSchema),
    defaultValues: {
      fisher: {
        nom: '',
        prenoms: '',
        dateNaissance: '',
        telephone: '',
        adresse: '',
        quartierVillage: '',
      },
      permit: {
        typePeche: '',
        zonePeche: '',
        numMaep: '',
        numSerie: '',
        dateDelivrance: '',
        dateExpiration: '',
        ifuDisponible: false,
        numIfu: '',
        numRavip: '',
        faitA: '',
        categorie: '',
      },
      vessel: {
        nomEmbarcation: '',
        numEmbarcation: '',
        siteDebarquement: '',
        siteHabitation: '',
      },
      technique: {
        typeEngin: '',
        techniquePeche: '',
        especesCiblees: '',
      },
    },
  });

  const createPermitMutation = useMutation({
    mutationFn: async (data: PermitFormData) => {
      if (navigator.onLine) {
        // Online submission
        const formData = new FormData();
        formData.append('permitData', JSON.stringify(data));
        
        if (capturedPhoto) {
          const response = await fetch(capturedPhoto);
          const blob = await response.blob();
          formData.append('photo', blob, 'identity.jpg');
        }

        const response = await fetch('/api/permits', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to create permit');
        }

        return response.json();
      } else {
        // Offline storage
        const permitData = { ...data };
        if (capturedPhoto) {
          permitData.photo = capturedPhoto;
        }
        
        const id = await offlineStorage.savePermit(permitData);
        return { id, offline: true };
      }
    },
    onSuccess: (data) => {
      if (data.offline) {
        toast({
          title: 'Permis sauvegardé hors ligne',
          description: 'Le permis sera synchronisé à la reconnexion',
        });
        setLocation('/');
      } else {
        setCreatedPermit(data);
        toast({
          title: 'Permis créé avec succès',
          description: `Permis ${data.numSerie} généré`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le permis',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PermitFormData) => {
    createPermitMutation.mutate(data);
  };

  const handleCameraCapture = () => {
    setLocation('/camera?returnTo=/permit-form');
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (createdPermit) {
    return (
      <div className="container mx-auto p-4 space-y-6 pb-20">
        <div className="flex items-center space-x-3 mb-6">
          <button
            onClick={() => setLocation('/')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="button-back-to-dashboard"
          >
            <i className="fas fa-arrow-left text-primary"></i>
          </button>
          <h2 className="text-xl font-bold">Aperçu de la Carte</h2>
        </div>

        <PermitCard
          permit={createdPermit}
          onDownload={() => {
            window.open(`/api/cards/${createdPermit.id}/pdf`, '_blank');
          }}
          onShare={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Permis de Pêche',
                text: `Permis ${createdPermit.numSerie}`,
                url: window.location.origin,
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 pb-20">
      <div className="flex items-center space-x-3 mb-6">
        <button
          onClick={() => setLocation('/')}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          data-testid="button-back"
        >
          <i className="fas fa-arrow-left text-primary"></i>
        </button>
        <h2 className="text-xl font-bold">Nouveau Permis de Pêche</h2>
      </div>

      {/* Form Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progression</span>
            <span className="text-sm font-medium" data-testid="form-progress">
              {currentStep}/{totalSteps}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Identity */}
          {currentStep === 1 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-user text-primary mr-2"></i>
                  Identité
                </h3>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="fisher.nom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Nom de famille" 
                            {...field} 
                            data-testid="input-fisher-nom"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fisher.prenoms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénoms *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Prénoms" 
                            {...field} 
                            data-testid="input-fisher-prenoms"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fisher.dateNaissance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance *</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-fisher-date-naissance"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Contact */}
          {currentStep === 2 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-map-marker-alt text-primary mr-2"></i>
                  Coordonnées
                </h3>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="fisher.adresse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse complète *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Adresse complète" 
                            rows={3} 
                            {...field} 
                            data-testid="input-fisher-adresse"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fisher.quartierVillage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quartier/Village *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Quartier ou village" 
                            {...field} 
                            data-testid="input-fisher-quartier"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fisher.telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numéro de téléphone *</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="+225 XX XX XX XX XX" 
                            {...field} 
                            data-testid="input-fisher-telephone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Permit Details */}
          {currentStep === 3 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-certificate text-primary mr-2"></i>
                  Détails du Permis
                </h3>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="permit.typePeche"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de pêche *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-type-peche">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="artisanale">Artisanale</SelectItem>
                              <SelectItem value="industrielle">Industrielle</SelectItem>
                              <SelectItem value="sportive">Sportive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="permit.zonePeche"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zone de pêche *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-zone-peche">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cotiere">Côtière</SelectItem>
                              <SelectItem value="lagunaire">Lagunaire</SelectItem>
                              <SelectItem value="haute-mer">Haute mer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="permit.numMaep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro XXX/MAEP *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="XXX/MAEP-XXXXXX" 
                              {...field} 
                              data-testid="input-num-maep"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="permit.numSerie"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de série *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="PF-2024-XXX" 
                              {...field} 
                              data-testid="input-num-serie"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="permit.dateDelivrance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de délivrance *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              data-testid="input-date-delivrance"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="permit.dateExpiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'expiration *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              data-testid="input-date-expiration"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: IFU/RAVIP */}
          {currentStep === 4 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-id-card text-primary mr-2"></i>
                  Références Fiscales
                </h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="permit.ifuDisponible"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disponibilité IFU *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === 'true')}
                            defaultValue={field.value?.toString()}
                            className="flex space-x-4"
                            data-testid="radio-ifu-disponible"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="true" id="ifu-oui" />
                              <Label htmlFor="ifu-oui">Oui</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="false" id="ifu-non" />
                              <Label htmlFor="ifu-non">Non</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch('permit.ifuDisponible') && (
                    <FormField
                      control={form.control}
                      name="permit.numIfu"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro IFU</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Numéro IFU" 
                              {...field} 
                              data-testid="input-num-ifu"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {!form.watch('permit.ifuDisponible') && (
                    <FormField
                      control={form.control}
                      name="permit.numRavip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro RAVIP</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Numéro RAVIP" 
                              {...field} 
                              data-testid="input-num-ravip"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Photo & Location */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Photo Capture */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <i className="fas fa-camera text-primary mr-2"></i>
                    Photo d'Identité *
                  </h3>
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-4 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                      {capturedPhoto ? (
                        <img src={capturedPhoto} alt="Photo captured" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <i className="fas fa-user text-4xl text-muted-foreground"></i>
                      )}
                    </div>
                    <Button 
                      type="button" 
                      onClick={handleCameraCapture}
                      data-testid="button-capture-photo"
                    >
                      <i className="fas fa-camera mr-2"></i>
                      {capturedPhoto ? 'Reprendre Photo' : 'Prendre Photo'}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      Assurez-vous que le visage est bien cadré et net
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Location */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <i className="fas fa-map-pin text-primary mr-2"></i>
                    Localisation
                  </h3>
                  <FormField
                    control={form.control}
                    name="permit.faitA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fait à *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Lieu de saisie" 
                            {...field} 
                            data-testid="input-fait-a"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 6: Optional Details */}
          {currentStep === 6 && (
            <div className="space-y-6">
              {/* Vessel Information */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <i className="fas fa-ship text-primary mr-2"></i>
                    Embarcation (Optionnel)
                  </h3>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vessel.nomEmbarcation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom d'embarcation</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Nom du bateau" 
                                {...field} 
                                data-testid="input-nom-embarcation"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vessel.numEmbarcation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Numéro d'embarcation</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Numéro d'immatriculation" 
                                {...field} 
                                data-testid="input-num-embarcation"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fishing Technique */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <i className="fas fa-cog text-primary mr-2"></i>
                    Technique de Pêche (Optionnel)
                  </h3>
                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="technique.typeEngin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type d'engin</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-type-engin">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="filet">Filet</SelectItem>
                              <SelectItem value="ligne">Ligne</SelectItem>
                              <SelectItem value="casier">Casier</SelectItem>
                              <SelectItem value="senne">Senne</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="technique.especesCiblees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Espèces ciblées</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Liste des espèces ciblées" 
                              rows={3} 
                              {...field} 
                              data-testid="input-especes-ciblees"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex space-x-4 pt-4">
            {currentStep > 1 && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={prevStep} 
                className="flex-1"
                data-testid="button-prev-step"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Précédent
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button 
                type="button" 
                onClick={nextStep} 
                className="flex-1"
                data-testid="button-next-step"
              >
                Suivant
                <i className="fas fa-arrow-right ml-2"></i>
              </Button>
            ) : (
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createPermitMutation.isPending}
                data-testid="button-submit-permit"
              >
                {createPermitMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Création...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Créer Permis
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
