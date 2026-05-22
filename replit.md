# Social Media Sister's CyberSuite

A social media content creation tool that allows users to generate, manage, and post various types of social media content, including carousels, single-image posts, and Instagram stories, with AI assistance and client-specific branding.

## Run & Operate

- **Run Dev Server**: `pnpm --filter @workspace/api-server run dev`
- **Build All**: `pnpm run build`
- **Typecheck All**: `pnpm run typecheck`
- **Codegen API Clients**: `pnpm --filter @workspace/api-spec run codegen`
- **DB Push (Dev)**: `pnpm --filter @workspace/db run push` (fallback to `push-force`)
- **Required Env Vars**:
    - `DATABASE_URL` (for Drizzle ORM)
    - `META_APP_ID`, `META_APP_SECRET` (for Meta Graph API)
    - `CLOUD_CAMPAIGN_API_KEY`, `CLOUD_CAMPAIGN_AGENCY_ID`, `CLOUD_CAMPAIGN_WORKSPACE_IDS` (for Cloud Campaign API)
    - `PORT` (for API server)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **ORM**: Drizzle ORM (PostgreSQL)
- **Validation**: Zod, `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle for backend), Vite (frontend)
- **Frontend**: React

## Where things live

- **Frontend App**: `artifacts/carousel-generator/src/`
- **API Server**: `artifacts/api-server/src/`
- **DB Schema**: `lib/db/src/schema/`
- **OpenAPI Spec**: `lib/api-spec/openapi.yaml`
- **Generated API Client (React Query)**: `lib/api-client-react/src/generated/`
- **Generated Zod Schemas**: `lib/api-zod/src/generated/`
- **Shared Utilities (Frontend)**: `artifacts/carousel-generator/src/lib/slide-utils.ts`
- **Client Brand Presets (DB Schema)**: `lib/db/src/schema/client_presets.ts`
- **Activity Log (DB Schema)**: `lib/db/src/schema/activity_log.ts`
- **Content Calendar (DB Schema)**: `lib/db/src/schema/calendar_posts.ts`
- **Image Approval (DB Schemas)**: `lib/db/src/schema/approval_batches.ts`, `lib/db/src/schema/approval_images.ts`

## Architecture decisions

- **Monorepo Structure**: Uses pnpm workspaces for a monorepo, organizing applications (`artifacts/`) and shared libraries (`lib/`) to centralize tooling and type safety.
- **TypeScript Composite Projects**: Leverages TypeScript's `composite` projects and project references to ensure correct cross-package type-checking and build ordering, emitting only declaration files (`.d.ts`) during typecheck.
- **OpenAPI-driven Development**: API contracts are defined in an OpenAPI spec, which then auto-generates Zod schemas for server-side validation and React Query hooks for the frontend, ensuring strong type consistency across the stack.
- **Client-side Image Processing**: Image compositing, compression, and ZIP generation are handled client-side in the browser to offload server resources and provide immediate feedback.
- **Object Storage for Media**: Rendered slide images are uploaded to Replit Object Storage, decoupling media serving from the application server and providing public URLs.

## Product

- **Carousel Generator**: Upload photos and CSV or use AI to generate up to 60 carousel posts, with in-app preview and ZIP download.
- **Single Image Mode**: Dedicated flow for single-image posts with AI-generated short overlay texts.
- **Story Generator**: Create Instagram Story engagement posts with AI question generation, customizable designs, and various export options.
- **AI Content Generation**: Generate carousel slide text, Instagram captions, and story questions using OpenAI integration.
- **Client Brand Presets**: Save and load reusable brand styling presets per client, including colors, fonts, gradients, and logo positions.
- **Caption Library**: Manage, save, and organize captions by category and client, with bulk save and browse features.
- **Direct Posting Integrations**: Post directly to Instagram and Facebook via Meta Graph API, and to Cloud Campaign.
- **Image Approval System**: Create shareable public links for clients to approve/reject images before final posting.
- **Analytics Dashboard**: View content creation metrics, including summary stats, per-client breakdowns, and activity logs.
- **Content Calendar**: Plan and organize posts with a monthly calendar view, drag-and-drop rescheduling, and filtering.

## User preferences

- **Copywriting voice**: Warm, stoic, and affable. Tone blends Dawn French (self-deprecating, honest, funny, inclusive) with the autobiographical prose style of Bruce Springsteen's "Born to Run" (unhurried, working-class honesty, small ordinary moments made large, sentences that build slowly to something real). The Springsteen influence should never be visible or referenced -- it is purely a stylistic underpinning.
- **No em dashes** in any AI-generated or copywritten content. Ever. Use plain sentences that end and begin. No dashes of any kind used as a parenthetical or pause.
- **Stoic and affable**: never anxious, never overselling, never loud. Confident, grounded, warm.

## Gotchas

- **Typechecking**: Always run `pnpm run typecheck` from the root to ensure all cross-package imports resolve correctly; running `tsc` within a single package might fail.
- **Development Database**: For development, use `pnpm --filter @workspace/db run push` for Drizzle migrations; `push-force` is available as a fallback.
- **API Route Prefix**: All API routes are mounted under `/api`.

## Pointers

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Orval Documentation](https://orval.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Express.js Documentation](https://expressjs.com/)