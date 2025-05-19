
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { GeneratedQuizData, McqQuestion, QuestionAttempt, StudentAnswers } from '@/types/quiz';
import { useToast } from '@/hooks/use-toast';
import { analyzeQuizPerformance, type AnalyzeQuizPerformanceInput, type AnalyzeQuizPerformanceOutput } from '@/ai/flows/analyze-quiz-performance';
import { analyzeCameraFeed, type AnalyzeCameraFeedInput, type AnalyzeCameraFeedOutput } from '@/ai/flows/analyze-camera-feed-flow';
import { QuestionDisplay } from './QuestionDisplay';
import { ResultsDisplay } from './ResultsDisplay';
import { TimerDisplay } from './TimerDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FullScreenWarningModal } from './FullScreenWarningModal';
import { AlertTriangle, Loader2, BookOpenCheck, Camera, Mic, ScreenShare, XCircle, Maximize, ShieldAlert, UserRoundX } from 'lucide-react';


const DEFAULT_QUIZ_DURATION_MINUTES = 15;
const FULLSCREEN_RETURN_TIMEOUT_SECONDS = 30; 
const CAMERA_ANALYSIS_INTERVAL_MS = 5000; // 5 seconds
const PROCTORING_GRACE_PERIOD_CHECKS = 3; // Number of checks before no-human/mic-inactive pause is enforced

export function QuizClient() {
  const [quizData, setQuizData] = useState<GeneratedQuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<StudentAnswers>([]);
  const [quizState, setQuizState] = useState<'loading' | 'permission_setup' | 'instructions' | 'in_progress' | 'submitting' | 'results'>('loading');
  const [score, setScore] = useState(0);
  const [analysis, setAnalysis] = useState<AnalyzeQuizPerformanceOutput | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [finalAttemptData, setFinalAttemptData] = useState<QuestionAttempt[]>([]);
  const [quizDurationSeconds, setQuizDurationSeconds] = useState(DEFAULT_QUIZ_DURATION_MINUTES * 60);

  // Proctoring states
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [hasScreenPermission, setHasScreenPermission] = useState<boolean | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExamPausedByProctoring, setIsExamPausedByProctoring] = useState(false);
  const [showFullScreenWarningModal, setShowFullScreenWarningModal] = useState(false);
  const [fullScreenReturnCountdown, setFullScreenReturnCountdown] = useState(FULLSCREEN_RETURN_TIMEOUT_SECONDS);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);
  const [humanPresenceIssue, setHumanPresenceIssue] = useState(false);
  const [gracePeriodChecksCompleted, setGracePeriodChecksCompleted] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const proctoringReturnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [isMicCurrentlyActive, setIsMicCurrentlyActive] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedQuiz = localStorage.getItem('currentQuiz');
    if (storedQuiz) {
      try {
        const parsedQuiz: GeneratedQuizData = JSON.parse(storedQuiz);
        if (parsedQuiz && parsedQuiz.questions && parsedQuiz.questions.length > 0) {
          setQuizData(parsedQuiz);
          setSelectedAnswers(new Array(parsedQuiz.questions.length).fill(null));
          setQuizState('permission_setup'); 
          setQuizDurationSeconds(parsedQuiz.durationMinutes > 0 ? parsedQuiz.durationMinutes * 60 : DEFAULT_QUIZ_DURATION_MINUTES * 60);
        } else {
          throw new Error("Invalid quiz data structure or no questions.");
        }
      } catch (error) {
        console.error("Failed to parse quiz data from localStorage:", error);
        toast({ title: 'Error Loading Quiz', description: 'Invalid quiz data. Please generate a new quiz.', variant: 'destructive' });
        router.push('/');
      }
    } else {
      toast({ title: 'No Quiz Found', description: 'Please generate a quiz first.', variant: 'destructive' });
      router.push('/');
    }
  }, [router, toast]);

  const setupMicrophoneAnalysis = useCallback(() => {
    if (cameraStreamRef.current && cameraStreamRef.current.getAudioTracks().length > 0 && !audioContextRef.current && hasMicPermission) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        microphoneSourceRef.current = audioContext.createMediaStreamSource(cameraStreamRef.current);
        microphoneSourceRef.current.connect(analyserRef.current);
        console.log("Microphone analysis setup complete.");
        setIsMicCurrentlyActive(true); // Assume active on setup, will be verified by check
      } catch (e) {
        console.error("Error setting up microphone analysis: ", e);
        toast({title: "Mic Analysis Error", description: "Could not set up microphone activity detection.", variant: "destructive"});
        setIsMicCurrentlyActive(false); 
      }
    }
  }, [hasMicPermission, toast]);

  const checkMicrophoneActivity = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current || !hasMicPermission) {
      setIsMicCurrentlyActive(false);
      return false;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(console.error);
    }
    if (audioContextRef.current.state !== 'running') {
        setIsMicCurrentlyActive(false);
        return false;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;
    const active = average > 0.5; // Extremely low threshold, just checks if not totally silent
    setIsMicCurrentlyActive(active);
    return active;
  }, [hasMicPermission]);

  const requestCameraMicPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) videoRef.current.play().catch(console.error);
        };
      }
      setHasCameraPermission(true);
      setHasMicPermission(true);
      setupMicrophoneAnalysis(); // Setup mic analysis after getting stream
      return true;
    } catch (error) {
      console.error('Error accessing camera/mic:', error);
      setHasCameraPermission(false);
      setHasMicPermission(false);
      toast({ variant: 'destructive', title: 'Camera/Mic Access Denied', description: 'Please enable camera and microphone permissions in your browser settings.' });
      return false;
    }
  };

  const requestScreenSharePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      screenStreamRef.current = stream;
      setHasScreenPermission(true);
      return true;
    } catch (error) {
      console.error('Error accessing screen share:', error);
      setHasScreenPermission(false);
      // Screen share is optional, so warning is less severe
      toast({ variant: 'warning', title: 'Screen Share Access Denied', description: 'Screen sharing is optional and was not enabled.' });
      return false; // Still return false to indicate it wasn't successful
    }
  };

  const enterFullScreen = useCallback(() => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        toast({ title: "Fullscreen Error", description: `Could not enter fullscreen: ${err.message}. Please try again.`, variant: "destructive"});
      });
    }
     setTimeout(() => setIsFullScreen(!!document.fullscreenElement), 100);
  }, [toast]);

  const startExamFlow = useCallback(() => {
    if (hasCameraPermission && hasMicPermission) { 
      setQuizState('instructions');
    } else {
       setQuizState('permission_setup'); 
       let missingItems = [];
       if (!hasCameraPermission) missingItems.push("Camera");
       if (!hasMicPermission) missingItems.push("Microphone");
       toast({title: "Setup Incomplete", description: `Please grant required permissions. Missing: ${missingItems.join(', ')}.`, variant: "destructive"});
    }
  }, [hasCameraPermission, hasMicPermission, toast]);

  const beginExam = () => {
    enterFullScreen();
    setQuizState('in_progress');
    setGracePeriodChecksCompleted(0); // Reset grace period counter
    setHumanPresenceIssue(false); // Reset human presence issue
  };


  useEffect(() => {
    if (quizState !== 'in_progress' && quizState !== 'submitting' && quizState !== 'results') return;

    const handleFullScreenChange = () => {
      const isCurrentlyFullScreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullScreen);
      if (!isCurrentlyFullScreen && quizState === 'in_progress') {
        setShowFullScreenWarningModal(true);
        setIsExamPausedByProctoring(true);
        setHumanPresenceIssue(false); // Clear human presence issue when fullscreen warning takes precedence
        if (proctoringReturnTimerRef.current) clearTimeout(proctoringReturnTimerRef.current);
        setFullScreenReturnCountdown(FULLSCREEN_RETURN_TIMEOUT_SECONDS); 
        proctoringReturnTimerRef.current = setInterval(() => {
            setFullScreenReturnCountdown(prev => {
                if (prev <= 1) {
                    if(proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
                    // toast({title: "Fullscreen Timeout", description: "Please return to fullscreen or end the exam.", variant: "destructive"});
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
      } else if (isCurrentlyFullScreen) {
        setShowFullScreenWarningModal(false);
        // Only unpause if not also paused for human presence
        if (!humanPresenceIssue) {
          setIsExamPausedByProctoring(false); 
        }
        if (proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
        proctoringReturnTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && quizState === 'in_progress' && isFullScreen) {
        toast({ title: 'Tab Switch Detected', description: 'Switching tabs is not allowed. The exam is paused.', variant: 'destructive' });
        setIsExamPausedByProctoring(true);
        setHumanPresenceIssue(false); // Clear human presence issue when tab switch takes precedence
      }
    };

    const preventAction = (e: Event, actionName: string) => {
      if (quizState === 'in_progress') {
        e.preventDefault();
        toast({ title: 'Action Restricted', description: `${actionName} is not allowed during the exam.`, variant: 'warning' });
      }
    };

    const handleCopy = (e: ClipboardEvent) => preventAction(e, 'Copying text');
    const handlePaste = (e: ClipboardEvent) => preventAction(e, 'Pasting text');
    const handleCut = (e: ClipboardEvent) => preventAction(e, 'Cutting text');
    const handleContextMenu = (e: MouseEvent) => preventAction(e, 'Right-clicking');

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (quizState === 'in_progress') {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your progress might be lost and the exam will be submitted.';
        return e.returnValue;
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
    };
  }, [quizState, toast, isFullScreen, humanPresenceIssue]);


  const captureAndAnalyzeFrame = useCallback(async () => {
    if (!cameraStreamRef.current || !hasCameraPermission || isAnalyzingFrame || showFullScreenWarningModal) {
      return;
    }

    const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
    if (!videoTrack || !videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_METADATA || videoRef.current.videoWidth === 0) {
      console.warn('Camera track not ready or video element not ready for capture.');
      return;
    }
    
    setIsAnalyzingFrame(true);
    let aiAnalysisResult: AnalyzeCameraFeedOutput | null = null;
    let currentMicActive = false;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.7);

        if (dataUri.length < 50) {
            console.warn("Captured data URI is too short, skipping AI analysis.");
        } else {
            const analysisInput: AnalyzeCameraFeedInput = { imageDataUri: dataUri };
            aiAnalysisResult = await analyzeCameraFeed(analysisInput);
        }
      }
      currentMicActive = checkMicrophoneActivity();

      if (gracePeriodChecksCompleted < PROCTORING_GRACE_PERIOD_CHECKS) {
        setGracePeriodChecksCompleted(prev => prev + 1);
      }

      if (aiAnalysisResult) {
        // Human presence / Mic check (only after grace period)
        if (gracePeriodChecksCompleted >= PROCTORING_GRACE_PERIOD_CHECKS) {
            if (!aiAnalysisResult.isHumanDetected || !currentMicActive) {
                setHumanPresenceIssue(true);
                setIsExamPausedByProctoring(true);
                 // This specific toast is now handled by the persistent Alert
            } else if (humanPresenceIssue) { // If issue was active but now resolved
                setHumanPresenceIssue(false);
                if (!showFullScreenWarningModal) { // Only unpause if not also in fullscreen warning
                  setIsExamPausedByProctoring(false);
                }
            }
        }

        // Other anomaly checks (book, phone, looking away) - always active if human is detected
        if (aiAnalysisResult.isHumanDetected && (aiAnalysisResult.isBookDetected || aiAnalysisResult.isPhoneDetected || aiAnalysisResult.isLookingAway)) {
          toast({
            title: 'Proctoring Alert',
            description: aiAnalysisResult.anomalyReason || 'Potential policy violation detected.',
            variant: 'destructive',
            duration: 7000,
          });
        } else if (!aiAnalysisResult.isHumanDetected && aiAnalysisResult.anomalyReason && gracePeriodChecksCompleted >= PROCTORING_GRACE_PERIOD_CHECKS) {
          // This condition is now handled by the humanPresenceIssue state and persistent alert.
          // We might still want a toast if the reason is more specific than just "no human".
          // For now, the persistent alert is the main feedback for no human.
        }
      }

    } catch (error: any) {
      console.error('Error capturing or analyzing frame:', error);
      toast({
        title: 'Proctoring System Error',
        description: `Could not analyze camera/mic feed: ${error.message || 'Unknown error'}.`,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingFrame(false);
    }
  }, [hasCameraPermission, toast, isAnalyzingFrame, checkMicrophoneActivity, gracePeriodChecksCompleted, humanPresenceIssue, showFullScreenWarningModal]);


  useEffect(() => {
    if (quizState === 'in_progress' && !isExamPausedByProctoring && hasCameraPermission && hasMicPermission && !showFullScreenWarningModal && !humanPresenceIssue) {
      if (cameraAnalysisIntervalRef.current) clearInterval(cameraAnalysisIntervalRef.current);
      cameraAnalysisIntervalRef.current = setInterval(() => {
        captureAndAnalyzeFrame();
      }, CAMERA_ANALYSIS_INTERVAL_MS);
    } else {
      if (cameraAnalysisIntervalRef.current) {
        clearInterval(cameraAnalysisIntervalRef.current);
        cameraAnalysisIntervalRef.current = null;
      }
    }
    return () => {
      if (cameraAnalysisIntervalRef.current) {
        clearInterval(cameraAnalysisIntervalRef.current);
      }
    };
  // Ensure all dependencies that could restart the interval are listed
  }, [quizState, isExamPausedByProctoring, hasCameraPermission, hasMicPermission, captureAndAnalyzeFrame, showFullScreenWarningModal, humanPresenceIssue]);
  
  // Effect to setup mic analysis when mic permission is granted
  useEffect(() => {
    if (hasMicPermission && (quizState === 'in_progress' || quizState === 'permission_setup')) {
      setupMicrophoneAnalysis();
    }
     return () => {
      microphoneSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioContextRef.current?.close().catch(console.error);
      audioContextRef.current = null;
      analyserRef.current = null;
      microphoneSourceRef.current = null;
    };
  }, [hasMicPermission, quizState, setupMicrophoneAnalysis]);


  const handleOptionSelect = (optionIndex: number) => {
    if (isExamPausedByProctoring || humanPresenceIssue) return;
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = optionIndex;
      return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    if (isExamPausedByProctoring || humanPresenceIssue) return;
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const submitQuiz = useCallback(async (reason?: string) => {
    if (!quizData) return;
    if (quizState === 'submitting' || quizState === 'results') return;

    setQuizState('submitting');
    toast({ title: 'Submitting Quiz...', description: reason || 'Calculating your score and analyzing performance.' });

    if (cameraAnalysisIntervalRef.current) {
      clearInterval(cameraAnalysisIntervalRef.current);
      cameraAnalysisIntervalRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    microphoneSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioContextRef.current?.close().catch(console.error);
    audioContextRef.current = null;


    let correctAnswers = 0;
    const attemptedQuestions: QuestionAttempt[] = quizData.questions.map((q, index) => {
      if (selectedAnswers[index] === q.correctAnswerIndex) {
        correctAnswers++;
      }
      return {
        ...q,
        studentAnswerIndex: selectedAnswers[index],
      };
    });
    
    setFinalAttemptData(attemptedQuestions);
    const calculatedScore = quizData.questions.length > 0 ? (correctAnswers / quizData.questions.length) * 100 : 0;
    setScore(calculatedScore);

    setIsLoadingAnalysis(true);
    try {
      const analysisInput: AnalyzeQuizPerformanceInput = {
        topic: quizData.topic,
        questions: attemptedQuestions,
      };
      const aiAnalysis = await analyzeQuizPerformance(analysisInput);
      setAnalysis(aiAnalysis);
    } catch (error) {
      console.error("Error fetching AI analysis:", error);
      toast({
        title: 'AI Analysis Failed',
        description: 'Could not get performance analysis from AI.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAnalysis(false);
      setQuizState('results');
      toast({ title: 'Quiz Submitted!', description: `Your score is ${calculatedScore.toFixed(0)}%.` });
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn("Could not exit fullscreen:", err));
      }
    }
  }, [quizData, selectedAnswers, toast, quizState]);

  const handleReturnToFullScreen = () => {
    enterFullScreen();
    setTimeout(() => {
        if (document.fullscreenElement) {
            setShowFullScreenWarningModal(false);
            // Only unpause if not also paused for human presence
            if (!humanPresenceIssue) {
              setIsExamPausedByProctoring(false);
            }
            if (proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
            proctoringReturnTimerRef.current = null;
        } else {
            toast({title: "Failed to Re-enter Fullscreen", description: "Please try enabling fullscreen manually.", variant: "warning"});
        }
    }, 200); 
  };

  const handleEndExamFromModal = () => {
    setShowFullScreenWarningModal(false);
    submitQuiz("Exam ended due to not returning to fullscreen.");
  };

  if (quizState === 'loading' || !quizData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Quiz...</p>
      </div>
    );
  }

  const videoElement = (
    <video 
        ref={videoRef} 
        className={`bg-muted rounded-md transition-all duration-300 ease-in-out ${!hasCameraPermission ? 'hidden' : 'block'}`} 
        autoPlay 
        muted 
        playsInline 
    />
  );

  if (quizState === 'permission_setup') {
    return (
      <>
        <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Exam Security Setup</CardTitle>
            <CardDescription className="text-center">
              This exam requires camera and microphone access for AI proctoring. Screen sharing is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button onClick={requestCameraMicPermissions} className="w-full" variant={hasCameraPermission === null ? "outline" : (hasCameraPermission && hasMicPermission) ? "default" : "destructive"} disabled={hasCameraPermission === true && hasMicPermission === true}>
                <Camera className="mr-2" /> {hasCameraPermission === null ? "Request Camera & Mic Access" : (hasCameraPermission && hasMicPermission) ? "Camera & Mic Granted" : "Camera/Mic Denied or Incomplete - Retry"}
              </Button>
               {(hasCameraPermission === false || hasMicPermission === false) && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Camera/Mic Required</AlertTitle><AlertDescription>Camera and Microphone access is mandatory for proctoring.</AlertDescription></Alert>}
            </div>
            
            <div className="space-y-3">
              <Button onClick={requestScreenSharePermission} className="w-full" variant={hasScreenPermission === null ? "outline" : hasScreenPermission ? "default" : "destructive"} disabled={hasScreenPermission === true}>
                <ScreenShare className="mr-2" /> {hasScreenPermission === null ? "Request Screen Share (Optional)" : hasScreenPermission ? "Screen Share Granted" : "Screen Share Denied - Retry"}
              </Button>
              {hasScreenPermission === false && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Screen Share Note</AlertTitle><AlertDescription>Screen sharing was denied or failed. It is optional for this exam.</AlertDescription></Alert>}
            </div>
            
            <div className={`w-full aspect-video rounded-md overflow-hidden ${hasCameraPermission ? 'block' : 'hidden'}`}>
              {videoElement}
            </div>
            { !hasCameraPermission && quizState === 'permission_setup' && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Preview Unavailable</AlertTitle>
                    <AlertDescription>Grant camera access to see the preview.</AlertDescription>
                </Alert>
            )}

            <Button onClick={startExamFlow} className="w-full" size="lg" disabled={hasCameraPermission !== true || hasMicPermission !== true}>
              Continue to Instructions
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (quizState === 'instructions') {
    return (
        <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Exam Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>Please read the following instructions carefully before starting:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>The exam must be taken in fullscreen mode.</li>
                    <li>Your camera and microphone must remain active. AI-assisted monitoring will be used.</li>
                    <li>Ensure you are clearly visible in the camera and your microphone is not muted.</li>
                    <li>Do not switch tabs or minimize the browser window.</li>
                    <li>Copying, pasting, and right-clicking are disabled.</li>
                    <li>Attempting to leave fullscreen, switch tabs, or if human presence/mic issues are detected, the exam will pause.</li>
                    <li>The timer will continue to run during any pauses.</li>
                    <li>Potential anomalies (e.g., presence of books, phones, looking away) may be flagged.</li>
                </ul>
                <p className="font-semibold">Press "Start Exam" to enter fullscreen and begin.</p>
                <Button onClick={beginExam} className="w-full" size="lg">
                    <Maximize className="mr-2" /> Start Exam
                </Button>
                 {hasCameraPermission && (
                    <div className="mt-4 p-2 border rounded-md">
                        <p className="text-sm font-medium text-center mb-1">Camera Preview:</p>
                        <div className="w-full max-w-xs mx-auto aspect-video rounded overflow-hidden">
                           {videoElement}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
  }
  
  if (quizData.questions.length === 0 && quizState !== 'loading') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Questions Available</h2>
        <p className="text-muted-foreground mb-6">The AI couldn't generate questions for your request. Please try generating a new one with different settings.</p>
        <Button onClick={() => router.push('/')} size="lg">
          Generate New Quiz
        </Button>
      </div>
    );
  }

  if (quizState === 'results') {
    return <ResultsDisplay 
             score={score} 
             questionsAttempted={finalAttemptData} 
             analysis={analysis}
             isLoadingAnalysis={isLoadingAnalysis}
             topic={quizData.topic} 
           />;
  }

  const currentQuestion: McqQuestion = quizData.questions[currentQuestionIndex];

  return (
    <div className="space-y-6 md:space-y-8 relative pb-24"> {/* Added padding-bottom for fixed elements */}
       {quizState === 'in_progress' && (
         <>
          <div className="fixed top-2 left-2 z-[60] p-2 bg-card/80 backdrop-blur-sm rounded-md shadow-lg flex items-center space-x-2 text-xs">
              {hasCameraPermission ? <Camera className="h-4 w-4 text-green-500" /> : <Camera className="h-4 w-4 text-red-500" />}
              {hasMicPermission ? (isMicCurrentlyActive ? <Mic className="h-4 w-4 text-green-500" /> : <Mic className="h-4 w-4 text-yellow-500" title="Microphone inactive or low volume" />) : <Mic className="h-4 w-4 text-red-500" />}
              {hasScreenPermission ? <ScreenShare className="h-4 w-4 text-green-500" /> : <ScreenShare className="h-4 w-4 text-yellow-500" title="Screen share not active" />}
              <ShieldAlert className="h-4 w-4 text-blue-500" title="AI Monitoring Active" />
              {isAnalyzingFrame && <Loader2 className="h-4 w-4 animate-spin text-primary" title="AI Analyzing..." />}
          </div>
          {hasCameraPermission && (
            <div className="fixed bottom-4 right-4 w-40 h-30 md:w-48 md:h-36 z-[60] border-2 border-primary rounded-lg overflow-hidden shadow-xl bg-black">
                {videoElement}
            </div>
          )}
         </>
       )}

      <FullScreenWarningModal
        isOpen={showFullScreenWarningModal}
        onReturnToFullScreen={handleReturnToFullScreen}
        onEndExam={handleEndExamFromModal}
        countdown={fullScreenReturnCountdown}
      />
      
      {humanPresenceIssue && quizState === 'in_progress' && !showFullScreenWarningModal && (
        <Alert variant="destructive" className="my-4 fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] w-auto max-w-md p-6 shadow-2xl rounded-lg">
          <div className="flex flex-col items-center text-center">
            <UserRoundX className="h-12 w-12 text-destructive mb-3" />
            <AlertTitle className="text-xl md:text-2xl mb-2">Proctoring Alert: Exam Paused</AlertTitle>
            <AlertDescription className="text-base md:text-lg">
              Human presence not clearly detected or microphone appears inactive.
              Please ensure you are clearly visible in the camera and your microphone is picking up sound.
              The exam will resume automatically if the issue is resolved. The timer is still running.
            </AlertDescription>
          </div>
        </Alert>
      )}


      <Card className="bg-secondary/30">
        <CardHeader className="pb-2 md:pb-4 flex flex-row justify-between items-center">
          <CardTitle className="text-2xl md:text-3xl text-primary flex items-center">
             <BookOpenCheck className="mr-3 h-7 w-7 md:h-8 md:w-8" />
             Quiz: {quizData.topic}
          </CardTitle>
           {(quizState === 'in_progress' || quizState === 'submitting') && (
             <Button onClick={() => submitQuiz("Exam ended by user.")} variant="destructive" size="sm" disabled={quizState === 'submitting'}>
                <XCircle className="mr-2 h-4 w-4" /> End Exam
             </Button>
           )}
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <TimerDisplay
                initialDurationSeconds={quizDurationSeconds}
                onTimeUp={() => submitQuiz("Time is up!")}
                isPaused={isExamPausedByProctoring || humanPresenceIssue || quizState === 'submitting' || quizState === 'results' || showFullScreenWarningModal}
              />
        </CardContent>
      </Card>

      {isExamPausedByProctoring && quizState === 'in_progress' && !showFullScreenWarningModal && !humanPresenceIssue && (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Exam Paused</AlertTitle>
          <AlertDescription>
            Your exam is paused due to a potential policy violation (e.g., tab switch). Please ensure you are in fullscreen mode and focused on the exam tab.
          </AlertDescription>
        </Alert>
      )}
      
      {(quizState === 'in_progress' || quizState === 'submitting') && currentQuestion && (
        <QuestionDisplay
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={quizData.questions.length}
          question={currentQuestion}
          selectedOption={selectedAnswers[currentQuestionIndex]}
          onOptionSelect={handleOptionSelect}
          onNext={handleNextQuestion}
          onSubmit={() => submitQuiz()}
          isLastQuestion={currentQuestionIndex === quizData.questions.length - 1}
          isSubmitting={quizState === 'submitting'}
          isDisabled={isExamPausedByProctoring || humanPresenceIssue || showFullScreenWarningModal}
        />
      )}
      {quizState === 'submitting' && !isExamPausedByProctoring && !humanPresenceIssue && (
         <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Submitting your answers...</p>
          </div>
      )}
    </div>
  );
}
