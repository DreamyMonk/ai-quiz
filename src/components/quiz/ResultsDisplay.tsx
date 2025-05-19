
"use client";

import type { QuestionAttempt, RevisitMaterialInput, RevisitMaterialOutput, GeneratedQuizData, McqQuestion } from '@/types/quiz';
import { generateRevisitMaterial } from '@/ai/flows/generate-revisit-material-flow';
import type { AnalyzeQuizPerformanceOutput } from '@/ai/flows/analyze-quiz-performance';
import { saveQuiz } from '@/services/quizService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb, BarChart3, Repeat, Info, Download, FileText, Loader2, RefreshCw, Eye, ChevronLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { GeneratingPdfModal } from './GeneratingPdfModal';
import { shuffleArray } from '@/lib/utils';


interface ResultsDisplayProps {
  score: number;
  questionsAttempted: QuestionAttempt[];
  analysis: AnalyzeQuizPerformanceOutput | null;
  isLoadingAnalysis: boolean;
  topic: string;
  quizDataForRetake: GeneratedQuizData | null; 
}

export function ResultsDisplay({
  score,
  questionsAttempted,
  analysis,
  isLoadingAnalysis,
  topic,
  quizDataForRetake,
}: ResultsDisplayProps) {
  const [isGeneratingRevisitPdf, setIsGeneratingRevisitPdf] = useState(false);
  const [revisitPdfUrl, setRevisitPdfUrl] = useState<string | null>(null);
  const [isReattempting, setIsReattempting] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const { toast } = useToast();
  const router = useRouter();

  const getOptionClass = (qIndex: number, optionIndex: number) => {
    const attempt = questionsAttempted[qIndex];
    if (optionIndex === attempt.correctAnswerIndex) {
      return 'text-green-600 font-semibold';
    }
    if (optionIndex === attempt.studentAnswerIndex && optionIndex !== attempt.correctAnswerIndex) {
      return 'text-red-600 line-through';
    }
    return '';
  };
  
  const scoreColor = score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500';

  const handleGenerateRevisitPdf = async () => {
    setIsGeneratingRevisitPdf(true);
    setRevisitPdfUrl(null);

    const incorrectOrSkippedQuestions = questionsAttempted.filter(
      (q) => q.studentAnswerIndex !== q.correctAnswerIndex
    );

    if (incorrectOrSkippedQuestions.length === 0) {
      toast({
        title: "All Correct!",
        description: "No incorrect answers to include in the Revisit PDF. Great job!",
      });
      setIsGeneratingRevisitPdf(false);
      return;
    }

    try {
      const revisitInput: RevisitMaterialInput = {
        topic: topic,
        incorrectQuestions: incorrectOrSkippedQuestions.map(q => ({
          question: q.question,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          studentAnswerIndex: q.studentAnswerIndex,
        }))
      };
      
      const revisitData: RevisitMaterialOutput = await generateRevisitMaterial(revisitInput);

      const doc = new jsPDF();
      let yPos = 20; 
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      const lineSpacing = 7;
      const paragraphSpacing = 10;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(revisitData.title, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
      yPos += paragraphSpacing * 1.5;

      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      const introLines = doc.splitTextToSize(revisitData.introduction, doc.internal.pageSize.width - margin * 2);
      doc.text(introLines, margin, yPos);
      yPos += introLines.length * lineSpacing + paragraphSpacing;

      doc.setFont(undefined, 'bold');
      doc.text("Detailed Review:", margin, yPos);
      yPos += lineSpacing * 1.5;

      for (const section of revisitData.sections) {
        if (yPos > pageHeight - margin * 3) { 
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const questionLines = doc.splitTextToSize(`Question: ${section.question}`, doc.internal.pageSize.width - margin * 2);
        doc.text(questionLines, margin, yPos);
        yPos += questionLines.length * lineSpacing;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);

        const correctAnswerText = `Correct Answer: ${section.correctAnswer}`;
        const studentAnswerText = `Your Answer: ${section.studentAnswer || "Skipped"}`;
        
        const caLines = doc.splitTextToSize(correctAnswerText, doc.internal.pageSize.width - margin * 2);
        doc.text(caLines, margin, yPos);
        yPos += caLines.length * (lineSpacing - 2);

        if (section.studentAnswer !== section.correctAnswer) {
             const saLines = doc.splitTextToSize(studentAnswerText, doc.internal.pageSize.width - margin * 2);
             doc.text(saLines, margin, yPos);
             yPos += saLines.length * (lineSpacing - 2);
        }
        yPos += (lineSpacing -2);


        doc.setFontSize(11);
        doc.setFont(undefined, 'italic');
        doc.text("Explanation:", margin, yPos);
        yPos += lineSpacing;

        doc.setFont(undefined, 'normal');
        const explanationLines = doc.splitTextToSize(section.detailedExplanation, doc.internal.pageSize.width - margin * 2 - 5); // -5 for slight indent
        doc.text(explanationLines, margin + 5, yPos);
        yPos += explanationLines.length * (lineSpacing - 1) + paragraphSpacing;

        if (section !== revisitData.sections[revisitData.sections.length - 1]) {
           if (yPos > pageHeight - margin * 2) { doc.addPage(); yPos = margin; }
           doc.setDrawColor(200, 200, 200); 
           doc.line(margin, yPos - (paragraphSpacing / 2), doc.internal.pageSize.width - margin, yPos - (paragraphSpacing / 2));
        }
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setRevisitPdfUrl(url);

      toast({
        title: "Revisit PDF Generated!",
        description: "Your personalized study guide is ready for download.",
      });

    } catch (error) {
      console.error("Error generating Revisit PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: (error as Error).message || "Could not generate the Revisit PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRevisitPdf(false);
    }
  };

  const handleReattemptQuiz = async () => {
    if (!quizDataForRetake) {
      toast({
        title: "Error",
        description: "Original quiz data not found for re-attempt.",
        variant: "destructive",
      });
      return;
    }
    setIsReattempting(true);

    try {
      // Ensure quizDataForRetake.questions exists and is an array
      if (!quizDataForRetake.questions || !Array.isArray(quizDataForRetake.questions)) {
        throw new Error("Invalid questions data in quizDataForRetake.");
      }

      const originalQuestions: McqQuestion[] = JSON.parse(JSON.stringify(quizDataForRetake.questions));
      const shuffledQuestionOrder = shuffleArray(originalQuestions);

      const reattemptQuestions = shuffledQuestionOrder.map(q => {
        if (!q.options || !Array.isArray(q.options) || typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) {
          console.warn("Skipping malformed question during re-attempt shuffle:", q);
          return q; // Or handle more gracefully, e.g., by filtering out malformed questions
        }
        const correctAnswerText = q.options[q.correctAnswerIndex];
        const shuffledOptions = shuffleArray([...q.options]);
        const newCorrectAnswerIndex = shuffledOptions.indexOf(correctAnswerText);
        return {
          ...q,
          options: shuffledOptions,
          correctAnswerIndex: newCorrectAnswerIndex,
        };
      });

      const newQuizDataForFirestore: Omit<GeneratedQuizData, 'id' | 'createdAt' | 'userId'> = {
        topic: quizDataForRetake.topic,
        questions: reattemptQuestions,
        durationMinutes: quizDataForRetake.durationMinutes,
        // userId will be set by saveQuiz if user is logged in
      };

      // Ensure user is passed to saveQuiz if available (though saveQuiz can handle null)
      // const currentUserId = quizDataForRetake.userId || null; 
      // saveQuiz will handle getting current user from AuthContext if needed, or you can pass it.
      // For simplicity, saveQuiz can be modified to take userId or get it from context. Assuming it does.
      
      const newRetakeQuizId = await saveQuiz(newQuizDataForFirestore, quizDataForRetake.userId || null);

      toast({
        title: "Quiz Ready for Re-attempt!",
        description: "Questions and options have been shuffled. Good luck!",
      });
      router.push(`/exam/${newRetakeQuizId}`);
    } catch (error) {
        console.error("Error saving re-attempt quiz:", error);
        toast({
            title: "Re-attempt Failed",
            description: (error as Error).message || "Could not prepare the quiz for re-attempt. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsReattempting(false);
    }
  };


  return (
    <div className="space-y-8">
      <Card className="w-full shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/50 p-6 text-center">
           <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
             <BarChart3 className="h-12 w-12 text-primary" />
           </div>
          <CardTitle className="text-4xl font-bold">Quiz Results</CardTitle>
          <CardDescription className="text-xl text-muted-foreground pt-1">Topic: {topic}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-2xl font-medium text-muted-foreground">Your Score</p>
            <p className={`text-7xl font-bold ${scoreColor}`}>{score.toFixed(0)}%</p>
            <Progress value={score} className="w-full max-w-md mx-auto h-4 mt-2" />
          </div>

          {isLoadingAnalysis && !analysis && (
            <div className="text-center py-6">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">AI is analyzing your performance...</p>
            </div>
          )}

          {analysis && (
            <Card className="bg-secondary/30">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center"><Lightbulb className="mr-2 h-6 w-6 text-primary" /> AI Performance Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-base">
                <div>
                  <h4 className="font-semibold text-primary">Strengths:</h4>
                  <p className="whitespace-pre-wrap">{analysis.strengths}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-destructive">Areas for Improvement:</h4>
                  <p className="whitespace-pre-wrap">{analysis.weaknesses}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-accent-foreground">Suggestions:</h4>
                  <p className="whitespace-pre-wrap">{analysis.suggestions}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="mt-8 pt-6 border-t">
             <h3 className="text-2xl font-semibold mb-4 text-center">Study & Review</h3>
             <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                {!revisitPdfUrl ? (
                  <Button 
                    onClick={handleGenerateRevisitPdf} 
                    disabled={isGeneratingRevisitPdf || questionsAttempted.filter(q => q.studentAnswerIndex !== q.correctAnswerIndex).length === 0}
                    size="lg"
                  >
                    {isGeneratingRevisitPdf ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-5 w-5" />
                    )}
                    Generate Revisit PDF
                  </Button>
                ) : (
                  <a href={revisitPdfUrl} download={`${topic.replace(/\s+/g, '_')}_Revisit_Guide.pdf`}>
                    <Button size="lg" variant="default">
                      <Download className="mr-2 h-5 w-5" />
                      Download Revisit PDF
                    </Button>
                  </a>
                )}
                {questionsAttempted.filter(q => q.studentAnswerIndex !== q.correctAnswerIndex).length === 0 && !isGeneratingRevisitPdf && (
                  <p className="text-sm text-green-600">All questions answered correctly! No revisit PDF needed.</p>
                )}
             </div>
          </div>


          {viewMode === 'summary' && (
            <div className="text-center mt-8">
              <Button onClick={() => setViewMode('detailed')} size="lg" variant="outline">
                <Eye className="mr-2 h-5 w-5" />
                View Detailed Question Review
              </Button>
            </div>
          )}

          {viewMode === 'detailed' && (
            <div>
              <div className="flex justify-between items-center mb-4 mt-8">
                <h3 className="text-2xl font-semibold">Detailed Question Review</h3>
                <Button onClick={() => setViewMode('summary')} variant="outline">
                  <ChevronLeft className="mr-2 h-5 w-5" />
                  Back to Summary
                </Button>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {questionsAttempted.map((attempt, index) => (
                  <AccordionItem value={`item-${index}`} key={index}>
                    <AccordionTrigger className="text-lg hover:no-underline">
                      <div className="flex items-center text-left">
                        {attempt.studentAnswerIndex === attempt.correctAnswerIndex ? (
                          <CheckCircle2 className="h-6 w-6 mr-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-6 w-6 mr-3 text-red-500 flex-shrink-0" />
                        )}
                        <span className="flex-1">Question {index + 1}: {attempt.question.length > 50 ? attempt.question.substring(0,50) + "..." : attempt.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 py-2 space-y-3 bg-slate-50 dark:bg-slate-800 rounded-b-md">
                      <p className="text-base font-medium mb-2">{attempt.question}</p>
                      <ul className="space-y-1 list-inside">
                        {attempt.options.map((option, optIndex) => (
                          <li key={optIndex} className={`flex items-start ${getOptionClass(index, optIndex)}`}>
                            {optIndex === attempt.correctAnswerIndex && <CheckCircle2 className="h-5 w-5 mr-2 mt-0.5 text-green-500 flex-shrink-0" />}
                            {optIndex === attempt.studentAnswerIndex && optIndex !== attempt.correctAnswerIndex && <XCircle className="h-5 w-5 mr-2 mt-0.5 text-red-500 flex-shrink-0" />}
                            {! (optIndex === attempt.correctAnswerIndex || (optIndex === attempt.studentAnswerIndex && optIndex !== attempt.correctAnswerIndex)) && <div className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"></div> }
                            <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                          </li>
                        ))}
                      </ul>
                      {attempt.studentAnswerIndex !== attempt.correctAnswerIndex && attempt.studentAnswerIndex !== null && (
                        <p className="text-sm text-muted-foreground">Your answer: <span className="font-semibold">{attempt.options[attempt.studentAnswerIndex!]}</span></p>
                      )}
                      {attempt.studentAnswerIndex === null && (
                        <p className="text-sm text-yellow-600 font-semibold">You did not answer this question.</p>
                      )}
                      <p className="text-sm text-green-700">Correct answer: <span className="font-semibold">{attempt.options[attempt.correctAnswerIndex]}</span></p>
                      
                      {analysis && analysis.questionExplanations && analysis.questionExplanations[index] && (
                        <Card className="mt-4 bg-primary/5 dark:bg-primary/10">
                          <CardHeader className="pb-2 pt-4">
                            <CardTitle className="text-md flex items-center text-primary">
                              <Info className="mr-2 h-5 w-5" />
                              AI Explanation
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm text-foreground/90">
                            <p className="whitespace-pre-wrap">{analysis.questionExplanations[index]}</p>
                          </CardContent>
                        </Card>
                      )}
                      {isLoadingAnalysis && !(analysis && analysis.questionExplanations && analysis.questionExplanations[index]) && (
                        <div className="text-left py-3">
                          <Loader2 className="inline-block h-5 w-5 animate-spin text-primary mr-1" />
                          <span className="text-sm text-muted-foreground">Loading explanation...</span>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-6 flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/">
            <Button size="lg" variant="outline" disabled={isReattempting}>
              <Repeat className="mr-2 h-5 w-5" />
              Create Another Quiz
            </Button>
          </Link>
          <Button size="lg" onClick={handleReattemptQuiz} disabled={!quizDataForRetake || isReattempting}>
            {isReattempting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" /> }
            {isReattempting ? "Preparing..." : "Re-attempt This Quiz"}
          </Button>
        </CardFooter>
      </Card>
      <GeneratingPdfModal isOpen={isGeneratingRevisitPdf} />
    </div>
  );
}
