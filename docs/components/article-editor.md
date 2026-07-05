# Article Editor

This document describes the article editor surface in `visual-note`, including editor-specific components, shared UI usage, and usage wiring for:

- article editor body
- article contents/sidebar outline
- top navbar
- workspace sections/topics sidebar

## Table of contents

1. [Article editor components defined in code](#article-editor-components)
   1. [Hooks](#article-editor-hooks)
   2. [Types + utilities](#article-editor-types-and-utilities)
2. [Shared components and primitives used by the article editor](#shared-components-and-primitives)
   1. [Project shared UI](#project-shared-ui)
   2. [External/shared primitives](#external-shared-primitives)
3. [What is built specifically for the article editor](#editor-specific-components)
4. [How the article editor is wired](#how-the-article-editor-is-wired)
5. [Article editor outline sidebar](#article-editor-outline-sidebar)
6. [Top navbar (`NotebookEditorNavbar`)](#top-navbar)
   1. [UI regions](#top-navbar-ui-regions)
   2. [Settings groups](#top-navbar-settings-groups)
   3. [Parent-driven behavior](#top-navbar-parent-driven-behavior)
7. [Workspace sections/topics sidebar](#workspace-sections-topics-sidebar)
   1. [What it renders](#workspace-sections-topics-what-it-renders)
   2. [Integration notes](#workspace-sections-topics-integration-notes)

<a id="article-editor-components"></a>
## Article editor components defined in code

| Component | File | Purpose |
| --- | --- | --- |
| `ArticleEditor` | [`article-editor.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/article-editor.tsx) | Orchestrates parser, editor mode switching, block list rendering, command menu, and optional contents panel. |
| `ArticleBlockRenderer` | [`article-block-renderer.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-block-renderer.tsx) | Maps parsed block kinds to concrete UI components. |
| `ArticleBlockChip` | [`article-block-chip.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-block-chip.tsx) | Renders per-block metadata labels/details based on `blockInfoMode`. |
| `ReadableArticleBlock` | [`readable-article-block.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/readable-article-block.tsx) | Read-only rendering for all supported block types. |
| `MarkdownImageBlock` | [`markdown-image-block.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/markdown-image-block.tsx) | Renders image blocks and image-editing/upload interactions. |
| `InlineLinkTextarea` | [`inline-link-textarea.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/inline-link-textarea.tsx) | Editable textarea that renders markdown links/images while not actively editing. |
| `BlockTextarea` | [`block-textarea.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/block-textarea.tsx) | Auto-height textarea used for most text blocks. |
| `HighlightedCodeBlock` | [`highlighted-code-block.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/highlighted-code-block.tsx) | Syntax highlighting for reader mode code output. |
| `CommandMenu` | [`command-menu.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/command-menu.tsx) | Slash-command menu UI and action wiring. |
| `ArticleTableOfContents` | [`article-table-of-contents.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-table-of-contents.tsx) | Heading outline panel for in-editor navigation. |
| `DisplayBlock` | [`article-display-block.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-display-block.tsx) | Resolves and renders `{{display:n}}` placeholders. |
| `MarkdownSourceEditor` | [`markdown-source-editor.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/markdown-source-editor.tsx) | Source-code editing mode via Monaco. |
| `article-editor barrel` | [`index.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/index.ts) | Re-exports shared-editor entry points. |

<a id="article-editor-hooks"></a>
### Hooks

- [`use-article-editor-controller.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-editor-controller.ts) — parses content, manages commands/selection, and writes updates.
- [`use-article-block-actions.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-block-actions.ts) — block mutation operations (insert/split/delete). 
- [`use-article-block-selection.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-block-selection.ts) — selection rectangle + bulk-range behavior.

<a id="article-editor-types-and-utilities"></a>
### Types + utilities

- [`types.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/types.ts) — shared editor props and command handler types.
- [`commands.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/commands.ts) — slash-command catalog and filtering.
- [`keyboard.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/keyboard.ts) — keyboard and command navigation behavior.
- [`command-application.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/command-application.ts) — command replacement helpers.
- [`text.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/text.ts), [`heading-target.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/heading-target.ts), [`keyboard-list.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/keyboard-list.ts), [`keyboard-subtitle.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/utils/keyboard-subtitle.ts) — parser/view helpers for heading/list/subtitle behavior.

<a id="shared-components-and-primitives"></a>
## Shared components and primitives used by the article editor

<a id="project-shared-ui"></a>
### Project shared UI

- `Button` → [`button.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/button.tsx)
- `Stack`, `Text`, `Card`, `Divider`, `Pill` → [`primitives.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/primitives.tsx)
- `ContextActions`, `InfoPopover`, `ModalDialog`, `RenameDialog`, `ScrollArea`, `TextField`, `ToolbarMenu` → [`index.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/index.ts)
- `cx` utility → [`class-name.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/class-name.ts)
- `ImageBlockFigure` → [`image-block`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/image-block/index.ts)
- `TextField` input control (form use) → [`text-field.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/form-controls.tsx)

<a id="external-shared-primitives"></a>
### External/shared primitives

- `BaseButton` + `Input` + `Popover` from Base UI → [`notebook-editor-navbar.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/notebook-editor-navbar.tsx)
- Motion primitives → [`article-editor.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/article-editor.tsx)
- Monaco + dynamic import → [`markdown-source-editor.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/markdown-source-editor.tsx)

<a id="editor-specific-components"></a>
## What is built specifically for the article editor

- Entry and orchestration modules:
  - [`ArticleEditor`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/article-editor.tsx)
  - [`MarkdownSourceEditor`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/markdown-source-editor.tsx)
  - [`use-article-editor-controller.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-editor-controller.ts)
  - [`use-article-block-actions.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-block-actions.ts)
  - [`use-article-block-selection.ts`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/hooks/use-article-block-selection.ts)

- Render pipeline and block-level components:
  - [`ArticleBlockRenderer`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-block-renderer.tsx)
  - [`ArticleTableOfContents`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-table-of-contents.tsx)
  - [`ArticleBlockChip`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-block-chip.tsx)
  - [`CommandMenu`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/command-menu.tsx)
  - [`ReadableArticleBlock`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/readable-article-block.tsx)
  - [`ReadableInlineContent`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/inline-link-textarea.tsx)
  - [`HighlightedCodeBlock`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/highlighted-code-block.tsx)
  - [`MarkdownImageBlock`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/markdown-image-block.tsx)
  - [`DisplayBlock`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-display-block.tsx)

<a id="how-the-article-editor-is-wired"></a>
## How the article editor is wired

1. `VisualNoteApp` renders `ViewWorkspace` and passes the selected notebook topic view plus handlers.
2. `ViewWorkspace` maps editor settings into `ArticleEditor` props (`value`, `displays`, `blockInfo`, `contents`, `mode`) and injects `renderDisplay` + `renderVisualBlock`.
3. `ArticleEditor` uses `useArticleEditorController` to parse markdown and build block handlers.
4. Render flow by mode:
   - `source` → [`MarkdownSourceEditor`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/markdown-source-editor.tsx)
   - `editing` → parsed block list + [`ArticleBlockRenderer`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-block-renderer.tsx)
   - `reader`/read-only → [`ReadableArticleBlock`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/readable-article-block.tsx)
5. `ArticleBlockRenderer` delegates by block kind (`paragraph`, `heading`, `callout`, `list`, `code`, `display`, `visual`, `image`, etc.).
6. `CommandMenu` reads controller command state and executes selected command actions.
7. Contents panel is optional and controlled via `contentsMode`.

<a id="article-editor-outline-sidebar"></a>
## Article editor outline sidebar (`ArticleTableOfContents`)

- Component: [`article-table-of-contents.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/article-editor/components/article-table-of-contents.tsx)
- Inputs: `headings`, `hideTitle`
- Behavior:
  - returns `null` when no headings exist
  - renders heading links with level classes
  - clicking scrolls to target heading + focuses heading input when possible
- Visibility is controlled by `contentsMode`:
  - `show`, `hide-title`, `hide`

<a id="top-navbar"></a>
## Top navbar (`NotebookEditorNavbar`)

- Component: [`notebook-editor-navbar.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/components/ui/notebook-editor-navbar.tsx)
- Parent is in [`visual-note-app.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/features/visual-note/visual-note-app/visual-note-app.tsx)

<a id="top-navbar-ui-regions"></a>
### UI regions

- Left: sidebar toggle + notebook switcher.
- Middle: search input and search result list.
- Right: editor settings menu + export action.

<a id="top-navbar-settings-groups"></a>
### Settings groups

- `Block Info` controls (`show`, `type-only`, `metadata-only`).
- `Outline` controls (`show`, `hide-title`, `hide`).
- `Mode` controls (`editing`, `source`, `reader`).

<a id="top-navbar-parent-driven-behavior"></a>
### Parent-driven behavior

- Receives settings/search state from `VisualNoteApp` and emits updates through:
  - `onSearchChange`, `onSearchLoadMore`, `onSearchResultSelect`
  - `onSettingsChange`, `onMoreSettings`
  - `onToggleSidebar`, `onExport`, `onHomeSelect`, `onNotebookSelect`

<a id="workspace-sections-topics-sidebar"></a>
## Workspace sections/topics sidebar

- Component: [`section-sidebar.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/features/visual-note/visual-note-app/components/section-sidebar.tsx)
- Dialog layer: [`section-sidebar-dialogs.tsx`](https://github.com/VirajShah21/visual-note/blob/fix/sidebar-ui-ux/src/features/visual-note/visual-note-app/components/section-sidebar-dialogs.tsx)

<a id="workspace-sections-topics-what-it-renders"></a>
### What it renders

- Section list with context actions (rename/delete).
- Topic list per section with context actions (rename/delete).
- New section/topic actions.
- Selection callbacks to update active section/topic.

<a id="workspace-sections-topics-integration-notes"></a>
### Integration notes

- `VisualNoteApp` owns visibility and action handlers.
- This sidebar is parented by the same feature-level screen that also renders editor content.
