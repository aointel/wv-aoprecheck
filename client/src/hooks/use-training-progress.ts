import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

export type TrainingModule = {
  id: string;
  slug: string;
  section: string;
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  icon: string | null;
  isRequired: boolean;
  isSupport: boolean;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
};

export type TrainingSectionSummary = {
  id: string;
  title: string;
  requiredModules: number;
  requiredCompleted: number;
  completed: boolean;
};

export type TrainingProgressResponse = {
  success: boolean;
  modules: TrainingModule[];
  sections: TrainingSectionSummary[];
  completedSections: string[];
  userEmail?: string;
};

const QUERY_KEY = ["platform-training", "modules"];

export function useTrainingProgress() {
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;

  const modulesQuery = useQuery<TrainingProgressResponse>({
    queryKey: QUERY_KEY,
    enabled: !!userEmail,
    retry: 1,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/platform-training/modules",
        undefined,
        userEmail ?? undefined
      );
      return response.json();
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (options: { moduleSlug: string; completed?: boolean }) => {
      const response = await apiRequest(
        "POST",
        "/api/platform-training/progress",
        {
          moduleSlug: options.moduleSlug,
          completed: options.completed ?? true,
        },
        userEmail ?? undefined
      );
      return response.json();
    },
    onSuccess: (data: TrainingProgressResponse) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  const completedSections = useMemo(() => {
    return new Set(modulesQuery.data?.completedSections ?? []);
  }, [modulesQuery.data]);

  const isSectionComplete = (sectionId: string) => completedSections.has(sectionId);

  return {
    ...modulesQuery,
    completedSections,
    isSectionComplete,
    markModule: markCompleteMutation,
    userEmail: modulesQuery.data?.userEmail ?? userEmail ?? null,
  };
}


