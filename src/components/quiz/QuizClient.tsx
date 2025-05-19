
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import type { GeneratedQuizData, McqQuestion, QuestionAttempt, StudentAnswers } from '@/types/quiz';
import { useToast } from '@/hooks/use-toast';
import { analyzeQuizPerformance, type AnalyzeQuizPerformanceInput, type AnalyzeQuizPerformanceOutput } from '@/ai/flows/analyze-quiz-performance';
import { QuestionDisplay } from './QuestionDisplay';
import { ResultsDisplay } from './ResultsDisplay';
import { TimerDisplay } from './TimerDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, BookOpenCheck, XCircle, PlayCircle, ListRestart, Info } from 'lucide-react';
import { CodeOfConductModal } from './CodeOfConductModal';
import { PledgeModal } from './PledgeModal';


const DEFAULT_QUIZ_DURATION_MINUTES = 15;

export function QuizClient() {
  const [quizData, setQuizData] = useState<GeneratedQuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<StudentAnswers>([]);
  const [quizState, setQuizState] = useState<'loading' | 'instructions' | 'in_progress' | 'submitting' | 'results'>('loading');
  const [score, setScore] = useState(0);
  const [analysis, setAnalysis] = useState<AnalyzeQuizPerformanceOutput | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [finalAttemptData, setFinalAttemptData] = useState<QuestionAttempt[]>([]);
  const [quizDurationSeconds, setQuizDurationSeconds] = useState(DEFAULT_QUIZ_DURATION_MINUTES * 60);
  const [showCodeOfConductModal, setShowCodeOfConductModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);

  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const { toast } = useToast();

  useEffect(() => {
    console.log("QuizClient: Main useEffect triggered. Pathname:", pathname, "Current quizState:", quizState, "Current quizData ID:", quizData?.id);
    const storedQuiz = localStorage.getItem('currentQuiz');
    if (storedQuiz) {
      try {
        const parsedQuiz: GeneratedQuizData = JSON.parse(storedQuiz);
        console.log("QuizClient: Parsed quiz from localStorage. ID:", parsedQuiz.id);
        if (parsedQuiz && parsedQuiz.questions && parsedQuiz.questions.length > 0 && parsedQuiz.id) {
          // Check if it's a new quiz or the same one, or if quizData is not yet set
          if (!quizData || quizData.id !== parsedQuiz.id) {
            console.log(`QuizClient: Loading new quiz ID: ${parsedQuiz.id}. Previous quizData ID: ${quizData?.id}. Resetting states.`);
            setQuizData(parsedQuiz);
            setSelectedAnswers(new Array(parsedQuiz.questions.length).fill(null));
            setCurrentQuestionIndex(0);
            setQuizState('instructions'); // Crucial reset to instructions
            setQuizDurationSeconds(parsedQuiz.durationMinutes > 0 ? parsedQuiz.durationMinutes * 60 : DEFAULT_QUIZ_DURATION_MINUTES * 60);
            // Reset result-related states for a new quiz
            setScore(0);
            setAnalysis(null);
            setFinalAttemptData([]);
          } else {
            // Same quiz ID, implies a page refresh or returning to the tab.
            // If quizState was 'results', it should remain 'results'.
            // If quizState was 'loading' or 'instructions', and it's the same quiz, it's okay for it to stay 'instructions' or progress.
            // If it was 'in_progress', this useEffect might re-trigger on refresh, but we don't want to reset to 'instructions' if progress exists.
            // This 'else' branch might need more sophisticated handling if we want to resume mid-quiz after a refresh.
            // For now, the critical part is that a NEW quiz ID correctly resets to 'instructions'.
            console.log("QuizClient: Same quiz ID found or quizData already set. ID:", parsedQuiz.id, "Current quizState:", quizState);
            if (quizState === 'loading') { // If initial load and quizData matches (e.g. refresh on exam page)
                // Allow progression to instructions or potentially in_progress if we had resume logic
                 setQuizState('instructions'); // Default to instructions if it was loading
            }
            // If quizState is already 'instructions', 'in_progress', or 'results' for the *same* quiz ID, let it be.
          }
        } else {
          console.error("QuizClient: Invalid quiz data structure from localStorage.");
          toast({ title: 'Error Loading Quiz', description: 'Invalid quiz data. Please generate a new quiz.', variant: 'destructive' });
          router.push('/');
        }
      } catch (error) {
        console.error("QuizClient: Failed to parse quiz data from localStorage:", error);
        toast({ title: 'Error Loading Quiz', description: 'Invalid quiz data. Please generate a new quiz.', variant: 'destructive' });
        router.push('/');
      }
    } else {
      console.log("QuizClient: No quiz found in localStorage.");
      toast({ title: 'No Quiz Found', description: 'Please generate a quiz first.', variant: 'destructive' });
      router.push('/');
    }
  }, [router, toast, pathname, quizData?.id]); // Added pathname and quizData.id to dependency array. quizData.id helps re-evaluate if external source changes it.


  useEffect(() => {
    const preventAction = (e: Event) => {
      if (quizState === 'in_progress') {
        e.preventDefault();
        toast({
          title: 'Action Disabled',
          description: 'This action is disabled during the exam.',
          variant: 'destructive',
          duration: 3000,
        });
      }
    };

    if (quizState === 'in_progress') {
      document.addEventListener('copy', preventAction);
      document.addEventListener('cut', preventAction);
      document.addEventListener('paste', preventAction);
      document.addEventListener('contextmenu', preventAction);
    }

    return () => {
      document.removeEventListener('copy', preventAction);
      document.removeEventListener('cut', preventAction);
      document.removeEventListener('paste', preventAction);
      document.removeEventListener('contextmenu', preventAction);
    };
  }, [quizState, toast]);


  const openPledgeModal = () => {
    setShowPledgeModal(true);
  };

  const confirmPledgeAndStartExam = () => {
    setShowPledgeModal(false);
    setQuizState('in_progress');
    console.log("QuizClient: Pledge confirmed, quizState set to 'in_progress'");
  };

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = optionIndex;
      return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSkipQuestion = () => {
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = null;
      return newAnswers;
    });

    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (quizData && currentQuestionIndex === quizData.questions.length - 1) {
      toast({
        title: "Last Question Skipped",
        description: "You can now submit your quiz.",
        duration: 3000,
      });
    }
  };

  const submitQuiz = useCallback(async (reason?: string) => {
    if (!quizData) return;
    if (quizState === 'submitting' || quizState === 'results') return;

    setQuizState('submitting');
    console.log("QuizClient: Submitting quiz. Reason:", reason);
    toast({ title: 'Submitting Quiz...', description: reason || 'Calculating your score and analyzing performance.' });

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
      console.log("QuizClient: Quiz submission complete, quizState set to 'results'. Score:", calculatedScore);
      toast({ title: 'Quiz Submitted!', description: `Your score is ${calculatedScore.toFixed(0)}%.` });
    }
  }, [quizData, selectedAnswers, toast, quizState]);


  if (quizState === 'loading' || !quizData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Quiz...</p>
      </div>
    );
  }

  if (quizState === 'instructions') {
    return (
        <>
        <Card className="w-full max-w-lg mx-auto my-8 shadow-xl">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Quiz Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-lg">You are about to start the quiz on: <span className="font-semibold">{quizData.topic}</span></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Number of questions: {quizData.questions.length}</li>
                    <li>Time limit: {quizData.durationMinutes} minutes.</li>
                    <li>Once started, the timer will begin.</li>
                    <li>Answer each question to the best of your ability.</li>
                    <li>You can use the navigator to jump between questions.</li>
                    <li>A "Skip" button is available for each question.</li>
                    <li>Actions like copy, paste, and right-click are disabled during the exam.</li>
                </ul>
                 <Button 
                    variant="link" 
                    onClick={() => setShowCodeOfConductModal(true)} 
                    className="p-0 h-auto text-primary hover:text-accent"
                  >
                    <Info className="mr-1 h-4 w-4" /> View Code of Conduct
                </Button>
                <Button onClick={openPledgeModal} className="w-full mt-4" size="lg">
                    <PlayCircle className="mr-2" /> Start Quiz
                </Button>
            </CardContent>
        </Card>
        <CodeOfConductModal isOpen={showCodeOfConductModal} onOpenChange={setShowCodeOfConductModal} />
        <PledgeModal isOpen={showPledgeModal} onConfirm={confirmPledgeAndStartExam} />
      </>
    );
  }

  if (quizData.questions.length === 0 && quizState !== 'loading') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" /> {/* Changed icon */}
        <h2 className="text-2xl font-semibold mb-2">No Questions Available</h2>
        <p className="text-muted-foreground mb-6">The AI couldn't generate questions for your request, or no questions were provided. Please try generating a new quiz.</p>
        <Button onClick={() => router.push('/')} size="lg">
          Generate New Quiz
        </Button>
      </div>
    );
  }

  if (quizState === 'results') {
    console.log("QuizClient: Rendering ResultsDisplay. Score:", score);
    return <ResultsDisplay
             score={score}
             questionsAttempted={finalAttemptData}
             analysis={analysis}
             isLoadingAnalysis={isLoadingAnalysis}
             topic={quizData.topic}
             quizDataForRetake={quizData}
           />;
  }

  const currentQuestion: McqQuestion = quizData.questions[currentQuestionIndex];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 md:gap-8 relative pb-24">
      <div className="space-y-6 md:space-y-8">
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
                isPaused={quizState === 'submitting' || quizState === 'results'}
              />
          </CardContent>
        </Card>

        {(quizState === 'in_progress' || quizState === 'submitting') && currentQuestion && (
          <QuestionDisplay
            key={`q-${currentQuestionIndex}-${quizData.id}`}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={quizData.questions.length}
            question={currentQuestion}
            selectedOption={selectedAnswers[currentQuestionIndex]}
            onOptionSelect={handleOptionSelect}
            onNext={handleNextQuestion}
            onSkip={handleSkipQuestion}
            onSubmit={() => submitQuiz()}
            isLastQuestion={currentQuestionIndex === quizData.questions.length - 1}
            isSubmitting={quizState === 'submitting'}
          />
        )}
        {quizState === 'submitting' && !currentQuestion && ( // Show loader if submitting and no current question (e.g. time up)
          <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-xl text-muted-foreground">Submitting your answers...</p>
            </div>
        )}
      </div>

      {(quizState === 'in_progress' && quizData.questions.length > 0) && (
        <aside className="lg:sticky lg:top-20 h-fit order-first lg:order-last">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <ListRestart className="mr-2 h-5 w-5" /> Question Navigator
              </CardTitle>
              <CardDescription>Jump to any question.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[calc(100vh-22rem)] lg:max-h-[60vh] pr-3">
                <div className="flex flex-col gap-2">
                  {quizData.questions.map((_, index) => (
                    <Button
                      key={`nav-${index}-${quizData.id}`}
                      variant={currentQuestionIndex === index ? 'default' : 'outline'}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className="w-full justify-start text-sm h-9"
                      disabled={quizState === 'submitting'}
                    >
                      Question {index + 1}
                       {selectedAnswers[index] !== null && <span className="ml-auto text-xs opacity-70">(Answered)</span>}
                       {selectedAnswers[index] === null && currentQuestionIndex !== index && <span className="ml-auto text-xs opacity-50">(Unanswered)</span>}
                       {currentQuestionIndex === index && <span className="ml-auto text-xs font-semibold">(Current)</span>}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      )}
    </div>
  );
}
