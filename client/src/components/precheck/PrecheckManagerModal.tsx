import AOIPrecheckAdmin from "@/pages/AOIPrecheckAdmin";

type Props = {
  open: boolean;
  onClose: () => void;
  managerEmail?: string;
};

/** Full AO Precheck Admin UI in a centered modal, scoped to the manager's confirmed team. */
export function PrecheckManagerModal({ open, onClose, managerEmail }: Props) {
  if (!open || !managerEmail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[1200px] h-[min(90vh,920px)] max-h-[calc(100vh-32px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Precheck Manager"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <AOIPrecheckAdmin embedded teamManagerEmail={managerEmail} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
