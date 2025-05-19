"use client";

import { useEffect, useState } from 'react';
import { TimerIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TimerDisplayProps {
  initialDurationSeconds: number;
  onTimeUp: () => void;
  isPaused: boolean;
}

export function TimerDisplay({ initialDurationSeconds, onTimeUp, isPaused }: TimerDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(initialDurationSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    if (isPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeUp, isPaused]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Card className="w-full md:w-auto shadow-md">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-center text-lg md:text-xl font-semibold text-primary">
          <TimerIcon className="mr-2 h-5 w-5 md:h-6 md:w-6" />
          <span>Time Left: </span>
          <span className="ml-1 tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
