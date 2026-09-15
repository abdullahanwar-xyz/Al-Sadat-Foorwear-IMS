import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import NotAuthorized from "@/pages/not-authorized";

interface ProtectedRouteProps {
  roles: string[];
  children: ReactNode;
}

// Gates a route by role, on top of the outer isAuthenticated check in
// App.tsx. Renders the Not Authorized page instead of the route's content
// when the logged-in user's role isn't in `roles` - this is what actually
// stops a restricted user from reaching a page by typing its URL directly,
// not just hiding the nav link to it.
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { hasRole } = useAuth();

  if (!hasRole(roles)) {
    return <NotAuthorized />;
  }

  return <>{children}</>;
}
