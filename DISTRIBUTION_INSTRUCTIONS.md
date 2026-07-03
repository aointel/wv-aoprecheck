# 🚀 Desktop App Distribution Guide

## **What to Distribute**

**File:** `electron-dist/AO Intelligence 1.0.3.exe`  
**Size:** ~130 MB  
**Type:** Portable - NO INSTALLATION NEEDED

---

## ✅ **Why Portable Version?**

- ✅ No installer hang issues
- ✅ No OneDrive sync conflicts
- ✅ Run from anywhere (desktop, C: drive, USB)
- ✅ No admin rights needed
- ✅ Instant startup

---

## 📤 **Distribution Methods**

### **Option 1: Email (Best for Small Teams)**

1. Go to: `C:\Users\mmand\OneDrive\Desktop\AOI\electron-dist\`
2. Find: `AO Intelligence 1.0.3.exe` 
3. Email to team members
4. They save it anywhere and double-click to run

**Email Template:**
```
Subject: 🚀 New AO Intelligence Desktop App - Version 1.0.3

Hi [Name],

Attached is the new AO Intelligence desktop app with automatic HPPRO tracking!

✅ AUTOMATIC FEATURES:
   • Screenshots captured every 30 seconds during presentations
   • Page scraping tracks every slide you view
   • Live Board shows your current presentation
   • No manual start needed!

📥 HOW TO USE:
   1. Save the attached file anywhere (Desktop, Documents, etc.)
   2. Double-click "AO Intelligence 1.0.3.exe" to run
   3. Log in with your credentials
   4. Open HPPRO - tracking starts automatically!

⚡ NO INSTALLATION NEEDED - just run the .exe file!

Questions? Reply to this email.

Thanks!
```

---

### **Option 2: Shared Drive**

**Google Drive:**
1. Upload `AO Intelligence 1.0.3.exe` to Google Drive
2. Right-click → "Get link" → "Anyone with the link"
3. Share link with team

**OneDrive/Dropbox:**
Same process - upload and share public link

---

### **Option 3: Network Share**

```
\\YourServer\SharedDrive\Software\AO Intelligence 1.0.3.exe
```

Team copies the file to their local machine and runs it.

---

## 👥 **User Instructions**

### **English:**
```
📱 AO Intelligence Desktop App - Quick Start

1. DOWNLOAD: Save "AO Intelligence 1.0.3.exe" to your computer
   (Desktop, Documents, or any folder)

2. RUN: Double-click the file to launch

3. LOGIN: Use your AO Intelligence credentials

4. USE HPPRO: Open any presentation - tracking starts automatically!

✅ What Gets Tracked Automatically:
   • Screenshots every 30 seconds
   • Every slide you view
   • Forms you fill out
   • Links you click
   • Time spent on each page

📊 View on Live Board:
   Your manager can see your current presentation in real-time!

⚠️ IMPORTANT: 
   • Keep the app running while presenting
   • Make sure you're logged in BEFORE opening HPPRO
   • No manual start needed - it's automatic!
```

### **Español:**
```
📱 App de Escritorio AO Intelligence - Inicio Rápido

1. DESCARGAR: Guarda "AO Intelligence 1.0.3.exe" en tu computadora
   (Escritorio, Documentos, o cualquier carpeta)

2. EJECUTAR: Haz doble clic en el archivo para iniciar

3. INICIAR SESIÓN: Usa tus credenciales de AO Intelligence

4. USA HPPRO: Abre cualquier presentación - ¡el seguimiento comienza automáticamente!

✅ Qué Se Rastrea Automáticamente:
   • Capturas de pantalla cada 30 segundos
   • Cada diapositiva que ves
   • Formularios que completas
   • Enlaces que haces clic
   • Tiempo en cada página

📊 Ver en Live Board:
   ¡Tu gerente puede ver tu presentación actual en tiempo real!

⚠️ IMPORTANTE:
   • Mantén la app ejecutándose durante la presentación
   • Asegúrate de estar conectado ANTES de abrir HPPRO
   • ¡No necesitas iniciar manualmente - es automático!
```

---

## 🎯 **Rollout Plan**

### **Phase 1: Pilot (Days 1-2)**
- Send to 5-10 trusted users
- Verify tracking works
- Collect feedback

### **Phase 2: Team Leaders (Days 3-4)**
- Distribute to all team leaders
- They test with their teams
- Monitor Live Board

### **Phase 3: Full Rollout (Days 5-7)**
- Send to all producers
- Follow up with non-users
- Check Live Board adoption

---

## 🔧 **Troubleshooting**

### **"Windows protected your PC" message**

**Solution:**
1. Click "More info"
2. Click "Run anyway"

This is normal for unsigned apps. To avoid in future, sign the exe with a code signing certificate.

---

### **"App won't start"**

**Solutions:**
1. Make sure you're not running from OneDrive - copy to C:\Temp\ first
2. Close any other instances
3. Run as administrator (right-click → "Run as administrator")

---

### **"Tracking not working"**

**Checklist:**
1. ✅ Logged into app BEFORE opening HPPRO
2. ✅ App still running in background
3. ✅ HPPRO opened in NEW window (not tab)
4. ✅ Console logs show "✅ PRESENTATION WINDOW DETECTED"

---

## 📊 **Verify Deployment**

### **Check Who's Using It:**

Query to run in Supabase:
```sql
SELECT 
  agent_email,
  COUNT(*) as presentation_count,
  MAX(started_at) as last_presentation
FROM presentation_sessions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY agent_email
ORDER BY last_presentation DESC;
```

### **Check Live Board:**
- Log in as admin
- Go to Live Board
- See active presentations with screenshots

---

## ✅ **Success Metrics**

After 1 week:
- [ ] 80%+ of producers using desktop app
- [ ] Active presentations showing on Live Board
- [ ] Screenshots captured for all presentations
- [ ] Zero installation issues reported

---

## 📁 **File Location**

**On your machine:**
```
C:\Users\mmand\OneDrive\Desktop\AOI\electron-dist\AO Intelligence 1.0.3.exe
```

**What's included:**
- Version 1.0.3
- Auto HPPRO detection
- Screenshot capture (30s intervals)
- Page scraping (10s intervals)
- Live Board integration
- No installation required

---

## 🎉 **You're Ready!**

Just distribute `AO Intelligence 1.0.3.exe` and let your team know:
1. **NO INSTALLATION** - just run it
2. **LOGIN FIRST** - before opening HPPRO
3. **AUTOMATIC TRACKING** - no manual start

That's it! The app does everything else automatically. 🚀

