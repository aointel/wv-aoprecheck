with open(r'C:\dev\AOIrail\client\src\pages\Downloads.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''        {/* Mac Tile */}
        <Card className="hover:shadow-lg transition-shadow border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Laptop className="h-6 w-6 text-amber-600" />
              <CardTitle className="text-2xl">macOS</CardTitle>
            </div>
            <CardDescription>Mac users — please read below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-100 border border-amber-300 p-4 text-amber-900">
              <p className="font-semibold text-base mb-1">⚠️ Mac not supported natively</p>
              <p className="text-sm">Please use <strong>Parallels Desktop</strong> to run the Windows version of ConnectNow on your Mac.</p>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Install <a href="https://www.parallels.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Parallels Desktop</a> on your Mac</li>
              <li>Set up a Windows virtual machine</li>
              <li>Download and install the Windows version of ConnectNow inside Parallels</li>
            </ol>
          </CardContent>
        </Card>'''

new = '''        {/* Mac Tile */}
        <Card className="hover:shadow-lg transition-shadow border-gray-200">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Laptop className="h-6 w-6 text-gray-600" />
              <CardTitle className="text-2xl">macOS</CardTitle>
            </div>
            <CardDescription>Intel + Apple Silicon — macOS 10.15 or later</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full gap-2"
              onClick={() => {
                const url = 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/installers/AO%20Intelligence-1.0.4.dmg';
                window.open(url, '_blank');
              }}
            >
              <Download className="h-4 w-4" />
              Download AO Intelligence for Mac (v1.0.4)
            </Button>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-900 text-sm">
              <p className="font-semibold mb-1">📋 Installation Instructions</p>
              <ol className="space-y-1 list-decimal list-inside text-xs">
                <li>Download the .dmg file above</li>
                <li>Open the disk image from your Downloads folder</li>
                <li>Drag <strong>AO Intelligence</strong> to your Applications folder</li>
                <li>Launch from Applications — if macOS blocks it, go to <strong>System Settings → Privacy & Security</strong> and click <strong>Open Anyway</strong></li>
              </ol>
            </div>
            <div className="text-xs text-muted-foreground">
              Universal binary · ~200 MB · macOS 10.15 (Catalina) or later
            </div>
          </CardContent>
        </Card>'''

assert old in content, 'Mac tile not found'
result = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\client\src\pages\Downloads.tsx', 'w', encoding='utf-8') as f:
    f.write(result)
print('Done')
