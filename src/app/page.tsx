
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
import type { GeneratedQuizData, McqQuestion } from '@/types/quiz';
import { Loader2, Sparkles, Wand2, ListChecks, Clock, PencilLine } from 'lucide-react';

// Schemas for each mode
const aiGeneratedQuizSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
  numberOfQuestions: z.coerce.number().int().min(3, "Must be at least 3 questions.").max(10, "Cannot exceed 10 questions for AI generation."),
  quizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(120, "Maximum 120 minutes."),
});

// Updated customQuizSchema to use a single textarea for all prompts
const customQuizSchema = z.object({
  customQuizTitle: z.string().min(3, "Quiz title must be at least 3 characters.").max(100, "Quiz title too long."),
  customPromptsBlock: z.string()
    .min(5, { message: "Please provide at least one question, topic, or prompt (min 5 characters for the entire block)." })
    .max(15000, { message: "The total text for custom questions is too long (max 15000 characters)." })
    .refine(value => value.trim().split('\n').filter(line => line.trim() !== '').length > 0, { message: "Please add at least one question or prompt."})
    .refine(value => value.trim().split('\n').filter(line => line.trim() !== '').length <= 20, { message: "You can add a maximum of 20 questions/prompts (each on a new line)."}),
  customQuizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(180, "Maximum 180 minutes."),
});

// Combined schema using a discriminated union
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

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<QuizSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const quizMode = form.watch("quizMode");

  const onSubmit: SubmitHandler<QuizSettingsFormValues> = async (data) => {
    setIsLoading(true);
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
          const quizData: GeneratedQuizData = {
            id: new Date().toISOString(),
            topic: data.topic,
            questions: result.questions.map(q => ({
              question: q.question,
              options: q.options,
              correctAnswerIndex: q.correctAnswerIndex,
            })),
            durationMinutes: data.quizDuration,
          };
          localStorage.setItem('currentQuiz', JSON.stringify(quizData));
          toast({
            title: 'AI Quiz Generated!',
            description: `Generated ${quizData.questions.length} questions on "${data.topic}". Redirecting...`,
          });
          router.push('/exam');
        } else {
          toast({
            title: 'No Questions Generated (AI)',
            description: 'The AI could not generate questions for this topic/configuration. Please try again.',
            variant: 'destructive',
          });
        }
      } else if (data.quizMode === "custom") {
        toast({
          title: 'Processing Your Custom Quiz...',
          description: 'AI is working on your questions. This might take a moment.',
        });

        const processedQuestions: McqQuestion[] = [];
        const ansPattern = /^(?<questionText>.+?)\s*\(ans\)(?<correctAnswerText>.+?)\(ans\)\s*$/i;

        const promptsArray = data.customPromptsBlock.trim().split('\n').filter(line => line.trim() !== '');

        for (const promptText of promptsArray) {
          const trimmedPrompt = promptText.trim();
          const match = trimmedPrompt.match(ansPattern);

          try {
            if (match && match.groups && match.groups.questionText.trim() && match.groups.correctAnswerText.trim()) {
              const questionText = match.groups.questionText.trim();
              const correctAnswerText = match.groups.correctAnswerText.trim();
              
              const optionsResult: GenerateOptionsForCustomQuestionOutput = await generateOptionsForCustomQuestion({
                questionText: questionText,
                correctAnswerText: correctAnswerText,
              });
              processedQuestions.push({
                question: questionText,
                options: optionsResult.options,
                correctAnswerIndex: optionsResult.correctAnswerIndex,
              });
            } else {
              const singleMcqResult: GenerateSingleMcqFromUserQueryOutput = await generateSingleMcqFromUserQuery({
                userQuery: trimmedPrompt,
              });
              if (singleMcqResult && singleMcqResult.question) {
                processedQuestions.push({
                  question: singleMcqResult.question,
                  options: singleMcqResult.options,
                  correctAnswerIndex: singleMcqResult.correctAnswerIndex,
                });
              } else {
                 throw new Error('AI failed to generate a question from the prompt.');
              }
            }
          } catch (err) {
            console.error("Error processing custom prompt:", trimmedPrompt, err);
            toast({
              title: `Error with prompt: "${trimmedPrompt.substring(0, 30)}..."`,
              description: `AI failed to process this prompt. ${(err as Error).message}. Please review it or try again.`,
              variant: 'destructive',
            });
            setIsLoading(false);
            return; 
          }
        }

        if (processedQuestions.length === promptsArray.length && promptsArray.length > 0) {
          const quizData: GeneratedQuizData = {
            id: new Date().toISOString(),
            topic: data.customQuizTitle,
            questions: processedQuestions,
            durationMinutes: data.customQuizDuration,
          };
          localStorage.setItem('currentQuiz', JSON.stringify(quizData));
          toast({
            title: 'Custom Quiz Ready!',
            description: `Your quiz "${data.customQuizTitle}" with ${processedQuestions.length} questions is ready. Redirecting...`,
          });
          router.push('/exam');
        } else if (promptsArray.length === 0) {
           toast({
            title: 'No Prompts Provided',
            description: 'Please enter at least one question or topic for your custom quiz.',
            variant: 'destructive',
          });
        }
        else {
          toast({
            title: 'Error Processing Custom Quiz',
            description: 'Could not process all custom question prompts. Please check inputs.',
            variant: 'destructive',
          });
        }
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
          <CardTitle className="text-3xl font-bold">Create Your Quiz</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            {quizMode === 'ai' 
              ? "Let AI craft a quiz for you, or switch to custom mode to build your own!"
              : "Build your own quiz. Paste questions/topics below (one per line). AI will fill in the blanks!"}
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
                          if (value === "ai") {
                            form.reset({
                              quizMode: "ai",
                              topic: currentValues.topic || defaultValues.topic,
                              numberOfQuestions: currentValues.numberOfQuestions || defaultValues.numberOfQuestions,
                              quizDuration: currentValues.quizDuration || defaultValues.quizDuration,
                              customQuizTitle: defaultValues.customQuizTitle,
                              customPromptsBlock: defaultValues.customPromptsBlock,
                              customQuizDuration: defaultValues.customQuizDuration,
                            });
                          } else { // Switching to "custom"
                            form.reset({
                              quizMode: "custom",
                              customQuizTitle: currentValues.customQuizTitle || defaultValues.customQuizTitle,
                              customPromptsBlock: currentValues.customPromptsBlock || defaultValues.customPromptsBlock,
                              customQuizDuration: currentValues.customQuizDuration || defaultValues.customQuizDuration,
                              topic: defaultValues.topic,
                              numberOfQuestions: defaultValues.numberOfQuestions,
                              quizDuration: defaultValues.quizDuration,
                            });
                          }
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
                         <FormDescription className="text-sm text-muted-foreground mb-2">
                          Enter each question or topic on a new line (max 20).
                          <ul className="list-disc list-inside pl-4 mt-1">
                            <li>To let AI generate a full MCQ: type a topic (e.g., <code className="bg-muted px-1 rounded-sm">Ancient Rome</code>) or a question (e.g., <code className="bg-muted px-1 rounded-sm">What is the speed of light?</code>).</li>
                            <li>To specify an answer: use the format <code className="bg-muted px-1 rounded-sm">Question Text (ans)Correct Answer(ans)</code>. <br/>
                              Example: <code className="bg-muted px-1 rounded-sm">The Earth revolves around the (ans)Sun(ans)</code>
                            </li>
                          </ul>
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="What is 2+2? (ans)4(ans)
Carbon Dioxide
The French Revolution
..."
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
          <p className="text-xs text-muted-foreground">Made with ❤️ from Saptarshi &amp; a Zedsu product</p>
        </CardFooter>
      </Card>
    </div>
  );
}
