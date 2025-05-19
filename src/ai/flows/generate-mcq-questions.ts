
// src/ai/flows/generate-mcq-questions.ts
'use server';

/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) based on a given topic and desired number of questions.
 *
 * - generateMcqQuestions - A function that takes a topic and number of questions as input and returns a set of MCQs.
 * - GenerateMcqQuestionsInput - The input type for the generateMcqQuestions function.
 * - GenerateMcqQuestionsOutput - The output type for the generateMcqQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMcqQuestionsInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate MCQs.'),
  numberOfQuestions: z.number().int().min(1).describe('The exact number of MCQs to generate.'),
});
export type GenerateMcqQuestionsInput = z.infer<typeof GenerateMcqQuestionsInputSchema>;

const GenerateMcqQuestionsOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('The possible answer options (should be 4).'),
      correctAnswerIndex: z
        .number()
        .int()
        .min(0)
        .max(3) // Assuming 4 options, so index is 0-3
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
  Given the topic: {{{topic}}}, generate exactly {{{numberOfQuestions}}} MCQs.
  Each question must have exactly 4 possible answer options, and only one correct answer.
  Return the questions in JSON format, with a "questions" array.
  Each question object should have the following keys:
  - "question": the text of the question
  - "options": an array of 4 strings, representing the possible answers
  - "correctAnswerIndex": the 0-indexed integer of the correct answer in the options array.
  Ensure that the correct answer is plausible and related to the question.
  Make sure that the options are distinct, and that only one is correct.
  Do not repeat questions. Ensure you generate exactly {{{numberOfQuestions}}} questions as requested.
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
    // Ensure the output matches the requested number of questions if possible, or handle discrepancies.
    // For now, we trust the LLM to follow instructions based on the prompt.
    // If output is null or questions array is empty, it indicates an issue with generation.
    if (!output || !output.questions) {
        // Fallback or error handling if needed, though schema validation should catch some issues.
        // For robust handling, one might check output.questions.length here.
        // Returning an empty array or throwing an error could be options.
        // For now, let's assume the LLM adheres to the prompt or schema validation handles errors.
        console.warn('AI did not return questions as expected.');
        return { questions: [] };
    }
    return output;
  }
);
