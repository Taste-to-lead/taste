import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  subscriptionTier: string;
  organizationId: number | null;
  organizationName?: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
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
    isSuperAdmin: user?.isSuperAdmin ?? false,
    isAdmin: user?.isAdmin ?? false,
    isPremium: user?.subscriptionTier === "premium",
    organizationName: user?.organizationName ?? null,
  };
}
