import { Link } from "wouter";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getLandingPathForRole } from "@/lib/roles";

export default function NotAuthorized() {
  const { user } = useAuth();
  const homePath = getLandingPathForRole(user?.user_type);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Not Authorized</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Your account doesn't have permission to access this page. Contact an administrator if you
            believe this is a mistake.
          </p>

          <Link href={homePath}>
            <Button className="mt-6 gradient-primary text-white">Go to my home page</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
