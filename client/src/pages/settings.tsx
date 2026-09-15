import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Settings as SettingsIcon, Tags, Plus, Trash2 } from "lucide-react";
import { onlineOrderSourceAPI } from "@/service/api";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSource, setNewSource] = useState("");

  const { data: sources, isLoading } = useQuery({
    queryKey: ["/api/online-order-sources"],
    queryFn: () => onlineOrderSourceAPI.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (value: string) => onlineOrderSourceAPI.create(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/online-order-sources"] });
      setNewSource("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add source", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => onlineOrderSourceAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/online-order-sources"] });
      toast({ title: "Source removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove source", description: error?.response?.data?.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    const trimmed = newSource.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleDelete = (id: number, value: string) => {
    if (window.confirm(`Remove "${value}" from the list of Online Order sources? Existing orders already using it are unaffected.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-poppins font-bold text-gray-800 mb-2">
          Settings
        </h1>
        <p className="text-gray-600">Configure application settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-poppins flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Online Order Sources
          </CardTitle>
          <p className="text-sm text-gray-500">
            Manage the channels offered on the Online Orders form (Instagram, TikTok, WhatsApp, Shopify, or anything else you sell through).
            Removing one only affects what's offered going forward — orders already placed keep their original source.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="e.g. Facebook"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newSource.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {!isLoading && (!sources || sources.length === 0) && (
              <p className="text-sm text-gray-500">No sources configured yet.</p>
            )}
            {sources?.map((source) => (
              <Badge key={source.id} variant="outline" className="flex items-center gap-2 py-1.5 px-3 text-sm capitalize">
                {source.value}
                <button
                  type="button"
                  onClick={() => handleDelete(source.id, source.value)}
                  className="text-red-500 hover:text-red-700"
                  title={`Remove ${source.value}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-16 text-center">
          <SettingsIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            More Settings Coming Soon
          </h3>
          <p className="text-gray-600">
            Additional application settings and configuration options will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
