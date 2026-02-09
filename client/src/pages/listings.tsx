import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin, Bed, Bath, Ruler, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Property } from "@shared/schema";

const propertyFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(10000, "Price must be at least $10,000"),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  sqft: z.number().min(100, "Must be at least 100 sqft"),
  location: z.string().min(3, "Location is required"),
  images: z.array(z.string()).default([]),
  status: z.string().default("active"),
  vibe: z.string().default("modern"),
  agentId: z.string().default("agent-1"),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

function PropertyCard({ property, onEdit, onDelete }: {
  property: Property;
  onEdit: (p: Property) => void;
  onDelete: (p: Property) => void;
}) {
  const imgSrc = property.images?.[0] || "/images/property-1.png";

  return (
    <Card className="group overflow-visible backdrop-blur-xl bg-card/80 border-card-border transition-transform duration-300 hover:scale-[1.02]" data-testid={`card-property-${property.id}`}>
      <div className="relative overflow-hidden rounded-t-md">
        <img
          src={imgSrc}
          alt={property.title}
          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 right-3">
          <Badge variant={property.status === "active" ? "default" : "secondary"} data-testid={`badge-status-${property.id}`}>
            {property.status === "active" ? "Active" : "Sold"}
          </Badge>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          <p className="text-white font-bold text-xl">${property.price.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-base truncate" data-testid={`text-property-title-${property.id}`}>{property.title}</h3>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{property.location}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bed className="w-3.5 h-3.5" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-3.5 h-3.5" />
            <span>{property.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5" />
            <span>{property.sqft.toLocaleString()} sqft</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onEdit(property)} data-testid={`button-edit-${property.id}`}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(property)} data-testid={`button-delete-${property.id}`}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Listings() {
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const { toast } = useToast();

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 500000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1500,
      location: "",
      images: [],
      status: "active",
      vibe: "modern",
      agentId: "agent-1",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PropertyFormValues) => {
      const res = await apiRequest("POST", "/api/properties", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setShowForm(false);
      form.reset();
      toast({ title: "Property created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PropertyFormValues & { id: number }) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PATCH", `/api/properties/${id}`, rest);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setEditingProperty(null);
      form.reset();
      toast({ title: "Property updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      setDeletingProperty(null);
      toast({ title: "Property deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    form.reset({
      title: property.title,
      description: property.description,
      price: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft,
      location: property.location,
      images: property.images || [],
      status: property.status,
      vibe: property.vibe || "modern",
      agentId: property.agentId,
    });
  };

  const handleOpenCreate = () => {
    setEditingProperty(null);
    form.reset({
      title: "",
      description: "",
      price: 500000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1500,
      location: "",
      images: [],
      status: "active",
      vibe: "modern",
      agentId: "agent-1",
    });
    setShowForm(true);
  };

  const onSubmit = (data: PropertyFormValues) => {
    if (editingProperty) {
      updateMutation.mutate({ ...data, id: editingProperty.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const addImage = () => {
    if (!imageUrl.trim()) return;
    const current = form.getValues("images") || [];
    form.setValue("images", [...current, imageUrl.trim()]);
    setImageUrl("");
  };

  const removeImage = (index: number) => {
    const current = form.getValues("images") || [];
    form.setValue("images", current.filter((_, i) => i !== index));
  };

  const isFormOpen = showForm || editingProperty !== null;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Luxury Penthouse Suite" {...field} data-testid="input-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the property..." className="resize-none" {...field} data-testid="input-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price: ${field.value?.toLocaleString()}</FormLabel>
              <FormControl>
                <Slider
                  min={50000}
                  max={10000000}
                  step={25000}
                  value={[field.value]}
                  onValueChange={([val]) => field.onChange(val)}
                  data-testid="slider-price"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="bedrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beds</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={20} {...field} onChange={e => field.onChange(+e.target.value)} data-testid="input-bedrooms" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bathrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Baths</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={20} {...field} onChange={e => field.onChange(+e.target.value)} data-testid="input-bathrooms" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sqft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sqft</FormLabel>
                <FormControl>
                  <Input type="number" min={100} {...field} onChange={e => field.onChange(+e.target.value)} data-testid="input-sqft" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input placeholder="Manhattan, NY" {...field} data-testid="input-location" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vibe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vibe</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vibe">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <FormLabel>Images</FormLabel>
          <div className="flex gap-2">
            <Input
              placeholder="Paste image URL..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
              data-testid="input-image-url"
            />
            <Button type="button" variant="secondary" onClick={addImage} data-testid="button-add-image">
              Add
            </Button>
          </div>
          {(form.watch("images") || []).length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {form.watch("images")?.map((url, i) => (
                <div key={i} className="relative group/img rounded-md overflow-hidden">
                  <img src={url} alt={`Preview ${i}`} className="w-full h-20 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center visibility-visible"
                    data-testid={`button-remove-image-${i}`}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-property">
            {isPending ? "Saving..." : editingProperty ? "Update Property" : "Create Property"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t-md" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-listings-title">Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">{properties?.length ?? 0} properties in your portfolio</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-listing">
          <Plus className="w-4 h-4 mr-2" />
          Add Listing
        </Button>
      </div>

      {(!properties || properties.length === 0) ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center backdrop-blur-xl bg-card/80 border-card-border">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No listings yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Create your first property listing to get started
          </p>
          <Button className="mt-4" onClick={handleOpenCreate} data-testid="button-create-first">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Listing
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onEdit={handleEdit}
              onDelete={(p) => setDeletingProperty(p)}
            />
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        if (!open) { setShowForm(false); setEditingProperty(null); form.reset(); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-xl bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>{editingProperty ? "Edit Property" : "Create New Listing"}</DialogTitle>
            <DialogDescription>
              {editingProperty ? "Update the property details below" : "Fill in the details for your new listing"}
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      <Dialog open={deletingProperty !== null} onOpenChange={(open) => { if (!open) setDeletingProperty(null); }}>
        <DialogContent className="backdrop-blur-xl bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProperty?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProperty(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingProperty && deleteMutation.mutate(deletingProperty.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
