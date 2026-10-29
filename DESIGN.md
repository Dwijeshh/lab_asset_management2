---
name: Lab Asset Manager
description: Calm, structured interface for MAHE laboratory inventory and borrowing.
colors:
  action-terracotta: "#a64f35"
  section-indigo: "#4f46e5"
  success-green: "#16a34a"
  danger-red: "#dc2626"
  canvas: "#f5eee5"
  surface: "#fffaf5"
  ink: "#302824"
  secondary-ink: "#63564e"
  line: "#e4d6c8"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  control: "10px"
  panel: "16px"
  header: "16px"
spacing:
  tight: "8px"
  control: "12px"
  standard: "16px"
  section: "24px"
  wide: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-terracotta}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Lab Asset Manager

## Overview

**Creative North Star: "The Campus Console"**

The interface is calm, structured, and modern. It is a work surface for locating equipment and acting on records, so hierarchy and status clarity carry more weight than decoration. The MAHE logo, campus photograph, and warm brick accent establish identity across login and every signed-in route.

The UI uses ivory panels on a warm stone canvas, modest shadows, rounded controls, and compact status chips. Preserve that familiar language when adding screens. Let tables remain readable and scroll within their own region on narrow screens.

**Key Characteristics:**
- Quiet warm surfaces with a restrained terracotta action accent.
- Clear labels and visible action states for repetitive administrative work.
- Dense data where needed, with room around major sections.

## Colors

The palette draws from the brick, stone, and daylight in the MAHE administrative building photograph. Some established role and status chips retain distinct colors so their meanings remain clear.

### Primary
- **Action Terracotta:** primary save and add actions, focus, and selected navigation.

### Secondary
- **Section Indigo:** retained for established role and status accents; routine secondary actions use a warm neutral outline.

### Tertiary
- **Success Green:** positive states and the existing Labs action.
- **Danger Red:** destructive actions and error recovery.

### Neutral
- **Canvas:** page background.
- **Surface:** cards, tables, header, and dialogs.
- **Ink:** primary headings and values.
- **Secondary Ink:** supporting copy.
- **Line:** borders and separators.

**The Quiet Accent Rule.** Use accent color to identify an action or state; keep ordinary inventory content on neutral surfaces.

## Typography

**Display Font:** no separate display face is used.
**Body Font:** the Tailwind system sans stack.
**Label/Mono Font:** the body stack; monospace appears only in small code-like institution metadata.

**Character:** Direct, familiar interface typography. Weight and size distinguish hierarchy while table copy stays compact.

### Hierarchy
- **Headline:** bold, large page title; scales down on narrow screens.
- **Title:** bold dialog and section titles.
- **Body:** regular reading and form text.
- **Label:** medium-weight field and table labels; table headers may use uppercase tracking.

## Layout

The dashboard sits in a centered container capped at the Tailwind `max-w-7xl` width, with compact mobile gutters and wider gutters at larger breakpoints. The four inventory totals form one quiet summary strip: two columns on phones and four on desktop. Filters wrap. Inventory, request, loan, and user records become labeled vertical records on phones so details and actions remain readable without page-level horizontal scrolling. Desktop keeps compact tables inside named regions.

**The Local Scroll Rule.** Any table that stays wide owns its horizontal scroll; the entire page should remain within the viewport.

## Elevation & Depth

Depth is modest. Ivory panels separate from the warm canvas through a stone border and a small soft shadow. Dialogs use a stronger shadow and dark backdrop to mark a temporary task. Avoid adding extra nested card layers around ordinary table content.

## Shapes

Inputs, buttons, and data cards use gently rounded corners. The shared header and dialogs have a larger corner radius. Status chips use pill corners to separate state from surrounding text.

## Components

### Buttons
- **Shape:** gently rounded, with compact horizontal padding.
- **Primary:** terracotta with white text for the main asset action.
- **Secondary:** an ivory surface and stone border for navigation and supporting actions.
- **Hover / Focus:** darker fill on hover; visible focus indication must remain on keyboard use.

### Chips
- **Style:** pale role or status fill with darker matching text. The words Available, In Use, Maintenance, and Retired remain visible independently of color.

### Cards / Containers
- **Corner Style:** rounded panel corners, with a larger radius on the shared header.
- **Background:** white over the neutral canvas.
- **Shadow Strategy:** a small soft shadow plus a thin stone border.
- **Internal Padding:** mostly standard or section spacing.

### Inputs / Fields
- **Style:** ivory fill, stone border, gently rounded corners, and full-width fields in forms.
- **Focus:** terracotta ring or border change; labels remain programmatically connected to fields.
- **Error / Disabled:** show a written error near the action and preserve input after a failed save.
- **Dialogs:** use a clear title, visible Close control, keyboard focus management, and an action button that names the operation.
- **Login:** provide a labeled Show/Hide password control while retaining the compact demo-account reference used by this project.

### Navigation
- **Style:** compact rounded administrator links in the header and an underlined active dashboard tab. The tab row scrolls within itself on narrow screens.

### Campus imagery
- **Photo:** the MAHE Manipal administrative building anchors login and all signed-in routes. Login has a dedicated photo panel on desktop and a short banner on mobile. Signed-in routes have a top-aligned photo banner that shows the roof and emblem before the content begins.
- **Palette:** warm stone, ivory, and terracotta run through login and the application workspace. Content below the banner sits on a solid warm canvas for legibility.
- **Institution banners:** the dashboard and laboratory list follow the selected institution, and laboratory detail uses its own institution. All MAHE institutions uses the MAHE photo; MIT, MCODS, and MCOPS use user-supplied campus photos; KMC uses a public-domain campus photo. Each banner has a readable institution label, and photos are framed to show the building rather than zooming tightly. Unknown institutions get a neutral labeled banner rather than an unrelated campus photo.
- **Institution gallery:** user management uses the MAHE photo in its top banner and shows labeled MAHE, MIT, MCODS, and MCOPS photo cards below the header on desktop and mobile. Add MCHP and other institutes only when approved, correctly identified photos are available.
- **Attribution:** show the photographer, source, and CC BY-SA 4.0 license near the form. Keep the image credit in `public/mahe-administration.LICENSE.txt` with the asset.

## Do's and Don'ts

### Do:
- **Do** keep labels, empty states, and errors explicit about the current view and recovery action.
- **Do** preserve readable status text alongside status color.
- **Do** use the MAHE logo and name already present in the app header.

### Don't:
- **Don't** let institution names or wide tables push the page beyond the phone viewport.
- **Don't** use a quiet empty state to conceal a failed request.
- **Don't** invent a new brand palette or typeface without a separate design decision.
