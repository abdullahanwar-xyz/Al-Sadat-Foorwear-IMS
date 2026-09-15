import { BackendLayout } from "@/components/layout/backend-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionsTab, ExpensesTab } from "@/components/backend";
import { Receipt, Wallet } from "lucide-react";

export default function BackendTransactions() {
  return (
    <BackendLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions & Expenses</h1>
          <p className="text-muted-foreground">
            Record supplier purchases/payments and manage business expenses
          </p>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Expenses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <TransactionsTab />
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <ExpensesTab />
          </TabsContent>
        </Tabs>
      </div>
    </BackendLayout>
  );
}
