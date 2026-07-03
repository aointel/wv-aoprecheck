import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function GamificationMockup() {
  const [, setLocation] = useLocation();
  const [showTinderDemo, setShowTinderDemo] = useState(false);

  const goToApp = () => {
    setLocation('/dashboard');
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Call Connector Pro - Daily Dial Streak Gamification
        </h1>
        
        {/* Main Call Interface with Gamification */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Call Connector Pro Interface</h2>
            
            {/* Daily Dial Counter - PROMINENT DISPLAY */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
              <div className="text-center">
                <div className="text-3xl font-bold">47</div>
                <div className="text-sm opacity-90">Daily Dials</div>
                <div className="text-xs opacity-75">Personal Best: 287</div>
              </div>
            </div>
          </div>

          {/* Progress Bar to Next Milestone */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress to "Steady Dialer" Badge</span>
              <span className="text-sm text-gray-500">47/50 dials</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-400 to-cyan-400 h-3 rounded-full transition-all duration-300" 
                style={{ width: '94%' }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">3 more dials to unlock your next badge!</div>
          </div>

          {/* Simulated Call Interface */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold mb-2">Current Lead</h3>
              <p><strong>Name:</strong> John Smith</p>
              <p><strong>Phone:</strong> (555) 123-4567</p>
              <p><strong>State:</strong> Colorado</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold mb-2">Call Controls</h3>
              <Button className="bg-green-500 text-white mr-2 hover:bg-green-600">
                📞 Dial (+1 to streak!)
              </Button>
              <Button variant="secondary">
                ⏸️ Pause
              </Button>
            </div>
          </div>
        </div>

        {/* Achievement Milestone Tracker */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Daily Dial Milestones</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            
            {/* 25 Dials - COMPLETED */}
            <div className="text-center p-3 bg-green-100 border-2 border-green-500 rounded-lg">
              <div className="text-2xl mb-1">✅</div>
              <div className="font-bold text-green-700">25</div>
              <div className="text-xs text-green-600">Getting Started</div>
              <div className="text-xs text-green-500">+25 XP</div>
            </div>

            {/* 50 Dials - ALMOST THERE */}
            <div className="text-center p-3 bg-yellow-100 border-2 border-yellow-500 rounded-lg animate-pulse">
              <div className="text-2xl mb-1">🎯</div>
              <div className="font-bold text-yellow-700">50</div>
              <div className="text-xs text-yellow-600">Steady Dialer</div>
              <div className="text-xs text-yellow-500">+50 XP</div>
            </div>

            {/* 100 Dials - LOCKED */}
            <div className="text-center p-3 bg-gray-100 border-2 border-gray-300 rounded-lg opacity-50">
              <div className="text-2xl mb-1">🔒</div>
              <div className="font-bold text-gray-500">100</div>
              <div className="text-xs text-gray-400">Century Club</div>
              <div className="text-xs text-gray-400">+100 XP</div>
            </div>

            {/* 200 Dials - LOCKED */}
            <div className="text-center p-3 bg-gray-100 border-2 border-gray-300 rounded-lg opacity-50">
              <div className="text-2xl mb-1">🔒</div>
              <div className="font-bold text-gray-500">200</div>
              <div className="text-xs text-gray-400">Power Dialer</div>
              <div className="text-xs text-gray-400">+200 XP</div>
            </div>

            {/* 300 Dials - LOCKED */}
            <div className="text-center p-3 bg-gray-100 border-2 border-gray-300 rounded-lg opacity-50">
              <div className="text-2xl mb-1">🔒</div>
              <div className="font-bold text-gray-500">300</div>
              <div className="text-xs text-gray-400">Dial Machine</div>
              <div className="text-xs text-gray-400">+300 XP</div>
            </div>

            {/* 500 Dials - LOCKED */}
            <div className="text-center p-3 bg-gray-100 border-2 border-gray-300 rounded-lg opacity-50">
              <div className="text-2xl mb-1">🔒</div>
              <div className="font-bold text-gray-500">500</div>
              <div className="text-xs text-gray-400">Elite Dialer</div>
              <div className="text-xs text-gray-400">+500 XP</div>
            </div>

            {/* 1000 Dials - LOCKED */}
            <div className="text-center p-3 bg-gray-100 border-2 border-gray-300 rounded-lg opacity-50">
              <div className="text-2xl mb-1">🔒</div>
              <div className="font-bold text-gray-500">1000</div>
              <div className="text-xs text-gray-400">Dial Legend</div>
              <div className="text-xs text-gray-400">+1000 XP</div>
            </div>
          </div>
        </div>

        {/* Achievement Overlay Examples */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Achievement Overlay Examples</h3>
          
          {/* Full Screen Overlay Simulation */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden h-64 mb-4">
            {/* Background blur effect */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            
            {/* Achievement popup in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 text-white p-8 rounded-2xl shadow-2xl transform animate-achievement-bounce border-4 border-yellow-300 animate-celebration-pulse">
                <div className="text-center">
                  <div className="text-6xl mb-4 animate-bounce">🏆</div>
                  <div className="text-3xl font-bold mb-2 drop-shadow-lg">ACHIEVEMENT UNLOCKED!</div>
                  <div className="text-xl mb-2 font-semibold">Steady Dialer Badge</div>
                  <div className="text-lg opacity-90 mb-3">50 Daily Dials Completed</div>
                  <div className="text-2xl font-bold bg-white/20 rounded-lg px-4 py-2 animate-pulse">+50 XP</div>
                </div>
              </div>
            </div>
            
            {/* Simulated confetti particles */}
            <div className="absolute top-4 left-8 text-yellow-400 text-2xl animate-ping">✨</div>
            <div className="absolute top-8 right-12 text-orange-400 text-xl animate-bounce">🎊</div>
            <div className="absolute bottom-12 left-16 text-red-400 text-lg animate-pulse">🎉</div>
            <div className="absolute bottom-8 right-8 text-yellow-300 text-3xl animate-spin">⭐</div>
          </div>
          
          {/* Corner notification style */}
          <div className="relative">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Alternative: Corner Notification Style</h4>
            <div className="bg-gray-100 rounded-lg p-4 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-lg shadow-lg animate-slide-in-right max-w-xs">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <div className="font-bold text-sm">Century Club!</div>
                    <div className="text-xs opacity-90">100 dials today</div>
                    <div className="text-xs font-semibold">+100 XP</div>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-sm">Overlay appears in corner during calls...</p>
            </div>
          </div>
          
          {/* Interactive Demo Buttons */}
          <div className="mt-6 text-center space-y-4">
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => setShowTinderDemo(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg"
              >
                🎮 Try Tinder-Style Demo
              </Button>
              <Button 
                onClick={() => {
                  // Original simple overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center';
                  overlay.innerHTML = `
                    <div class="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white p-12 rounded-3xl shadow-2xl transform animate-achievement-bounce border-4 border-purple-300 animate-celebration-pulse max-w-md mx-4">
                      <div class="text-center">
                        <div class="text-8xl mb-6 animate-bounce">🚀</div>
                        <div class="text-4xl font-bold mb-4 drop-shadow-lg">MILESTONE REACHED!</div>
                        <div class="text-2xl mb-3 font-semibold">Power Dialer Badge</div>
                        <div class="text-xl opacity-90 mb-4">200 Daily Dials Completed!</div>
                        <div class="text-3xl font-bold bg-white/20 rounded-xl px-6 py-3 animate-pulse">+200 XP</div>
                        <div class="mt-4 text-lg opacity-80">You're on fire! 🔥</div>
                      </div>
                    </div>
                  `;
                  document.body.appendChild(overlay);
                  setTimeout(() => overlay.remove(), 4000);
                  overlay.addEventListener('click', () => overlay.remove());
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-lg"
              >
                🔥 Simple Overlay Demo
              </Button>
            </div>
            <p className="text-sm text-gray-500">Choose your preferred achievement style</p>
          </div>
        </div>

        {/* Daily Stats Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Today's Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">47</div>
              <div className="text-sm text-blue-500">Total Dials</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">18</div>
              <div className="text-sm text-green-500">Connected</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">75</div>
              <div className="text-sm text-purple-500">Total XP</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">1</div>
              <div className="text-sm text-yellow-500">Badges Earned</div>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Implementation Notes:</h4>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• The dial counter would be prominently displayed in the Call Connector Pro header</li>
            <li>• Progress bar updates in real-time with each dial attempt</li>
            <li>• Achievement popups appear immediately when milestones are reached</li>
            <li>• All progress persists across sessions and resets daily at midnight</li>
            <li>• Personal best tracking encourages beating previous records</li>
            <li>• Minimal UI changes - overlays on existing interface</li>
          </ul>
          
          {/* Navigation Button */}
          <div className="mt-6 text-center">
            <Button onClick={goToApp} className="bg-blue-600 text-white hover:bg-blue-700">
              Return to ConnectNow Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Tinder-Style Achievement Overlay with Transparent Background */}
      <AnimatePresence>
        {showTinderDemo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              duration: 0.8,
              type: "spring",
              stiffness: 100,
              damping: 20,
              opacity: { duration: 0.6 }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(147, 51, 234, 0.8))',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => setShowTinderDemo(false)}
          >
            {/* Money/Trophy Animation Particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, y: 100 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 2, 0],
                    y: [100, -200],
                    x: [(Math.random() - 0.5) * 400]
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.15,
                    repeat: Infinity,
                    repeatType: "loop"
                  }}
                  className="absolute text-yellow-300 text-4xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `100%`
                  }}
                >
                  {i % 3 === 0 ? '🏆' : i % 3 === 1 ? '💎' : '⭐'}
                </motion.div>
              ))}
            </div>

            {/* Main Celebration Content */}
            <div className="text-center relative z-10 max-w-4xl px-8">
              {/* Achievement Title */}
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: 0.3, 
                  duration: 0.8,
                  type: "spring",
                  stiffness: 120,
                  damping: 15
                }}
                className="mb-8"
              >
                <h1 className="text-white text-7xl font-bold tracking-wider drop-shadow-lg mb-4" style={{
                  fontFamily: "'Dancing Script', cursive, system-ui",
                  textShadow: '0 4px 8px rgba(0,0,0,0.3)'
                }}>
                  Achievement Unlocked!
                </h1>
                <p className="text-yellow-200 text-lg font-medium tracking-wide">
                  You've reached a major milestone!
                </p>
              </motion.div>

              {/* Achievement Cards Side by Side */}
              <div className="flex justify-center items-center gap-12 mb-8">
                {/* producer Achievement Card */}
                <motion.div
                  initial={{ x: -200, opacity: 0, rotate: -15 }}
                  animate={{ x: 0, opacity: 1, rotate: 0 }}
                  transition={{ 
                    delay: 1.0,
                    duration: 1.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  className="relative"
                >
                  <div className="w-48 h-64 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* Achievement Icon */}
                    <div className="w-full h-40 bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center relative">
                      <div className="text-8xl animate-bounce">🎯</div>
                    </div>
                    {/* Achievement Info */}
                    <div className="p-4 text-center">
                      <h3 className="font-bold text-gray-800 text-lg mb-1">
                        Century Club
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">100 Daily Dials</p>
                      <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        +100 XP
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Producer Profile Card */}
                <motion.div
                  initial={{ x: 200, opacity: 0, rotate: 15 }}
                  animate={{ x: 0, opacity: 1, rotate: 0 }}
                  transition={{ 
                    delay: 1.0,
                    duration: 1.2,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  className="relative"
                >
                  <div className="w-48 h-64 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* producer Photo */}
                    <div className="w-full h-40 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center relative">
                      <div className="w-24 h-24 bg-white/30 rounded-full flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">
                          A
                        </span>
                      </div>
                    </div>
                    {/* Producer Info */}
                    <div className="p-4 text-center">
                      <h3 className="font-bold text-gray-800 text-lg mb-1">
                        Producer Name
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">AO Intelligence</p>
                      <div className="flex justify-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.2, duration: 0.6 }}
                className="text-center"
              >
                <Button
                  onClick={() => setShowTinderDemo(false)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-4 rounded-full text-xl"
                >
                  Keep Dialing! 📞
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}