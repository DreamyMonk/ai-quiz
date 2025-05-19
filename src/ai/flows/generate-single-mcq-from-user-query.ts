
'use server';
/**
 * @fileOverview Generates a single Multiple Choice Question (MCQ) from a user's query or topic.
 *
 * - generateSingleMcqFromUserQuery - A function that takes a user query and returns one complete MCQ.
 * - GenerateSingleMcqFromUserQueryInput - The input type.
 * - GenerateSingleMcqFromUserQueryOutput - The output type (a single McqQuestion).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSingleMcqInputSchema = z.object({
  userQuery: z.string().describe('The user-provided text (topic, statement, or incomplete question) to generate an MCQ from.'),
});
export type GenerateSingleMcqInput = z.infer<typeof GenerateSingleMcqInputSchema>;

// This schema matches the structure of a single question in GenerateMcqQuestionsOutputSchema
const McqQuestionOutputSchema = z.object({
  question: z.string().describe('The text of the generated question.'),
  options: z.array(z.string()).length(4).describe('An array of 4 possible answer options, one of which is correct.'),
  correctAnswerIndex: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe('The 0-indexed integer of the correct answer within the options array.'),
});
export type GenerateSingleMcqFromUserQueryOutput = z.infer<typeof McqQuestionOutputSchema>;


export async function generateSingleMcqFromUserQuery(input: GenerateSingleMcqInput): Promise<GenerateSingleMcqFromUserQueryOutput> {
  return generateSingleMcqFlow(input);
}

const generateSingleMcqPrompt = ai.definePrompt({
  name: 'generateSingleMcqFromUserQueryPrompt',
  input: {schema: GenerateSingleMcqInputSchema},
  output: {schema: McqQuestionOutputSchema},
  prompt: `You are an AI assistant that generates a single Multiple Choice Question (MCQ) based on user input.
User input: "{{{userQuery}}}"

Based on this input:
1. If the input itself appears to be a well-formed question, use it directly as the MCQ question text.
2. If the input is a topic, a statement, or an incomplete question, formulate a clear, specific, and relevant MCQ question based on the user's input.
3. Generate exactly 4 plausible answer options for this question. One option must be the correct answer. The options should be distinct.
4. Determine the 0-indexed position of the correct answer within the options array.

Return the result in JSON format with "question" (string), "options" (an array of 4 strings), and "correctAnswerIndex" (an integer from 0 to 3).

Example for user input "Capital of France":
{
  "question": "What is the capital of France?",
  "options": ["London", "Berlin", "Paris", "Madrid"],
  "correctAnswerIndex": 2
}

Example for user input "Describe the process of photosynthesis.":
{
  "question": "Which of the following is a primary product of photosynthesis?",
  "options": ["Carbon Dioxide", "Water", "Glucose", "Oxygen"],
  "correctAnswerIndex": 2 
}
(Note: In the above photosynthesis example, Oxygen is also a product, but Glucose is a more direct 'primary product' in the context of energy storage for the plant. Ensure answers are appropriately nuanced if the topic demands it, or simplify if that's more suitable for a general MCQ).

Ensure the generated question is directly and clearly related to the user's query. The options should be plausible distractors.
`,
});

const generateSingleMcqFlow = ai.defineFlow(
  {
    name: 'generateSingleMcqFromUserQueryFlow',
    inputSchema: GenerateSingleMcqInputSchema,
    outputSchema: McqQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await generateSingleMcqPrompt(input);
    
    if (!output || !output.question || !output.options || output.options.length !== 4 || output.correctAnswerIndex === undefined) {
      console.error('AI did not return a valid MCQ structure:', output);
      throw new Error('Failed to generate a valid MCQ from the provided prompt.');
    }
    return output;
  }
);

    