
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentQuizzesByUserId } from '@/services/quizService';
import type { GeneratedQuizData } from '@/types/quiz';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ListX, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export function QuizHistorySidebarContent() {
  const { user } = useAuth();
  const [recentQuizzes, setRecentQuizzes] = useState<GeneratedQuizData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      setIsLoading(true);
      setError(null);
      getRecentQuizzesByUserId(user.uid, 15)
        .then(quizzes => {
          setRecentQuizzes(quizzes);
        })
        .catch(err => {
          console.error("Error fetching recent quizzes:", err);
          setError(err.message || "Failed to load quiz history.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setRecentQuizzes([]); // Clear if user logs out
    }
  }, [user?.uid]);

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2 text-lg font-semibold text-sidebar-primary">
          <History className="h-6 w-6" />
          <span>Recent Quizzes</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <ScrollArea className="h-full">
          <div className="p-2">
            {isLoading && (
              <SidebarMenu>
                {[...Array(5)].map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
            {!isLoading && error && (
              <div className="p-4 text-center text-destructive">
                <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {!isLoading && !error && recentQuizzes.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <ListX className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No quizzes taken in the last 15 days.</p>
              </div>
            )}
            {!isLoading && !error && recentQuizzes.length > 0 && (
              <SidebarMenu>
                {recentQuizzes.map(quiz => (
                  <SidebarMenuItem key={quiz.id}>
                    <Link href={`/exam/${quiz.id}`} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        className="w-full justify-start"
                        tooltip={`Topic: ${quiz.topic}\nDate: ${quiz.createdAt ? format(quiz.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}\nQuestions: ${quiz.questions.length}`}
                      >
                        <a>
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium">{quiz.topic}</span>
                            {quiz.createdAt && (
                              <span className="text-xs text-sidebar-foreground/70">
                                {format(quiz.createdAt.toDate(), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>
    </>
  );
}
