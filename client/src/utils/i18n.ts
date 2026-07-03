// Centralized internationalization utility for verification system
export type Language = 'en' | 'es';

export interface Translations {
  // Common translations
  common: {
    loading: string;
    processing: string;
    error: string;
    success: string;
    sessionNotFound: string;
    sessionNotFoundDesc: string;
    invalidLink: string;
    invalidLinkDesc: string;
  };
  
  // Client verification translations
  client: {
    hello: string;
    approvalNeeded: string;
    policyDetails: string;
    name: string;
    phone: string;
    location: string;
    monthlyPremium: string;
    verificationMethod: string;
    disclaimer: string;
    disclaimerText: string;
    disclaimerPoints: string[];
    disclaimerNote: string;
    disclaimerApproved: string;
    approvedThankYou: string;
    approvedOn: string;
    approveDisclaimer: string;
    approveNote: string;
    securedBy: string;
    approvalFailed: string;
    disclaimerApprovedTitle: string;
    approvalFailedDesc: string;
    disclaimerApprovedDesc: string;
    instruction: string;
    action: string;
    button: string;
    pageTitle: string;
    subtitle: string;
  };
  
  // producer verification translations  
  producer: {
    pageTitle: string;
    subtitle: string;
    uploadTitle: string;
    uploadSubtitle: string;
    clientLabel: string;
    methodLabel: string;
    instructionsTitle: string;
    instructions: string[];
    uploadAreaTitle: string;
    uploadAreaSubtitle: string;
    tapToUpload: string;
    supportedFormats: string;
    fileSelected: string;
    uploadSuccess: string;
    uploadSuccessDesc: string;
    uploadFailed: string;
    uploadFailedDesc: string;
    uploading: string;
    loadingSession: string;
    sessionNotFoundTitle: string;
    sessionNotFoundDesc: string;
  };
}

const translations: Record<Language, Translations> = {
  en: {
    common: {
      loading: "Loading...",
      processing: "Processing...",
      error: "Error",
      success: "Success",
      sessionNotFound: "Session Not Found",
      sessionNotFoundDesc: "Could not find your verification session.",
      invalidLink: "Invalid Client Link",
      invalidLinkDesc: "This client verification link is invalid or has expired.",
    },
    client: {
      hello: "Hello",
      approvalNeeded: "Your producer needs your approval to continue with your policy verification.",
      policyDetails: "Your Policy Details",
      name: "Name:",
      phone: "Phone:",
      location: "Location:",
      monthlyPremium: "Monthly Premium:",
      verificationMethod: "Verification Method:",
      disclaimer: "📋 Verification Disclaimer",
      disclaimerText: "By approving this disclaimer, you confirm that:",
      disclaimerPoints: [
        "You are the policy holder mentioned above",
        "You authorize your producer to verify your policy details",
        "You understand this verification is for compliance purposes", 
        "You agree to participate in the scheduled verification call",
        "Your information will be handled securely and confidentially"
      ],
      disclaimerNote: "Your producer will proceed with verification once you approve this disclaimer.",
      disclaimerApproved: "✅ Disclaimer Approved",
      approvedThankYou: "Thank you for approving the disclaimer. Your producer can proceed with verification.",
      approvedOn: "Approved on",
      approveDisclaimer: "Approve Verification Disclaimer",
      approveNote: "By clicking \"Approve\", you agree to the terms mentioned above",
      securedBy: "Secured by AO Precheck • Secure Verification",
      approvalFailed: "Approval failed",
      disclaimerApprovedTitle: "Disclaimer approved",
      approvalFailedDesc: "Failed to approve disclaimer",
      disclaimerApprovedDesc: "Thank you for approving the verification disclaimer.",
      instruction: "Ready to Proceed",
      action: "Click approve to continue with verification.",
      button: "I Agree and Approve",
      pageTitle: "Client Verification", 
      subtitle: "Insurance Policy Verification"
    },
    producer: {
      pageTitle: "producer Verification",
      subtitle: "AO Precheck",
      uploadTitle: "Upload Zoom Gallery Screenshot",
      uploadSubtitle: "Take a screenshot of your Zoom gallery view from your phone and upload it here",
      clientLabel: "Client:",
      methodLabel: "Method:",
      instructionsTitle: "📸 Instructions",
      instructions: [
        "Take a screenshot of the Zoom gallery during the call",
        "Make sure both you and the client are visible",
        "The screenshot should be clear and legible",
        "Upload the image using the button below"
      ],
      uploadAreaTitle: "Upload Screenshot",
      uploadAreaSubtitle: "Tap to take photo or select file",
      tapToUpload: "Tap to take photo or select file",
      supportedFormats: "Supports JPG, PNG, WEBP (Max 10MB)",
      fileSelected: "File selected",
      uploadSuccess: "Screenshot uploaded!",
      uploadSuccessDesc: "Screenshot uploaded successfully! You can close this page now.",
      uploadFailed: "Upload failed", 
      uploadFailedDesc: "Failed to upload screenshot. Please try again.",
      uploading: "Uploading...",
      loadingSession: "Loading verification session...",
      sessionNotFoundTitle: "Session Not Found",
      sessionNotFoundDesc: "The verification session could not be found."
    }
  },
  es: {
    common: {
      loading: "Cargando...",
      processing: "Procesando...",
      error: "Error",
      success: "Éxito",
      sessionNotFound: "Sesión No Encontrada",
      sessionNotFoundDesc: "No se pudo encontrar su sesión de verificación.",
      invalidLink: "Enlace de Cliente Inválido", 
      invalidLinkDesc: "Este enlace de verificación de cliente no es válido o ha expirado.",
    },
    client: {
      hello: "Hola",
      approvalNeeded: "Su producere necesita su aprobación para continuar con la verificación de su póliza.",
      policyDetails: "Detalles de su Póliza",
      name: "Nombre:",
      phone: "Teléfono:",
      location: "Ubicación:",
      monthlyPremium: "Prima Mensual:",
      verificationMethod: "Método de Verificación:",
      disclaimer: "📋 Aviso Legal de Verificación",
      disclaimerText: "Al aprobar este aviso legal, usted confirma que:",
      disclaimerPoints: [
        "Usted es el titular de la póliza mencionada arriba",
        "Autoriza a su producere a verificar los detalles de su póliza",
        "Comprende que esta verificación es para propósitos de cumplimiento",
        "Acepta participar en la llamada de verificación programada",
        "Su información será manejada de manera segura y confidencial"
      ],
      disclaimerNote: "Su producere procederá con la verificación una vez que apruebe este aviso.",
      disclaimerApproved: "✅ Aviso Legal Aprobado",
      approvedThankYou: "Gracias por aprobar el aviso legal. Su producere puede proceder con la verificación.",
      approvedOn: "Aprobado el",
      approveDisclaimer: "Aprobar Aviso Legal de Verificación",
      approveNote: "Al hacer clic en \"Aprobar\", usted acepta los términos mencionados arriba",
      securedBy: "Protegido por AO Precheck • Verificación Segura",
      approvalFailed: "Aprobación falló",
      disclaimerApprovedTitle: "Aviso legal aprobado",
      approvalFailedDesc: "No se pudo aprobar el aviso legal",
      disclaimerApprovedDesc: "Gracias por aprobar el aviso legal de verificación.",
      instruction: "Listo para Proceder",
      action: "Haga clic en aprobar para continuar con la verificación.",
      button: "Acepto y Apruebo",
      pageTitle: "Verificación de Cliente",
      subtitle: "Verificación de Póliza de Seguro"
    },
    producer: {
      pageTitle: "Verificación de producere",
      subtitle: "AO Precheck", 
      uploadTitle: "Subir Captura de Pantalla de Zoom",
      uploadSubtitle: "Toma una captura de pantalla de la galería de Zoom desde tu teléfono y súbela aquí",
      clientLabel: "Cliente:",
      methodLabel: "Método:",
      instructionsTitle: "📸 Instrucciones",
      instructions: [
        "Toma una captura de pantalla de la galería de Zoom durante la llamada",
        "Asegúrate de que tanto tú como el cliente estén visibles", 
        "La captura debe ser clara y legible",
        "Sube la imagen usando el botón de abajo"
      ],
      uploadAreaTitle: "Subir Captura de Pantalla", 
      uploadAreaSubtitle: "Toca para tomar una foto o seleccionar una imagen",
      tapToUpload: "Toca para tomar una foto o seleccionar archivo",
      supportedFormats: "Soporta JPG, PNG, WEBP (Máx 10MB)",
      fileSelected: "Archivo seleccionado",
      uploadSuccess: "¡Captura de pantalla subida!",
      uploadSuccessDesc: "¡Captura de pantalla subida exitosamente! Puedes cerrar esta página ahora.",
      uploadFailed: "Error al subir",
      uploadFailedDesc: "Error al subir la captura de pantalla. Por favor, inténtalo de nuevo.", 
      uploading: "Subiendo...",
      loadingSession: "Cargando sesión de verificación...",
      sessionNotFoundTitle: "Sesión No Encontrada",
      sessionNotFoundDesc: "No se pudo encontrar la sesión de verificación. Por favor, verifica el enlace."
    }
  }
};

// Main translation function
export function t(key: string, language: Language = 'en'): string {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  // Fallback to English if translation missing
  if (language !== 'en') {
    return t(key, 'en');
  }
  
  console.warn(`Translation missing for key: ${key}`);
  return key;
}

// Get array translation (for disclaimerPoints, instructions, etc.)
export function tArray(key: string, language: Language = 'en'): string[] {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  if (Array.isArray(value)) {
    return value;
  }
  
  // Fallback to English if translation missing
  if (language !== 'en') {
    return tArray(key, 'en');
  }
  
  console.warn(`Array translation missing for key: ${key}`);
  return [];
}

// Detect language from URL parameter, pathname suffix, or session data
export function detectLanguage(sessionLanguage?: string, urlParams?: URLSearchParams): Language {
  // Check URL parameter first (?lang=es)
  const urlLang = urlParams?.get('lang');
  if (urlLang === 'es' || urlLang === 'en') {
    return urlLang as Language;
  }
  
  // Check pathname for Spanish suffix (e.g., /client-verify-es/, /agent-verify-es/)
  const pathname = window.location.pathname;
  if (pathname.includes('-es/') || pathname.endsWith('-es')) {
    return 'es';
  }
  
  // Check session language
  if (sessionLanguage === 'es' || sessionLanguage === 'en') {
    return sessionLanguage as Language;
  }
  
  // Default to English
  return 'en';
}

// Create translation hook for components
export function useTranslations(sessionLanguage?: string, urlParams?: URLSearchParams) {
  const language = detectLanguage(sessionLanguage, urlParams);
  
  return {
    t: (key: string) => t(key, language),
    tArray: (key: string) => tArray(key, language),
    language,
    isSpanish: language === 'es'
  };
}