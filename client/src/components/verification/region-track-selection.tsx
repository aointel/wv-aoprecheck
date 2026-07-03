import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Flag, Building2 } from "lucide-react";

export type RegionTrack = 'us' | 'canada' | 'new-york';

interface RegionTrackSelectionProps {
  onRegionSelect: (region: RegionTrack) => void;
  language?: 'en' | 'es';
}

export function RegionTrackSelection({ onRegionSelect, language = 'en' }: RegionTrackSelectionProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionTrack | null>(null);
  const isSpanish = language === 'es';

  const regions = [
    {
      id: 'us' as RegionTrack,
      title: isSpanish ? 'Pista de EE. UU.' : 'US Track',
      description: isSpanish ? 'Verificaciones para clientes en Estados Unidos' : 'Verifications for clients in the United States',
      icon: Flag,
      color: 'blue'
    },
    {
      id: 'canada' as RegionTrack,
      title: isSpanish ? 'Pista de Canadá' : 'Canada Track',
      description: isSpanish ? 'Verificaciones para clientes en Canadá' : 'Verifications for clients in Canada',
      icon: MapPin,
      color: 'red'
    },
    {
      id: 'new-york' as RegionTrack,
      title: isSpanish ? 'Pista de Nueva York' : 'New York Track',
      description: isSpanish ? 'Verificaciones para clientes en Nueva York' : 'Verifications for clients in New York',
      icon: Building2,
      color: 'purple'
    }
  ];

  const handleRegionSelect = (region: RegionTrack) => {
    setSelectedRegion(region);
  };

  const handleContinue = () => {
    if (selectedRegion) {
      onRegionSelect(selectedRegion);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isSpanish ? 'Seleccionar Región' : 'Select Region Track'}
        </h1>
        <p className="text-gray-600">
          {isSpanish ? 'Seleccione la región para esta verificación' : 'Select the region track for this verification'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {regions.map((region) => {
          const Icon = region.icon;
          const isSelected = selectedRegion === region.id;
          
          return (
            <Card 
              key={region.id}
              className={`h-64 cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50' 
                  : 'hover:shadow-lg hover:ring-1 hover:ring-gray-300'
              }`}
              onClick={() => handleRegionSelect(region.id)}
              data-testid={`card-region-${region.id}`}
            >
              <CardContent className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                  region.color === 'blue' ? 'bg-blue-100' : 
                  region.color === 'red' ? 'bg-red-100' :
                  'bg-purple-100'
                }`}>
                  <Icon className={`w-10 h-10 ${
                    region.color === 'blue' ? 'text-blue-600' : 
                    region.color === 'red' ? 'text-red-600' :
                    'text-purple-600'
                  }`} />
                </div>
                
                <CardTitle className="text-2xl font-bold mb-3">{region.title}</CardTitle>
                <p className="text-sm text-gray-600">{region.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedRegion && (
        <div className="text-center">
          <Button 
            onClick={handleContinue}
            size="lg"
            className="px-8 py-3"
            data-testid="button-continue-region"
          >
            {isSpanish ? 'Continuar con' : 'Continue with'} {regions.find(r => r.id === selectedRegion)?.title}
          </Button>
        </div>
      )}
    </div>
  );
}

