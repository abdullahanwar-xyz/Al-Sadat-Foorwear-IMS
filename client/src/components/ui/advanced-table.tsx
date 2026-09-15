import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown
} from "lucide-react";

interface Column<T> {
  id: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
}

interface AdvancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  className?: string;
  pageSize?: number;
  showPagination?: boolean;
  onRowClick?: (item: T) => void;
}

export function AdvancedTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  className,
  pageSize = 10,
  showPagination = true,
  onRowClick
}: AdvancedTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (search) {
      filtered = filtered.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(item =>
          String(item[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    return filtered;
  }, [data, search, filters]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: keyof T) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc"
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleFilterChange = (columnId: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [columnId]: value
    }));
    setCurrentPage(1);
  };

  const getSortIcon = (columnId: keyof T) => {
    if (sortConfig?.key === columnId) {
      return sortConfig.direction === "asc" ? 
        <ChevronLeft className="h-4 w-4" /> : 
        <ChevronRight className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Quick filters for filterable columns */}
        <div className="flex gap-2">
          {columns
            .filter(col => col.filterable)
            .map(col => (
              <Input
                key={String(col.id)}
                placeholder={`Filter ${col.label}`}
                value={filters[String(col.id)] || ""}
                onChange={(e) => handleFilterChange(String(col.id), e.target.value)}
                className="w-32"
              />
            ))}
        </div>
      </div>

      {/* Table */}
      {/* This div is a bounded-height scroll container on both axes on
          purpose, not just overflow-x: per the CSS overflow spec, setting
          only overflow-x to a non-"visible" value silently promotes
          overflow-y's "visible" to "auto" too (there's no way to opt out of
          that on the same element), so this div was already an unbounded
          vertical scroll container even when it only intended horizontal
          scrolling - the sticky <thead> below was sticking to ITS top,
          which never moved, since nothing forced this div to actually
          scroll internally. Giving it a real max-height makes that
          scrolling genuine, which is what makes the sticky header work. */}
      <div className="border border-slate-200 rounded-lg">
        <div className="overflow-auto rounded-lg max-h-[70vh]">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600">
              <tr>
                {columns.map(column => (
                  <th
                    key={String(column.id)}
                    className={cn(
                      "px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider",
                      column.sortable && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 group",
                      column.className
                    )}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{column.label}</span>
                      {column.sortable && getSortIcon(column.id)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-600">
              {paginatedData.map((item, index) => (
                <tr
                  key={index}
                  className={cn(
                    "hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map(column => (
                    <td
                      key={String(column.id)}
                      className={cn(
                        "px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100",
                        column.className
                      )}
                    >
                      {column.render 
                        ? column.render(item[column.id], item)
                        : String(item[column.id] || '-')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {paginatedData.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No data found
          </div>
        )}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Showing {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} to{" "}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
          </p>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  const distance = Math.abs(page - currentPage);
                  return distance <= 1 || page === 1 || page === totalPages;
                })
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="text-slate-400 dark:text-slate-500">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </React.Fragment>
                ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}