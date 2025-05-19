
"use client";

import type { McqQuestion } from '@/types/quiz';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, Send, SkipForward } from 'lucide-react';

interface QuestionDisplayProps {
  questionNumber: number;
  totalQuestions: number;
  question: McqQuestion;
  selectedOption: number | null;
  onOptionSelect: (optionIndex: number) => void;
  onNext: () => void;
  onSkip: () => void;
  onSubmit: () => void;
  isLastQuestion: boolean;
  isSubmitting: boolean;
  isDisabled?: boolean;
}

export function QuestionDisplay({
  questionNumber,
  totalQuestions,
  question,
  selectedOption,
  onOptionSelect,
  onNext,
  onSkip,
  onSubmit,
  isLastQuestion,
  isSubmitting,
  isDisabled = false,
}: QuestionDisplayProps) {
  const trulyDisabled = isSubmitting || isDisabled;

  return (
    <Card className={`w-full shadow-lg ${trulyDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <CardHeader>
        <CardDescription className="text-base">
          Question {questionNumber} of {totalQuestions}
        </CardDescription>
        <CardTitle className="text-2xl leading-relaxed">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedOption !== null ? String(selectedOption) : undefined}
          onValueChange={(value) => onOptionSelect(Number(value))}
          className="space-y-3"
          disabled={trulyDisabled}
        >
          {question.options.map((option, index) => (
            <Label
              key={index}
              htmlFor={`option-${index}`}
              className={`flex items-center space-x-3 p-4 border rounded-lg transition-all
                ${selectedOption === index ? 'bg-primary/10 border-primary ring-2 ring-primary' : 'hover:bg-secondary/80'}
                ${trulyDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              <RadioGroupItem value={String(index)} id={`option-${index}`} disabled={trulyDisabled} />
              <span className="text-base">{option}</span>
            </Label>
          ))}
        </RadioGroup>
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
          <Button
            onClick={onSkip}
            variant="outline"
            size="lg"
            disabled={trulyDisabled}
            className="w-full sm:w-auto"
          >
            <SkipForward className="mr-2 h-5 w-5" />
            Skip
          </Button>
          {isLastQuestion ? (
            <Button
              onClick={onSubmit}
              size="lg"
              disabled={trulyDisabled} // Removed selectedOption === null check here
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-5 w-5" />
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button
              onClick={onNext}
              size="lg"
              disabled={selectedOption === null || trulyDisabled}
              className="w-full sm:w-auto"
            >
              Next Question
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
