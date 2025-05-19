// src/ai/flows/generate-mcq-questions.ts
'use server';

/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) based on a given topic.
 *
 * - generateMcqQuestions - A function that takes a topic as input and returns a set of MCQs.
 * - GenerateMcqQuestionsInput - The input type for the generateMcqQuestions function.
 * - GenerateMcqQuestionsOutput - The output type for the generateMcqQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMcqQuestionsInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate MCQs.'),
});
export type GenerateMcqQuestionsInput = z.infer<typeof GenerateMcqQuestionsInputSchema>;

const GenerateMcqQuestionsOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('The possible answer options.'),
      correctAnswerIndex: z
        .number()
        .int()
        .min(0)
        .describe('The index of the correct answer in the options array.'),
    })
  ).describe('An array of multiple-choice questions.'),
});
export type GenerateMcqQuestionsOutput = z.infer<typeof GenerateMcqQuestionsOutputSchema>;

export async function generateMcqQuestions(input: GenerateMcqQuestionsInput): Promise<GenerateMcqQuestionsOutput> {
  return generateMcqQuestionsFlow(input);
}

const generateMcqQuestionsPrompt = ai.definePrompt({
  name: 'generateMcqQuestionsPrompt',
  input: {schema: GenerateMcqQuestionsInputSchema},
  output: {schema: GenerateMcqQuestionsOutputSchema},
  prompt: `You are an expert in creating multiple-choice questions (MCQs).
  Given the topic: {{{topic}}}, generate a set of MCQs.
  Each question should have 4 possible answers, and only one correct answer.
  Return the questions in JSON format, with a "questions" array.
  Each question object should have the following keys:
  - "question": the text of the question
  - "options": an array of strings, representing the possible answers
  - "correctAnswerIndex": the index of the correct answer in the options array (0-indexed).
  Ensure that the correct answer is plausible and related to the question.
  Make sure that the options are distinct, and that only one is correct.
  Do not repeat questions.
  The number of questions generated should be appropriate for the complexity of the topic and the user's presumed knowledge.
  The generated questions should require recall of knowledge, not general knowledge or common sense.
  `,
});

const generateMcqQuestionsFlow = ai.defineFlow(
  {
    name: 'generateMcqQuestionsFlow',
    inputSchema: GenerateMcqQuestionsInputSchema,
    outputSchema: GenerateMcqQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateMcqQuestionsPrompt(input);
    return output!;
  }
);
