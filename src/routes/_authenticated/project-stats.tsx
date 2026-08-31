import { createFileRoute } from "@tanstack/react-router";
import { ProjectStatsView } from "@/components/analytics/ProjectStatsView";

export const Route = createFileRoute("/_authenticated/project-stats")({
  component: ProjectStatsPage,
});

function ProjectStatsPage() {
  return <ProjectStatsView />;
}
