export const DOMAIN_OVERLAYS = ["saas", "e-commerce", "logistics", "gaming", "none"] as const;
export type DomainOverlay = (typeof DOMAIN_OVERLAYS)[number];

const BASE = [
  "Follow the project's layer boundaries; keep business logic out of UI and handlers.",
  "Never output secrets. Read configuration only through the validated env module.",
  "Validate all external input at the boundary. Use parameterized queries.",
  "Do not include personal data in logs or analytics events.",
];

const OVERLAYS: Record<Exclude<DomainOverlay, "none">, string[]> = {
  saas: [
    "This is a multi-tenant B2B SaaS. Every data access is scoped by tenantId taken from the authenticated session.",
    "Check permissions, not role names. Respect plan entitlements. Record admin actions in an audit log.",
  ],
  "e-commerce": [
    "This is an e-commerce system. Money is integer minor units plus currency; never use floats.",
    "Never request or echo card data. Payments are idempotent and confirmed by provider webhooks.",
    "Orders are state machines; order lines snapshot price and tax at purchase.",
  ],
  logistics: [
    "This is a logistics/ride-hailing system using Uber H3 for spatial indexing.",
    "Coordinates are (lat, lng) for H3 and (lng, lat) for GeoJSON. Rank candidates by great-circle distance after a k-ring lookup.",
    "Dispatch offers are idempotent, time-limited, and follow an explicit state machine.",
  ],
  gaming: [
    "This is a game. Keep simulation on a fixed timestep separate from rendering, and treat the server as authoritative.",
    "Avoid per-frame allocations. Keep content data-driven and saves versioned.",
  ],
};

/**
 * Domain-specific system prompt guidelines to inject into custom LLM calls at runtime.
 * @example
 * const system = getPromptContext("logistics");
 */
export function getPromptContext(domainOverlay: DomainOverlay = "none"): string {
  if (!DOMAIN_OVERLAYS.includes(domainOverlay)) {
    throw new Error(`Unknown domain overlay "${String(domainOverlay)}". Expected one of: ${DOMAIN_OVERLAYS.join(", ")}`);
  }
  const lines = domainOverlay === "none" ? BASE : [...BASE, ...OVERLAYS[domainOverlay]];
  return ["Follow these engineering guidelines:", ...lines.map((l) => `- ${l}`)].join("\n");
}
