
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { generateMcqQuestions, type GenerateMcqQuestionsOutput } from '@/ai/flows/generate-mcq-questions';
import { generateOptionsForCustomQuestion, type GenerateOptionsForCustomQuestionOutput } from '@/ai/flows/generate-options-for-custom-question';
import type { GeneratedQuizData, McqQuestion } from '@/types/quiz';
import { Loader2, Sparkles, Wand2, ListChecks, Clock, PlusCircle, Trash2, PencilLine } from 'lucide-react';

// Schemas for each mode
const aiGeneratedQuizSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
  numberOfQuestions: z.coerce.number().int().min(3, "Must be at least 3 questions.").max(10, "Cannot exceed 10 questions for AI generation."),
  quizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(120, "Maximum 120 minutes."),
});

const customQuestionSchema = z.object({
  questionText: z.string().min(5, "Question text must be at least 5 characters.").max(500, "Question text too long."),
  correctAnswerText: z.string().min(1, "Correct answer must not be empty.").max(200, "Correct answer too long."),
});

const customQuizSchema = z.object({
  customQuizTitle: z.string().min(3, "Quiz title must be at least 3 characters.").max(100, "Quiz title too long."),
  customQuestions: z.array(customQuestionSchema).min(1, "Please add at least one question.").max(10, "Maximum 10 custom questions."),
  customQuizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(180, "Maximum 180 minutes."),
});

// Combined schema using a discriminated union
const formSchema = z.discriminatedUnion("quizMode", [
  z.object({ quizMode: z.literal("ai") }).merge(aiGeneratedQuizSchema),
  z.object({ quizMode: z.literal("custom") }).merge(customQuizSchema),
]);

type QuizSettingsFormValues = z.infer<typeof formSchema>;

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<QuizSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quizMode: "ai",
      topic: '',
      numberOfQuestions: 5,
      quizDuration: 10,
      customQuizTitle: '',
      customQuestions: [{ questionText: '', correctAnswerText: '' }],
      customQuizDuration: 15,
    },
  });

  const quizMode = form.watch("quizMode");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "customQuestions" as any, // Cast due to discriminated union complexity with useFieldArray
  });

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
          description: 'AI is generating options for your questions. This might take a moment.',
        });

        const processedQuestions: McqQuestion[] = [];
        for (const customQ of data.customQuestions) {
          try {
            const optionsResult: GenerateOptionsForCustomQuestionOutput = await generateOptionsForCustomQuestion({
              questionText: customQ.questionText,
              correctAnswerText: customQ.correctAnswerText,
            });
            processedQuestions.push({
              question: customQ.questionText,
              options: optionsResult.options,
              correctAnswerIndex: optionsResult.correctAnswerIndex,
            });
          } catch (err) {
            console.error("Error generating options for a custom question:", customQ.questionText, err);
            toast({
              title: `Error with question: "${customQ.questionText.substring(0, 30)}..."`,
              description: `AI failed to process this question. ${(err as Error).message}. Please review it or try again.`,
              variant: 'destructive',
            });
            setIsLoading(false);
            return; 
          }
        }

        if (processedQuestions.length === data.customQuestions.length) {
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
        } else {
          toast({
            title: 'Error Processing Custom Quiz',
            description: 'Could not process all custom questions. Please check inputs.',
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
              : "Build your own quiz by providing questions and correct answers. AI will help generate options!"}
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
                          // Reset form parts when switching modes to avoid validation errors from hidden fields
                          if (value === "ai") {
                            form.reset({ 
                              ...form.getValues(), 
                              quizMode: "ai", 
                              customQuizTitle: '', 
                              customQuestions: [{ questionText: '', correctAnswerText: '' }],
                              customQuizDuration: 15,
                            });
                          } else {
                             form.reset({ 
                              ...form.getValues(), 
                              quizMode: "custom",
                              topic: '',
                              numberOfQuestions: 5,
                              quizDuration: 10,
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
                  
                  <div>
                    <FormLabel className="text-base mb-2 block">Your Questions</FormLabel>
                    {fields.map((item, index) => (
                      <Card key={item.id} className="p-4 space-y-4 mb-4 border border-border shadow-sm bg-secondary/30">
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-md font-semibold">Question {index + 1}</FormLabel>
                          {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isLoading} className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Remove question</span>
                            </Button>
                          )}
                        </div>
                        <FormField
                          control={form.control}
                          name={`customQuestions.${index}.questionText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Question Text</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Enter your question here" {...field} disabled={isLoading} className="text-base min-h-[80px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`customQuestions.${index}.correctAnswerText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Correct Answer Text</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter the correct answer text" {...field} disabled={isLoading} className="text-base" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ questionText: '', correctAnswerText: '' })}
                      disabled={isLoading || fields.length >= 10}
                      className="mt-2 w-full sm:w-auto"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Question {fields.length >=10 && "(Max 10)"}
                    </Button>
                  </div>

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
          <p className="text-xs text-muted-foreground">Powered by Generative AI</p>
        </CardFooter>
      </Card>
    </div>
  );
}
