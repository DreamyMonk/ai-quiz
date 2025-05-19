// src/ai/flows/analyze-quiz-performance.ts
'use server';
/**
 * @fileOverview Analyzes a student's quiz performance and provides insights.
 *
 * - analyzeQuizPerformance - A function that analyzes quiz performance.
 * - AnalyzeQuizPerformanceInput - The input type for the analyzeQuizPerformance function.
 * - AnalyzeQuizPerformanceOutput - The return type for the analyzeQuizPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeQuizPerformanceInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  questions: z.array(
    z.object({
      question: z.string().describe('The question text.'),
      options: z.array(z.string()).describe('The possible answer options.'),
      correctAnswerIndex: z
        .number()
        .describe('The index of the correct answer in the options array.'),
      studentAnswerIndex: z
        .number()
        .nullable()
        .describe('The index of the student selected answer, null if unanswered.'),
    })
  ).describe('An array of questions, with the correct answers and student answers.'),
});
export type AnalyzeQuizPerformanceInput = z.infer<
  typeof AnalyzeQuizPerformanceInputSchema
>;

const AnalyzeQuizPerformanceOutputSchema = z.object({
  overallScore: z.number().describe('The student overall score (0-100).'),
  strengths: z.string().describe('The student strengths in the topic.'),
  weaknesses: z.string().describe('The student weaknesses in the topic.'),
  suggestions: z.string().describe('Suggestions for improvement.'),
  questionExplanations: z.array(
    z.string().describe('A detailed explanation for the question, why the correct answer is correct, common pitfalls, and the key concept tested. This array should have explanations in the same order as the input questions.')
  ).describe('Detailed explanations for each question in the quiz, in the same order as the input questions.')
});
export type AnalyzeQuizPerformanceOutput = z.infer<
  typeof AnalyzeQuizPerformanceOutputSchema
>;

export async function analyzeQuizPerformance(
  input: AnalyzeQuizPerformanceInput
): Promise<AnalyzeQuizPerformanceOutput> {
  return analyzeQuizPerformanceFlow(input);
}

const analyzeQuizPerformancePrompt = ai.definePrompt({
  name: 'analyzeQuizPerformancePrompt',
  input: {schema: AnalyzeQuizPerformanceInputSchema},
  output: {schema: AnalyzeQuizPerformanceOutputSchema},
  prompt: `You are an AI quiz performance analyzer. Analyze the student\'s quiz performance and provide insights into their strengths and weaknesses in the given topic.

  Topic: {{{topic}}}

  Questions:
  {{#each questions}}
  Question: {{this.question}}
  Options: {{this.options}}
  Correct Answer Index: {{this.correctAnswerIndex}}
  Student Answer Index: {{this.studentAnswerIndex}}
  ---
  {{/each}}

  Based on the quiz data, provide the following:
  - overallScore: The student overall score (0-100).
  - strengths: The student strengths in the topic.
  - weaknesses: The student weaknesses in the topic.
  - suggestions: Suggestions for improvement.
  - questionExplanations: An array of strings. Each string must be a detailed explanation for the corresponding input question.
    For each question, explain in detail:
    1. Why the correct answer is indeed correct.
    2. Common misunderstandings or reasons why a student might choose incorrect options (distractors).
    3. Briefly reiterate the core concept or knowledge being tested by the question.
    Ensure the number of explanations in the 'questionExplanations' array precisely matches the number of questions provided in the input, and that they are in the same order.
  `,
});

const analyzeQuizPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeQuizPerformanceFlow',
    inputSchema: AnalyzeQuizPerformanceInputSchema,
    outputSchema: AnalyzeQuizPerformanceOutputSchema,
  },
  async input => {
    const {output} = await analyzeQuizPerformancePrompt(input);
    return output!;
  }
);
