import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, ChevronDown, Menu, Box, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "../../hooks/use-toast";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
    setLocation("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Box className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span className="font-sora font-semibold text-lg text-slate-800 dark:text-slate-100">
              Al Sadat Footwear
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={() => setIsNotificationsOpen((open) => !open)}
            >
              <Bell className="h-5 w-5" />
            </Button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50 animate-slide-down">
                <div className="p-3 border-b border-gray-200 dark:border-slate-600">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Notifications
                  </p>
                </div>
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No notifications yet
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileMenuRef}>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            >
              <div className="w-7 h-7 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user ? getInitials(user.user_name) : "?"}
                </span>
              </div>
              <span className="text-sm font-medium hidden md:block">
                {user?.user_name || "Guest"}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50 animate-slide-down">
                <div className="p-3 border-b border-gray-200 dark:border-slate-600">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.user_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {user?.user_type}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    @{user?.user_username}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                    onClick={() => setLocation("/settings")}
                  >
                    <UserIcon className="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
  