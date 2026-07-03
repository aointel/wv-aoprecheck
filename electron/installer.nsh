; Custom NSIS installer script for AO Intelligence
; Welcome message and branding

!define PRODUCT_NAME "AO Intelligence"
!define PRODUCT_TAGLINE "Powered by ConnectNow"
!define PRODUCT_DESCRIPTION "Professional outbound calling dialer application"
!define PRODUCT_COMPANY "AO Intelligence"

; Custom welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "Welcome to AO Intelligence, powered by ConnectNow.$\r$\n$\r$\nThis setup wizard will guide you through the installation of ${PRODUCT_NAME}, the professional outbound calling dialer application that streamlines your sales processes.$\r$\n$\r$\nClick Next to continue or Cancel to exit Setup."

; Custom finish page
!define MUI_FINISHPAGE_TITLE "Completing ${PRODUCT_NAME} Setup"
!define MUI_FINISHPAGE_TEXT "${PRODUCT_NAME} has been successfully installed on your computer.$\r$\n$\r$\nYour professional calling solution is now ready to help you streamline sales processes and enhance agent productivity.$\r$\n$\r$\nClick Finish to close Setup."

; Custom installer colors and appearance
!define MUI_BGCOLOR "0x1a1a1a"
!define MUI_TEXTCOLOR "0xffffff"

; Custom header text
!define MUI_HEADER_TEXT "AO Intelligence Setup"
!define MUI_HEADER_SUBTEXT "Professional Outbound Calling Solution"

; License page customization
!define MUI_LICENSEPAGE_TEXT_TOP "Please review the license agreement for ${PRODUCT_NAME}:"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept the terms of the agreement, click I Agree to continue."

; Directory page customization  
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ${PRODUCT_NAME} in the following folder.$\r$\n$\r$\nTo install in a different folder, click Browse and select another folder."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder"

; Installation page customization
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Installation Complete"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "${PRODUCT_NAME} has been installed on your computer."
!define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "Installation Aborted"
!define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "Setup was not completed successfully."

; Start menu customization
!define MUI_STARTMENUPAGE_DEFAULTFOLDER "${PRODUCT_NAME}"

; Custom messages for various installer stages
LangString DESC_SecMain ${LANG_ENGLISH} "Install ${PRODUCT_NAME} - The professional outbound calling solution"
LangString DESC_SecDesktop ${LANG_ENGLISH} "Create a desktop shortcut for easy access to ${PRODUCT_NAME}"
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Create Start Menu shortcuts for ${PRODUCT_NAME}"

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SecMain} $(DESC_SecMain)
!insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop) 
!insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; Custom uninstaller messages
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Setup will uninstall ${PRODUCT_NAME} from your computer."
!define MUI_UNCONFIRMPAGE_TEXT_BOTTOM "Click Uninstall to start the uninstallation."

; Modern UI configuration
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "welcome.bmp"