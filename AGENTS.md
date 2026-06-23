# Visual Note Agent Guide

Visual Note is a Next.js, React, TypeScript notebook application that treats every notebook as a structured website instead of a markdown document. Agents must preserve that product direction in all implementation work.

<!-- BEGIN:nextjs-agent-rules -->

## Next.js Version Rule

This is Next.js 16. APIs, conventions, and file structure may differ from older Next versions. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-sensitive behavior. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Product Model

The data hierarchy is:

- `User`: creates an account and logs in.
- `Notebook`: owned by a user; each notebook is its own website.
- `Page`: top navigation item and highest-order content unit inside a notebook.
- `Topic`: left-sidebar subdivision within one page.
- `View`: content shown in the main content area for one topic. Views can combine markdown-like prose, structured components, and dashboards.
- `Component`: a prebuilt display unit for structured information such as labeled data cards, GitHub PR details, travel information, schedules, or dashboard widgets.
- `Data`: structured JSON objects passed into components and views.

The application should make this hierarchy visible in the interface. Avoid reverting to a document editor mental model where a notebook is just a list of markdown files.

## Stack Requirements

- Use Supabase for authentication and persistence.
- Use Base UI for primitive UI behavior.
- Use CSS Modules for shared component styling.
- Use React with TypeScript.
- Keep the lint and format configuration aligned:
    - 300 character maximum line length for TypeScript and TSX files.
    - 4 spaces for indentation.
    - No semicolons.
    - Do not use parentheses for arrow functions with exactly one untyped parameter unless syntax requires them.
    - Do not use curly braces for single-line conditional bodies.

## UI Architecture Rules

- Build all application UI through project-owned shared components under `src/components/ui/`.
- Shared components may import Base UI primitives directly.
- Feature code must import project-owned shared components, not Base UI primitives.
- Feature code must not render raw HTML elements such as `div`, `button`, `input`, `textarea`, `select`, `main`, `section`, `header`, `nav`, `aside`, `ul`, `li`, `p`, or headings directly.
- The only raw HTML exception is the required Next.js document shell in `src/app/layout.tsx`, where `html` and `body` are mandatory.
- Keep shared components small, typed, and styled with adjacent CSS Modules.
- Prefer explicit component names that describe product intent, such as `NotebookShell`, `TopicSidebar`, or `StructuredDataEditor`, over generic layout wrappers in feature code.
- Do not show persistent explanatory copy for controls, sections, or product model concepts at first glance. Frequent users should see the working interface first.
- Put optional explanations behind project-owned info-icon popovers so new users can learn what a feature does without cluttering repeated workflows.

## Article Editor Rules

- Preserve the structured article model when editing. Keyboard flows such as slash commands, heading Enter, list Enter, and empty-list exit should create or move between article blocks instead of leaving raw markdown control text in the editor.
- When changing article parsing or serialization, verify round trips for multi-line structures such as lists, quotes, code blocks, and callouts. Empty list items must not turn into literal `-` or `1.` paragraphs.
- Empty structural blocks must round-trip through markdown serialization. For example, `# ` should remain an empty heading block while the user is typing, not fall back to a paragraph containing raw markdown.
- Keep markdown as the storage format, but avoid exposing raw inline markdown in resting article surfaces. Inline links such as `[label](url)` should display as actual hyperlinks when the block is not being edited.

## Supabase Rules

- Keep Supabase client creation in `src/lib/supabase/`.
- Do not scatter Supabase URL or key reads across components.
- Use `supabase/schema.sql` as the authoritative starter schema for the workspace persistence table and RLS policies.
- Run with custom app-auth backed by Supabase Postgres only; no local demo mode.
- Never commit service role keys or server-only secrets into client code.

## Agent Workflow

- Before making framework-sensitive changes, inspect existing files and the relevant local Next docs when needed.
- After code changes, run `npm run lint:fix` first so fixable lint warnings and errors are handled automatically before manual cleanup.
- Then run `npm run lint`, `npm run format:check`, and `npm run build`.
- If a lint warning or error is not auto-fixable, fix it manually instead of weakening the rule.
- Do not satisfy implementation requests with documentation-only changes.
- Do not bypass the shared UI layer to move faster; add or extend a shared component instead.
