# GymApp

A Next.js 16 web application for gym coaching management. Coaches manage training plans and students; students track their workout sessions.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS v4, shadcn/ui components (`src/components/ui/`), HeroUI, lucide-react
- **Backend**: Supabase (PostgreSQL + Auth)
- **Data fetching**: TanStack React Query v5
- **Testing**: Vitest (`npm test`)
- **Package manager**: npm

## Key Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
npm test          # Vitest (run once)
npm run test:watch # Vitest watch mode
```

## Project Structure

```
src/
  app/
    (dashboard)/          # Auth-protected dashboard (layout checks role via Supabase)
      coach/              # Coach views: student list, student detail, templates, library
        student/
          actions.ts      # Server Actions for plan/session mutations
          [studentId]/    # Student detail page
      student/            # Student views: today's session, plan summary
      admin/              # Admin dashboard
      layout.tsx          # Redirects unauthenticated; injects role-based nav
    auth/                 # Login, forgot-password, reset-password pages
    api/                  # API routes (templates, exercises, user, etc.)
  hooks/                  # React Query hooks (useCoachStudents, useTrainingPlan, etc.)
  lib/
    supabase.ts           # Three Supabase client factories (browser, server, admin)
    utils.ts              # cn() helper (clsx + tailwind-merge)
    constants.ts
  types/
    supabase.ts           # Generated Supabase DB types (do not edit manually)
  components/
    ui/                   # shadcn/ui components
    ExerciseFormModal.tsx
```

## User Roles

Three roles defined in Supabase enum `user_role`: `ADMIN`, `COACH`, `STUDENT`.

- **ADMIN**: Full access — admin dashboard + all coach features
- **COACH**: Students panel, templates, exercise library
- **STUDENT**: Today's session view, profile

Role is read from `profiles` table on every dashboard request in `(dashboard)/layout.tsx`.

## Supabase Clients

Always use the correct client:
- `createSupabaseBrowserClient()` — client components (singleton)
- `createSupabaseServerClient()` — Server Components and Server Actions (uses cookies)
- `createSupabaseAdminClient()` — service-role operations (bypasses RLS), server only

## Data Patterns

- **Reads**: React Query hooks in `src/hooks/` fetching from `/api/` routes
- **Writes**: Next.js Server Actions (`"use server"`) in `actions.ts` files co-located with routes; call `revalidatePath()` after mutations
- **Cache invalidation**: Server Actions call `revalidatePath`; client mutations also call `queryClient.invalidateQueries()`

## UI Conventions

- UI text is in **Spanish**
- Mobile-first design; most containers use `max-w-4xl mx-auto` with responsive padding
- Rounded cards: `rounded-2xl`, `rounded-xl`; buttons often `rounded-2xl`
- Color tokens: `text-muted-foreground`, `bg-card`, `border-border`, `text-primary`
- Font weight used for hierarchy: `font-black` for headers/labels, `font-bold` for emphasis
- Tracking: `tracking-widest` on uppercase labels, `tracking-tight` on headings
- Labels use `text-[10px] font-black uppercase tracking-widest text-muted-foreground`

## Path Alias

`@/*` maps to `./src/*`.
