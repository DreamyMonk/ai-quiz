
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateMcqQuestions, type GenerateMcqQuestionsOutput } from '@/ai/flows/generate-mcq-questions';
import type { GeneratedQuizData } from '@/types/quiz';
import { Loader2, Sparkles, Wand2, ListChecks, Clock } from 'lucide-react';

const formSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
  numberOfQuestions: z.coerce.number().int().min(3, "Must be at least 3 questions.").max(25, "Cannot exceed 25 questions."),
  quizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(120, "Maximum 120 minutes."),
});

type QuizSettingsFormValues = z.infer<typeof formSchema>;

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<QuizSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      numberOfQuestions: 5,
      quizDuration: 10,
    },
  });

  const onSubmit: SubmitHandler<QuizSettingsFormValues> = async (data) => {
    setIsLoading(true);
    try {
      toast({
        title: 'Generating Your Custom Quiz...',
        description: 'AI is working its magic. Please wait.',
      });
      const result: GenerateMcqQuestionsOutput = await generateMcqQuestions({ 
        topic: data.topic,
        numberOfQuestions: data.numberOfQuestions,
      });

      if (result.questions && result.questions.length > 0) {
        const quizData: GeneratedQuizData = {
          id: new Date().toISOString(), // Simple unique ID
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
          title: 'Success!',
          description: `Generated ${quizData.questions.length} questions on "${data.topic}" with a ${data.quizDuration}-minute time limit. Redirecting to exam...`,
        });
        router.push('/exam');
      } else {
        toast({
          title: 'No Questions Generated',
          description: 'The AI could not generate questions for this topic/configuration. Please try a different topic or settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error generating MCQs:", error);
      toast({
        title: 'Error',
        description: 'Failed to generate MCQs. Please try again later.',
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
            <Wand2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Customize Your AI Quiz</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            Define your topic, number of questions, and time limit. Our AI will craft a personalized quiz for you!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Topic</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'The Renaissance Period', 'Quantum Physics Basics', 'JavaScript Promises'"
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
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Quiz
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
