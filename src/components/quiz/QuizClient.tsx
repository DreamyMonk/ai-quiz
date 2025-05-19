
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
// Script component is removed as Testwith is no longer used
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
import { AlertTriangle, Loader2, BookOpenCheck, Camera, Mic, ScreenShare, XCircle, Maximize, ShieldAlert } from 'lucide-react';


const DEFAULT_QUIZ_DURATION_MINUTES = 15;
const FULLSCREEN_RETURN_TIMEOUT_SECONDS = 30; 
const CAMERA_ANALYSIS_INTERVAL_MS = 5000; // 5 seconds

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
  const [hasScreenPermission, setHasScreenPermission] = useState<boolean | null>(null); // Retained for potential future use, but not primary focus
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExamPausedByProctoring, setIsExamPausedByProctoring] = useState(false);
  const [showFullScreenWarningModal, setShowFullScreenWarningModal] = useState(false);
  const [fullScreenReturnCountdown, setFullScreenReturnCountdown] = useState(FULLSCREEN_RETURN_TIMEOUT_SECONDS);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);


  const videoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const proctoringReturnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

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


  const requestCameraMicPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) videoRef.current.play();
        };
      }
      setHasCameraPermission(true);
      setHasMicPermission(true);
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
      toast({ variant: 'destructive', title: 'Screen Share Access Denied', description: 'Please enable screen sharing permission in your browser settings.' });
      return false;
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
    // Screen permission is optional for now, focus is on camera
    if (hasCameraPermission && hasMicPermission) { 
      setQuizState('instructions');
    } else {
       setQuizState('permission_setup'); 
       let missingItems = [];
       if (!hasCameraPermission) missingItems.push("Camera");
       if (!hasMicPermission) missingItems.push("Microphone");
       // if (!hasScreenPermission) missingItems.push("Screen Share"); // Screen share optional
       
       toast({title: "Setup Incomplete", description: `Please grant required permissions. Missing: ${missingItems.join(', ')}.`, variant: "destructive"});
    }
  }, [hasCameraPermission, hasMicPermission, toast]);


  const beginExam = () => {
    enterFullScreen();
    setQuizState('in_progress');
  };


  useEffect(() => {
    if (quizState !== 'in_progress' && quizState !== 'submitting' && quizState !== 'results') return;

    const handleFullScreenChange = () => {
      const isCurrentlyFullScreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullScreen);
      if (!isCurrentlyFullScreen && quizState === 'in_progress') {
        setShowFullScreenWarningModal(true);
        setIsExamPausedByProctoring(true);
        if (proctoringReturnTimerRef.current) clearTimeout(proctoringReturnTimerRef.current);
        setFullScreenReturnCountdown(FULLSCREEN_RETURN_TIMEOUT_SECONDS); 
        proctoringReturnTimerRef.current = setInterval(() => {
            setFullScreenReturnCountdown(prev => {
                if (prev <= 1) {
                    if(proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
                    toast({title: "Fullscreen Timeout", description: "Please return to fullscreen or end the exam.", variant: "destructive"});
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
      } else if (isCurrentlyFullScreen) {
        setShowFullScreenWarningModal(false);
        setIsExamPausedByProctoring(false); // Resume exam only if it was paused due to fullscreen exit
        if (proctoringReturnTimerRef.current) clearInterval(proctoringReturnTimerRef.current);
        proctoringReturnTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && quizState === 'in_progress' && isFullScreen) {
        toast({ title: 'Tab Switch Detected', description: 'Switching tabs is not allowed. The exam is paused.', variant: 'destructive' });
        setIsExamPausedByProctoring(true);
      } else if (document.visibilityState === 'visible' && quizState === 'in_progress' && isFullScreen) {
        // Optional: Auto-resume if they return to the tab and are still in fullscreen
        // setIsExamPausedByProctoring(false); 
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
  }, [quizState, toast, isFullScreen]);


  const captureAndAnalyzeFrame = useCallback(async () => {
    if (!cameraStreamRef.current || !hasCameraPermission || isAnalyzingFrame) {
      return;
    }

    const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
    if (!videoTrack || !videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_METADATA) {
      console.warn('Camera track not ready or video element not ready for capture.');
      return;
    }
    
    setIsAnalyzingFrame(true);
    try {
      // Use video element as source for canvas drawing for better compatibility
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG for smaller size

        if (dataUri.length < 50) { // Basic check for empty data URI
            console.warn("Captured data URI is too short, skipping analysis.");
            setIsAnalyzingFrame(false);
            return;
        }
        
        // console.log(`Analyzing camera frame (Data URI Preview): ${dataUri.substring(0,100)}...`);
        
        const analysisInput: AnalyzeCameraFeedInput = { imageDataUri: dataUri };
        const result: AnalyzeCameraFeedOutput = await analyzeCameraFeed(analysisInput);

        if (result.isBookDetected || result.isPhoneDetected || result.isLookingAway) {
          toast({
            title: 'Proctoring Alert',
            description: result.anomalyReason || 'Potential policy violation detected.',
            variant: 'destructive',
            duration: 7000,
          });
        }
      }
    } catch (error: any) {
      console.error('Error capturing or analyzing camera frame:', error);
      toast({
        title: 'Proctoring System Error',
        description: `Could not analyze camera feed: ${error.message || 'Unknown error'}.`,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingFrame(false);
    }
  }, [hasCameraPermission, toast, isAnalyzingFrame]);


  useEffect(() => {
    if (quizState === 'in_progress' && !isExamPausedByProctoring && hasCameraPermission) {
      if (cameraAnalysisIntervalRef.current) clearInterval(cameraAnalysisIntervalRef.current); // Clear existing interval
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
  }, [quizState, isExamPausedByProctoring, hasCameraPermission, captureAndAnalyzeFrame]);


  const handleOptionSelect = (optionIndex: number) => {
    if (isExamPausedByProctoring) return;
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = optionIndex;
      return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    if (isExamPausedByProctoring) return;
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
            setIsExamPausedByProctoring(false);
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

  if (quizState === 'permission_setup') {
    return (
      <>
        {/* Testwith Script component removed */}
        <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Exam Security Setup</CardTitle>
            <CardDescription className="text-center">
              This exam requires certain browser permissions. Screen sharing is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Button onClick={requestCameraMicPermissions} className="w-full" variant={hasCameraPermission === null ? "outline" : hasCameraPermission ? "default" : "destructive"} disabled={hasCameraPermission === true && hasMicPermission === true}>
                <Camera className="mr-2" /> {hasCameraPermission === null ? "Request Camera & Mic Access" : (hasCameraPermission && hasMicPermission) ? "Camera & Mic Granted" : "Camera & Mic Denied - Retry"}
              </Button>
               {(hasCameraPermission === false || hasMicPermission === false) && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Camera/Mic Required</AlertTitle><AlertDescription>Camera and Microphone access is mandatory for proctoring.</AlertDescription></Alert>}
            </div>
            
            <div className="space-y-3">
              <Button onClick={requestScreenSharePermission} className="w-full" variant={hasScreenPermission === null ? "outline" : hasScreenPermission ? "default" : "destructive"} disabled={hasScreenPermission === true}>
                <ScreenShare className="mr-2" /> {hasScreenPermission === null ? "Request Screen Share (Optional)" : hasScreenPermission ? "Screen Share Granted" : "Screen Share Denied - Retry"}
              </Button>
              {/* Alert for screen share denial is less critical if it's optional */}
              {hasScreenPermission === false && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Screen Share Note</AlertTitle><AlertDescription>Screen sharing was denied or failed. It is optional for this exam.</AlertDescription></Alert>}
            </div>
            
            {/* Video element should always be in the DOM to allow drawing to canvas, hide if no permission */}
            <video ref={videoRef} className={`w-full aspect-video rounded-md bg-muted ${hasCameraPermission ? 'block' : 'hidden'}`} autoPlay muted playsInline />
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
                    <li>Do not switch tabs or minimize the browser window.</li>
                    <li>Copying, pasting, and right-clicking are disabled.</li>
                    <li>Attempting to leave fullscreen or switch tabs will pause the exam.</li>
                    <li>The timer will continue to run during any pauses.</li>
                    <li>Potential anomalies (e.g., presence of books, phones, looking away) may be flagged.</li>
                </ul>
                <p className="font-semibold">Press "Start Exam" to enter fullscreen and begin.</p>
                <Button onClick={beginExam} className="w-full" size="lg">
                    <Maximize className="mr-2" /> Start Exam
                </Button>
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
    <div className="space-y-6 md:space-y-8 relative">
       {quizState === 'in_progress' && (
         <div className="fixed top-2 left-2 z-50 p-2 bg-card/80 backdrop-blur-sm rounded-md shadow-lg flex items-center space-x-2 text-xs">
            {hasCameraPermission ? <Camera className="h-4 w-4 text-green-500" /> : <Camera className="h-4 w-4 text-red-500" />}
            {hasMicPermission ? <Mic className="h-4 w-4 text-green-500" /> : <Mic className="h-4 w-4 text-red-500" />}
            {hasScreenPermission ? <ScreenShare className="h-4 w-4 text-green-500" /> : <ScreenShare className="h-4 w-4 text-yellow-500" /> /* Yellow if optional and denied */}
            <ShieldAlert className="h-4 w-4 text-blue-500" title="AI Monitoring Active" />
         </div>
       )}

      <FullScreenWarningModal
        isOpen={showFullScreenWarningModal}
        onReturnToFullScreen={handleReturnToFullScreen}
        onEndExam={handleEndExamFromModal}
        countdown={fullScreenReturnCountdown}
      />

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
                isPaused={isExamPausedByProctoring || quizState === 'submitting' || quizState === 'results'}
              />
        </CardContent>
      </Card>

      {isExamPausedByProctoring && quizState === 'in_progress' && !showFullScreenWarningModal && (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Exam Paused</AlertTitle>
          <AlertDescription>
            Your exam is paused due to a potential policy violation (e.g., tab switch or exiting fullscreen). Please ensure you are in fullscreen mode and focused on the exam tab.
          </AlertDescription>
        </Alert>
      )}
      
      {isAnalyzingFrame && quizState === 'in_progress' && !isExamPausedByProctoring && (
        <div className="fixed bottom-4 right-4 z-50 bg-card p-2 rounded-md shadow-lg flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
          <span>AI Analyzing...</span>
        </div>
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
          isDisabled={isExamPausedByProctoring}
        />
      )}
      {quizState === 'submitting' && !isExamPausedByProctoring && (
         <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Submitting your answers...</p>
          </div>
      )}
    </div>
  );
}
