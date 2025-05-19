
'use server';
/**
 * @fileOverview Generates detailed revisit material (like a study guide) for questions a user answered incorrectly or skipped.
 *
 * - generateRevisitMaterial - A function that takes the quiz topic and incorrect/skipped questions,
 *   and returns comprehensive explanations for them.
 * - RevisitMaterialInput - The input type.
 * - RevisitMaterialOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { RevisitMaterialInput, RevisitMaterialOutput } from '@/types/quiz';

// Schemas for Zod validation, matching the TypeScript types
const RevisitMaterialInputSchema = z.object({
  topic: z.string().describe('The main topic of the quiz.'),
  incorrectQuestions: z.array(
    z.object({
      question: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('The possible answer options.'),
      correctAnswerIndex: z.number().int().describe('The index of the correct answer in the options array.'),
      studentAnswerIndex: z.number().int().nullable().describe('The index of the student\'s selected answer, or null if skipped.'),
      // Added for easier templating
      studentAnswerText: z.string().optional().describe("The text of the student's answer, or 'Skipped' if not answered."),
      correctAnswerText: z.string().optional().describe("The text of the correct answer."),
    })
  ).describe('An array of questions the student answered incorrectly or skipped.'),
});

const RevisitMaterialOutputSchema = z.object({
  title: z.string().describe('A suitable title for the revisit material/study guide, e.g., "Revisit Guide for [Topic]".'),
  introduction: z.string().describe('A brief introductory paragraph for the revisit material.'),
  sections: z.array(
    z.object({
      question: z.string().describe('The original question text.'),
      correctAnswer: z.string().describe('The text of the correct answer.'),
      studentAnswer: z.string().nullable().describe('The text of the student\'s answer if provided, or "Skipped".'),
      detailedExplanation: z.string().describe('A comprehensive, book-like explanation of the concept tested by the question. It should clarify why the correct answer is right, discuss common misunderstandings related to incorrect options (if applicable), and elaborate on the core principles. Aim for educational depth.'),
    })
  ).describe('An array of sections, each dedicated to one incorrect/skipped question with its detailed explanation.'),
});

export async function generateRevisitMaterial(input: RevisitMaterialInput): Promise<RevisitMaterialOutput> {
  // Pre-process input to add studentAnswerText and correctAnswerText
  const processedInputForPrompt = {
    topic: input.topic,
    incorrectQuestions: input.incorrectQuestions.map(q => ({
      ...q,
      studentAnswerText: q.studentAnswerIndex !== null ? q.options[q.studentAnswerIndex] : "Skipped",
      correctAnswerText: q.options[q.correctAnswerIndex],
    })),
  };
  return generateRevisitMaterialFlow(processedInputForPrompt);
}

const generateRevisitMaterialPrompt = ai.definePrompt({
  name: 'generateRevisitMaterialPrompt',
  input: {schema: RevisitMaterialInputSchema}, // Still uses the base schema for validation, but receives processed data
  output: {schema: RevisitMaterialOutputSchema},
  prompt: `You are an AI assistant tasked with creating a "Revisit Guide" to help a student understand concepts they struggled with on a quiz about "{{{topic}}}".
For each of the following questions that the student answered incorrectly or skipped, provide a detailed, book-like explanation.

Your response should be structured as follows:
1.  A "title" for the guide (e.g., "Revisit Guide for {{{topic}}}").
2.  An "introduction" paragraph that sets a positive and encouraging tone for learning from mistakes.
3.  An array of "sections". Each section in the array corresponds to one question and must contain:
    *   "question": The original question text.
    *   "correctAnswer": The text of the correct option (this will be derived from 'correctAnswerText' below).
    *   "studentAnswer": The text of the student's chosen option (this will be derived from 'studentAnswerText' below), or the word "Skipped" if they didn't answer.
    *   "detailedExplanation": This is the most important part. For each question:
        *   Thoroughly explain the core concept(s) being tested.
        *   Clearly elaborate on why the provided "correctAnswer" (as identified below) is correct.
        *   If applicable, discuss common misunderstandings or why other options might seem plausible but are incorrect.
        *   Aim for an educational, in-depth explanation as one might find in a textbook or a dedicated study resource. Make it easy to understand but comprehensive.
        *   Use clear language, and structure the explanation logically. You can use markdown for formatting if it helps clarity (e.g., bullet points within the explanation string), but the overall output must be a single JSON object matching the schema.

Here are the questions to address:
{{#each incorrectQuestions}}
Question: {{this.question}}
Options: {{#each this.options}} ({{@index}}) {{this}} {{/each}}
Correct Answer: {{this.correctAnswerText}}
Student's Answer: {{this.studentAnswerText}}
---
{{/each}}

Focus on providing high-quality, helpful explanations for the "detailedExplanation" field in each section.
Ensure the "correctAnswer" field in your output sections matches the "Correct Answer" text provided above for each question.
Ensure the "studentAnswer" field in your output sections matches the "Student's Answer" text provided above for each question.
Ensure the output is a single, valid JSON object adhering to the RevisitMaterialOutputSchema.
`,
});


const generateRevisitMaterialFlow = ai.defineFlow(
  {
    name: 'generateRevisitMaterialFlow',
    inputSchema: RevisitMaterialInputSchema, // Input to the flow function is the original type
    outputSchema: RevisitMaterialOutputSchema,
  },
  async (processedInput): Promise<RevisitMaterialOutput> => { // 'processedInput' here is what we prepared earlier
    const {output} = await generateRevisitMaterialPrompt(processedInput);
    if (!output) {
      throw new Error('AI failed to generate revisit material.');
    }
    
    // Post-processing to ensure schema alignment if AI deviates slightly, especially for studentAnswer
    output.sections.forEach((section, index) => {
      const originalQuestionData = processedInput.incorrectQuestions[index];
      if (originalQuestionData) {
        // Ensure the AI uses the pre-calculated correct answer text
        if (section.correctAnswer !== originalQuestionData.correctAnswerText) {
            // console.warn(`AI deviated on correct answer for question: "${section.question}". Forcing correct text.`);
            section.correctAnswer = originalQuestionData.correctAnswerText!;
        }
        // Ensure the AI uses the pre-calculated student answer text, especially "Skipped"
        if (section.studentAnswer !== originalQuestionData.studentAnswerText) {
             // console.warn(`AI deviated on student answer for question: "${section.question}". Forcing text.`);
            section.studentAnswer = originalQuestionData.studentAnswerText!;
        }
         // If AI makes studentAnswer null for a skipped question, ensure it's "Skipped"
        if (originalQuestionData.studentAnswerIndex === null && section.studentAnswer === null) {
            section.studentAnswer = "Skipped";
        }
      }
    });
    return output;
  }
);

