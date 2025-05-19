
"use client";

import { QuizClient } from '@/components/quiz/QuizClient';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function DynamicExamPage() {
  const params = useParams();
  const [quizId, setQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (params?.quizId) {
      setQuizId(Array.isArray(params.quizId) ? params.quizId[0] : params.quizId);
    }
  }, [params]);

  if (!quizId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Quiz ID...</p>
      </div>
    );
  }

  return <QuizClient quizId={quizId} />;
}
