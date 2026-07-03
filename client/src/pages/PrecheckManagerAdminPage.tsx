import AOIPrecheckAdmin from "@/pages/AOIPrecheckAdmin";
import { ConnectNowLayout } from "@/components/layouts/ConnectNowLayout";

/**
 * Full AO Precheck Admin, or embedded team-scoped manager view (Precheck Manager modal / iframe).
 */
export default function PrecheckManagerAdminPage() {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embedded") === "1";
  const teamManager = params.get("teamManager")?.trim().toLowerCase() || undefined;

  if (embedded && teamManager) {
    return (
      <AOIPrecheckAdmin
        embedded
        teamManagerEmail={teamManager}
        onClose={() => {
          if (window.parent !== window) {
            window.parent.postMessage({ type: "aoprecheck-close-manager" }, "*");
          } else {
            window.history.back();
          }
        }}
      />
    );
  }

  return (
    <ConnectNowLayout>
      <AOIPrecheckAdmin />
    </ConnectNowLayout>
  );
}
