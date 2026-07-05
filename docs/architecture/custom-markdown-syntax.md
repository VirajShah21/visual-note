# Custom Markdown Syntax

Last updated: 2026-07-05

## Table of contents

1. [Purpose](#purpose)
2. [Canonical implementation](#canonical-implementation)
3. [Supported block syntax](#supported-block-syntax)
4. [Visual Note extensions](#visual-note-extensions)
    1. [Subtitle containers](#subtitle-containers)
    2. [Callout containers](#callout-containers)
    3. [Display embeds](#display-embeds)
    4. [Visual blocks](#visual-blocks)
    5. [Page storage markers](#page-storage-markers)
5. [Inline syntax](#inline-syntax)
6. [Parser and serialization behavior](#parser-and-serialization-behavior)
7. [Export and storage behavior](#export-and-storage-behavior)
8. [Examples](#examples)
9. [Validation checklist](#validation-checklist)

## Purpose

Visual Note stores article content as markdown, but the editor supports a small
set of product-specific extensions for notebook displays and structured visual
blocks. This document defines the markdown syntax that can be parsed, edited,
serialized, exported, and persisted for page article content.

This syntax is not intended to replace the product model. Notebooks, pages,
topics, views, components, and data remain structured platform concepts; markdown
is the portable article-body representation inside that model.

## Canonical implementation

The source of truth for syntax behavior is code:

- Parser and serializer: [`article-content.ts`](../../src/lib/visual-note/article-content.ts)
- Visual block kinds and JSON5 body handling: [`visual-blocks.ts`](../../src/lib/visual-note/visual-blocks.ts)
- Export renderer: [`markdown.ts`](../../src/lib/visual-note/export/markdown.ts)
- Export document builder: [`document.ts`](../../src/lib/visual-note/export/document.ts)
- Article editor commands: [`commands.ts`](../../src/components/ui/article-editor/utils/commands.ts)
- Keyboard shortcut replacement: [`keyboard.ts`](../../src/components/ui/article-editor/utils/keyboard.ts)
- Inline media/link rendering: [`inline-link-textarea.tsx`](../../src/components/ui/article-editor/components/inline-link-textarea.tsx)
- Page content persistence: [`page-content-store.ts`](../../src/server/visual-note/page-content-store.ts)
- Page storage serializer and hydrator:
  [`workspace-store-save-helpers.ts`](../../src/server/visual-note/workspace-store-save-helpers.ts) and
  [`page-markdown-hydration.ts`](../../src/server/visual-note/page-markdown-hydration.ts)

When this document and code disagree, code wins and this document should be
updated.

## Supported block syntax

| Block              | Syntax                                      | Notes                                                                                                            |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Heading            | `#`, `##`, `###`, `####`                    | Only levels 1 through 4 are parsed as heading blocks. A space after the marker is required.                      |
| Paragraph          | Plain text separated by blank lines         | Paragraph collection stops when the next non-empty line starts another recognized block.                         |
| Bullet list        | `- item` or `* item`                        | Consecutive bullet lines become one list block. Empty marker lines are accepted while editing.                   |
| Ordered list       | `1. item`                                   | Consecutive numbered lines become one ordered list block. Serialized numbering is normalized to `1.`, `2.`, etc. |
| Quote              | `> quoted text`                             | Consecutive quote lines become one quote block.                                                                  |
| Code fence         | Triple backticks with optional language     | Empty language serializes as `text` through parser fallback.                                                     |
| Divider            | `---`                                       | Must be the whole trimmed line.                                                                                  |
| Markdown image     | `![alt](https://example.com/image.png)`     | Must occupy the full trimmed line to become an image block.                                                      |
| Display embed      | `{{display:1}}`                             | Visual Note extension; one-based display index in markdown, zero-based in memory.                                |
| Subtitle container | `:::subtitle` ... `:::`                     | Visual Note extension.                                                                                           |
| Callout container  | `:::note`, `:::tip`, `:::warning` ... `:::` | Visual Note extension.                                                                                           |
| Visual block fence | ` ```visual:<kind> ` ... ` ``` `            | Visual Note extension with a JSON5 object body.                                                                  |

The parser ignores a standalone `{{toc}}` line. It is accepted as a marker but
does not currently serialize back into article content.

## Visual Note extensions

### Subtitle containers

Subtitle blocks are written as container blocks:

```markdown
:::subtitle
Short context for the article or section.
:::
```

Serialization preserves the container form. Empty subtitle blocks serialize as:

```markdown
:::subtitle
:::
```

### Callout containers

Supported callout tones are `note`, `tip`, and `warning`:

```markdown
:::note
This is a note.
:::

:::tip
This is a tip.
:::

:::warning
This is a warning.
:::
```

If a callout container is empty, the parser creates fallback text in the form
`<tone> note content`.

### Display embeds

Displays are embedded with a one-based display index:

```markdown
{{display:1}}
{{display:2}}
```

The parser stores `{{display:1}}` as `displayIndex: 0`. Serialization converts
the zero-based value back to the one-based markdown marker.

The parser accepts optional spaces around the number:

```markdown
{{display: 1 }}
```

Display markers are only recognized when the whole trimmed line matches the
display pattern.

### Visual blocks

Visual blocks use fenced code blocks with a `visual:<kind>` info string:

````markdown
```visual:task-list
title: "Launch checklist"
tasks: [
    { title: "Finish renderer", done: false, dueDate: "2026-06-11", owner: "Viraj" },
    { title: "Run build", done: false, dueDate: "2026-06-11", owner: "Codex" },
]
```
````

The body is parsed as JSON5 object properties. The parser wraps the body in `{`
and `}` before calling JSON5, so the body should contain object fields, not an
outer object wrapper.

Supported visual block kinds:

- `image`
- `pull-request`
- `calendar-event`
- `packing-list`
- `contact-card`
- `address-card`
- `chart`
- `recipe`
- `task-list`
- `shopping-list`
- `timeline`
- `poll`

If the visual kind is not recognized, the fence is treated as a normal code block.
If the kind is recognized but the JSON5 body does not parse, the block remains a
visual block with a parse error and preserves the raw body for serialization.

### Page storage markers

Page objects stored in notebook object storage wrap article markdown with
storage-only HTML comments:

```markdown
<!-- visual-note:topic topic-id -->

## Topic title

<!-- visual-note:view view-id -->

### View title
```

These comments are not article blocks and are not emitted by
`serializeArticleContent`. They are generated by `pageMarkdownFromWorkspace` so a
single page object can preserve every topic and every view body, including
multiple views under the same topic and intentionally empty view bodies.

Hydration prefers these markers when they exist. If a stored page does not have
markers, `hydrateViewsFromPageMarkdown` falls back to matching `##` topic
headings and assigns each topic section to the first article view, or otherwise
the first view for that topic.

## Inline syntax

The editor command menu can insert these inline markdown snippets:

| Inline command | Inserted text                 |
| -------------- | ----------------------------- |
| Bold           | `**text**`                    |
| Italic         | `*text*`                      |
| Inline code    | `` `code` ``                  |
| Link           | `[text](https://example.com)` |

Current readable inline rendering only special-cases markdown links and inline
images matching:

```text
[label](https://example.com)
![alt](https://example.com/image.png)
```

Supported rendered URL schemes are:

- `http:`
- `https:`
- `mailto:`
- `tel:`
- `data:image/`
- `blob:`
- root-relative URLs beginning with `/`

Other link targets are normalized by prepending `https://` for rendered output.
Bold, italic, and inline code may be stored as plain markdown text, but they are
not currently parsed into distinct inline render nodes by the readable inline
renderer.

## Parser and serialization behavior

- Line endings are normalized from CRLF to LF before parsing.
- Blank lines separate blocks.
- Empty content parses to one paragraph block with `Start by adding content in this article.`
- If a view has configured displays but no display block, parsing appends a helper paragraph:
  `Use {{display:1}}, {{display:2}}, and so on to embed configured displays inline.`
- Heading IDs are generated from heading text by lowercasing, stripping non-alphanumeric separators, converting whitespace to `-`, and de-duplicating with numeric suffixes.
- Paragraphs can span multiple lines until a blank line or recognized block start.
- Only headings with a marker followed by whitespace parse as headings.
- Code fences close on the next line whose trimmed content starts with triple backticks.
- Container blocks close on a line whose trimmed content is exactly `:::`.
- Serialization joins blocks with one blank line.
- Ordered list serialization renumbers items from 1.
- Visual block serialization uses JSON5 formatting with four-space indentation.

## Export and storage behavior

Page storage and Export to Markdown share article block parse/serialize
semantics, but they are different whole-page formats.

Page storage:

1. Build marked page markdown with `pageMarkdownFromWorkspace`.
2. Write the page H1, topic markers, `##` topic headings, view markers, and `###`
   view headings.
3. Parse and serialize each non-empty view body through `parseArticleContent` and
   `serializeArticleContent`.
4. Persist page markdown with content type `text/markdown; charset=utf-8`.

Export rendering:

1. Build an export document with [`createExportDocument`](../../src/lib/visual-note/export/document.ts).
2. Render markdown with [`renderMarkdownExport`](../../src/lib/visual-note/export/markdown.ts).
3. Select one view per topic: first article view, otherwise the first view,
   otherwise no body.
4. Omit page-storage topic/view marker comments.

Export rendering adds structural headings around view content:

- notebook export: notebook title is H1, page titles are H2, topic titles are H3
- page export: page title is H1, topic titles are H2

Page article content itself should normally live in markdown object storage, not
as JSON schemas in Postgres. Routes that cannot write object storage may preserve
SQL view content with warning payloads as a temporary fallback. See
[notebook-storage.md](./notebook-storage.md) for the full page storage contract.

## Examples

### Basic article

```markdown
# Overview

:::subtitle
Storage rules for page content.
:::

This page uses markdown as the article body format.

## Requirements

- Store page content in S3-compatible object storage
- Keep graph metadata in Postgres
- Reuse article block parse/serialize formatting

:::warning
Do not store article bodies as JSON schemas in SQL.
:::
```

### Structured page with display and visual block

````markdown
# Launch Plan

{{display:1}}

```visual:timeline
title: "Launch timeline"
events: [
    { label: "Schema ready", date: "2026-07-04", time: "" },
    { label: "Migration shipped", date: "2026-07-05", time: "" },
]
```

:::tip
Keep this page exportable as a normal markdown file.
:::
````

### Stored page object

```markdown
# Launch Plan

<!-- visual-note:topic topic-1 -->

## Planning

<!-- visual-note:view view-1 -->

### Article

The article view body is stored below its view marker.

<!-- visual-note:view view-2 -->

### Dashboard Notes

The second view can keep its own body in the same page object.
```

## Validation checklist

Use this checklist when changing article parsing, serialization, storage, or
export behavior:

1. Parse and serialize every supported block type.
2. Verify empty headings, empty list items, empty callouts, and empty subtitles round-trip.
3. Verify visual block JSON5 bodies serialize without adding an outer object wrapper.
4. Verify invalid visual JSON5 preserves raw body text.
5. Verify display markers remain one-based in markdown and zero-based in memory.
6. Verify page storage markers preserve all topic/view bodies across hydration.
7. Verify Export to Markdown still produces marker-free user-facing markdown.
8. Verify `GET /api/pages/[pageId]/content` returns markdown, not a JSON block schema.
