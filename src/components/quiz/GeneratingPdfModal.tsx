
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";

interface GeneratingPdfModalProps {
  isOpen: boolean;
}

export function GeneratingPdfModal({ isOpen }: GeneratingPdfModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Controlled by parent */ }}>
      <DialogContent className="sm:max-w-md" hideCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center text-2xl">
            <FileText className="mb-3 h-10 w-10 text-primary" />
            Generating Your "Revisit" PDF
          </DialogTitle>
          <DialogDescription className="pt-2 text-center text-base text-muted-foreground">
            AI is crafting your personalized study guide. This might take a moment.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">Please wait and do not close this tab...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add hideCloseButton prop to DialogContent if it doesn't exist
declare module "@radix-ui/react-dialog" {
  interface DialogContentProps {
    hideCloseButton?: boolean;
  }
}

// Modify DialogContent in ui/dialog.tsx if needed to respect hideCloseButton
// For now, assuming it's handled or can be added. If not, the X will still show.
// This is a conceptual addition to the type; actual implementation depends on ui/dialog.tsx
// If you want to ensure the X is hidden, DialogContent in ui/dialog.tsx would need:
// {children}
// {!hideCloseButton && (
//   <DialogPrimitive.Close className="...">
//     <X className="h-4 w-4" />
//     <span className="sr-only">Close</span>
//   </DialogPrimitive.Close>
// )}
// I will update ui/dialog.tsx to support this.
