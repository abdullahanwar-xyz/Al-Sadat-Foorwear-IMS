import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  ArrowLeft,
  Landmark,
  BarChart3,
  UserCog,
  CreditCard,
  Wallet2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/backend",
  },
  {
    title: "Suppliers",
    icon: Users,
    href: "/backend/suppliers",
  },
  {
    title: "Transactions",
    icon: Receipt,
    href: "/backend/transactions",
  },
  {
    title: "Banking",
    icon: Landmark,
    href: "/backend/banking",
  },
  {
    title: "Business Reports",
    icon: FileText,
    href: "/backend/reports",
  },
  {
    title: "Sales Reports",
    icon: BarChart3,
    href: "/backend/sales-reports",
  },
  {
    title: "Daily Cash Summary",
    icon: Wallet2,
    href: "/backend/daily-cash-summary",
  },
  {
    title: "Users",
    icon: UserCog,
    href: "/backend/users",
  },
  {
    title: "Payment Methods",
    icon: CreditCard,
    href: "/backend/payment-methods",
  },
];

export function BackendSidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="border-b p-6">
        <Link href="/">
          <a className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Shop
          </a>
        </Link>
        <h2 className="mt-4 text-xl font-bold">Accounts & Finance</h2>
        <p className="text-sm text-muted-foreground">Financial Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium">Currency</p>
          <p className="text-sm font-bold">PKR (₨)</p>
        </div>
      </div>
    </div>
  );
}
