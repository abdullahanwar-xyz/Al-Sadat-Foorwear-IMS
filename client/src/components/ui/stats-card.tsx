import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: "green" | "red" | "blue" | "purple";
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendColor = "green", 
  className 
}: StatsCardProps) {
  const trendColorClasses = {
    green: "text-green-600 bg-green-100",
    red: "text-red-600 bg-red-100",
    blue: "text-blue-600 bg-blue-100",
    purple: "text-purple-600 bg-purple-100"
  };

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-lg", `bg-${trendColor}-100`)}>
            {icon}
          </div>
          {trend && (
            <span className={cn("text-sm font-medium px-2 py-1 rounded-full", trendColorClasses[trendColor])}>
              {trend}
            </span>
          )}
        </div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </CardContent>
    </Card>
  );
}
