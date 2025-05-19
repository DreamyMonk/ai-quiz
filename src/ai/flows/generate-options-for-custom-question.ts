'use server';
/**
 * @fileOverview Generates quiz options for a user-provided question and correct answer.
 *
 * - generateOptionsForCustomQuestion - A function that takes a question and its correct answer,
 *   and returns a full set of 4 options (including the correct one, shuffled) and the index of the correct answer.
 * - GenerateOptionsForCustomQuestionInput - The input type.
 * - GenerateOptionsForCustomQuestionOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateOptionsForCustomQuestionInputSchema = z.object({
  questionText: z.string().describe('The text of the custom question.'),
  correctAnswerText: z.string().describe('The text of the correct answer for this question.'),
});
export type GenerateOptionsForCustomQuestionInput = z.infer<typeof GenerateOptionsForCustomQuestionInputSchema>;

const GenerateOptionsForCustomQuestionOutputSchema = z.object({
  options: z.array(z.string()).length(4).describe('An array of 4 answer options: the provided correct answer and 3 generated distractors, shuffled.'),
  correctAnswerIndex: z.number().int().min(0).max(3).describe('The 0-indexed integer of the correct answer within the shuffled options array.'),
});
export type GenerateOptionsForCustomQuestionOutput = z.infer<typeof GenerateOptionsForCustomQuestionOutputSchema>;

export async function generateOptionsForCustomQuestion(input: GenerateOptionsForCustomQuestionInput): Promise<GenerateOptionsForCustomQuestionOutput> {
  return generateOptionsForCustomQuestionFlow(input);
}

const generateOptionsPrompt = ai.definePrompt({
  name: 'generateOptionsForCustomQuestionPrompt',
  input: {schema: GenerateOptionsForCustomQuestionInputSchema},
  output: {schema: GenerateOptionsForCustomQuestionOutputSchema},
  prompt: `You are an expert in creating multiple-choice question options.
  For the given question and its correct answer, you need to:
  1. Generate exactly three plausible but incorrect distractor options. These distractors should be distinct from each other and from the correct answer.
  2. Combine the provided correct answer with these three distractors to form a list of four options.
  3. Shuffle these four options randomly.
  4. Determine the 0-indexed position (index) of the original correct answer within this new shuffled list of four options.

  Question: "{{{questionText}}}"
  Correct Answer: "{{{correctAnswerText}}}"

  Return the result in JSON format with "options" (an array of 4 strings) and "correctAnswerIndex" (an integer from 0 to 3).
  Example: If the correct answer is "Paris" and generated distractors are "London", "Berlin", "Rome", a possible shuffled output could be:
  options: ["London", "Paris", "Berlin", "Rome"], correctAnswerIndex: 1
  Ensure the output strictly adheres to the schema.
  Ensure the {{{correctAnswerText}}} is one of the options and that correctAnswerIndex points to it.
  `,
});

const generateOptionsForCustomQuestionFlow = ai.defineFlow(
  {
    name: 'generateOptionsForCustomQuestionFlow',
    inputSchema: GenerateOptionsForCustomQuestionInputSchema,
    outputSchema: GenerateOptionsForCustomQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await generateOptionsPrompt(input);
    
    if (!output || !output.options || output.options.length !== 4 || output.correctAnswerIndex === undefined || output.correctAnswerIndex < 0 || output.correctAnswerIndex > 3) {
      console.error('AI did not return valid options structure for custom question:', output);
      throw new Error('Failed to generate valid options structure for the custom question.');
    }

    // Verify the correct answer text is at the specified index. If not, try to find it or fix it.
    if (output.options[output.correctAnswerIndex] !== input.correctAnswerText) {
      const foundIndex = output.options.findIndex(opt => opt === input.correctAnswerText);
      if (foundIndex !== -1) {
        console.warn(`Correct answer index mismatch. LLM said ${output.correctAnswerIndex}, but found at ${foundIndex}. Updating index.`);
        output.correctAnswerIndex = foundIndex;
      } else {
        // Correct answer text is not in the options array at all or significantly altered. This is a more critical failure.
        // Forcibly insert the correct answer at the LLM's reported index, or a default index if that's also problematic.
        console.warn(`Correct answer text "${input.correctAnswerText}" not found in LLM options or at specified index ${output.correctAnswerIndex}. Options: ${output.options.join(', ')}. Forcing correct answer into options.`);
        output.options[output.correctAnswerIndex] = input.correctAnswerText; // Overwrite whatever is at the reported index.
      }
    }
    return output;
  }
);
