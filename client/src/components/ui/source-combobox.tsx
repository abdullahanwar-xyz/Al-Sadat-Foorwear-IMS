import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { onlineOrderSourceAPI } from "@/service/api";

interface SourceComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

// Mirrors CollectionCombobox's UI exactly, but backed by a real manageable
// list (OnlineOrderSource) instead of values derived from existing records -
// "+ Add new source" persists it via the API (self-service, same as anyone
// typing a new collection), so it's available to everyone next time too.
// Admins can additionally remove sources from Settings.
export function SourceCombobox({ value, onChange }: SourceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: sources } = useQuery({
    queryKey: ["/api/online-order-sources"],
    queryFn: () => onlineOrderSourceAPI.getAll(),
  });

  const existingSources = useMemo(
    () => (sources || []).map((s) => s.value).sort((a, b) => a.localeCompare(b)),
    [sources]
  );

  const trimmedSearch = search.trim();
  const searchMatchesExisting = existingSources.some(
    (s) => s.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const filteredSources = existingSources.filter((s) =>
    s.toLowerCase().includes(trimmedSearch.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (newValue: string) => onlineOrderSourceAPI.create(newValue),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/online-order-sources"] });
      onChange(created.value);
      setSearch("");
      setOpen(false);
    },
  });

  const handleSelect = (source: string) => {
    onChange(source);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal capitalize"
        >
          <span className={cn("capitalize", !value && "text-muted-foreground normal-case")}>
            {value || "Select or add a source..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new source..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Type to add your first source.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {filteredSources.map((source) => (
                <CommandItem key={source} value={source} onSelect={() => handleSelect(source)}>
                  <Check className={cn("mr-2 h-4 w-4", value === source ? "opacity-100" : "opacity-0")} />
                  <span className="capitalize">{source}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmedSearch && !searchMatchesExisting && (
              <CommandGroup>
                <CommandItem
                  value={`__add-new__${trimmedSearch}`}
                  disabled={createMutation.isPending}
                  onSelect={() => createMutation.mutate(trimmedSearch)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? "Adding..." : `Add new source: "${trimmedSearch}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
