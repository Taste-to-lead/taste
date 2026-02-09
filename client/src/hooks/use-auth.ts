import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

type AuthUser = {
  id: number;
  email: string;
  name: string;
} | null;

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
  };
}
