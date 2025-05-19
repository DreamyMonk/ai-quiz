
'use server';
/**
 * @fileOverview Analyzes a camera feed snapshot for potential proctoring anomalies.
 *
 * - analyzeCameraFeed - A function that takes an image data URI and returns detected anomalies.
 * - AnalyzeCameraFeedInput - The input type.
 * - AnalyzeCameraFeedOutput - The output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCameraFeedInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A snapshot from the camera feed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeCameraFeedInput = z.infer<typeof AnalyzeCameraFeedInputSchema>;

const AnalyzeCameraFeedOutputSchema = z.object({
  isBookDetected: z.boolean().describe('True if a book is clearly visible in the image, otherwise false.'),
  isPhoneDetected: z.boolean().describe('True if a mobile phone is clearly visible and potentially in use, otherwise false.'),
  isLookingAway: z.boolean().describe('True if the person in the image appears to be consistently looking away from the screen area, otherwise false.'),
  isHumanDetected: z.boolean().describe('True if a human face is clearly visible and appears to be the primary subject engaging with the exam. False if no human is clearly visible, or if the image is of an empty chair, ceiling, etc.'),
  anomalyReason: z.string().optional().describe('A brief explanation if any anomaly is detected (e.g., "Book detected on desk", "User looking to the side", "No human detected"). Empty if no clear anomaly.')
});
export type AnalyzeCameraFeedOutput = z.infer<typeof AnalyzeCameraFeedOutputSchema>;

export async function analyzeCameraFeed(input: AnalyzeCameraFeedInput): Promise<AnalyzeCameraFeedOutput> {
  return analyzeCameraFeedFlow(input);
}

const proctoringPrompt = ai.definePrompt({
  name: 'analyzeCameraFeedPrompt',
  input: {schema: AnalyzeCameraFeedInputSchema},
  output: {schema: AnalyzeCameraFeedOutputSchema},
  prompt: `You are an AI assistant helping with basic exam proctoring by analyzing an image from a user's webcam.
  Image to analyze: {{media url=imageDataUri}}

  Analyze the provided image and determine the following:
  1.  isBookDetected: Is there a physical book clearly visible in the user's immediate surroundings (e.g., on the desk, in hand)?
  2.  isPhoneDetected: Is there a mobile phone clearly visible and potentially being used or looked at by the user?
  3.  isLookingAway: Does the user appear to be significantly looking away from the general direction of the computer screen for an extended period? (This is a general assessment, not precise eye-tracking).
  4.  isHumanDetected: Is a human face clearly visible and appears to be the primary subject actively engaging with the exam setup? If no human is clearly visible (e.g., empty chair, looking at ceiling, only a partial non-facial body part), set this to false.

  Provide your analysis in the specified JSON output format.
  If 'isHumanDetected' is false, this is the primary anomaly; set 'anomalyReason' to "No human detected" or "Human presence unclear".
  If 'isHumanDetected' is true, and other anomalies (book, phone, looking away) are detected, provide a brief, neutral 'anomalyReason' for those (e.g., "Book detected on desk", "User looking to the side", "Phone visible in hand"). If multiple anomalies, list the most prominent one or a combined short reason.
  If no clear anomalies are detected (human present, no book/phone/looking away), the booleans should be false (except isHumanDetected=true) and anomalyReason can be empty or "No clear anomalies detected".

  Focus on clear, unambiguous visual evidence. If unsure about book/phone/looking away, err on the side of not reporting an anomaly for that specific category. If unsure about human presence, prioritize accuracy for 'isHumanDetected'.
  `,
  config: { 
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
});

const analyzeCameraFeedFlow = ai.defineFlow(
  {
    name: 'analyzeCameraFeedFlow',
    inputSchema: AnalyzeCameraFeedInputSchema,
    outputSchema: AnalyzeCameraFeedOutputSchema,
  },
  async (input) => {
    const {output} = await proctoringPrompt(input);
    if (!output) {
      console.warn('AI did not return an output for camera feed analysis.');
      return {
        isBookDetected: false,
        isPhoneDetected: false,
        isLookingAway: false,
        isHumanDetected: false, // Default to false if AI fails
        anomalyReason: "AI analysis failed or returned no output."
      };
    }
    // Prioritize isHumanDetected anomaly reason
    if (!output.isHumanDetected) {
        output.anomalyReason = output.anomalyReason || "No human detected or presence unclear.";
    } else if ((output.isBookDetected || output.isPhoneDetected || output.isLookingAway) && !output.anomalyReason) {
        let reasons = [];
        if (output.isBookDetected) reasons.push("Book detected");
        if (output.isPhoneDetected) reasons.push("Phone detected");
        if (output.isLookingAway) reasons.push("User looking away");
        output.anomalyReason = reasons.join(', ') || "Anomaly detected";
    } else if (output.isHumanDetected && !output.isBookDetected && !output.isPhoneDetected && !output.isLookingAway && !output.anomalyReason) {
        output.anomalyReason = "No clear anomalies detected.";
    }
    return output;
  }
);
