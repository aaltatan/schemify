---
name: schemify editor
description: A drafting sheet for building JSON Schemas, with the live schema printed as a blueprint.
colors:
  accent: "oklch(0.47 0.16 260)"
  accent-hover: "oklch(0.41 0.16 260)"
  accent-soft: "oklch(0.93 0.035 258)"
  on-accent: "oklch(0.99 0.005 245)"
  paper: "oklch(0.962 0.008 245)"
  grid: "oklch(0.925 0.012 245)"
  sheet: "oklch(0.99 0.003 245)"
  sunken: "oklch(0.945 0.01 245)"
  rule: "oklch(0.87 0.012 245)"
  rule-strong: "oklch(0.74 0.018 250)"
  ink: "oklch(0.26 0.035 258)"
  ink-muted: "oklch(0.47 0.03 255)"
  danger: "oklch(0.52 0.19 27)"
  danger-soft: "oklch(0.95 0.03 27)"
  ok: "oklch(0.5 0.12 160)"
  print: "oklch(0.255 0.06 258)"
  print-rule: "oklch(0.34 0.06 258)"
  print-ink: "oklch(0.93 0.02 240)"
  accent-dark: "oklch(0.78 0.11 245)"
  accent-hover-dark: "oklch(0.84 0.09 245)"
  accent-soft-dark: "oklch(0.33 0.07 255)"
  on-accent-dark: "oklch(0.2 0.04 258)"
  paper-dark: "oklch(0.205 0.035 258)"
  grid-dark: "oklch(0.235 0.04 258)"
  sheet-dark: "oklch(0.245 0.04 258)"
  sunken-dark: "oklch(0.215 0.038 258)"
  rule-dark: "oklch(0.33 0.04 258)"
  rule-strong-dark: "oklch(0.45 0.045 255)"
  ink-dark: "oklch(0.94 0.012 245)"
  ink-muted-dark: "oklch(0.74 0.03 248)"
  danger-dark: "oklch(0.74 0.15 25)"
  danger-soft-dark: "oklch(0.3 0.06 25)"
  ok-dark: "oklch(0.78 0.12 160)"
  print-dark: "oklch(0.165 0.035 258)"
  print-rule-dark: "oklch(0.28 0.04 258)"
  print-ink-dark: "oklch(0.92 0.02 240)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
  wordmark:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  button:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
  code-block:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  xs: "3px"
  sm: "4px"
  md: "5px"
  lg: "6px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  logo-mark:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    size: "28px"
  link-footer:
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
  link-footer-hover:
    textColor: "{colors.accent}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  input-title:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "44px"
  button-add:
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-add-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  button-icon:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    size: "32px"
  button-icon-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  button-icon-remove-hover:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
  card-property:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-property-body:
    backgroundColor: "{colors.sunken}"
    padding: "16px"
  chip-source:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  chip-source-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
  select-option-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  theme-switch:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.lg}"
    padding: "2px"
  theme-switch-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    size: "28px"
  panel-print:
    backgroundColor: "{colors.print}"
    textColor: "{colors.print-ink}"
    typography: "{typography.code-block}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-print-copy:
    textColor: "{colors.print-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-print-copy-hover:
    backgroundColor: "{colors.print-rule}"
    textColor: "{colors.print-ink}"
  button-print-download:
    backgroundColor: "{colors.print-ink}"
    textColor: "{colors.print}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
---

# Design System: schemify editor

## Overview

**Creative North Star: "The Drafting Sheet"**

The editor is a spec sheet pinned to a drafting table. Cool blue-grey paper carries a faint 24px graph grid; property cards are clean sheets laid on it, ruled with 1px hairlines and lifted by the softest navy-tinted shadow. One ink-blue pen marks everything that is live: focus, selection, a checked box, a pressed source, the add affordance. The same ink fills the brand mark, a small tile with a schema's braces around two ruled lines. Everything else is graphite: ink and muted ink on paper.

Beside the sheet sits the blueprint print: the live JSON Schema, navy with pale ink, in both themes. It is the product; the sheet is how you get there. In dark mode the whole table turns to blueprint navy and the print sinks one step deeper so it still reads as its own object.

Density is that of a working tool: 36px controls, 13-14px text, 12-16px gaps. The system rejects the generic neutral-grey SaaS form: no flat grey canvas, no heavy card chrome, no second accent.

**Key Characteristics:**
- Cool blue-grey paper with a 24px graph grid behind everything.
- One ink-blue accent; danger red only where an answer is wrong.
- 1px hairline rules, 5-6px corners, soft navy-tinted shadows.
- Mono only for data (keys, types, values, filenames, JSON); system sans for the rest.
- The JSON panel is a navy blueprint print in light and dark alike.

## Colors

A restrained, cool palette: blue-grey neutrals at hue 245-258, one saturated ink-blue, and a warm red reserved for errors. Every colour is a CSS custom property in OKLCH, redefined per theme; the `-dark` tokens are the same roles under dark mode (system preference or the explicit dark override).

### Primary
- **Drafting Ink Blue** (accent): the only chromatic voice. The brand mark's tile, focus borders and outlines, the caret, checked checkboxes, pressed source chips, the selected-option check, the selected theme segment, the add button on hover, computed-function names, the footer link on hover. In dark mode it lifts to a pale cyan-blue so it reads on navy.
- **Pressed Ink** (accent-hover): the accent one step darker in light, lighter in dark; hover on already-accented controls.
- **Ink Wash** (accent-soft): a pale accent tint for focus halos, text selection, the active listbox option, pressed chips and the selected theme segment.
- **Paper on Ink** (on-accent): text and checkmarks set on solid accent.

### Neutral
- **Drafting Paper** (paper): the page background under the grid.
- **Graph Line** (grid): the 24px graph-paper lines, used only by the body background.
- **Clean Sheet** (sheet): property cards, inputs, the listbox, the header (at 90% with blur).
- **Recess** (sunken): nested type bodies inside a card (at 60%), the theme switch track, icon-button hover.
- **Hairline** (rule): card borders, the header rule, the divider above a card's type body.
- **Strong Rule** (rule-strong): input, checkbox, chip and listbox borders, the nested-body left rule, dashed add buttons, the wordmark divider, the footer link underline, the scrollbar thumb.
- **Graphite Ink** (ink): all primary text.
- **Graphite Muted** (ink-muted): field labels, legends, icon buttons at rest, option group headings, placeholders (at 70%).

### Status
- **Correction Red** (danger) and **Correction Wash** (danger-soft): error text under a field, the invalid input border and its halo, the remove button on hover.
- **Check Green** (ok): the valid-schema state.

### Blueprint
- **Blueprint Navy** (print), **Blueprint Rule** (print-rule), **Blueprint Ink** (print-ink): the JSON panel's ground, its borders and toolbar hovers, and its text. These do not follow the paper; they are navy in both themes.

### Named Rules
**The One Ink Rule.** The accent is the only hue that marks interaction, and the only fill the brand mark wears. If something is live, focused, chosen or pressed, it is ink-blue; nothing else gets a colour.

**The Correction Red Rule.** Danger red appears only on the field whose answer is wrong and on the remove control's hover. It never decorates.

**The Blueprint Print Rule.** The JSON output is always navy with pale ink, whatever the theme. It is a print of the drawing, not part of the sheet.

## Typography

**Body Font:** system sans (ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** system mono (ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)

**Character:** a plain instrument pairing. The sans stays out of the way for questions and labels; the mono marks the things that end up in the JSON.

### Hierarchy
- **Title** (600, 1.125rem, tracking -0.025em): the schema title input only; the largest text in the app.
- **Wordmark** (600, 1rem, tracking -0.02em): "schemify" in the header, after the mark and before a 16px vertical strong rule and "generate" in muted mono at 0.8125rem.
- **Body** (400, 0.875rem): input values, checkbox labels, options, computed summaries.
- **Button** (500, 0.875rem): button labels.
- **Label** (400, 0.8125rem, muted ink): field labels and fieldset legends, sentence case, phrased as the CLI's question.
- **Caption** (400, 0.75rem): error text, the panel's status line, listbox group headings (500), source chips (mono), the footer (link at 500).
- **Code** (mono 400, 0.8125rem): property names (500), type selects, choice values, options, the filename.
- **Code Block** (mono 400, 0.75rem, line-height 1.625): the JSON in the blueprint panel.

### Named Rules
**The Mono Means Data Rule.** Mono is set only on what becomes JSON: keys, type names, values, function names, the filename and the schema itself. Questions, labels and buttons are sans.

**The Question Label Rule.** Labels are sentence-case questions in muted ink at 13px, never uppercase, never letter-spaced.

## Layout

A centred container (max 80rem, 16px side padding) under a sticky 56px header, and above a sticky 40px footer bar; the main area grows to fill the window so the footer sits at the bottom even on a short page. Below 1024px everything stacks in one column; from 1024px the main area splits into a fluid sheet column and a 30rem blueprint column with a 32px gap. The blueprint panel is sticky (top 80px, height `100vh - 9rem`, clearing both bars) so the JSON stays in view while the sheet scrolls.

Inside the sheet column, the title field leads and property cards follow with a 20px gap. Within a card, fields sit on a two-column grid from 640px (12px gaps); the name / type / row-actions line uses a `1fr 11rem auto` grid. Single fields that would sit alone are held to half width so they align with the two-column grid. Nested object bodies indent behind a 1px strong left rule with 16px padding.

Spacing rhythm: 6px between a label and its control, 12px between fields, 16px card padding and section gaps, 24px and 32px between the major columns. The 24px graph grid sets the page's underlying measure.

## Elevation & Depth

Depth comes first from tone and rules: a sheet on paper, a recessed body inside a sheet, all edged by 1px hairlines. Shadows are a soft supporting layer, always tinted with navy (hue 258), never neutral black and never hard-edged. Each object carries exactly one shadow that matches its distance from the paper.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px oklch(0.2 0.05 258 / 0.06)`): property cards resting on the paper.
- **Popover** (`box-shadow: 0 8px 24px -6px oklch(0.2 0.05 258 / 0.25), 0 2px 6px -2px oklch(0.2 0.05 258 / 0.12)`): the open select listbox.
- **Print** (`box-shadow: 0 10px 30px -12px oklch(0.2 0.06 258 / 0.45)`): the blueprint JSON panel.
- **Mark** (`box-shadow: 0 1px 2px oklch(0.2 0.06 258 / 0.3)`): the brand mark tile in the header.
- **Focus Halo** (`box-shadow: 0 0 0 3px var(--accent-soft)`): inputs and an open select; the danger-soft variant on invalid fields.

### Named Rules
**The Tinted Shadow Rule.** Every shadow is navy-tinted and soft. A shadow with a hard offset or a neutral grey/black colour is not part of this world.

## Shapes

Corners are gently eased, never pill-shaped: 5px for every control (inputs, buttons, chips, the listbox), 6px for containers (property cards, the blueprint panel, the theme switch track, the brand mark tile), 4px for small inner parts (checkbox, listbox option, theme segment), 3px for the order badge inside a chip. Only the status dot is round. Borders are always 1px; the add button uses a 1px dashed strong rule to read as an unfilled slot on the drawing.

## Components

### Buttons
A drafting tool's buttons: quiet at rest, inked on intent.
- **Shape:** gently eased corners (5px), 36px tall, 12px horizontal padding, 6px icon gap.
- **Add:** dashed strong-rule outline, muted ink text with a plus icon; on hover the dash turns accent and the fill becomes the ink wash with accent text.
- **Icon:** 32px square, muted ink, no border; hover fills with recess and darkens to ink. The remove icon button hovers to correction wash and red.
- **Disabled:** 40% opacity (30% for icon buttons), no pointer events.
- **Focus:** 2px accent outline, 2px offset, from the global focus style.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** clean sheet, with the type-specific body set flush to the card edges in a 60% recess under a hairline divider.
- **Shadow Strategy:** the Sheet shadow (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 16px, 16px gaps between rows.

### Inputs / Fields
- **Style:** 36px tall, clean sheet fill, 1px strong rule, 5px corners, 10px padding; the label sits above at 6px.
- **Hover:** border darkens to muted ink.
- **Focus:** border turns accent with a 3px ink-wash halo; no outline.
- **Error:** border turns correction red, the halo turns correction wash, and the error text sits directly under that field in 12px red.
- **Checkbox:** a custom 16px box with 4px corners; checked fills accent with a paper-on-ink check icon.

### Select
A custom listbox that looks like an input: same 36px box, a muted chevron that rotates 180deg when open, and the open state holds the focus border and halo. The list is a clean sheet with a strong rule, 5px corners, 4px padding and the Popover shadow; it flips upward when the window runs out below. Options are 4px-cornered rows; the active one gets the ink wash, the selected one an accent check. Optional group headings are 12px medium muted text. Type and value lists use mono.

### Source Chips
Toggle chips for choosing which earlier properties a computed value reads: 28px tall, mono caption, strong-rule border. Pressed chips take the accent border and ink wash and carry a 16px solid-accent order badge (3px corners, sans numerals) showing the argument order.

### Navigation
A sticky 56px header in clean sheet at 90% with a light backdrop blur and a hairline bottom rule. It holds only the brand lockup and the theme switch. The lockup reads mark, "schemify" (Wordmark), a 1px by 16px strong-rule divider, then "generate" in muted mono, spaced 10px apart. The theme switch is a recessed 6px track with three 28px icon segments (system, light, dark); the selected segment takes the ink wash and accent icon. The choice is remembered and applied before first paint.

### Blueprint Panel (signature)
The JSON output as a print: navy ground, pale ink, 1px blueprint-rule border, 6px corners and the Print shadow. A toolbar row holds an 8px status dot (green when valid, red with an issue count when not), the mono filename, a ghost Copy button (blueprint-ink at 80%, hovering to the blueprint rule fill) and a solid Download button (blueprint ink fill, navy text). Below it, the editable mono JSON at 12px with relaxed leading. A JSON read error appears as a red-tinted strip under the toolbar. The panel border brightens when the JSON area has keyboard focus.

### Brand Mark (signature)
A 28px accent tile with 6px corners and the Mark shadow, carrying an 18px on-accent line drawing at stroke 2: a schema's curly braces around two short ruled lines, as on a spec sheet. The favicon is the same mark on a 32px tile with 7px corners. The mark is drawn, never typed.

### Footer
A 40px bar pinned to the bottom of the window, mirroring the header: translucent sheet with a light blur and a top rule, so the copyright is always in view. One caption line in muted ink: the copyright year, then the author's name as a link in medium ink with the 14px GitHub line icon. The link carries a strong-rule underline offset 4px; on hover the text and underline both turn accent.

### Icons
Authored 24px line icons, 1.75 stroke, round caps and joins, drawn in currentColor at 16px (14px in compact places). One stroke weight across the app.

## Do's and Don'ts

### Do:
- **Do** keep the 24px graph grid on the paper behind every surface.
- **Do** use the accent only for interaction states (focus, selection, checked, pressed, add-on-hover, link-on-hover) and the brand mark.
- **Do** set keys, types, values, filenames and JSON in mono at 13px (12px in the blueprint), and everything else in system sans.
- **Do** put an error under the field that caused it, in 12px correction red, with the field's border and halo turned red.
- **Do** use 1px rules, 5px corners on controls and 6px on containers.
- **Do** tint every shadow with navy (hue 258) and keep it soft.
- **Do** keep the blueprint panel navy with pale ink in both themes.

### Don't:
- **Don't** introduce a second accent hue or use the accent decoratively.
- **Don't** fall back to a flat neutral-grey canvas or untinted grey shadows; the neutrals are blue-grey.
- **Don't** use hard offset shadows, pill-shaped controls or borders heavier than 1px.
- **Don't** use mono for labels, questions or buttons.
- **Don't** add uppercase, letter-spaced labels or eyebrow text above fields or sections.
- **Don't** use glyph or emoji icons; draw icons as 24px line SVGs at 1.75 stroke.
- **Don't** hard-code colours outside the token set; every surface reads from the theme's custom properties.
