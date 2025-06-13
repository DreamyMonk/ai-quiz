
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { generateMcqQuestions, type GenerateMcqQuestionsOutput } from '@/ai/flows/generate-mcq-questions';
import { generateOptionsForCustomQuestion, type GenerateOptionsForCustomQuestionOutput } from '@/ai/flows/generate-options-for-custom-question';
import { generateSingleMcqFromUserQuery, type GenerateSingleMcqFromUserQueryOutput } from '@/ai/flows/generate-single-mcq-from-user-query';
import type { McqQuestion, GeneratedQuizData } from '@/types/quiz';
import { Loader2, Sparkles, Wand2, ListChecks, Clock, PencilLine } from 'lucide-react';
import { shuffleArray } from '@/lib/utils';
import { saveQuiz } from '@/services/quizService';
import { useAuth } from '@/contexts/AuthContext'; 


const aiGeneratedQuizSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
  numberOfQuestions: z.coerce.number().int().min(3, "Must be at least 3 questions.").max(10, "Cannot exceed 10 questions for AI generation."),
  quizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(120, "Maximum 120 minutes."),
});

const customQuizSchema = z.object({
  customQuizTitle: z.string().min(3, "Quiz title must be at least 3 characters.").max(100, "Quiz title too long."),
  customPromptsBlock: z.string()
    .min(5, { message: "Please provide at least one question, topic, or prompt (min 5 characters for the entire block)." })
    .max(50000, { message: "The total text for custom questions is too long (max 50000 characters)." }) 
    .refine(value => value.trim().split('\n').filter(line => line.trim() !== '').length > 0, { message: "Please add at least one question or prompt."})
    .refine(value => {
      const lines = value.trim().split('\n').filter(line => line.trim() !== '');
      // Count questions/prompts: Each line that isn't part of a detected multi-line MCQ block
      // and each detected multi-line MCQ block counts as one item.
      let itemCount = 0;
      const questionStartRegex = /^\s*\d+[.)]\s+/;
      let currentBlockLines: string[] = [];

      for (const line of lines) {
          if (questionStartRegex.test(line)) { // Potentially a new MCQ block
              if (currentBlockLines.length > 0) { // Process previous block
                  const potentialMcq = parseFullMcqBlock(currentBlockLines);
                  if (potentialMcq) {
                      itemCount++;
                  } else { // Treat lines as individual prompts if not a valid block
                      itemCount += currentBlockLines.length;
                  }
                  currentBlockLines = [line];
              } else {
                  currentBlockLines.push(line);
              }
          } else if (line.trim() && currentBlockLines.length === 0) {
              // This is a standalone line not starting with a number, counts as one prompt
              itemCount++;
          } else if (line.trim()) {
             currentBlockLines.push(line);
          }
      }
      if (currentBlockLines.length > 0) { // Process the last block
          const potentialMcq = parseFullMcqBlock(currentBlockLines);
          if (potentialMcq) {
              itemCount++;
          } else {
              itemCount += currentBlockLines.length;
          }
      }
      return itemCount <= 100;
    }, { message: "You can add a maximum of 100 questions/prompts or fully formatted MCQs."}),
  customQuizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(180, "Maximum 180 minutes."),
});

const formSchema = z.discriminatedUnion("quizMode", [
  z.object({ quizMode: z.literal("ai") }).merge(aiGeneratedQuizSchema),
  z.object({ quizMode: z.literal("custom") }).merge(customQuizSchema),
]);

type QuizSettingsFormValues = z.infer<typeof formSchema>;

const defaultValues: QuizSettingsFormValues = {
  quizMode: "ai",
  topic: '',
  numberOfQuestions: 5,
  quizDuration: 10,
  customQuizTitle: '',
  customPromptsBlock: '',
  customQuizDuration: 15,
};

function parseFullMcqBlock(lines: string[]): McqQuestion | null {
  if (lines.length < 3) return null; 

  const questionNumberRegex = /^\s*\d+[.)]\s*/;
  const optionLabelRegex = /^\s*([A-Da-d])\s*[.)]\s+/i; 
  const answerLineRegex = /^\s*(?:Answer|Ans)[:\s]*\s*([A-Da-d])\s*(?:\((.*?)\))?\s*$/i; 

  let questionText = "";
  const parsedOptions: { letter: string, text: string }[] = [];
  let correctAnswerLetter: string | null = null;
  
  let potentialQuestionLine = lines[0].replace(questionNumberRegex, "").trim();

  if (!potentialQuestionLine) return null;
  questionText = potentialQuestionLine;

  let lineIndex = 1;
  while(lineIndex < lines.length && parsedOptions.length < 4) {
    const currentLine = lines[lineIndex].trim();
    const optionMatch = currentLine.match(optionLabelRegex);

    if (optionMatch && optionMatch[1]) { 
      parsedOptions.push({ letter: optionMatch[1].toUpperCase(), text: currentLine.replace(optionLabelRegex, "").trim() });
    } else if (answerLineRegex.test(currentLine) || questionNumberRegex.test(currentLine)) {
      break; 
    } else if (parsedOptions.length > 0) {
      parsedOptions[parsedOptions.length -1].text += `\n${currentLine}`;
    } else {
      questionText += `\n${currentLine}`;
    }
    lineIndex++;
  }
  
  while(lineIndex < lines.length) {
    const currentLine = lines[lineIndex].trim();
    const answerMatch = currentLine.match(answerLineRegex);
    if (answerMatch && answerMatch[1]) {
        correctAnswerLetter = answerMatch[1].toUpperCase();
        break; 
    }
    if (questionNumberRegex.test(currentLine) && correctAnswerLetter === null) return null;
    lineIndex++;
  }
  
  if (parsedOptions.length < 2 || parsedOptions.length > 4 || !correctAnswerLetter) { // Allow 2 to 4 options
    return null;
  }

  const validOptionLetters = ["A", "B", "C", "D"].slice(0, parsedOptions.length);
  if (!validOptionLetters.includes(correctAnswerLetter)) {
    return null; 
  }
  
  const originalOptionTexts = parsedOptions.map(opt => opt.text);
  const originalCorrectAnswerText = originalOptionTexts[validOptionLetters.indexOf(correctAnswerLetter)];

  if (originalCorrectAnswerText === undefined) {
    return null; 
  }
  
  const shuffledOptionTexts = shuffleArray([...originalOptionTexts]);
  const newCorrectAnswerIndex = shuffledOptionTexts.indexOf(originalCorrectAnswerText);

  if (newCorrectAnswerIndex === -1) {
    return null; 
  }

  return {
    question: questionText,
    options: shuffledOptionTexts,
    correctAnswerIndex: newCorrectAnswerIndex,
  };
}


export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth(); 

  const form = useForm<QuizSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const quizMode = form.watch("quizMode");

  const onSubmit: SubmitHandler<QuizSettingsFormValues> = async (data) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in or sign up to create a quiz.",
        variant: "destructive",
      });
      setIsLoading(false); // Ensure loading state is reset
      return;
    }

    setIsLoading(true);
    let quizDataForFirestore: Omit<GeneratedQuizData, 'id' | 'createdAt' | 'userId'> | null = null;

    try {
      if (data.quizMode === "ai") {
        toast({
          title: 'Generating Your AI Quiz...',
          description: 'AI is working its magic. Please wait.',
        });
        const result: GenerateMcqQuestionsOutput = await generateMcqQuestions({
          topic: data.topic,
          numberOfQuestions: data.numberOfQuestions,
        });

        if (result.questions && result.questions.length > 0) {
          quizDataForFirestore = {
            topic: data.topic,
            questions: result.questions.map(q => ({
              question: q.question,
              options: q.options,
              correctAnswerIndex: q.correctAnswerIndex,
            })),
            durationMinutes: data.quizDuration,
          };
        } else {
          toast({
            title: 'No Questions Generated (AI)',
            description: 'The AI could not generate questions for this topic/configuration. Please try again.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      } else if (data.quizMode === "custom") {
        toast({
          title: 'Processing Your Custom Quiz...',
          description: 'AI is working on your questions/prompts. This might take a moment.',
        });

        const processedQuestions: McqQuestion[] = [];
        const allLines = data.customPromptsBlock.trim().split('\n').filter(line => line.trim() !== '');
        
        const questionBlocks: string[][] = [];
        let currentBlock: string[] = [];
        const questionStartRegex = /^\s*\d+[.)]\s+/;

        for (const line of allLines) {
            if (questionStartRegex.test(line) && currentBlock.length > 0) {
                questionBlocks.push([...currentBlock]);
                currentBlock = [line]; 
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) { 
            questionBlocks.push([...currentBlock]);
        }
        
        if (questionBlocks.length === 0 && allLines.length > 0) {
          allLines.forEach(line => questionBlocks.push([line]));
        }

        const processingPromises = questionBlocks.map(async (block) => {
          const fullMcq = parseFullMcqBlock(block);
          if (fullMcq) {
            return fullMcq;
          } else {
            const promptForAi = block.join('\n').trim(); 
            if (!promptForAi) return null;
            
            const ansPattern = /^(?<questionText>.+?)\s*\(ans\)(?<correctAnswerText>.+?)\(ans\)\s*$/i;
            const match = promptForAi.match(ansPattern);

            if (match && match.groups && match.groups.questionText.trim() && match.groups.correctAnswerText.trim()) {
              const questionText = match.groups.questionText.trim();
              const correctAnswerText = match.groups.correctAnswerText.trim();
              try {
                const optionsResult: GenerateOptionsForCustomQuestionOutput = await generateOptionsForCustomQuestion({
                  questionText: questionText,
                  correctAnswerText: correctAnswerText,
                });
                return {
                  question: questionText,
                  options: optionsResult.options,
                  correctAnswerIndex: optionsResult.correctAnswerIndex,
                };
              } catch (e) {
                console.error(`Failed to generate options for: ${questionText}`, e);
                throw new Error(`AI failed for prompt (ans): "${promptForAi.substring(0,30)}..." - ${(e as Error).message}`);
              }
            } else { 
               try {
                const singleMcqResult: GenerateSingleMcqFromUserQueryOutput = await generateSingleMcqFromUserQuery({
                  userQuery: promptForAi,
                });
                if (singleMcqResult && singleMcqResult.question) {
                  return {
                    question: singleMcqResult.question,
                    options: singleMcqResult.options,
                    correctAnswerIndex: singleMcqResult.correctAnswerIndex,
                  };
                } else {
                  throw new Error(`AI returned invalid structure for: "${promptForAi.substring(0,30)}..."`);
                }
              } catch (e) {
                console.error(`Failed to generate single MCQ for: ${promptForAi}`, e);
                throw new Error(`AI failed for prompt: "${promptForAi.substring(0,30)}..." - ${(e as Error).message}`);
              }
            }
          }
        });

        const results = await Promise.allSettled(processingPromises);
        let anyErrors = false;

        results.forEach((result, blockIndex) => {
          if (result.status === 'fulfilled' && result.value) {
              processedQuestions.push(result.value);
          } else if (result.status === 'rejected') {
            anyErrors = true;
            const failedBlockContent = questionBlocks[blockIndex] ? questionBlocks[blockIndex].join('\n').substring(0, 50) + "..." : "Unknown block";
            console.error(`Error processing custom prompt block starting with: "${failedBlockContent}"`, result.reason);
            toast({
              title: `Error processing a block`,
              description: `AI failed to process a block. Review input. ${(result.reason as Error).message}`,
              variant: 'destructive',
              duration: 7000,
            });
          }
        });
        
        if (anyErrors && processedQuestions.length === 0) {
             toast({
                title: 'Custom Quiz Processing Failed',
                description: 'Could not process any of your custom questions. Please check your input and try again.',
                variant: 'destructive',
            });
            setIsLoading(false);
            return;
        }
        if (processedQuestions.length === 0 && allLines.length > 0) {
             toast({
                title: 'No Questions Processed',
                description: 'None of the provided custom prompts resulted in a valid question. Please check your input format and AI logs.',
                variant: 'destructive',
            });
            setIsLoading(false);
            return;
        }

        if (processedQuestions.length > 0) {
          const finalQuestions = shuffleArray(processedQuestions); 
          quizDataForFirestore = {
            topic: data.customQuizTitle,
            questions: finalQuestions,
            durationMinutes: data.customQuizDuration,
          };
        } else if (allLines.length === 0) {
           toast({
            title: 'No Prompts Provided',
            description: 'Please enter at least one question or topic for your custom quiz.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      if (quizDataForFirestore) {
        const currentUserId = user ? user.uid : null; // Should always have a user ID here due to earlier check
        const newQuizId = await saveQuiz(quizDataForFirestore, currentUserId);
        toast({
          title: 'Quiz Saved!',
          description: `Your quiz "${quizDataForFirestore.topic}" is ready. Redirecting...`,
        });
        router.push(`/exam/${newQuizId}`);
      }

    } catch (error) {
      console.error("Error in quiz submission process:", error);
      toast({
        title: 'Error',
        description: `An unexpected error occurred: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-8">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            {quizMode === 'ai' ? <Wand2 className="h-10 w-10 text-primary" /> : <PencilLine className="h-10 w-10 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">AI Quiz Maker</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            {quizMode === 'ai' 
              ? "Let AI craft a quiz for you, or switch to custom mode to build your own!"
              : "Build your own quiz. Paste questions/topics below (one per line or in blocks). AI can help!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="quizMode"
                render={({ field }) => (
                  <FormItem className="space-y-3 mb-6">
                    <FormLabel className="text-base font-semibold">Quiz Mode</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          const currentValues = form.getValues();
                          form.reset({ 
                            quizMode: value as "ai" | "custom",
                            topic: value === "ai" ? (currentValues.topic || defaultValues.topic) : defaultValues.topic,
                            numberOfQuestions: value === "ai" ? (currentValues.numberOfQuestions || defaultValues.numberOfQuestions) : defaultValues.numberOfQuestions,
                            quizDuration: value === "ai" ? (currentValues.quizDuration || defaultValues.quizDuration) : defaultValues.quizDuration,
                            customQuizTitle: value === "custom" ? (currentValues.customQuizTitle || defaultValues.customQuizTitle) : defaultValues.customQuizTitle,
                            customPromptsBlock: value === "custom" ? (currentValues.customPromptsBlock || defaultValues.customPromptsBlock) : defaultValues.customPromptsBlock,
                            customQuizDuration: value === "custom" ? (currentValues.customQuizDuration || defaultValues.customQuizDuration) : defaultValues.customQuizDuration,
                          }, { keepDefaultValues: false }); 
                        }}
                        defaultValue={field.value}
                        className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                        disabled={isLoading}
                      >
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="ai" id="ai-mode" />
                          </FormControl>
                          <FormLabel htmlFor="ai-mode" className="font-normal text-base cursor-pointer">AI Generated</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="custom" id="custom-mode" />
                          </FormControl>
                          <FormLabel htmlFor="custom-mode" className="font-normal text-base cursor-pointer">Create My Own</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {quizMode === 'ai' && (
                <>
                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Topic for AI Quiz</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., 'The Renaissance Period', 'Quantum Physics Basics'"
                            className="resize-none min-h-[100px] text-base"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="numberOfQuestions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary/80" />Number of Questions</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 5" {...field} disabled={isLoading} className="text-base" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quizDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base flex items-center"><Clock className="mr-2 h-5 w-5 text-primary/80" />Quiz Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 10" {...field} disabled={isLoading} className="text-base" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {quizMode === 'custom' && (
                <>
                  <FormField
                    control={form.control}
                    name="customQuizTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Your Quiz Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 'My Awesome History Quiz'" {...field} disabled={isLoading} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customPromptsBlock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Your Questions & Prompts</FormLabel>
                         <FormDescription className="text-sm text-muted-foreground mb-2 space-y-1">
                          <div>Enter each question/prompt on a new line, or paste blocks of fully formatted MCQs (max 100 items). For pasted MCQs, options will be shuffled.</div>
                          <ul className="list-disc list-inside pl-4 mt-1">
                            <li>
                              <strong>Fully Formatted MCQ:</strong> Paste a question number (e.g., "1."), its text, options (A, B, C, D, each on a new line), and an "Answer: X" line (also on a new line).
                              <div className="pl-4 my-1 p-2 bg-muted/50 rounded-md text-xs">
                                <code className="block">1. What is 2+2?</code>
                                <code className="block">A) 3</code>
                                <code className="block">B) 4</code>
                                <code className="block">C) 5</code>
                                <code className="block">D) 6</code>
                                <code className="block">Answer: B</code>
                              </div>
                            </li>
                            <li><strong>AI Generates Options:</strong> Provide question and answer like: <code className="bg-muted px-1 rounded-sm">The Earth revolves around the (ans)Sun(ans)</code>. AI creates other options.</li>
                            <li><strong>AI Generates Full MCQ:</strong> Type a topic (e.g., <code className="bg-muted px-1 rounded-sm">Ancient Rome</code>) or a question (e.g., <code className="bg-muted px-1 rounded-sm">What is the speed of light?</code>). AI creates the full question and options.</li>
                          </ul>
                           For multiple fully formatted MCQs, ensure each starts with a number (e.g., "1.", "2)") to help parsing.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="1. What is 2+2?
A) 3
B) 4
C) 5
D) 6
Answer: B

The chemical symbol for Carbon? (ans)C(ans)

The French Revolution
... (up to 100 entries)"
                            className="resize-y min-h-[200px] md:min-h-[250px] text-base"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customQuizDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base flex items-center"><Clock className="mr-2 h-5 w-5 text-primary/80" />Quiz Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 15" {...field} disabled={isLoading} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {quizMode === 'ai' ? 'Generating AI Quiz...' : 'Processing Custom Quiz...'}
                  </>
                ) : (
                  <>
                    {quizMode === 'ai' ? <Sparkles className="mr-2 h-5 w-5" /> : <PencilLine className="mr-2 h-5 w-5" />}
                    {quizMode === 'ai' ? 'Generate AI Quiz' : 'Create Custom Quiz'}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">Made with ❤️ from Saptrishi &amp; a Zedsu product</p>
        </CardFooter>
      </Card>
    </div>
  );
}
