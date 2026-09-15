import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AnimatedKPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
  className?: string;
  gradient?: "indigo" | "blue" | "slate" | "green" | "orange" | "purple";
  showBadge?: boolean;
  badgeText?: string;
}

const gradientStyles = {
  indigo: "from-indigo-500 to-blue-600",
  blue: "from-blue-500 to-blue-700",
  slate: "from-slate-500 to-slate-700",
  green: "from-green-500 to-green-600",
  orange: "from-orange-500 to-red-500",
  purple: "from-purple-500 to-purple-700"
};

export function AnimatedKPICard({
  title,
  value,
  icon,
  trend,
  subtitle,
  className,
  gradient = "indigo",
  showBadge = false,
  badgeText
}: AnimatedKPICardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "";
    if (trend > 0) return "text-green-500";
    if (trend < 0) return "text-red-500";
    return "text-gray-500";
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white shadow-lg border border-slate-200 transition-all duration-300 hover:shadow-xl hover:scale-105 group",
        className
      )}
    >
      {/* Gradient background overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity duration-300",
        gradientStyles[gradient]
      )} />
      
      {/* Content */}
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-3 rounded-lg bg-gradient-to-r",
            gradientStyles[gradient]
          )}>
            <div className="text-white">
              {icon}
            </div>
          </div>
          
          {showBadge && badgeText && (
            <div className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
              {badgeText}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-600">{title}</h3>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{value}</span>
            {trend !== undefined && (
              <div className="flex items-center space-x-1">
                {getTrendIcon()}
                <span className={cn("text-sm font-medium", getTrendColor())}>
                  {Math.abs(trend)}%
                </span>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
    </div>
  );
}