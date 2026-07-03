/**
 * Pattern B — browser: all masterlead mutations go through `apiRequest` so `resolveServiceUrl`
 * sends them to the data deploy when Connect is segmented. Server/workers use `masterleadClient` (Postgres) directly.
 */
import { apiRequest } from "@/lib/queryClient";

export type MasterleadUpdateResolutionBody = {
  leadId: string | number;
  leadPhone?: string;
  cnresolution: string;
  agentEmail?: string | null;
};

export function masterleadUpdateResolution(body: MasterleadUpdateResolutionBody): Promise<Response> {
  return apiRequest("POST", "/api/masterlead/update-resolution", body);
}
