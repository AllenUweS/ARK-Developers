import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder,
  FolderOpen,
  File,
  Plus,
  Search,
  Upload,
  FolderPlus,
  Trash2,
  Pencil,
  Home,
  ChevronRight,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileCode,
  Archive,
  Download,
  Eye,
  Lock,
  Unlock,
  X,
  Files,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const ROOT_FOLDER_ID = "00000000-0000-0000-0000-000000000001";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface Document {
  id: string;
  folder_id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  created_at: string;
  is_downloadable?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("text/") || mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return Archive;
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("html")) return FileCode;
  return File;
}

function DocumentsPage() {
  const qc = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "folder" | "document"; id: string; name: string; file_path?: string } | null>(null);

  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleViewDocument = (doc: Document) => {
    setViewingDocument(doc);
    setViewerOpen(true);
  };

  const handleFileSelect = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const filtered = fileArray.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: role } = useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user!.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";
  const isManager = role === "manager";
  const canEdit = isAdmin || isManager;

  // Build folder path for breadcrumbs
  const { data: folderPath } = useQuery({
    queryKey: ["folder-path", currentFolderId],
    enabled: currentFolderId !== null,
    queryFn: async () => {
      const path: Folder[] = [];
      let currentId: string | null = currentFolderId;
      while (currentId) {
        const { data, error } = await (supabase
          .from("document_folders" as any)
          .select("id, name, parent_id")
          .eq("id", currentId)
          .single());
        if (error || !data) break;
        path.unshift(data as unknown as Folder);
        currentId = (data as any).parent_id;
      }
      return path;
    },
  });

  // Fetch folders in current folder
  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("document_folders" as any)
        .select("*")
        .eq("parent_id", currentFolderId || ROOT_FOLDER_ID)
        .order("name"));
      if (error) throw error;
      return (data ?? []) as unknown as Folder[];
    },
  });

  // Fetch documents in current folder
  const { data: documents, refetch: refetchDocuments } = useQuery({
    queryKey: ["documents", currentFolderId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("documents" as any)
        .select("*")
        .eq("folder_id", currentFolderId || ROOT_FOLDER_ID)
        .order("name"));
      if (error) throw error;
      return (data ?? []) as unknown as Document[];
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase
        .from("document_folders" as any)
        .insert({
          name,
          parent_id: currentFolderId || ROOT_FOLDER_ID,
          created_by: user?.id,
        }));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder created");
      setCreateFolderOpen(false);
      setNewFolderName("");
      refetchFolders();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create folder"),
  });

  // Upload document mutation (supports multiple files)
  const uploadDocumentsMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let count = 0;
      for (const file of files) {
        count++;
        setUploadProgress({ current: count, total: files.length });

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${currentFolderId || ROOT_FOLDER_ID}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await (supabase
          .from("documents" as any)
          .insert({
            folder_id: currentFolderId || ROOT_FOLDER_ID,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            created_by: user?.id,
            is_downloadable: isDownloadable,
          }));

        if (dbError) throw dbError;
      }
    },
    onSuccess: (_, files) => {
      toast.success(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadProgress(null);
      setIsDownloadable(true);
      refetchDocuments();
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Failed to upload documents");
      setUploading(false);
      setUploadProgress(null);
    },
  });

  // Toggle downloadable mutation
  const toggleDownloadableMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const nextState = doc.is_downloadable === false ? true : false;
      const { error } = await (supabase
        .from("documents" as any)
        .update({ is_downloadable: nextState })
        .eq("id", doc.id));
      if (error) throw error;
      return nextState;
    },
    onSuccess: (nextState) => {
      toast.success(nextState ? "Document is now Downloadable" : "Document set to View Only");
      refetchDocuments();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update permissions"),
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("document_folders" as any)
        .delete()
        .eq("id", id));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder deleted");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      refetchFolders();
      refetchDocuments();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete folder"),
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      // Storage remove (non-blocking if file missing)
      if (doc.file_path) {
        try {
          const { error: storageError } = await supabase.storage
            .from("documents")
            .remove([doc.file_path]);
          if (storageError) {
            console.warn("Storage deletion note:", storageError.message);
          }
        } catch (err) {
          console.warn("Storage deletion exception:", err);
        }
      }

      // DB delete
      const { error: dbError } = await (supabase
        .from("documents" as any)
        .delete()
        .eq("id", doc.id));
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      refetchDocuments();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete document"),
  });

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    await uploadDocumentsMutation.mutateAsync(selectedFiles);
    setUploading(false);
  };

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600);

    if (error) {
      toast.error("Failed to generate download link");
      return;
    }

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFolders = folders?.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const filteredDocuments = documents?.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-3xl">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Company documents and resources
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateFolderOpen(true)}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" /> New Folder
            </Button>
            <Button
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
              className="gap-2 bg-terracotta hover:bg-terracotta/90"
            >
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={`flex items-center gap-1.5 hover:text-terracotta transition-colors ${
            !currentFolderId ? "text-terracotta font-semibold" : "text-muted-foreground"
          }`}
        >
          <Home className="h-4 w-4" /> Company Documents
        </button>
        {folderPath?.map((folder, index) => (
          <div key={folder.id} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <button
              onClick={() => setCurrentFolderId(folder.id)}
              className={`hover:text-terracotta transition-colors ${
                index === folderPath.length - 1 ? "text-terracotta font-semibold" : "text-muted-foreground"
              }`}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </nav>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search folders and documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Folders Grid */}
      {filteredFolders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Folders</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="group flex flex-col items-center p-4 rounded-xl border border-border/60 bg-card hover:border-terracotta/50 hover:bg-terracotta/5 cursor-pointer transition-all"
              >
                <Folder className="h-10 w-10 text-terracotta/70 group-hover:text-terracotta mb-2 transition-colors" />
                <span className="text-sm font-medium text-center truncate w-full">{folder.name}</span>

                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete({ type: "folder", id: folder.id, name: folder.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents List */}
      {filteredDocuments.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Documents</h3>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {filteredDocuments.map((doc) => {
              const FileIcon = getFileIcon(doc.mime_type);
              const isViewOnly = doc.is_downloadable === false;
              const canDownloadDoc = !isViewOnly || canEdit;

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-3 hover:bg-muted/30 transition-colors border-b last:border-b-0 group"
                >
                  <div
                    onClick={() => handleViewDocument(doc)}
                    className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                  >
                    <FileIcon className="h-5 w-5 text-muted-foreground group-hover:text-terracotta transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate group-hover:text-terracotta transition-colors">{doc.name}</p>
                        {isViewOnly && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 h-4 gap-1">
                            <Lock className="h-2.5 w-2.5" /> View Only
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDocument(doc)}
                      className="h-8 w-8 p-0"
                      title="View in webpage"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDownloadableMutation.mutate(doc)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title={isViewOnly ? "Allow Download" : "Make View Only"}
                        disabled={toggleDownloadableMutation.isPending}
                      >
                        {isViewOnly ? (
                          <Lock className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Unlock className="h-4 w-4 text-emerald-500" />
                        )}
                      </Button>
                    )}

                    {canDownloadDoc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        className="h-8 w-8 p-0"
                        title={isViewOnly ? "Download (Admin Override)" : "Download"}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setItemToDelete({
                            type: "document",
                            id: doc.id,
                            name: doc.name,
                            file_path: doc.file_path
                          });
                          setDeleteDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredFolders.length === 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-dashed bg-muted/20">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery ? "No results found" : "This folder is empty"}
          </p>
          {canEdit && !searchQuery && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFolderOpen(true)}
                className="gap-2"
              >
                <FolderPlus className="h-4 w-4" /> Create Folder
              </Button>
              <Button
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
                className="gap-2 bg-terracotta hover:bg-terracotta/90"
              >
                <Upload className="h-4 w-4" /> Upload File
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                createFolderMutation.mutate(newFolderName.trim());
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
              disabled={createFolderMutation.isPending || !newFolderName.trim()}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-File Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open && !uploading) {
          setSelectedFiles([]);
          setUploadProgress(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Select or drag and drop multiple files to upload to the current folder
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFileUpload} className="space-y-4">
            {/* Dropzone Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  handleFileSelect(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging ? "border-terracotta bg-terracotta/5 scale-[0.99]" : "border-border hover:border-terracotta/50 bg-card"
              }`}
            >
              <input
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <Upload className="h-9 w-9 text-terracotta/80 mb-2" />
                <p className="text-sm font-semibold">
                  Click to choose files or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports multiple PDFs, Images, Word docs, Excel files, etc.
                </p>
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected Files ({selectedFiles.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="file-upload" className="text-xs text-terracotta hover:underline cursor-pointer flex items-center gap-1 font-medium">
                      <Plus className="h-3 w-3" /> Add More
                    </label>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-destructive hover:underline"
                      disabled={uploading}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2 bg-muted/20">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-3 p-2 px-3 rounded-md border bg-card text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-terracotta shrink-0" />
                        <span className="font-medium truncate">{file.name}</span>
                        <span className="text-muted-foreground text-[11px] shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        disabled={uploading}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download Permission Setting */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <label htmlFor="allow-download" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  {isDownloadable ? <Download className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-amber-500" />}
                  Allow Download for Employees
                </label>
                <p className="text-xs text-muted-foreground">
                  {isDownloadable
                    ? "Employees can both view and download these documents."
                    : "View Only: Employees can view inside browser, but cannot download."}
                </p>
              </div>
              <Switch
                id="allow-download"
                checked={isDownloadable}
                onCheckedChange={setIsDownloadable}
                disabled={uploading}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFiles([]);
                  setUploadProgress(null);
                }}
                disabled={uploading}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={selectedFiles.length === 0 || uploading}
                className="bg-terracotta hover:bg-terracotta/90 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {uploadProgress
                      ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...`
                      : "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? "s" : ""}` : "Files"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"?
              {itemToDelete?.type === "folder" && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                  Warning: This will also delete all documents and subfolders within this folder.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToDelete?.type === "folder") {
                  deleteFolderMutation.mutate(itemToDelete.id);
                } else if (itemToDelete?.type === "document") {
                  deleteDocumentMutation.mutate({
                    id: itemToDelete.id,
                    file_path: (itemToDelete as any).file_path,
                  });
                }
              }}
              disabled={
                itemToDelete?.type === "folder"
                  ? deleteFolderMutation.isPending
                  : deleteDocumentMutation.isPending
              }
            >
              {(itemToDelete?.type === "folder"
                ? deleteFolderMutation.isPending
                : deleteDocumentMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document In-Page Viewer Modal */}
      <DocumentViewerModal
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open);
          if (!open) setViewingDocument(null);
        }}
        document={viewingDocument}
        bucketName="documents"
        canEdit={canEdit}
      />
    </div>
  );
}
