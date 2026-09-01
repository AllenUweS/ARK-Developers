import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ArrowLeft, MapPin, Upload, FileText, Trash2, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SiteMapper } from "@/components/site-mapper/SiteMapper";
import { resolveProjectLayoutUrl } from "@/components/site-mapper/types";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { ProjectBankAccountsSection } from "@/components/projects/ProjectBankAccountsSection";

export const Route = createFileRoute("/_authenticated/projects_/$id")({
  component: ProjectDetail,
});

/** Converts an uploaded layout file to a PNG blob. PDFs are rasterized
 *  (first page) client-side via pdf.js so the layout can be stored and
 *  rendered like any other image. */
async function fileToImageBlob(file: File): Promise<{ blob: Blob; ext: string }> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { blob: file, ext: file.name.split(".").pop() ?? "png" };

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as string)).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to rasterize PDF"))),
      "image/png",
    ),
  );
  return { blob, ext: "png" };
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [uploading, setUploading] = useState(false);

  const { data: role } = useQuery({
    queryKey: ["role", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: user.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = role === "admin" || role === "super_admin";

  const { data: project } = useQuery({
    queryKey: ["project", id, role],
    enabled: !!role,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (data && !isAdmin && data.status !== "live") {
        return null;
      }
      return data as any;
    },
  });


  // Signed URL for layout image (with fallback for migrated old project files)
  const layoutPath = (project as any)?.layout_image_url as string | null | undefined;
  const { data: layoutUrl } = useQuery({
    queryKey: ["layout-url", layoutPath],
    enabled: !!layoutPath,
    queryFn: () => resolveProjectLayoutUrl(layoutPath),
  });

  const { data: documents } = useQuery({
    queryKey: ["project-docs", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_documents")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  async function updateStatus(newStatus: "upcoming" | "live" | "completed" | "archived") {
    const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Project status updated to ${newStatus}`);
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function goLive() {
    await updateStatus("live");
  }

  async function makeOffline() {
    await updateStatus("upcoming");
  }

  async function deleteProject() {
    if (!confirm(`Are you sure you want to delete "${project?.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return toast.error("Cannot delete project because it has existing plots or bookings.");
      }
      return toast.error(error.message);
    }
    toast.success("Project deleted");
    qc.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/projects" });
  }

  async function uploadLayout(file: File): Promise<void> {
    setUploading(true);
    try {
      const { blob, ext } = await fileToImageBlob(file);
      const path = `${id}/layout-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-layouts")
        .upload(path, blob, { upsert: true });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { error } = await supabase
        .from("projects")
        .update({ layout_image_url: path } as any)
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Layout uploaded");
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to process the layout file");
    } finally {
      setUploading(false);
    }
  }

  async function uploadDocuments(files: File[]) {
    let count = 0;
    for (const file of files) {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-documents").upload(path, file);
      if (upErr) {
        toast.error(`Failed to upload ${file.name}: ${upErr.message}`);
        continue;
      }
      const { error } = await (supabase as any).from("project_documents").insert({
        project_id: id,
        name: file.name,
        file_path: path,
        file_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      });
      if (!error) count++;
    }
    if (count > 0) {
      toast.success(`Uploaded ${count} document${count > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["project-docs", id] });
    }
  }

  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  async function deleteDocument(doc: any) {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    await supabase.storage.from("project-documents").remove([doc.file_path]);
    const { error } = await (supabase as any).from("project_documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["project-docs", id] });
  }

  async function handleDocumentAction(doc: any, action: "preview" | "download") {
    if (action === "preview") {
      setViewingDoc(doc);
      setViewerOpen(true);
      return;
    }
    const { data } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(doc.file_path, 60, { download: true });
    if (data?.signedUrl) {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div>
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" /> All projects
      </Link>

      {project === null ? (
        <div className="text-center py-20 text-muted-foreground">
          Project not found or you don't have access to view it.
        </div>
      ) : project ? (
        <>
          <div className="grid lg:grid-cols-[2fr_1fr] gap-8 mb-10">
          <div className="aspect-[16/9] rounded-lg overflow-hidden bg-muted">
            {project.cover_image_url && (
              <img
                src={project.cover_image_url}
                alt={project.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {project.code}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full border capitalize bg-terracotta/10 text-terracotta border-terracotta/30">
                {project.status}
              </span>
            </div>
            <h1 className="text-display text-4xl mt-2">{project.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
              <MapPin className="h-3 w-3" /> {project.location}
            </p>
            <p className="text-sm mt-4 leading-relaxed">{project.description}</p>

            {isAdmin && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <EditProjectDialog project={project} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Status:</span>
                  <Select value={project.status} onValueChange={(val) => updateStatus(val as any)}>
                    <SelectTrigger className="w-[140px] h-9 text-xs bg-background capitalize">
                      <SelectValue placeholder="Project Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={deleteProject}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete project
                </Button>
              </div>
            )}
          </div>
        </div>

      {/* Interactive Site Mapper: trace plot boundaries directly on the layout */}
      <SiteMapper
        projectId={id}
        isAdmin={isAdmin}
        userId={user.id}
        layoutPath={layoutPath}
        layoutUrl={layoutUrl}
        uploading={uploading}
        onUploadLayout={uploadLayout}
      />

      {/* Project Bank Accounts */}
      <ProjectBankAccountsSection
        projectId={id}
        projectName={project.name}
        canEdit={isAdmin || role === "management" || role === "accounts"}
      />

      {/* Documents */}
      <section className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-display text-2xl">Documents</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Approvals, brochures, legal documents, and other project files.
            </p>
          </div>
          {isAdmin && (
            <label>
              <Button
                asChild
                className="bg-terracotta text-accent-foreground hover:bg-terracotta/90"
                size="sm"
              >
                <span className="cursor-pointer">
                  <Upload className="h-3 w-3 mr-1" /> Upload document
                </span>
              </Button>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && uploadDocuments(Array.from(e.target.files))}
              />
            </label>
          )}
        </div>

        {!documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No documents uploaded yet.
          </p>
        ) : (
          <ul className="divide-y">
            {documents.map((doc) => (
              <li key={doc.id} className="py-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.file_type ?? "file"}
                    {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDocumentAction(doc, "preview")} title="Preview">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDocumentAction(doc, "download")} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => deleteDocument(doc)} title="Delete">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      ) : null}

      <DocumentViewerModal
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open);
          if (!open) setViewingDoc(null);
        }}
        document={viewingDoc ? {
          id: viewingDoc.id,
          name: viewingDoc.name,
          file_path: viewingDoc.file_path,
          mime_type: viewingDoc.file_type,
          file_size: viewingDoc.size_bytes,
          is_downloadable: viewingDoc.is_downloadable,
        } : null}
        bucketName="project-documents"
        canEdit={isAdmin}
      />
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
