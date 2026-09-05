import { createFileRoute } from "@tanstack/react-router";
import { FieldSiteVisitStudio } from "@/components/leads/FieldSiteVisitStudio";

export const Route = createFileRoute("/_authenticated/site-visits_/$leadId")({
  component: SiteVisitPage,
});

function SiteVisitPage() {
  const { leadId } = Route.useParams();
  const { user } = Route.useRouteContext();

  return <FieldSiteVisitStudio leadId={leadId} userId={user.id} />;
}
