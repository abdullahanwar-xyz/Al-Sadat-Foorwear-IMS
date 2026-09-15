import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  Home,
  Package,
  ArrowRightCircle,
  ShoppingCart,
  FileText,
  Truck,
  PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ADMIN_ROLES, SALESMAN_ROLES, PRODUCT_ENTRY_ROLES } from "@/lib/roles";

interface SidebarProps {
  isCollapsed: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home, roles: ADMIN_ROLES },
  { name: "Inventory", href: "/inventory", icon: Package, roles: PRODUCT_ENTRY_ROLES },
  { name: "Record Sale", href: "/record-sale", icon: ShoppingCart, roles: SALESMAN_ROLES },
  { name: "Invoices", href: "/invoices", icon: FileText, roles: SALESMAN_ROLES },
  { name: "Online Orders", href: "/online-orders", icon: Truck, roles: SALESMAN_ROLES },
  { name: "Online Invoices", href: "/online-invoices", icon: PackageSearch, roles: SALESMAN_ROLES },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const { hasRole } = useAuth();

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter((item) => {
    if (item.roles.length === 0) return true; // Show to all users
    return hasRole(item.roles);
  });

  return (
    <aside
      className={cn(
        "bg-white dark:bg-slate-900 shadow-lg min-h-screen transition-all duration-300 border-r border-slate-200 dark:border-slate-700",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("p-4", isCollapsed ? "p-2" : "p-6")}>
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer group",
                    isActive
                      ? "bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/50 dark:to-blue-900/50 text-indigo-600 dark:text-indigo-400 border-r-3 border-indigo-600 dark:border-indigo-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    isCollapsed ? "mx-auto" : ""
                  )} />
                  {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Accounts & Finance Link - Only for Admins and Owners */}
        {hasRole(["ShopOwner", "SuperAdmin"]) && (
          <>
            <Separator className="my-4" />
            <Link href="/backend">
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start gap-3 border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 hover:border-orange-400 dark:hover:border-orange-600",
                  isCollapsed ? "px-2" : ""
                )}
                title={isCollapsed ? "Accounts & Finance" : undefined}
              >
                <ArrowRightCircle className={cn("h-5 w-5", isCollapsed ? "mx-auto" : "")} />
                {!isCollapsed && <span className="text-sm font-semibold">Accounts & Finance</span>}
              </Button>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
