import type { ReactNode } from "react";
import { BackendSidebar } from "./backend-sidebar";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";

interface BackendLayoutProps {
  children: ReactNode;
}

export function BackendLayout({ children }: BackendLayoutProps) {
  const { user } = useAuth();

  // Only SuperAdmin and ShopOwner can access backend
  if (!user || (user.user_type !== "SuperAdmin" && user.user_type !== "ShopOwner")) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <BackendSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
