import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Image as ImageIcon, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const createProject = useMutation({
    mutationFn: async () => {
      let finalCoverUrl = null;

      if (coverFile) {
        const path = `covers/${Date.now()}-${coverFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("project-layouts")
          .upload(path, coverFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("project-layouts").getPublicUrl(path);
        finalCoverUrl = data.publicUrl;
      }

      const cleanCode = code.trim().toUpperCase();
      const cleanName = name.trim();
      const cleanLocation = location.trim();

      if (!cleanCode) throw new Error("Project Code is required");
      if (!cleanName) throw new Error("Project Name is required");
      if (!cleanLocation) throw new Error("Location is required");

      const { data, error } = await supabase
        .from("projects")
        .insert([{ 
          code: cleanCode, 
          name: cleanName, 
          location: cleanLocation, 
          description: description.trim() || null,
          cover_image_url: finalCoverUrl 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created successfully");
      setOpen(false);
      setCode("");
      setName("");
      setLocation("");
      setDescription("");
      setCoverFile(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-terracotta text-white hover:bg-terracotta/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="code">Project Code (e.g., P001)</Label>
            <Input
              id="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Unique project identifier"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Serenity Valley"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., North District"
            />
          </div>
          <div className="space-y-2">
            <Label>Cover Photo</Label>
            <div className="mt-2">
              {coverFile ? (
                <div className="relative rounded-md overflow-hidden border bg-muted aspect-[21/9]">
                  <img 
                    src={URL.createObjectURL(coverFile)} 
                    alt="Cover preview" 
                    className="w-full h-full object-cover" 
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={() => setCoverFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Label
                  htmlFor="coverFile"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm font-medium">Click to upload cover photo</p>
                    <p className="text-xs mt-1 opacity-75">SVG, PNG, JPG or GIF (max. 5MB)</p>
                  </div>
                  <Input
                    id="coverFile"
                    className="hidden"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    type="file"
                    accept="image/*"
                  />
                </Label>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
