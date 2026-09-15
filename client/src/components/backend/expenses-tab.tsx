import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseAPI, EXPENSE_CATEGORIES } from "@/service/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Filter, Calendar, TrendingUp, Trash2 } from "lucide-react";
import { formatPKR } from "@/utils/currency";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseModal } from "@/components/backend";

export function ExpensesTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses with filters
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["expenses", selectedCategory, startDate, endDate],
    queryFn: async () => {
      const filters: any = {};
      if (selectedCategory !== "all") filters.category = selectedCategory;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      const result = await expenseAPI.getAll(filters);
      return result.data;
    },
  });

  // Fetch expense statistics
  const { data: statsData } = useQuery({
    queryKey: ["expense-stats", startDate, endDate],
    queryFn: async () => {
      const filters: any = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      const result = await expenseAPI.getStats(filters);
      return result.data;
    },
  });

  // Fetch expenses by category
  const { data: categoryData } = useQuery({
    queryKey: ["expense-by-category", startDate, endDate],
    queryFn: async () => {
      const filters: any = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      const result = await expenseAPI.getByCategory(filters);
      return result.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
      queryClient.invalidateQueries({ queryKey: ["expense-by-category"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flows"] });
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
      setDeleteExpenseId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete expense",
        variant: "destructive",
      });
      setDeleteExpenseId(null);
    },
  });

  const expenses = expensesData || [];
  const stats = statsData || { total_expenses: 0, total_count: 0, average_expense: 0 };

  // Filter expenses by search term
  const filteredExpenses = expenses.filter(
    (expense) =>
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatPKR(stats.total_expenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_count} expense(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPKR(stats.average_expense)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {categoryData && categoryData.length > 0
                  ? categoryData[0].category
                  : "—"}
              </div>
              {categoryData && categoryData.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPKR(categoryData[0].total_amount)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Expenses List</span>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>

            {/* Expenses Table */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <p className="text-muted-foreground">Loading expenses...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="mt-4 text-lg font-medium">No expenses found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || selectedCategory !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by adding your first expense"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.expense_id}>
                        <TableCell>
                          {format(new Date(expense.expense_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge>{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.description || "—"}
                        </TableCell>
                        <TableCell>{expense.payment_method || "—"}</TableCell>
                        <TableCell>{expense.reference_number || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatPKR(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteExpenseId(expense.expense_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddExpenseModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

      <AlertDialog open={deleteExpenseId !== null} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the expense and reverse its effect on the bank/cash
              balance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseId && deleteMutation.mutate(deleteExpenseId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
