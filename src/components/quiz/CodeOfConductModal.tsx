
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck } from "lucide-react";

interface CodeOfConductModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CodeOfConductModal({ isOpen, onOpenChange }: CodeOfConductModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <ShieldCheck className="mr-2 h-6 w-6 text-primary" />
            Our Commitment to Integrity
          </DialogTitle>
          <DialogDescription className="pt-2 text-base">
            Understanding Academic Honesty for a Fair Assessment
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
        <div className="space-y-4 py-4 text-sm text-muted-foreground">
          <p>
            At AI Quiz Maker, we believe in the power of fair assessment and genuine learning. Academic integrity is crucial for your personal growth and for maintaining the value of this educational tool.
          </p>
          <h4 className="font-semibold text-foreground">Why is Cheating Detrimental?</h4>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>
              <strong>Undermines Learning:</strong> Cheating prevents you from truly understanding the material and identifying areas where you need to improve. The goal is to learn, not just to get a score.
            </li>
            <li>
              <strong>Devalues Effort:</strong> It disrespects your own potential and the hard work of others who engage honestly.
            </li>
            <li>
              <strong>Inaccurate Assessment:</strong> Results obtained through dishonest means do not reflect your actual knowledge or skills, making it difficult to gauge your progress.
            </li>
            <li>
              <strong>Impacts Trust:</strong> Maintaining integrity builds trust in your abilities and character.
            </li>
          </ul>
          <h4 className="font-semibold text-foreground">Your Agreement:</h4>
          <p>
            By proceeding with this quiz, you agree to uphold the principles of academic honesty. This includes:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>Completing the quiz independently, relying on your own knowledge.</li>
            <li>Not using unauthorized notes, websites, AI assistance (other than what's part of this tool's learning features), or help from others during the quiz.</li>
            <li>Not sharing quiz questions or answers with others.</li>
          </ul>
          <p className="font-semibold text-foreground">
            Let's make this a fair and valuable learning experience for everyone.
          </p>
        </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>I Understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
