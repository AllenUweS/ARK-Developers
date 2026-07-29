import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Image as ImageIcon, X } from "lucide-react";

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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EditProjectDialog({ project }: { project: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [code, setCode] = useState(project?.code || "");
  const [name, setName] = useState(project?.name || "");
  const [location, setLocation] = useState(project?.location || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status, setStatus] = useState(project?.status || "upcoming");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState(project?.cover_image_url || "");

  useEffect(() => {
    if (open && project) {
      setCode(project.code || "");
      setName(project.name || "");
      setLocation(project.location || "");
      setDescription(project.description || "");
      setStatus(project.status || "upcoming");
      setExistingCoverUrl(project.cover_image_url || "");
      setCoverFile(null);
    }
  }, [open, project]);

  const updateProject = useMutation({
    mutationFn: async () => {
      let finalCoverUrl = existingCoverUrl;

      if (coverFile) {
        const path = `covers/${Date.now()}-${coverFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("project-layouts")
          .upload(path, coverFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("project-layouts").getPublicUrl(path);
        finalCoverUrl = data.publicUrl;
      }

      const { data, error } = await supabase
        .from("projects")
        .update({ 
          code, 
          name, 
          location, 
          description,
          status,
          cover_image_url: finalCoverUrl 
        })
        .eq("id", project.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated successfully");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update project");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit info
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="code">Project Code</Label>
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
            <Label htmlFor="status">Project Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" className="capitalize">
                <SelectValue placeholder="Select project status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cover Photo</Label>
            <div className="mt-2">
              {coverFile || existingCoverUrl ? (
                <div className="relative rounded-md overflow-hidden border bg-muted aspect-[21/9]">
                  <img 
                    src={coverFile ? URL.createObjectURL(coverFile) : existingCoverUrl} 
                    alt="Cover preview" 
                    className="w-full h-full object-cover" 
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={() => {
                      setCoverFile(null);
                      setExistingCoverUrl("");
                    }}
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
                    <p className="text-sm font-medium">Click to upload new cover photo</p>
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
              disabled={updateProject.isPending}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              {updateProject.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
