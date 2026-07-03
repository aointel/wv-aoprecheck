import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Upload, RefreshCw, Table, BarChart3 } from "lucide-react";

interface SubmittedAppRow {
  id: number;
  insured: string | null;
  agent_release: string | null;
  sga_submit: string | null;
  policy_number: string | null;
  lob: string | null;
  cwa: string | null;
  agent: string | null;
  office: string | null;
  transfer_type: string | null;
  matched_billing_transaction_id: number | null;
  matched_agent_dial_metric_id: number | null;
  aoi_alp: number | null;
  ccpro_alp: number | null;
  [key: string]: unknown;
}

interface ProductionSummaryRow {
  agent: string;
  agent_email: string | null;
  production_count: number;
  production_alp_sum: number;
  connects_count: number;
  booked_count: number;
}

export default function SubmittedApplicationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pasted, setPasted] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [policyFilter, setPolicyFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [summaryDateFrom, setSummaryDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [summaryDateTo, setSummaryDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const listQuery = useQuery({
    queryKey: [
      "/api/submitted-applications",
      agentFilter,
      dateFrom,
      dateTo,
      policyFilter,
      officeFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (agentFilter) params.set("agent", agentFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (policyFilter) params.set("policyNumber", policyFilter);
      if (officeFilter) params.set("office", officeFilter);
      const res = await fetch(`/api/submitted-applications?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      return data as { data: SubmittedAppRow[]; count: number };
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["/api/submitted-applications/production-summary", summaryDateFrom, summaryDateTo],
    queryFn: async () => {
      const res = await fetch(
        `/api/submitted-applications/production-summary?dateFrom=${summaryDateFrom}&dateTo=${summaryDateTo}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch summary");
      return data as { data: ProductionSummaryRow[]; dateFrom: string; dateTo: string };
    },
    enabled: !!summaryDateFrom && !!summaryDateTo,
    refetchInterval: 10_000,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/submitted-applications/import", { pasted });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Import complete",
        description: `Imported ${data.imported} rows (${data.inserted} new, ${data.updated} updated).`,
      });
      setPasted("");
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-applications/production-summary"] });
    },
    onError: (e: Error) => {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    },
  });

  const runMatchingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/submitted-applications/run-matching", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Matching complete",
        description: `Matched ${data.matched} rows (AOI connect: ${data.aoi_connect}, CCPRO reached: ${data.ccpro_reached ?? 0}).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-applications/production-summary"] });
    },
    onError: (e: Error) => {
      toast({ title: "Matching failed", description: e.message, variant: "destructive" });
    },
  });

  const rows = listQuery.data?.data ?? [];
  const summaryRows = summaryQuery.data?.data ?? [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Submitted Applications
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Paste table data from the portal, import, and tie production to connects (AOI) and booked (CCPRO).
          </p>
        </div>
      </div>

      {/* Paste and import */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Paste from portal
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            In the portal, open Search Submitted Applications, set date range, select all in the table, copy, then paste below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder="Paste tab-separated table data here..."
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!pasted.trim() || importMutation.isPending}
            >
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
            <Button
              variant="outline"
              onClick={() => runMatchingMutation.mutate()}
              disabled={runMatchingMutation.isPending}
            >
              {runMatchingMutation.isPending ? "Matching…" : "Run matching (AOI / CCPRO)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Production summary: ties production to connects and booked */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Production summary (connects + booked)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-agent counts for the selected date range. Production = submitted apps; Connects = billing; Booked = agent_dial_metrics.
          </p>
          <div className="flex flex-wrap gap-4 items-end pt-2">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={summaryDateFrom}
                onChange={(e) => setSummaryDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={summaryDateTo}
                onChange={(e) => setSummaryDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => summaryQuery.refetch()}
              disabled={summaryQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <p className="text-muted-foreground">Loading summary…</p>
          ) : summaryQuery.isError ? (
            <p className="text-destructive">{String(summaryQuery.error)}</p>
          ) : summaryRows.length === 0 ? (
            <p className="text-muted-foreground">No data for this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Agent</th>
                    <th className="text-right p-2">Production</th>
                    <th className="text-right p-2">ALP sum</th>
                    <th className="text-right p-2">Connects</th>
                    <th className="text-right p-2">Booked</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={r.agent} className="border-b">
                      <td className="p-2">{r.agent}</td>
                      <td className="text-right p-2">{r.production_count}</td>
                      <td className="text-right p-2">${r.production_alp_sum.toLocaleString()}</td>
                      <td className="text-right p-2">{r.connects_count}</td>
                      <td className="text-right p-2">{r.booked_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lookup: filters and table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5" />
            Look up submitted applications
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Filter and view pasted rows. Transfer type shows AOI connect or CCPRO booked when matched.
          </p>
          <div className="flex flex-wrap gap-4 items-end pt-2">
            <div>
              <Label>Agent</Label>
              <Input
                placeholder="Agent name or code"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="w-48"
              />
            </div>
            <div>
              <Label>Date from</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label>Date to</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label>Policy #</Label>
              <Input
                placeholder="Policy number"
                value={policyFilter}
                onChange={(e) => setPolicyFilter(e.target.value)}
                className="w-32"
              />
            </div>
            <div>
              <Label>Office</Label>
              <Input
                placeholder="Office"
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="w-32"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${listQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : listQuery.isError ? (
            <p className="text-destructive">{String(listQuery.error)}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No rows match filters.</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2">Insured</th>
                    <th className="text-left p-2">SGA Submit</th>
                    <th className="text-left p-2">Policy #</th>
                    <th className="text-left p-2">Agent</th>
                    <th className="text-left p-2">CWA</th>
                    <th className="text-left p-2">Transfer</th>
                    <th className="text-right p-2">AOI ALP</th>
                    <th className="text-right p-2">CCPRO ALP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.insured ?? "—"}</td>
                      <td className="p-2">
                        {r.sga_submit
                          ? new Date(r.sga_submit).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="p-2">{r.policy_number ?? "—"}</td>
                      <td className="p-2">{r.agent ?? "—"}</td>
                      <td className="p-2">{r.cwa ?? "—"}</td>
                      <td className="p-2">
                        {r.transfer_type === "aoi_connect" && (
                          <span className="text-blue-600 font-medium">AOI connect</span>
                        )}
                        {r.transfer_type === "ccpro_reached" && (
                          <span className="text-amber-600 font-medium">CCPRO</span>
                        )}
                        {!r.transfer_type && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 text-right">
                        {r.aoi_alp != null ? `$${Number(r.aoi_alp).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {r.ccpro_alp != null ? `$${Number(r.ccpro_alp).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Showing {rows.length} rows (no pagination).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
