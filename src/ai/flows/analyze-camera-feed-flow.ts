
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
  isHumanDetected: z.boolean().describe('True if a human face is clearly visible and appears to be the primary subject engaging with the exam. False if no human is clearly visible, the image is too dark/obscured, or if the camera is pointed at an irrelevant scene like a ceiling or empty chair.'),
  anomalyReason: z.string().optional().describe('A brief explanation if any anomaly is detected (e.g., "Book detected on desk", "User looking to the side", "No human detected", "Camera feed too dark/obscured", "Camera pointed away"). Empty if no clear anomaly.')
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
  1.  isHumanDetected: Is a human face clearly visible, well-lit, and appears to be the primary subject actively engaging with the exam setup?
      Set to 'false' if:
        a. No human face is clearly visible.
        b. The image is too dark, blurry, or obscured to reasonably identify a person.
        c. The camera is clearly pointing at something irrelevant to an active exam session (e.g., ceiling, wall, empty chair, only a pet).
  2.  isBookDetected: If a human is detected, is there a physical book clearly visible in the user's immediate surroundings (e.g., on the desk, in hand)?
  3.  isPhoneDetected: If a human is detected, is there a mobile phone clearly visible and potentially being used or looked at by the user?
  4.  isLookingAway: If a human is detected, does the user appear to be significantly looking away from the general direction of the computer screen for an extended period? (This is a general assessment, not precise eye-tracking).

  Provide your analysis in the specified JSON output format.

  Regarding 'anomalyReason':
  *   If 'isHumanDetected' is false, this is the primary anomaly. Set 'anomalyReason' to explain why (e.g., "No human detected", "Camera feed too dark or obscured", "Camera pointed away from user", "Human presence unclear").
  *   If 'isHumanDetected' is true, but other anomalies (book, phone, looking away) are detected, provide a brief, neutral 'anomalyReason' for those (e.g., "Book detected on desk", "User looking to the side", "Phone visible in hand"). If multiple anomalies, list the most prominent one or a combined short reason.
  *   If 'isHumanDetected' is true and no other clear anomalies are detected, the other booleans should be false, and 'anomalyReason' can be empty or "No clear anomalies detected."

  Focus on clear, unambiguous visual evidence. If unsure about book/phone/looking away when a human is present, err on the side of not reporting an anomaly for that specific category. Prioritize accuracy for 'isHumanDetected' based on the criteria above.
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
        isHumanDetected: false, 
        anomalyReason: "AI analysis failed or returned no output."
      };
    }
    
    // Ensure anomalyReason is set if isHumanDetected is false
    if (!output.isHumanDetected && !output.anomalyReason) {
        output.anomalyReason = "No human detected or camera feed issue.";
    } else if (output.isHumanDetected) {
        // If human is detected, but other anomalies exist and no reason is given, create one.
        if ((output.isBookDetected || output.isPhoneDetected || output.isLookingAway) && !output.anomalyReason) {
            let reasons = [];
            if (output.isBookDetected) reasons.push("Book detected");
            if (output.isPhoneDetected) reasons.push("Phone detected");
            if (output.isLookingAway) reasons.push("User looking away");
            output.anomalyReason = reasons.join(', ') || "Potential anomaly detected.";
        } else if (!output.isBookDetected && !output.isPhoneDetected && !output.isLookingAway && !output.anomalyReason) {
            // Human detected, no other issues, no reason provided.
            output.anomalyReason = "No clear anomalies detected.";
        }
    }
    return output;
  }
);

