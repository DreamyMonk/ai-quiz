
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Handshake, ShieldCheck } from "lucide-react";

interface PledgeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export function PledgeModal({ isOpen, onConfirm }: PledgeModalProps) {
  // The modal should control its own open state based on the isOpen prop,
  // but not call onOpenChange, as confirmation is the only way out.
  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Modal is controlled by parent */ }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <ShieldCheck className="mr-2 h-7 w-7 text-primary" />
            Our Mutual Trust
          </DialogTitle>
          <DialogDescription className="pt-2 text-base text-muted-foreground">
            A quick moment to acknowledge our shared values before you begin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
          <p className="text-base">
            We've designed this AI Quiz Maker to be a helpful tool for learning and assessment. We trust that you'll use it with integrity.
          </p>
          <p className="text-base">
            Remember, the true value comes from your own honest effort. It's always better to skip a question or answer based on your current understanding than to compromise the learning process. This quiz is for you, and your genuine attempt is what matters most.
          </p>
          <p className="text-base font-semibold text-foreground">
            By starting this exam, you affirm your commitment to academic honesty.
          </p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onConfirm} size="lg" className="w-full sm:w-auto">
            <Handshake className="mr-2 h-5 w-5" />
            I Pledge & Start Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
