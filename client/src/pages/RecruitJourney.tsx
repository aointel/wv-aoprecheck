import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, ChevronRight, Play, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Video path - served from Supabase Storage
const recruitmentVideo = 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/ao_globe_life_company_overview_-_dani_jankowski%20(1080p)%20(1)_1759594958661.mp4';

const STEPS = [
  { id: 'videos', label: 'Videos' },
  { id: 'complete', label: 'Complete' }
];

const VIDEO_CHAPTERS = [
  { name: 'Our Company', start: 0, end: 503, duration: 503 },           // 0:00 - 8:23 (60%)
  { name: 'Compensation', start: 503, end: 680, duration: 177 },     // 8:23 - 11:20 (21%)
  { name: "Next Step", start: 680, end: 840, duration: 160 }       // 11:20 - 14:00 (19%)
];

const VIDEO_DURATION = 840; // ~14 minutes in seconds

export default function RecruitJourney() {
  const [currentStep, setCurrentStep] = useState(1);
  const [watchTime, setWatchTime] = useState(0);
  const [furthestWatched, setFurthestWatched] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showDeclineMessage, setShowDeclineMessage] = useState(false);
  const [showIntroMessage, setShowIntroMessage] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireSlide, setQuestionnaireSlide] = useState(0);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // Schedule callback removed - only instant connect now
  const [heroPhase, setHeroPhase] = useState<'greeting' | 'welcome'>('greeting');
  const [questionnaireData, setQuestionnaireData] = useState({
    stoodOut: '',
    goodFit: '',
    licensingInvestment: ''
  });
  
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hero phase transition: "Hey John!" -> "Welcome to AO GlobeLife"
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroPhase('welcome');
    }, 2500); // Show greeting for 2.5 seconds, then transition to welcome
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-advance from thank you message to connection options
  useEffect(() => {
    if (showThankYouMessage) {
      const timer = setTimeout(() => {
        setShowThankYouMessage(false);
        setCurrentStep(2);
      }, 2000); // Show thank you for 2 seconds, then show connection options
      
      return () => clearTimeout(timer);
    }
  }, [showThankYouMessage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const candidateParam = params.get('candidate'); // New: candidate ID from SMS link
    const name = params.get('name');
    const phone = params.get('phone');
    const producer = params.get('producer');
    const id = params.get('id');
    
    console.log('🔍 URL Params:', { token, candidate: candidateParam, name, phone, producer, id });
    
    // Always set from URL params first (fallback/default values)
    if (name) setCandidateName(decodeURIComponent(name));
    if (phone) setCandidatePhone(decodeURIComponent(phone));
    if (producer) {
      const decodedproducer = decodeURIComponent(producer);
      console.log('✅ Producer Email set:', decodedproducer);
      setAgentEmail(decodedproducer);
    } else {
      console.log('⚠️ No producer parameter in URL');
    }
    if (id) setCandidateId(id);
    if (candidateParam) setCandidateId(candidateParam); // Set from candidate param too
    
    // If token is provided (old SMS flow), fetch from session
    if (token) {
      console.log('🔑 Token provided, fetching journey session...');
      fetch(`/api/recruit/journey-session?token=${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.candidate) {
            console.log('✅ Journey session loaded:', data.candidate);
            setCandidateName(`${data.candidate.firstName} ${data.candidate.lastName}`);
            setCandidatePhone(data.candidate.phone);
            setAgentEmail(data.candidate.agentEmail);
            setCandidateId(data.candidate.id.toString());
          }
        })
        .catch(err => console.error('❌ Error fetching journey session:', err));
    }
    
    // NEW: If candidate ID provided but no other params, fetch from candidate table
    if (candidateParam && !producer) {
      console.log('🔍 Fetching candidate data from ID:', candidateParam);
      fetch(`/api/recruit/candidates/${candidateParam}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.candidate) {
            console.log('✅ Candidate loaded:', data.candidate);
            setCandidateName(`${data.candidate.firstName} ${data.candidate.lastName}`);
            setCandidatePhone(data.candidate.phone);
            setAgentEmail(data.candidate.agentEmail);
            setCandidateId(data.candidate.id.toString());
          }
        })
        .catch(err => console.error('❌ Error fetching candidate:', err));
    }
  }, []);

  // Update journey progress in database
  const updateJourneyProgress = async (updates: any) => {
    if (!candidateId) return;
    
    try {
      const response = await fetch(`/api/recruit/journey-session/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        console.log('✅ Journey progress updated:', updates);
      } else {
        console.error('❌ Failed to update journey progress');
      }
    } catch (error) {
      console.error('❌ Error updating journey progress:', error);
    }
  };

  // Video time tracking and furthest watched logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = Math.floor(video.currentTime);
      setWatchTime(currentTime);
      
      // Determine current chapter
      let currentChapter = 0;
      let chapterProgress = 0;
      
      VIDEO_CHAPTERS.forEach((chapter, idx) => {
        if (currentTime >= chapter.start && currentTime < chapter.end) {
          currentChapter = idx;
          chapterProgress = ((currentTime - chapter.start) / chapter.duration) * 100;
        }
      });
      
      // Update furthest watched
      if (currentTime > furthestWatched) {
        setFurthestWatched(currentTime);
        
        // Update chapter progress in database
        updateJourneyProgress({ 
          current_video_chapter: currentChapter,
          video_progress_percent: Math.round(chapterProgress)
        });
        
        // Mark video section 1 as watched (Our Company chapter complete)
        if (currentTime >= VIDEO_CHAPTERS[0].end) {
          updateJourneyProgress({ video_section_1_watched: true });
        }
        
        // Mark video section 2 as watched (Compensation chapter complete)
        if (currentTime >= VIDEO_CHAPTERS[1].end) {
          updateJourneyProgress({ video_section_2_watched: true });
        }
      }

      // Check if video is complete (watched 95% or more)
      if (currentTime >= VIDEO_DURATION * 0.95 && !videoCompleted) {
        setVideoCompleted(true);
        updateJourneyProgress({ 
          video_section_1_watched: true,
          video_section_2_watched: true,
          current_video_chapter: 2,
          video_progress_percent: 100
        });
      }
    };

    const handleSeeking = () => {
      // Prevent seeking beyond furthest watched point
      if (video.currentTime > furthestWatched + 2) {
        video.currentTime = furthestWatched;
      }
    };

    // Block fullscreen attempts
    const blockFullscreen = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('fullscreenchange', blockFullscreen);
    video.addEventListener('webkitfullscreenchange', blockFullscreen);
    video.addEventListener('mozfullscreenchange', blockFullscreen);
    video.addEventListener('msfullscreenchange', blockFullscreen);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('fullscreenchange', blockFullscreen);
      video.removeEventListener('webkitfullscreenchange', blockFullscreen);
      video.removeEventListener('mozfullscreenchange', blockFullscreen);
      video.removeEventListener('msfullscreenchange', blockFullscreen);
    };
  }, [furthestWatched, videoCompleted]);

  // Show continue prompt when video is completed
  useEffect(() => {
    if (videoCompleted && currentStep === 1 && !showContinuePrompt && !showQuestionnaire) {
      setTimeout(() => setShowContinuePrompt(true), 500);
    }
  }, [videoCompleted, currentStep, showContinuePrompt, showQuestionnaire]);

  useEffect(() => {
    if (showIntroMessage) {
      const timer = setTimeout(() => {
        setShowIntroMessage(false);
        setShowQuestionnaire(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showIntroMessage]);

  useEffect(() => {
    if (showThankYouMessage) {
      const timer = setTimeout(() => {
        handleNextStep();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showThankYouMessage]);

  const handleNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleConnectWithproducer = async () => {
    if (!agentEmail || !candidateName) return;
    
    setIsConnecting(true);
    try {
      const response = await fetch('/api/recruit/request-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          candidateName,
          candidatePhone,
          agentEmail,
          questionnaireData
        })
      });

      const data = await response.json();
      
      if (data.success && data.connectionId) {
        // Redirect to custom waiting room page
        window.location.href = `/recruit/waiting?id=${data.connectionId}&name=${encodeURIComponent(candidateName)}`;
      }
    } catch (error) {
      console.error('Error connecting with producer:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Schedule callback removed - only instant connect now

  return (
    <div className="min-h-screen bg-white pb-20">
      
      {/* Hero Section with Wavy Bottom */}
      <div className="relative">
        {/* Gradient Background */}
        <div className="relative bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 h-[28vh] min-h-[220px]">
          
          {/* Simple Header */}
          <header className="relative z-10 px-4 sm:px-6 h-12 flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center space-x-3">
            </div>
          </header>

          {/* Hero Content */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 -mt-2 sm:-mt-4">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key={heroPhase}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6 }}
                  className="text-center"
                >
                  {heroPhase === 'greeting' ? (
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                      Hey {candidateName || 'there'}!
                    </h2>
                  ) : (
                    <div>
                      <h2 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                        Welcome to<br />AO GlobeLife
                      </h2>
                      <p className="text-lg sm:text-xl text-white/90 flex items-center justify-center gap-2">
                        (Click <Play className="w-5 h-5 fill-white inline" /> to get started)
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="text-center"
                >
                  <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Application Complete!</h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Wavy Bottom Edge */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 sm:h-32" preserveAspectRatio="none" viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,60 C360,100 720,20 1080,60 C1260,80 1440,40 1440,40 L1440,120 L0,120 Z" fill="white" />
            </svg>
          </div>
        </div>
      </div>

      {/* White Content Section */}
      <div ref={contentRef} className="bg-white -mt-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Videos Step */}
              {currentStep === 1 && !showQuestionnaire && (
                <div className="space-y-6">
                  <div className="p-1 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                      <video
                        ref={videoRef}
                        className="w-full h-full"
                        controls
                        controlsList="nodownload nofullscreen noremoteplayback"
                        disablePictureInPicture
                        playsInline
                        webkit-playsinline="true"
                        onContextMenu={(e) => e.preventDefault()}
                        data-testid="video-player"
                      >
                        <source src={recruitmentVideo} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>

                  <div className="space-y-6 px-2">
                    {/* Mobile-Optimized Proportional Progress Tracker - Hide when video is complete */}
                    {!videoCompleted && (
                      <div className="relative py-4">
                        {/* Chapter Tiles (proportional widths) */}
                        <div className="flex gap-1 mb-6">
                          {VIDEO_CHAPTERS.map((chapter, idx) => {
                            const widthPercent = (chapter.duration / VIDEO_DURATION) * 100;
                            const isCurrent = watchTime >= chapter.start && watchTime < chapter.end;
                            const chapterProgress = isCurrent 
                              ? ((watchTime - chapter.start) / chapter.duration) * 100 
                              : furthestWatched > chapter.end ? 100 : 0;
                            
                            return (
                              <div 
                                key={idx} 
                                className="relative bg-gray-200 rounded-lg overflow-hidden transition-all duration-300"
                                style={{ 
                                  width: `${widthPercent}%`,
                                  minHeight: '56px'
                                }}
                              >
                                {/* Progress Fill */}
                                <div 
                                  className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-all duration-500"
                                  style={{ 
                                    width: `${chapterProgress}%`,
                                    opacity: chapterProgress > 0 ? 1 : 0
                                  }}
                                />
                                
                                {/* Chapter Name */}
                                <div className="absolute inset-0 flex items-center justify-center px-0.5">
                                  <p className={`text-[9px] sm:text-xs font-medium text-center transition-colors leading-tight ${
                                    chapterProgress > 50 ? 'text-white' : 'text-gray-600'
                                  }`} style={{ wordBreak: 'break-word' }}>
                                    {chapter.name}
                                  </p>
                                </div>
                                
                                {/* Current Indicator Ring */}
                                {isCurrent && (
                                  <div className="absolute inset-0 ring-2 ring-purple-400 ring-offset-1 rounded-lg" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showContinuePrompt && !showIntroMessage && !showQuestionnaire && !showThankYouMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col gap-3"
                      >
                        <Button
                          onClick={() => {
                            setShowContinuePrompt(false);
                            setShowIntroMessage(true);
                          }}
                          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg rounded-xl shadow-lg"
                          data-testid="button-continue-application"
                        >
                          Move forward
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="w-full h-14 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-lg rounded-xl"
                          data-testid="button-decline-application"
                          onClick={() => { setShowContinuePrompt(false); setShowDeclineMessage(true); }}
                        >
                          Not interested
                        </Button>
                      </motion.div>
                    )}

                    {showDeclineMessage && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                        <p className="text-2xl font-semibold text-gray-900">No problem at all — best of luck to you!</p>
                      </motion.div>
                    )}

                    {showIntroMessage && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5 }}
                        className="text-center py-8"
                      >
                        <p className="text-2xl font-semibold text-gray-900">
                          Sounds good, let's get some quick questions out of the way...
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Questionnaire Slider */}
              {currentStep === 1 && showQuestionnaire && (
                <div className="space-y-6">
                  {/* Header */}
                  {questionnaireSlide === 0 && (
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        We'd like to know more!
                      </h2>
                    </div>
                  )}

                  {/* Progress Dots */}
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full transition-all ${
                          questionnaireSlide === index ? 'w-8 bg-indigo-600' : 'w-2 bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={questionnaireSlide}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="p-6 shadow-lg border-gray-200 min-h-[400px] flex flex-col">
                        <div className="flex-1">
                          {/* Question 1 */}
                          {questionnaireSlide === 0 && (
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-indigo-600 font-bold mb-2">QUESTION 1 OF 3</div>
                                <label className="block text-lg font-bold text-gray-900 mb-4">
                                  What stood out to you most about our opportunity?
                                </label>
                              </div>
                              <textarea
                                value={questionnaireData.stoodOut}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setQuestionnaireData({ ...questionnaireData, stoodOut: newValue });
                                  // Mark question 1 as answered and save the answer
                                  if (newValue.trim().length > 0) {
                                    updateJourneyProgress({ 
                                      question_1_answered: true,
                                      questionnaire_stood_out: newValue
                                    });
                                  }
                                }}
                                placeholder="Enter your answer here."
                                className="w-full h-48 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none resize-none text-base"
                                data-testid="input-stood-out"
                                autoFocus
                              />
                            </div>
                          )}

                          {/* Question 2 */}
                          {questionnaireSlide === 1 && (
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-indigo-600 font-bold mb-2">QUESTION 2 OF 3</div>
                                <label className="block text-lg font-bold text-gray-900 mb-4">
                                  Why do you feel you would be a good fit with our company?
                                </label>
                              </div>
                              <textarea
                                value={questionnaireData.goodFit}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setQuestionnaireData({ ...questionnaireData, goodFit: newValue });
                                  // Mark question 2 as answered and save the answer
                                  if (newValue.trim().length > 0) {
                                    updateJourneyProgress({ 
                                      question_2_answered: true,
                                      questionnaire_good_fit: newValue
                                    });
                                  }
                                }}
                                placeholder="Enter your answer here."
                                className="w-full h-48 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none resize-none text-base"
                                data-testid="input-good-fit"
                                autoFocus
                              />
                            </div>
                          )}

                          {/* Question 3 */}
                          {questionnaireSlide === 2 && (
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-indigo-600 font-bold mb-2">QUESTION 3 OF 3</div>
                                <label className="block text-lg font-bold text-gray-900 mb-4">
                                  Would you be prepared to make the financial investment in the licensing process?
                                </label>
                              </div>
                              <div className="space-y-3">
                                {['Yes', 'No', 'I am already licensed'].map((option) => (
                                  <button
                                    key={option}
                                    onClick={() => {
                                      setQuestionnaireData({ ...questionnaireData, licensingInvestment: option });
                                      // Mark question 3 as answered and save the answer
                                      updateJourneyProgress({ 
                                        question_3_answered: true,
                                        questionnaire_licensing_investment: option
                                      });
                                    }}
                                    className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                                      questionnaireData.licensingInvestment === option
                                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-medium'
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                    data-testid={`option-licensing-${option.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    <div className="flex items-center">
                                      <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                                        questionnaireData.licensingInvestment === option
                                          ? 'border-indigo-600 bg-indigo-600'
                                          : 'border-gray-300'
                                      }`}>
                                        {questionnaireData.licensingInvestment === option && (
                                          <div className="w-2 h-2 rounded-full bg-white"></div>
                                        )}
                                      </div>
                                      {option}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="mt-6 flex gap-3">
                          {questionnaireSlide > 0 && (
                            <Button
                              onClick={() => setQuestionnaireSlide(prev => prev - 1)}
                              variant="outline"
                              className="h-12 px-6 border-2 border-gray-300 hover:bg-gray-50 rounded-xl"
                              data-testid="button-previous-question"
                            >
                              <ArrowLeft className="w-5 h-5" />
                            </Button>
                          )}

                          <Button
                            onClick={() => {
                              if (questionnaireSlide === 2) {
                                setShowQuestionnaire(false);
                                setShowThankYouMessage(true);
                              } else {
                                setQuestionnaireSlide(prev => prev + 1);
                              }
                            }}
                            disabled={
                              (questionnaireSlide === 0 && !questionnaireData.stoodOut) ||
                              (questionnaireSlide === 1 && !questionnaireData.goodFit) ||
                              (questionnaireSlide === 2 && !questionnaireData.licensingInvestment)
                            }
                            className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl shadow-lg"
                            data-testid="button-next-question"
                          >
                            {questionnaireSlide === 2 ? (
                              <>Submit Application <ChevronRight className="w-5 h-5 ml-2" /></>
                            ) : (
                              <>Continue <ChevronRight className="w-5 h-5 ml-2" /></>
                            )}
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  </AnimatePresence>

                  <p className="text-center text-xs text-gray-500">
                    This questionnaire is required to move forward. Not interested?{' '}
                    <button 
                      onClick={() => setShowQuestionnaire(false)}
                      className="text-indigo-600 hover:underline"
                    >
                      Go back
                    </button>
                  </p>
                </div>
              )}

              {/* Thank You Message */}
              {currentStep === 1 && showThankYouMessage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="text-center py-12"
                >
                  <p className="text-2xl font-semibold text-gray-900 mb-4">
                    Thanks for that!
                  </p>
                  <p className="text-xl text-gray-700">
                    Now let's connect you with a manager to answer any questions you have.
                  </p>
                </motion.div>
              )}

              {/* Success Message */}
              {currentStep === 2 && (() => {
                console.log('🎯 Rendering Connect Now screen - currentStep:', currentStep, 'agentEmail:', agentEmail);
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="text-center space-y-8"
                  >
                    <div className="inline-block bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-6 shadow-2xl">
                      <CheckCircle2 className="w-20 h-20 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-3">All Set!</h2>
                      <p className="text-lg text-gray-600 mb-6">
                        Let's get you connected with a team member.
                      </p>
                      
                      <div className="space-y-6 mt-8">
                        
                        <div className="max-w-md mx-auto">
                          <Button
                            onClick={() => {
                              console.log('🔘 Connect Now clicked - agentEmail:', agentEmail);
                              handleConnectWithproducer();
                            }}
                            disabled={isConnecting || !agentEmail}
                            className="w-full h-20 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:bg-gray-400 text-white text-xl rounded-2xl shadow-2xl flex flex-col items-center justify-center transform hover:scale-105 transition-transform"
                            data-testid="button-get-connected"
                          >
                            {isConnecting ? (
                              <>
                                <span className="font-bold">Connecting...</span>
                                <span className="text-sm text-indigo-100">Please wait</span>
                              </>
                            ) : (
                              <>
                                <span className="font-bold">🎥 Connect Now</span>
                                <span className="text-sm text-indigo-100">Video call with your manager</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {!agentEmail && (
                          <p className="text-sm text-amber-600 text-center mt-4 p-4 bg-amber-50 rounded-lg max-w-md mx-auto">
                            ⚠️ Note: This page requires a unique producer link to connect. Please use the link provided by your manager.
                          </p>
                        )}
                        
                        {agentEmail && (
                          <p className="text-xs text-gray-500 text-center mt-4">
                            Your manager will be notified and will join you shortly
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Schedule Callback removed - only instant connect */}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

