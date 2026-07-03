import React from 'react';

export default function Clash() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800"></div>
        
        {/* Animated radial gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-red-500/20 via-pink-500/10 to-transparent rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-radial from-orange-500/20 via-red-500/10 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-radial from-purple-500/20 via-red-500/10 to-transparent rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-red-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              CLASH
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Challenge other producers to competitive battles across various metrics!
            </p>
          </div>

          <div className="text-center text-white text-lg">
            Clash content coming soon...
          </div>
        </div>
      </div>
    </div>
  );
}