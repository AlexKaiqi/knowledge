const platformWriteUncertainOutcomes = new Set(['possibly-executed', 'unknown'])

export function selectAccessRoute(catalog, {
  capabilityRef,
  requiredPhases = [],
  healthByRoute = {},
  excludedRouteIds = [],
} = {}) {
  const requirements = catalog.selectionPolicy.automaticRouteRequirements
  const excluded = new Set(excludedRouteIds)
  const routes = catalog.routes
    .filter((route) => route.automaticSelectionEligible)
    .filter((route) => requirements.lifecycles.includes(route.lifecycle))
    .filter((route) => requirements.contractLevels.includes(route.contractLevel))
    .filter((route) => !excluded.has(route.id))
    .filter((route) => !requirements.requireHealthy || healthByRoute[route.id] === 'healthy')
    .filter((route) => {
      const coverage = route.capabilityCoverage.find((entry) => entry.capabilityRef === capabilityRef)
      return coverage && requiredPhases.every((phase) => coverage.phases.includes(phase)) && coverage.gaps.length === 0
    })
    .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id))
  return routes[0] ?? null
}

export function canFailOver({ effect, effectStarted, outcomeCertainty }) {
  if (effect !== 'platform-write') return true
  if (effectStarted || platformWriteUncertainOutcomes.has(outcomeCertainty)) return false
  return outcomeCertainty === 'definitely-not-executed'
}
