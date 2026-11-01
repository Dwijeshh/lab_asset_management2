---
name: Lab Asset Manager
description: Calm, structured interface for MAHE laboratory inventory and borrowing.
colors:
  action-terracotta: "#a64f35"
  role-neutral: "#eee5dc"
  success-green: "#16a34a"
  danger-red: "#dc2626"
  canvas: "#f5eee5"
  surface: "#fffaf5"
  ink: "#302824"
  secondary-ink: "#63564e"
  line: "#e4d6c8"
typography:
  headline:
    fontFamily: "Newsreader Variable, serif"
    fontSize: "clamp(2rem, 3.1vw, 2.65rem)"
    fontWeight: 650
  title:
    fontFamily: "Newsreader Variable, serif"
    fontSize: "clamp(1.5rem, 2vw, 1.85rem)"
    fontWeight: 650
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  control: "8px"
  panel: "14px"
  header: "14px"
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
  work-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "20px"
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

The UI uses ivory work surfaces on a warm stone canvas, modest offset shadows, squared-off rounded controls, and compact status chips. Campus imagery identifies the institution, then recedes so the first task appears in the opening viewport. Tables remain readable and scroll within their own region on narrow screens.

**Key Characteristics:**
- Quiet warm surfaces with a restrained terracotta action accent.
- Clear labels and visible action states for repetitive administrative work.
- Compact records and tables, with room around major sections.

## Colors

The palette draws from the brick, stone, and daylight in the MAHE administrative building photograph. Some established role and status chips retain distinct colors so their meanings remain clear.

### Primary
- **Action Terracotta:** primary save and add actions, focus, and selected navigation.

### Secondary
- **Role Neutral:** pale stone distinguishes the administrator badge. Routine secondary actions use a warm neutral outline.

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

**Display Font:** self-hosted Newsreader Variable for page, section, and empty-state headings and summary figures.
**Body Font:** self-hosted DM Sans Variable for controls, tables, forms, and prose.
**Label/Mono Font:** DM Sans Variable for labels; monospace only for real codes or technical data.

**Character:** An editorial serif gives MAHE page headings an institutional voice. The sans face stays calm and precise where staff scan inventory and complete forms. Both fonts ship with the app, avoiding browser font requests.

### Hierarchy
- **Headline:** bold, large page title; scales down on narrow screens.
- **Title:** bold dialog and section titles.
- **Body:** regular reading and form text.
- **Label:** medium-weight field and table labels; table headers may use uppercase tracking.

## Layout

The signed-in shell is a centered 80rem work area. Its compact campus banner remains visible above an overlapping ivory header. The header separates the title and navigation from institution and account controls. On phones, navigation uses two clearly tappable columns. The dashboard leads with scope, tabs, search, and actions; its four totals sit near the inventory as one summary strip. Inventory and user records become labeled vertical records on phones; asset records use two columns on tablets. Desktop keeps compact tables inside named regions.

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
- **Corner Style:** 14px surface corners and 8px controls.
- **Background:** white over the neutral canvas.
- **Shadow Strategy:** a small soft shadow plus a thin stone border.
- **Internal Padding:** 16–24px according to task density. Avoid a card inside a card for ordinary records.

### Inputs / Fields
- **Style:** ivory fill, stone border, gently rounded corners, and full-width fields in forms.
- **Focus:** terracotta ring or border change; labels remain programmatically connected to fields.
- **Error / Disabled:** show a written error near the action and preserve input after a failed save.
- **Dialogs:** use a clear title, visible Close control, keyboard focus management, and an action button that names the operation.
- **Login:** provide a labeled Show/Hide password control while retaining the compact demo-account reference used by this project.

### Navigation
- **Style:** the active page is a warm outlined navigation control; dashboard tabs keep their underline. Each link has a 40px touch height. On phones the primary navigation forms two columns, while the dashboard tab row scrolls within itself.

### Campus imagery
- **Photo:** the MAHE Manipal administrative building anchors login and all signed-in routes. Login has a dedicated photo panel on desktop and a short banner on mobile. Signed-in routes use a shorter top photo banner with the work surface overlapping its lower edge.
- **Palette:** warm stone, ivory, and terracotta run through login and the application workspace. Content below the banner sits on a solid warm canvas for legibility.
- **Institution banners:** the dashboard and laboratory list follow the selected institution, and laboratory detail uses its own institution. All MAHE institutions uses the MAHE photo; MIT, MCODS, and MCOPS use user-supplied campus photos; KMC uses a public-domain campus photo. Each banner has a readable institution label, and photos are framed to show the building rather than zooming tightly. Unknown institutions get a neutral labeled banner rather than an unrelated campus photo.
- **Institution gallery:** user management uses the MAHE photo in its top banner and retains four labeled MAHE, MIT, MCODS, and MCOPS views below the header. The gallery is deliberately shallow so account search and the table appear sooner. Add MCHP and other institutes only when approved, correctly identified photos are available.
- **Attribution:** show the photographer, source, and CC BY-SA 4.0 license near the form. Keep the image credit in `public/mahe-administration.LICENSE.txt` with the asset.

## Do's and Don'ts

### Do:
- **Do** keep labels, empty states, and errors explicit about the current view and recovery action.
- **Do** preserve readable status text alongside status color.
- **Do** use the MAHE logo and name already present in the app header.

### Don't:
- **Don't** let institution names or wide tables push the page beyond the phone viewport.
- **Don't** use a quiet empty state to conceal a failed request.
- **Don't** let photography, summary cards, or nested panels delay the primary task.
