# @rbalansag/sdk

Runtime helpers for Mega RAG projects.

```ts
import { z } from "zod";
import { createEnvValidator, trackTelemetryEvent, getPromptContext } from "@rbalansag/sdk";

// Validates process.env at boot; prints missing variables and exits on failure.
export const env = createEnvValidator(z.object({ DATABASE_URL: z.string().url() }));

// Validated (actorId, eventName, properties, userTraits) tuple, stamped with eventId + timestamp.
const event = trackTelemetryEvent({
  actorId: "u_123",
  eventName: "checkout.completed",
  properties: { totalMinor: 4999, currency: "USD" },
  userTraits: { plan: "pro" },
});

// Domain guidelines for your own LLM calls.
const system = getPromptContext("e-commerce");
```

For mobile/game clients use `createTelemetryQueue({ send, storage })` for offline-first batching.

Subpath exports: `@rbalansag/sdk/env`, `/telemetry`, `/prompt`.
