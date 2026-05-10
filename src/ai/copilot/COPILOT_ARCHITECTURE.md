# MediFlow AI Copilot — Clinic Operations Layer

Production orchestration for **read-only** AI assistance. The Copilot **never** commits database transactions, records payments, or issues diagnoses. Domain modules execute mutations after explicit human confirmation.

## Text flow diagram

```
Client (JWT + tenantId)
        │
        ▼
POST /ai/copilot  ──► CopilotController
        │
        ▼
CopilotService.process()
        │
        ├─► IntentDetectorService ──► LlmGateway (JSON intent + entities)
        │
        ├─ clinical without patientId? ──► early structured response (needs_patient_context)
        │
        ├─ search intent? ──► NL→JSON planner (LLM) ──► CopilotExecutionEngine (validated plans)
        │                          │
        │                          └─► single read: searchPatients | searchAppointments | searchInvoices
        │
        └─ other intents ──► ToolRegistry.executeForIntent (parallel read-only tools)
                    │
                    ▼
              CopilotMemoryService (optional Redis + TTL; else in-process) ─► prompt prefix
                    │
                    ▼
              ContextBuilderService (tenant-scoped string + short TTL cache keyed by payload hash)
                    │
                    ▼
              PromptLibrary (category templates: scheduling / clinical / communication / search / finance)
                    │
                    ▼
              LlmGateway (Gemini ↔ OpenAI fallback chain)
                    │
                    ▼
        { intent, tool_used, response, structured_data, metadata }
```

## Modules & files

| Layer | Responsibility |
|--------|----------------|
| `copilot.controller.ts` | Auth’d entrypoint, Zod-validated body |
| `copilot.service.ts` | Orchestration, clinical guard, search pipeline, response shaping |
| `v2/copilot-memory.service.ts` | Session hints (`lastIntent`, ids); **Redis** when `REDIS_URL` set, TTL-bounded |
| `intent/intent-detector.service.ts` | LLM JSON classifier → `IntentType` + entities |
| `tools/tool-registry.service.ts` | Tool registry; **only** Prisma reads; `tenantWhere` on every query |
| `context/context-builder.service.ts` | Serialize tool JSON → prompt context; cache ~60s |
| `prompts/*.prompts.ts` | Reusable templates with `{{input}}`, `{{context}}`, etc. |
| `prompts/prompt-library.ts` | Render helpers, intent classifier text, scheduling prompt routing |
| `llm/llm-gateway.service.ts` | Provider chain (`LLM_PROVIDER` → fallback) |
| `llm/providers/gemini.provider.ts` | Google Generative AI |
| `llm/providers/openai.provider.ts` | OpenAI-compatible API |

## Standard response shape

```json
{
  "intent": "scheduling|clinical|communication|finance|search|general",
  "tool_used": "getAvailableSlots|null",
  "response": "human-readable (Arabic when input is Arabic)",
  "structured_data": {},
  "metadata": {
    "confidence": "high|medium|low",
    "language": "ar|en|mixed",
    "model_used": "string",
    "processing_time_ms": 0
  }
}
```

`metadata` is for observability; the four primary fields match the product contract.

## Environment

- `GEMINI_API_KEY` — primary Gemini access  
- `GEMINI_MODEL` — optional model override  
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` — fallback provider (see `OpenAiProvider`)  
- `LLM_PROVIDER` — `gemini` (default) or `openai`  
- `CLINIC_PHONE` — substituted into communication prompts (`{{clinic_phone}}`)
- `REDIS_URL` — optional; when set, copilot session memory is stored in Redis with TTL (shared across app instances)  
- `COPILOT_MEMORY_TTL_SEC` — optional TTL for Redis keys (default **86400**, max **604800**)

## Example lifecycle (semantic search)

1. User: `مين المرضى اللي ما دفعوا؟`  
2. Intent detector → `search`, Arabic.  
3. Planner LLM → `{ "tool": "searchInvoices", "filters": { "unpaid": true }, "display_query": "..." }`.  
4. `searchInvoices` runs with `tenantId` + `(draft OR partial with balance>0)`.  
5. Response: Arabic summary line + `structured_data.nl_plan` + `results_preview` (capped).

## Safety

- Clinical prompts: **no diagnosis / no treatment**; administrative risk flags only.  
- Tools: **no** `create`, `update`, `delete` in the Copilot path.  
- Multi-tenant: all Prisma calls include `tenantWhere(auth.tenantId, …)`.
