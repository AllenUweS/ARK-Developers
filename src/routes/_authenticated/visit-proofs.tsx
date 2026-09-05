import { createFileRoute, redirect } from "@tanstack/react-router";
import { VisitProofsWorkspace } from "@/components/leads/VisitProofsWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/visit-proofs")({
  beforeLoad: async ({ context }) => {
    if (typeof window === "undefined") return;
    const userId = (context as any)?.user?.id;
    if (userId) {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: userId });
      const allowedRoles = ["admin", "super_admin", "manager", "management", "crm", "accounts"];
      if (!allowedRoles.includes(data as string)) throw redirect({ to: "/leads" });
    }
  },
  component: () => <VisitProofsWorkspace userId={Route.useRouteContext().user?.id} />,
});
