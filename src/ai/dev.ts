import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-quiz-performance.ts';
import '@/ai/flows/generate-mcq-questions.ts';
import '@/ai/flows/generate-options-for-custom-question.ts';
