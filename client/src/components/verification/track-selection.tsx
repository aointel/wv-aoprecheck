import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Phone, Users, Clock, MessageCircle, UserCheck, ArrowLeft, PlayCircle, Zap } from "lucide-react";

type VerificationTrack = 'zoom' | 'conference' | 'aoi-meet';
type ConferenceMethod = 'phone' | 'whatsapp' | 'facetime' | 'in-person';
type SessionType = 'demo' | 'live';

interface TrackSelectionProps {
  onTrackSelect: (track: VerificationTrack, method?: ConferenceMethod, sessionType?: SessionType) => void;
  language?: 'en' | 'es';
}

export function TrackSelection({ onTrackSelect, language = 'en' }: TrackSelectionProps) {
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<VerificationTrack | null>(null);
  const [showConferenceMethods, setShowConferenceMethods] = useState(false);
  const [selectedConferenceMethod, setSelectedConferenceMethod] = useState<ConferenceMethod | null>(null);

  const isSpanish = language === 'es';

  const sessionTypes = [
    {
      id: 'live' as SessionType,
      title: isSpanish ? 'Sesión en Vivo' : 'Live Session',
      description: isSpanish ? 'Sesión de verificación real del cliente' : 'Real client verification session',
      icon: Zap,
      color: 'green'
    },
    {
      id: 'demo' as SessionType,
      title: isSpanish ? 'Sesión de Demostración' : 'Demo Session',
      description: isSpanish ? 'Sesión de práctica/demostración' : 'Practice/demonstration session',
      icon: PlayCircle,
      color: 'blue'
    }
  ];

  const tracks = [
    {
      id: 'zoom' as VerificationTrack,
      title: isSpanish ? 'Reunión de Zoom' : 'Zoom Meeting',
      icon: Video,
      status: 'active',
      badge: isSpanish ? 'Disponible' : 'Available'
    },
    {
      id: 'conference' as VerificationTrack,
      title: isSpanish ? 'Llamada de Conferencia' : 'Conference Call',
      icon: Phone,
      status: 'new',
      badge: isSpanish ? 'Nuevo' : 'New'
    },
    {
      id: 'aoi-meet' as VerificationTrack,
      title: isSpanish ? 'AOI Meet' : 'AOI Meet',
      icon: Users,
      status: 'coming-soon',
      badge: isSpanish ? 'Próximamente' : 'Coming Soon'
    }
  ];

  const conferenceMethods = [
    {
      id: 'phone' as ConferenceMethod,
      title: isSpanish ? 'Teléfono' : 'Phone',
      icon: Phone
    },
    {
      id: 'whatsapp' as ConferenceMethod,
      title: 'WhatsApp',
      icon: MessageCircle
    },
    {
      id: 'facetime' as ConferenceMethod,
      title: 'FaceTime',
      icon: Video
    },
    {
      id: 'in-person' as ConferenceMethod,
      title: isSpanish ? 'En Persona' : 'In Person',
      icon: UserCheck
    }
  ];

  const handleSessionTypeSelect = (type: SessionType) => {
    setSessionType(type);
  };

  const handleTrackSelect = (track: VerificationTrack) => {
    if (track === 'conference') {
      setShowConferenceMethods(true);
      setSelectedTrack(track);
    } else {
      setSelectedTrack(track);
    }
  };

  const handleConferenceMethodSelect = (method: ConferenceMethod) => {
    setSelectedConferenceMethod(method);
  };

  const handleBackFromConference = () => {
    setShowConferenceMethods(false);
    setSelectedTrack(null);
    setSelectedConferenceMethod(null);
  };

  const handleBackFromTrack = () => {
    setSessionType(null);
    setSelectedTrack(null);
    setShowConferenceMethods(false);
    setSelectedConferenceMethod(null);
  };

  const handleConfirm = () => {
    if (selectedTrack === 'conference' && selectedConferenceMethod && sessionType) {
      onTrackSelect(selectedTrack, selectedConferenceMethod, sessionType);
    } else if (selectedTrack && selectedTrack !== 'conference' && sessionType) {
      onTrackSelect(selectedTrack, undefined, sessionType);
    }
  };

  // Step 1: Session Type Selection (Demo vs Live)
  if (!sessionType) {
    return (
      <div className="w-full max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isSpanish ? 'Seleccionar Tipo de Sesión' : 'Select Session Type'}
          </h1>
          <p className="text-gray-600">
            {isSpanish ? '¿Es esta una sesión en vivo o de demostración?' : 'Is this a live session or demo session?'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {sessionTypes.map((type) => {
            const Icon = type.icon;
            
            return (
              <Card 
                key={type.id}
                className="h-56 cursor-pointer transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-gray-300"
                onClick={() => handleSessionTypeSelect(type.id)}
                data-testid={`card-session-${type.id}`}
              >
                <CardContent className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                    type.color === 'green' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <Icon className={`w-10 h-10 ${
                      type.color === 'green' ? 'text-green-600' : 'text-blue-600'
                    }`} />
                  </div>
                  
                  <CardTitle className="text-2xl font-bold mb-3">{type.title}</CardTitle>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Step 2: Track/Method Selection (with back button)
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      {/* Back button and header */}
      <div className="flex items-center mb-8">
        <Button
          variant="ghost"
          onClick={handleBackFromTrack}
          className="mr-4"
          data-testid="button-back-session-type"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isSpanish ? 'Atrás' : 'Back'}
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSpanish ? 'Seleccionar Método de Verificación' : 'Select Verification Method'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {sessionType === 'demo' 
              ? (isSpanish ? 'Sesión de Demostración' : 'Demo Session') 
              : (isSpanish ? 'Sesión en Vivo' : 'Live Session')}
          </p>
        </div>
      </div>

      {!showConferenceMethods ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {tracks.map((track) => {
            const Icon = track.icon;
            const isSelected = selectedTrack === track.id;
            
            return (
              <Card 
                key={track.id}
                className={`h-48 transition-all duration-200 ${
                  track.status === 'coming-soon'
                    ? 'opacity-50 cursor-not-allowed bg-gray-50'
                    : `cursor-pointer ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50' 
                          : 'hover:shadow-lg hover:ring-1 hover:ring-gray-300'
                      }`
                }`}
                onClick={() => track.status !== 'coming-soon' && handleTrackSelect(track.id)}
                data-testid={`card-meeting-${track.id}`}
              >
                <CardContent className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                    track.id === 'zoom' ? 'bg-blue-100' : 
                    track.id === 'conference' ? 'bg-green-100' :
                    'bg-purple-100'
                  }`}>
                    <Icon className={`w-8 h-8 ${
                      track.id === 'zoom' ? 'text-blue-600' : 
                      track.id === 'conference' ? 'text-green-600' :
                      'text-purple-600'
                    }`} />
                  </div>
                  
                  <CardTitle className="text-xl font-bold mb-2">{track.title}</CardTitle>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {isSpanish ? 'Usado para: ' : 'Used for: '}
                    {track.id === 'zoom' && (isSpanish ? 'Reuniones de Zoom' : 'Zoom meetings')}
                    {track.id === 'conference' && (isSpanish ? 'Teléfono, WhatsApp, FaceTime, En Persona' : 'Phone, WhatsApp, FaceTime, In Person')}
                    {track.id === 'aoi-meet' && (isSpanish ? 'Reuniones AOI' : 'AOI meetings')}
                  </p>
                  
                  {track.status === 'coming-soon' && (
                    <Badge className="text-sm px-3 py-1 bg-gray-100 text-gray-600">
                      <Clock className="w-3 h-3 mr-1" />
                      {track.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-8">
            <Button
              variant="ghost"
              onClick={handleBackFromConference}
              className="mr-4"
              data-testid="button-back-conference"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isSpanish ? 'Atrás' : 'Back'}
            </Button>
            <h2 className="text-2xl font-bold text-gray-900">
              {isSpanish ? 'Selecciona método de conferencia' : 'Select Conference Method'}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {conferenceMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedConferenceMethod === method.id;
              
              return (
                <Card 
                  key={method.id}
                  className={`h-40 cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-green-500 shadow-lg bg-green-50' 
                      : 'hover:shadow-lg hover:ring-1 hover:ring-gray-300'
                  }`}
                  onClick={() => handleConferenceMethodSelect(method.id)}
                  data-testid={`card-conference-${method.id}`}
                >
                  <CardContent className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                      <Icon className="w-6 h-6 text-green-600" />
                    </div>
                    <CardTitle className="text-lg font-bold">{method.title}</CardTitle>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {(selectedTrack && selectedTrack !== 'conference') || (selectedTrack === 'conference' && selectedConferenceMethod) ? (
        <div className="text-center">
          <Button 
            onClick={handleConfirm}
            size="lg"
            className="px-8 py-3"
            data-testid="button-continue-selection"
          >
            {isSpanish ? 'Continuar con' : 'Continue with'} {
              selectedTrack === 'conference' && selectedConferenceMethod
                ? `${sessionType === 'demo' ? 'Demo' : 'Live'} - ${conferenceMethods.find(m => m.id === selectedConferenceMethod)?.title}`
                : `${sessionType === 'demo' ? 'Demo' : 'Live'} - ${tracks.find(t => t.id === selectedTrack)?.title}`
            }
          </Button>
        </div>
      ) : null}
    </div>
  );
}
