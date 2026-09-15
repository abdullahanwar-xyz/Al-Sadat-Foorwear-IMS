import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { productAPI } from "@/service/api";

interface CollectionComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

// Lists whatever collections already exist across current products, plus an
// "+ Add new collection" option to type a brand new one. `collection` is a
// plain string column with no fixed enum on the backend - this is purely a
// UI convenience over free text, so Inventory's Filter Collection and
// Dashboard keep working against whatever values actually exist without
// needing any list of their own to stay in sync.
export function CollectionCombobox({ value, onChange }: CollectionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => productAPI.getAll(),
  });

  const existingCollections = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p) => {
      if (p.collection && p.collection.trim()) set.add(p.collection.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const trimmedSearch = search.trim();
  const searchMatchesExisting = existingCollections.some(
    (c) => c.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const filteredCollections = existingCollections.filter((c) =>
    c.toLowerCase().includes(trimmedSearch.toLowerCase())
  );

  const handleSelect = (collection: string) => {
    onChange(collection);
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
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || "Select or add a collection..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new collection..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Type to add your first collection.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {filteredCollections.map((collection) => (
                <CommandItem key={collection} value={collection} onSelect={() => handleSelect(collection)}>
                  <Check className={cn("mr-2 h-4 w-4", value === collection ? "opacity-100" : "opacity-0")} />
                  {collection}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmedSearch && !searchMatchesExisting && (
              <CommandGroup>
                <CommandItem value={`__add-new__${trimmedSearch}`} onSelect={() => handleSelect(trimmedSearch)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add new collection: "{trimmedSearch}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
