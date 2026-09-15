import { useState, useEffect } from "react";
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
import { Edit, Plus, Minus, X, Image as ImageIcon } from "lucide-react";
import { productAPI, uploadAPI, resolveUploadUrl } from "@/service/api";

interface Product {
  id: number;
  name: string;
  thickness: string;
  collection: string;
  commission_percentage?: number;
  colorRates: {
    id: number;
    color: string;
    rate: number;
    imageUrl?: string | null;
    sizes?: {
      id: number;
      size: number;
      quantity: number;
      unit: string;
    }[];
  }[];
}

interface UpdateProductModalProps {
  product: Product;
  trigger?: React.ReactNode;
}

const defaultSizeTemplate = () =>
  [6, 7, 8, 9, 10, 11, 12].map((size) => ({ size: size.toString(), quantity: "", unit: "pair" }));

function colorRatesFromProduct(product: Product) {
  if (!product.colorRates || product.colorRates.length === 0) {
    return [{ color: "Standard", rate: "", imageUrl: "", sizes: defaultSizeTemplate() }];
  }

  return product.colorRates.map((cr) => ({
    color: cr.color,
    rate: cr.rate.toString(),
    imageUrl: cr.imageUrl || "",
    sizes: cr.sizes && cr.sizes.length > 0
      ? cr.sizes.map((size) => ({
          size: size.size.toString(),
          quantity: size.quantity.toString(),
          unit: size.unit
        }))
      : defaultSizeTemplate()
  }));
}

// The Product model still has a required "thickness" column left over from
// the aluminum-shop schema. It's no longer collected in the UI; since this is
// an existing product we simply leave its stored value untouched on update.
export function UpdateProductModal({ product, trigger }: UpdateProductModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: product.id,
    name: product.name,
    collection: product.collection || "",
  });

  const [colorRates, setColorRates] = useState(colorRatesFromProduct(product));
  const [uploadingColorIndex, setUploadingColorIndex] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update the form data and color rates when the product prop changes
  useEffect(() => {
    setFormData({
      id: product.id,
      name: product.name,
      collection: product.collection || "",
    });
    setColorRates(colorRatesFromProduct(product));
  }, [product]);

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

  const updateProductMutation = useMutation({
    mutationFn: (data: typeof formData & { colorRates: typeof colorRates }) => {
      // Filter out color rates with empty values and process sizes
      const validColorRates = data.colorRates
        .filter(cr => cr.rate)
        .map(cr => ({
          color: data.colorRates.length > 1 ? cr.color : (cr.color || "Standard"),
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

      return productAPI.update(data.id, {
        name: data.name,
        collection: data.collection,
        colorRates: validColorRates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product updated successfully",
        description: "The product has been updated in your inventory.",
      });
      setOpen(false);
    },
    onError: (error) => {
      console.error("Error updating product:", error);
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
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

    updateProductMutation.mutate({ ...formData, colorRates });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto animate-slide-up">
        <DialogHeader>
          <DialogTitle className="font-sora">Update Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              disabled={updateProductMutation.isPending}
            >
              {updateProductMutation.isPending ? "Updating..." : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
