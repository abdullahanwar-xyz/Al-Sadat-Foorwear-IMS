import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { CollectionCombobox } from "@/components/ui/collection-combobox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, X, Image as ImageIcon } from "lucide-react";
import { productAPI, uploadAPI, resolveUploadUrl, type CreateProductPayload } from "@/service/api";

interface AddProductModalProps {
  trigger?: React.ReactNode;
}

// The Product model still has a required "thickness" column left over from
// the aluminum-shop schema. It's no longer collected in the UI, so we send
// this fixed placeholder rather than migrating the column away.
const UNUSED_THICKNESS_PLACEHOLDER = "N/A";

const defaultSizeTemplate = () =>
  [6, 7, 8, 9, 10, 11, 12].map((size) => ({ size: size.toString(), quantity: "", unit: "pair" }));

const defaultColorRates = () => [
  { color: "Standard", rate: "", imageUrl: "", sizes: defaultSizeTemplate() },
];

export function AddProductModal({ trigger }: AddProductModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    collection: "",
  });

  // Color rates with their sizes. A single row starts out as an internal
  // "Standard" color (no name shown) until a second color is added.
  const [colorRates, setColorRates] = useState(defaultColorRates());
  const [uploadingColorIndex, setUploadingColorIndex] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProductMutation = useMutation({
    mutationFn: (productData: typeof formData & { colorRates: typeof colorRates }) => {
      // Create a payload with only the color rates that have values and their sizes
      const validColorRates = productData.colorRates
        .filter(cr => cr.rate)
        .map((cr) => ({
          color: productData.colorRates.length > 1 ? cr.color : (cr.color || "Standard"),
          rate: parseFloat(cr.rate.toString()),
          imageUrl: cr.imageUrl || undefined,
          sizes: (cr.sizes || [])
            .filter(s => s.quantity)
            .map(s => ({
              size: parseFloat(s.size.toString()),
              quantity: parseInt(s.quantity.toString()),
              unit: s.unit
            }))
        }));

      const payload: CreateProductPayload = {
        name: productData.name,
        thickness: UNUSED_THICKNESS_PLACEHOLDER,
        collection: productData.collection,
        colorRates: validColorRates
      };

      return productAPI.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product added successfully",
        description: "The new product has been added to your inventory.",
      });
      setOpen(false);
      setFormData({ name: "", collection: "" });
      setColorRates(defaultColorRates());
    },
    onError: (error) => {
      console.error("Error adding product:", error);
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.collection) {
      toast({
        title: "Collection required",
        description: "Please select a collection.",
        variant: "destructive",
      });
      return;
    }

    createProductMutation.mutate({ ...formData, colorRates });
  };

  // Helper function to update color name
  const updateColorName = (index: number, value: string) => {
    const updatedRates = [...colorRates];
    updatedRates[index].color = value;
    setColorRates(updatedRates);
  };

  // Helper function to update color rate
  const updateColorRate = (index: number, value: string) => {
    const updatedRates = [...colorRates];
    updatedRates[index].rate = value;
    setColorRates(updatedRates);
  };

  // Helper function to update size quantity - whole numbers only, no
  // decimals accepted at all (stock is counted in whole pairs).
  const updateSizeQuantity = (colorIndex: number, sizeIndex: number, value: string) => {
    const wholeNumberOnly = value.replace(/[^\d]/g, "");
    const updatedRates = [...colorRates];
    updatedRates[colorIndex].sizes[sizeIndex].quantity = wholeNumberOnly;
    setColorRates(updatedRates);
  };

  // Helper function to update size value
  const updateSizeValue = (colorIndex: number, sizeIndex: number, value: string) => {
    const updatedRates = [...colorRates];
    updatedRates[colorIndex].sizes[sizeIndex].size = value;
    setColorRates(updatedRates);
  };

  // Helper function to add new size
  const addNewSize = (colorIndex: number) => {
    const updatedRates = [...colorRates];
    updatedRates[colorIndex].sizes.push({ size: "", quantity: "", unit: "pair" });
    setColorRates(updatedRates);
  };

  // Helper function to remove size
  const removeSize = (colorIndex: number, sizeIndex: number) => {
    const updatedRates = [...colorRates];
    if (updatedRates[colorIndex].sizes.length > 1) {
      updatedRates[colorIndex].sizes.splice(sizeIndex, 1);
      setColorRates(updatedRates);
    }
  };

  // Helper function to add a new color row
  const addNewColor = () => {
    setColorRates([...colorRates, { color: "", rate: "", imageUrl: "", sizes: defaultSizeTemplate() }]);
  };

  // Helper function to remove a color row
  const removeColor = (colorIndex: number) => {
    if (colorRates.length > 1) {
      setColorRates(colorRates.filter((_, i) => i !== colorIndex));
    }
  };

  // Helper function to upload an image for a color row
  const handleImageUpload = async (colorIndex: number, file: File) => {
    setUploadingColorIndex(colorIndex);
    try {
      const { url } = await uploadAPI.uploadImage(file);
      const updatedRates = [...colorRates];
      updatedRates[colorIndex].imageUrl = url;
      setColorRates(updatedRates);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Image upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingColorIndex(null);
    }
  };

  // Helper function to remove an uploaded image for a color row
  const removeImage = (colorIndex: number) => {
    const updatedRates = [...colorRates];
    updatedRates[colorIndex].imageUrl = "";
    setColorRates(updatedRates);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add New Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto animate-slide-up">
        <DialogHeader>
          <DialogTitle className="font-sora">Add New Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection">Collection</Label>
            <CollectionCombobox
              value={formData.collection}
              onChange={(collection) => setFormData({ ...formData, collection })}
            />
          </div>

          {/* Color rates and sizes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Color Rates & Sizes</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addNewColor}
                className="h-7 text-green-600 hover:text-green-800 hover:bg-green-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Color
              </Button>
            </div>
            <div className="space-y-4">
              {colorRates.map((colorRate, colorIndex) => (
                <div key={colorIndex} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    {colorRates.length > 1 && (
                      <Input
                        value={colorRate.color}
                        onChange={(e) => updateColorName(colorIndex, e.target.value)}
                        placeholder="Color name (e.g., Black)"
                        className="w-32 flex-shrink-0"
                      />
                    )}
                    <DecimalInput
                      value={colorRate.rate}
                      onChange={(e) => updateColorRate(colorIndex, e.target.value)}
                      placeholder="Rate"
                      className="flex-1"
                    />
                    {colorRates.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColor(colorIndex)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Photo for this color (internal admin use) */}
                  <div className="flex items-center gap-3">
                    {colorRate.imageUrl ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={resolveUploadUrl(colorRate.imageUrl)}
                          alt={colorRate.color || "Color"}
                          className="h-12 w-12 rounded-md object-cover border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(colorIndex)}
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center text-slate-400 flex-shrink-0">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <label className="flex-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Photo (optional)</span>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploadingColorIndex === colorIndex}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(colorIndex, file);
                          e.target.value = "";
                        }}
                        className="text-xs h-8"
                      />
                    </label>
                  </div>

                  {/* Sizes for this color */}
                  <div className="ml-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">Sizes & Quantities:</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addNewSize(colorIndex)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {colorRate.sizes.map((size, sizeIndex) => (
                        <div key={sizeIndex} className="flex items-center space-x-1 min-w-0">
                          <DecimalInput
                            value={size.size}
                            onChange={(e) => updateSizeValue(colorIndex, sizeIndex, e.target.value)}
                            placeholder="Size"
                            className="text-xs h-8 w-14 flex-shrink-0"
                          />
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            value={size.quantity}
                            onChange={(e) => updateSizeQuantity(colorIndex, sizeIndex, e.target.value)}
                            placeholder="Qty"
                            className="text-xs h-8 w-16 flex-shrink-0"
                          />
                          {colorRate.sizes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSize(colorIndex, sizeIndex)}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 flex-shrink-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gradient-primary text-white"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
