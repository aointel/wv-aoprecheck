import React, { useState, useEffect } from 'react';
// Placeholder icon URL
const hotleadIcon = 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=56&h=56&fit=crop';

interface FireProgressBarProps {
  agentEmail: string;
}

// Simple in-memory call tracker - same as HotleadProgressCounter
const callTracker = {
  getTodayCalls: (email: string) => {
    const key = `calls_${email}_${new Date().toDateString()}`;
    return parseInt(localStorage.getItem(key) || '0');
  },
  addCall: (email: string) => {
    const key = `calls_${email}_${new Date().toDateString()}`;
    const current = callTracker.getTodayCalls(email);
    localStorage.setItem(key, (current + 1).toString());
    return current + 1;
  }
};

export function FireProgressBar({ agentEmail }: FireProgressBarProps) {
  const [plusLeadCalls, setPlusLeadCalls] = useState(0);

  // Load calls from localStorage and listen for updates
  useEffect(() => {
    const updateCalls = () => {
      const calls = callTracker.getTodayCalls(agentEmail);
      setPlusLeadCalls(calls);
    };

    // Initial load
    updateCalls();
    
    // Listen for call completion events
    const handleCallCompleted = (event: any) => {
      const { agentEmail: callproducer, leadType } = event.detail || {};
      
      // Count ALL call completions regardless of lead type or duration
      if (callproducer === agentEmail) {
        console.log('🔥 FireProgressBar: Got plus lead completion event, incrementing counter!');
        const newCount = callTracker.addCall(agentEmail);
        console.log(`🎯 FireProgressBar: Counter now at ${newCount}`);
        updateCalls();
      }
    };
    
    // Add event listener
    window.addEventListener('callCompleted', handleCallCompleted);
    
    // Also listen for storage changes (in case manual buttons are used)
    const handleStorageChange = () => updateCalls();
    window.addEventListener('storage', handleStorageChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('callCompleted', handleCallCompleted);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [agentEmail]);

  // Calculate progress (every 5 calls = 1 hotlead)
  const callsUntilNextHotlead = 5 - (plusLeadCalls % 5);
  const currentSection = (plusLeadCalls % 5) + 1; // 1-5

  // Generate the 4 sections + fire symbol
  const sections = Array.from({ length: 4 }, (_, index) => {
    const sectionNumber = index + 1;
    const isActive = sectionNumber <= currentSection;
    const isCurrentSection = sectionNumber === currentSection;
    
    // Progressive fire gradient colors - more edgy
    let bgColor = 'bg-gray-300 dark:bg-gray-600'; // Default cool
    let glowEffect = '';
    
    if (isActive) {
      switch (sectionNumber) {
        case 1:
          bgColor = 'bg-gradient-to-r from-slate-400 to-blue-500';
          break;
        case 2:
          bgColor = 'bg-gradient-to-r from-blue-500 to-orange-500';
          break;
        case 3:
          bgColor = 'bg-gradient-to-r from-orange-500 to-red-500';
          break;
        case 4:
          bgColor = 'bg-gradient-to-r from-red-500 to-red-700';
          glowEffect = 'shadow-md shadow-red-500/40';
          break;
      }
    }

    // Add very slow, subtle pulse animation to current section
    const pulseAnimation = isCurrentSection ? 'animate-[pulse_5s_ease-in-out_infinite]' : '';

    return (
      <div
        key={sectionNumber}
        className={`
          flex-1 h-3 rounded-sm transition-all duration-500 ease-in-out
          ${bgColor} ${glowEffect} ${pulseAnimation}
          mr-1
        `}
      />
    );
  });

  // Manual progress increment for testing
  const incrementProgress = () => {
    const newCount = callTracker.addCall(agentEmail);
    setPlusLeadCalls(newCount);
    console.log(`🔥 Manual increment: Counter now at ${newCount}`);
  };

  // Clickable fire icon for manual testing
  const handleFireClick = () => {
    incrementProgress();
  };

  const fireIcon = (
    <div 
      className={`flex items-center cursor-pointer hover:scale-110 transition-transform duration-200 h-3 px-6 rounded-r-sm ml-4 ${
        currentSection >= 5 ? 'bg-gradient-to-r from-red-500 to-red-700' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      onClick={handleFireClick}
    >
      <img 
        src={hotleadIcon}
        alt="Hotlead Progress"
        className={`w-14 h-14 transition-all duration-500 ${
          currentSection >= 5 
            ? 'drop-shadow-lg filter brightness-125 contrast-125' 
            : currentSection >= 4
            ? 'drop-shadow-md filter brightness-110 contrast-110'
            : currentSection >= 3
            ? 'filter brightness-100 contrast-100'
            : currentSection >= 2
            ? 'filter brightness-90 contrast-90'
            : 'filter brightness-75 contrast-75 grayscale-50'
        }`}
      />
    </div>
  );

  if (!agentEmail) return null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 mb-4">
      <div className="flex items-center">
        <div className="flex flex-1">
          {sections}
        </div>
        {fireIcon}
      </div>
    </div>
  );
}