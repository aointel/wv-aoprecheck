import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Monitor, Smartphone, Laptop, Shield, Zap, Users, Languages, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Language = "en" | "es";

const translations = {
  en: {
    title: "Download ConnectNow",
    subtitle: "AO Intelligence powered by ConnectNow Desktop Application",
    version: "Version",
    released: "Released",
    secureTitle: "Secure & Professional",
    secureDesc: "Enterprise-grade security with automatic updates",
    fastTitle: "Lightning Fast",
    fastDesc: "Native desktop performance with WebRTC calling",
    teamTitle: "Team Collaboration",
    teamDesc: "Video meetings, lead management, and appointment booking",
    download: "Download",
    systemReqs: "System Requirements",
    installInstructions: "Installation Instructions",
    autoUpdatesTitle: "Automatic Updates",
    autoUpdatesDesc: "ConnectNow automatically checks for updates and will notify you when new versions are available. Updates are downloaded and installed seamlessly in the background.",
    windows: {
      installer: "ConnectNow Setup",
      installerDesc: "Professional installer for Windows (Recommended)",
      direct: "ConnectNow Direct",
      directDesc: "Direct executable - no installation required",
      requirements: [
        "• Windows 10 or later",
        "• 4 GB RAM minimum",
        "• 200 MB disk space",
        "• Internet connection required"
      ],
      steps: [
        "1. Download the installer",
        "2. Run the .exe file",
        "3. Follow the setup wizard",
        "4. Launch ConnectNow from Start Menu"
      ]
    },
    mac: {
      dmg: "ConnectNow for Mac",
      dmgDesc: "Universal binary (Intel + Apple Silicon)",
      zip: "ConnectNow Archive",
      zipDesc: "ZIP archive version",
      requirements: [
        "• macOS 10.15 or later",
        "• Intel or Apple Silicon Mac",
        "• 4 GB RAM minimum",
        "• 200 MB disk space"
      ],
      steps: [
        "1. Download the .dmg file",
        "2. Open the disk image",
        "3. Drag ConnectNow to Applications",
        "4. Launch from Applications folder"
      ]
    },
    linux: {
      appimage: "ConnectNow AppImage",
      appimageDesc: "Universal Linux application",
      deb: "ConnectNow DEB",
      debDesc: "For Debian/Ubuntu systems",
      requirements: [
        "• Ubuntu 18.04+ or equivalent",
        "• 4 GB RAM minimum",
        "• 200 MB disk space",
        "• GLIBC 2.28 or higher"
      ],
      steps: [
        "1. Download AppImage or DEB",
        "2. Make executable (chmod +x)",
        "3. Run directly or install package",
        "4. Launch from applications menu"
      ]
    }
  },
  es: {
    title: "Descargar ConnectNow",
    subtitle: "AO Intelligence impulsado por la Aplicación de Escritorio ConnectNow",
    version: "Versión",
    released: "Publicado",
    secureTitle: "Seguro y Profesional",
    secureDesc: "Seguridad de nivel empresarial con actualizaciones automáticas",
    fastTitle: "Súper Rápido",
    fastDesc: "Rendimiento nativo de escritorio con llamadas WebRTC",
    teamTitle: "Colaboración en Equipo",
    teamDesc: "Videollamadas, gestión de clientes potenciales y reserva de citas",
    download: "Descargar",
    systemReqs: "Requisitos del Sistema",
    installInstructions: "Instrucciones de Instalación",
    autoUpdatesTitle: "Actualizaciones Automáticas",
    autoUpdatesDesc: "ConnectNow verifica automáticamente las actualizaciones y te notificará cuando haya nuevas versiones disponibles. Las actualizaciones se descargan e instalan sin problemas en segundo plano.",
    windows: {
      installer: "Instalador ConnectNow",
      installerDesc: "Instalador profesional para Windows (Recomendado)",
      direct: "ConnectNow Directo",
      directDesc: "Ejecutable directo - no requiere instalación",
      requirements: [
        "• Windows 10 o posterior",
        "• 4 GB de RAM mínimo",
        "• 200 MB de espacio en disco",
        "• Conexión a Internet requerida"
      ],
      steps: [
        "1. Descarga el instalador",
        "2. Ejecuta el archivo .exe",
        "3. Sigue el asistente de instalación",
        "4. Inicia ConnectNow desde el Menú Inicio"
      ]
    },
    mac: {
      dmg: "ConnectNow para Mac",
      dmgDesc: "Binario universal (Intel + Apple Silicon)",
      zip: "Archivo ConnectNow",
      zipDesc: "Versión de archivo ZIP",
      requirements: [
        "• macOS 10.15 o posterior",
        "• Mac Intel o Apple Silicon",
        "• 4 GB de RAM mínimo",
        "• 200 MB de espacio en disco"
      ],
      steps: [
        "1. Descarga el archivo .dmg",
        "2. Abre la imagen de disco",
        "3. Arrastra ConnectNow a Aplicaciones",
        "4. Inicia desde la carpeta Aplicaciones"
      ]
    },
    linux: {
      appimage: "ConnectNow AppImage",
      appimageDesc: "Aplicación universal de Linux",
      deb: "ConnectNow DEB",
      debDesc: "Para sistemas Debian/Ubuntu",
      requirements: [
        "• Ubuntu 18.04+ o equivalente",
        "• 4 GB de RAM mínimo",
        "• 200 MB de espacio en disco",
        "• GLIBC 2.28 o superior"
      ],
      steps: [
        "1. Descarga AppImage o DEB",
        "2. Hazlo ejecutable (chmod +x)",
        "3. Ejecuta directamente o instala el paquete",
        "4. Inicia desde el menú de aplicaciones"
      ]
    }
  }
};

// Detect if desktop app is installed/running
function isDesktopAppInstalled(): boolean {
  // Check for Electron API (desktop app is running)
  if ((window as any).electronAPI?.isDesktopApp) {
    return true;
  }
  
  // Check for desktop app flag
  if ((window as any).isDesktopApp) {
    return true;
  }
  
  // Check user agent for desktop app
  const userAgent = navigator.userAgent;
  if (userAgent.includes('ConnectNow') || userAgent.includes('Electron')) {
    return true;
  }
  
  // Check for desktop app mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) {
    return true;
  }
  
  return false;
}

export default function Downloads() {
  const [language, setLanguage] = useState<Language>("en");
  const [location, navigate] = useLocation();
  const isPublicDownloadsRoute = location.includes('/downloads');
  const { authState } = useAuth();
  const isAuthenticated = !!authState.user;
  
  const currentVersion = "1.0.4";
  const releaseDate = "November 17, 2025";
  const t = translations[language];

  // Electron users should never stay on downloads — bounce them back
  useEffect(() => {
    const desktopAppInstalled = isDesktopAppInstalled();
    if (!desktopAppInstalled) return;

    const userEmail = authState.user?.email;
    if (userEmail === 'cnsysop@aoglobelife.com') return;

    // Electron app landed here (server gate incorrectly blocked) — redirect immediately
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, authState.user?.email, navigate]);

  const downloads = {
    windows: {
      title: "Windows",
      icon: <Monitor className="h-6 w-6" />,
      files: [
        {
          name: "AO Intelligence Desktop Installer",
          description: language === "en" 
            ? "Professional installer with auto-updates"
            : "Instalador profesional con actualizaciones automáticas",
          filename: `AOI-1.0.0-Setup (2) (2).exe`,
          size: "~200 MB",
          type: language === "en" ? "Windows Installer" : "Instalador de Windows"
        }
      ]
    }
  };

  const handleDownload = async (filename: string) => {
    // Download from Supabase Storage
    const downloadUrl = `https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/installers/${encodeURIComponent(filename)}`;
    
    console.log('📥 Starting download:', filename);
    console.log('🔗 Download URL:', downloadUrl);
    
    try {
      // Fetch the file as a blob to force download
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ Download failed:', response.status, response.statusText);
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      console.log('📦 Content-Type:', contentType);
      
      const blob = await response.blob();
      console.log('✅ Blob created, size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      
      // Append to body, click, then remove
      document.body.appendChild(link);
      console.log('🖱️ Clicking download link...');
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL after a short delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        console.log('🧹 Cleaned up blob URL');
      }, 100);
      
      console.log('✅ Download initiated successfully');
    } catch (error) {
      console.error('❌ Download error:', error);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nTrying to open in new tab...`);
      // Fallback: open in new tab if fetch fails
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div
      className={
        isPublicDownloadsRoute
          ? "downloads-page-root h-[100dvh] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-background pb-28"
          : "w-full min-h-0 overflow-x-hidden pb-8"
      }
    >
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Language Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => setLanguage("en")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              language === "en"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Languages className="h-4 w-4" />
            English
          </button>
          <button
            onClick={() => setLanguage("es")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              language === "es"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Languages className="h-4 w-4" />
            Español
          </button>
        </div>
      </div>

      {/* Browser-blocked notice — only for actual browser users redirected by the gate */}
      {isPublicDownloadsRoute && !(window as any).electronAPI?.isDesktopApp && !navigator.userAgent.includes('Electron') && (
        <div className="mb-6 p-4 rounded-lg border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-center">
          <p className="text-lg font-bold text-orange-700 dark:text-orange-300 mb-1">
            🚫 Browser access is not allowed
          </p>
          <p className="text-sm text-orange-600 dark:text-orange-400">
            ConnectNow requires the Desktop App. Download and install it below, then open it from your Start Menu.
          </p>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
          {t.title}
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          {t.subtitle}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-4">
          <Badge variant="secondary">{t.version} {currentVersion}</Badge>
          <span>{t.released} {releaseDate}</span>
        </div>
        
        {/* Get your account / Login for unauthenticated users */}
        {!isAuthenticated && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button 
              onClick={() => navigate('/join')}
              variant="default"
              size="lg"
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {language === "en" ? "Get your account" : "Obtener cuenta"}
            </Button>
            <Button 
              onClick={() => navigate('/login')}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              {language === "en" ? "Log In" : "Iniciar Sesión"}
            </Button>
          </div>
        )}
      </div>

      {/* INSTALLATION INSTRUCTIONS - BIG ALERT */}
      <Card className="mb-8 border-2 border-blue-500 bg-blue-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Download className="h-16 w-16 text-blue-600 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900">
              {language === "en" ? "IMPORTANT: After Downloading" : "IMPORTANTE: Después de Descargar"}
            </h2>
            <div className="text-lg space-y-2 text-blue-800 max-w-2xl mx-auto">
              <p className="font-semibold">
                {language === "en" 
                  ? "1. The installer will download to your Downloads folder" 
                  : "1. El instalador se descargará en tu carpeta de Descargas"}
              </p>
              <p className="font-semibold">
                {language === "en"
                  ? "2. Open your Downloads folder and run ConnectNow-Setup.exe"
                  : "2. Abre tu carpeta de Descargas y ejecuta ConnectNow-Setup.exe"}
              </p>
              <p className="font-semibold">
                {language === "en"
                  ? "3. Follow the installation wizard"
                  : "3. Sigue el asistente de instalación"}
              </p>
              <p className="font-semibold">
                {language === "en"
                  ? "4. Launch ConnectNow from your Start Menu"
                  : "4. Inicia ConnectNow desde tu Menú Inicio"}
              </p>
            </div>
            <div className="pt-4 border-t-2 border-blue-300 mt-4">
              <p className="text-blue-900 font-bold text-xl">
                {language === "en"
                  ? "⚠️ DO NOT just click Download and close this page - you must RUN the installer!"
                  : "⚠️ NO solo hagas clic en Descargar y cierres esta página - ¡debes EJECUTAR el instalador!"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Shield className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h3 className="font-semibold mb-2">{t.secureTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {t.secureDesc}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <Zap className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
            <h3 className="font-semibold mb-2">{t.fastTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {t.fastDesc}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <Users className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold mb-2">{t.teamTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {t.teamDesc}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Windows Download */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Monitor className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-2xl">Windows</CardTitle>
            </div>
            <CardDescription>Download for Windows 10 or later</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {downloads.windows.files.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{file.name}</div>
                    <div className="text-sm text-muted-foreground">{file.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">Size: {file.size}</div>
                  </div>
                  <Badge variant="outline">{file.type}</Badge>
                </div>
                <Button 
                  onClick={() => handleDownload(file.filename)}
                  className="w-full"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t.download}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* macOS Notice */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Laptop className="h-6 w-6 text-blue-700" />
              <CardTitle className="text-2xl">macOS</CardTitle>
            </div>
            <CardDescription>
              {language === "en"
                ? "Mac app download is no longer provided"
                : "La descarga de la app para Mac ya no está disponible"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-300 bg-white/70 dark:bg-slate-900/40 p-4 text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                {language === "en"
                  ? "Use Parallels Desktop to run AO Intelligence on Mac."
                  : "Usa Parallels Desktop para ejecutar AO Intelligence en Mac."}
              </p>
              <p className="mt-2 text-blue-800 dark:text-blue-200">
                {language === "en"
                  ? "Install Windows in Parallels, then download and run the Windows installer from this page."
                  : "Instala Windows en Parallels y luego descarga y ejecuta el instalador de Windows desde esta página."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Requirements */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t.systemReqs}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Windows
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {t.windows.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Laptop className="h-4 w-4" />
                macOS
              </h4>
              <p className="text-sm text-muted-foreground">Use Parallels Desktop to run the Windows version.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Linux
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {t.linux.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.installInstructions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Windows</h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                {t.windows.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">macOS</h4>
              <p className="text-sm text-muted-foreground">Use Parallels Desktop — install the Windows version inside Parallels.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Linux</h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                {t.linux.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Updates Note */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">{t.autoUpdatesTitle}</h4>
        </div>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {t.autoUpdatesDesc}
        </p>
      </div>
    </div>
    </div>
  );
}