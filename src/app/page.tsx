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
import { useToast } from '@/hooks/use-toast';
import { generateMcqQuestions, type GenerateMcqQuestionsOutput } from '@/ai/flows/generate-mcq-questions';
import type { GeneratedQuizData } from '@/types/quiz';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

const formSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
});

type TopicFormValues = z.infer<typeof formSchema>;

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
    },
  });

  const onSubmit: SubmitHandler<TopicFormValues> = async (data) => {
    setIsLoading(true);
    try {
      toast({
        title: 'Generating Questions...',
        description: 'AI is working its magic. Please wait.',
      });
      const result: GenerateMcqQuestionsOutput = await generateMcqQuestions({ topic: data.topic });

      if (result.questions && result.questions.length > 0) {
        const quizData: GeneratedQuizData = {
          id: new Date().toISOString(), // Simple unique ID
          topic: data.topic,
          questions: result.questions.map(q => ({
            question: q.question,
            options: q.options,
            correctAnswerIndex: q.correctAnswerIndex,
          })),
        };
        localStorage.setItem('currentQuiz', JSON.stringify(quizData));
        toast({
          title: 'Success!',
          description: `Generated ${quizData.questions.length} questions on "${data.topic}". Redirecting to exam...`,
        });
        router.push('/exam');
      } else {
        toast({
          title: 'No Questions Generated',
          description: 'The AI could not generate questions for this topic. Please try a different topic or rephrase.',
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
          <CardTitle className="text-3xl font-bold">Welcome to MCQ AI Studio</CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-2">
            Enter a topic below, and our AI will craft a set of multiple-choice questions for you to test your knowledge!
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
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Questions
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
