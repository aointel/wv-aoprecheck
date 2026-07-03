export type FlowWeightingInput = {
  callable: number;
  queued: number;
  active: number;
  activeAgents: number;
};

export type FlowWeightingOutput = {
  remaining: number;
  utilizationRatio: number;
  pressureScore: number;
  recommendedWeight: number;
};

export function computeFlowWeighting(input: FlowWeightingInput): FlowWeightingOutput {
  const callable = Number(input.callable || 0);
  const queued = Number(input.queued || 0);
  const active = Number(input.active || 0);
  const activeAgents = Number(input.activeAgents || 0);

  const remaining = Math.max(callable - active, 0);

  const scarcity = callable > 0 ? Math.max(0, 1 - remaining / Math.max(callable, 1)) : 0;
  const assignmentLoad = callable > 0 ? Math.min(1, queued / Math.max(callable, 1)) : 0;
  const agentDemand = Math.min(1, activeAgents / 8);
  const pressureCallableScale = callable > 0 ? Math.min(1, callable / 500) : 0;
  const basePressure = (scarcity * 0.7 + assignmentLoad * 0.3) * 100;
  // Keep inventory pressure non-zero for stressed buckets even without recent agent heartbeat.
  const demandFloor = activeAgents > 0 ? 1 : 0.25;
  const pressureScore = Math.min(
    100,
    Math.max(0, basePressure * pressureCallableScale * demandFloor + agentDemand * 20),
  );

  const remainingRatio = callable > 0 ? Math.min(1, remaining / Math.max(callable, 1)) : 0;
  const coverageScore =
    callable > 0
      ? (activeAgents <= 0 ? 1 : Math.min(1, callable / Math.max(activeAgents * 250, 1)))
      : 0;
  const callableScale = callable > 0 ? Math.min(1, callable / 500) : 0;
  const recommendedWeight = Math.min(
    100,
    Math.max(0, (remainingRatio * 0.6 + coverageScore * 0.4) * callableScale * 100),
  );

  const utilizationRatio = callable > 0 ? Math.min(1, active / Math.max(callable, 1)) : 0;

  return {
    remaining,
    utilizationRatio: Number(utilizationRatio.toFixed(6)),
    pressureScore: Number(pressureScore.toFixed(1)),
    recommendedWeight: Number(recommendedWeight.toFixed(1)),
  };
}
