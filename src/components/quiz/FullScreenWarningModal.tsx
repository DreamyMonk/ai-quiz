
"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, MonitorPlay, LogOut } from "lucide-react";

interface FullScreenWarningModalProps {
  isOpen: boolean;
  onReturnToFullScreen: () => void;
  onEndExam: () => void;
  countdown?: number; // Optional: if you want to show a countdown
}

export function FullScreenWarningModal({
  isOpen,
  onReturnToFullScreen,
  onEndExam,
  countdown,
}: FullScreenWarningModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={() => { /* Controlled externally */ }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-2xl text-center">
            Exited Fullscreen Mode
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base py-2">
            To continue the exam, you must return to fullscreen mode.
            The exam is currently paused, but the timer is still running.
            {countdown !== undefined && countdown > 0 && (
              <p className="font-semibold mt-2">
                Action required within {countdown} seconds.
              </p>
            )}
             {countdown !== undefined && countdown === 0 && (
              <p className="font-semibold mt-2 text-destructive">
                Time limit to return to fullscreen exceeded. Please choose an option.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4">
          <Button
            onClick={onReturnToFullScreen}
            className="w-full"
            size="lg"
          >
            <MonitorPlay className="mr-2" />
            Return to Fullscreen
          </Button>
          <Button
            onClick={onEndExam}
            variant="destructive"
            className="w-full"
            size="lg"
          >
             <LogOut className="mr-2" />
            End Exam
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
