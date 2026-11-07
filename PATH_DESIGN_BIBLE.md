# Path Product Design Bible

**Product Design System Context · Version 1.0 · 7 November 2026**

**Audience** — Path Product Designer, Lead, Developer, QA and Integrator.

**Purpose** — Give a new designer enough product, interaction and visual context to make coherent decisions and deliver implementable specifications. Use this document as the design reference, together with the current task and inspected implementation.

## How to interpret this document

Four evidence labels prevent historical choices from becoming invented requirements.

| Label | Meaning |
| --- | --- |
| **Established** | A recorded owner decision, including the latest applicable correction. Preserve its intent across new work. |
| **Observed / reported** | A behavior, value or result found in the inspected RC18 snapshot or a later completion report. It describes evidence and its limits. It does not automatically make every detail a permanent design rule. |
| **Design guidance** | A professional recommendation supplied by this Bible. Use it as a proposed working standard and validate it in the task. It is not represented as a previously approved owner decision. |
| **Open / designer discretion** | The history does not settle this detail. Resolve it with a concrete proposal, explain the tradeoff and record the decision. |

Within a section, explicit labels take precedence over general wording. Additional workflow, accessibility, state and handoff recommendations are **Design guidance** unless marked otherwise. Exact implementation values are **Observed** unless an approval is identified.

Resolve conflicts in this order. Follow the owner's latest explicit decision, then the accepted specification for the particular task, then this consolidated reference. Inspect current code to understand shipped behavior and compatibility. Treat old prototypes and screenshots as historical evidence. A file named “authoritative” can still have been superseded by a later user decision. A bug in current code is a problem to solve.

This document consolidates the available development conversation, the inspected RC18 source snapshot, and the reported Today Core Polish completion. The local RC18 snapshot predates the latest Paperclip integrations. Inspect the actual working branch before making changes. Section 6 distinguishes those later reported results from independently inspected source.

## 1. Product identity

### Product and audience

Path is a personal digital environment for organizing life. It connects what a person intends to do, when they will do it, the work needed to get there, and the record of what actually happened. Tasks, events, projects, workouts, habits, notes and spatial thinking belong to one understandable environment.

The originating use case combines university, creative work, software projects, training and philosophy, with a schedule that changes from week to week. Design for people managing several meaningful areas of life with limited attention. This includes students, independent creators and people building consistent routines. These are product assumptions grounded in the founding use case, rather than a completed market segmentation study.

**Established experience goals**

- Calm, personal, modern and deliberate.
- A clear next action when the user wants to act quickly.
- Space for deeper planning and reflection when the user chooses it.
- A coherent visual and interaction language across all eight sections.
- Responsive, tactile feedback with restrained personality.

Path's distinctiveness comes from the combination of connected life areas, a recognizable Greek visual identity, quiet monochrome surfaces and carefully controlled movement. Each part should help the user orient, act or reflect.

### Product principles

Design around a continuous flow from intention to action to reflection. A project task scheduled into Calendar should remain recognizably the same work. A completed workout or habit should have an understandable effect in Today and Progress. Show the relationship when it matters, without requiring users to understand the storage model.

Make common actions easy to repeat. Keep the current day, selected date, scheduled time and completion state explicit. Preserve user agency over priorities, rest, planning and the amount of information shown.

**Design guidance** — Use supportive, direct language. A missed habit or empty day should lead to a useful next step. Avoid moral judgment, guilt, manufactured urgency and productivity scores with unclear meaning. Local saving, optional account features and cloud status need truthful, distinct feedback.

### Philosophy and minimalism

Philosophy contributes reflection, perspective and continuity. Greek references create a recognizable cultural and visual vocabulary. Minimalism reduces competing signals while preserving the information and controls required to act confidently. A layout with fewer visible controls still needs discoverable actions, accessible labels and clear recovery from mistakes.

## 2. Visual language

### Established visual direction

Use **dark premium minimalism** with a **monochrome-first palette**. Compose broad dark areas, quiet raised surfaces, off-white primary content, restrained secondary text and selective contrast. “Premium” comes from proportion, consistency, legibility and careful behavior.

| Element | Design rule |
| --- | --- |
| Background | Deep charcoal or near-black, visually stable and low in texture. Keep decorative gradients extremely restrained. |
| Surfaces | Separate adjacent layers with small tonal differences. Use raised surfaces where a group or action benefits from a boundary. |
| Borders | Thin, quiet separators. Increase definition for selection, focus and meaningful interaction boundaries. |
| Glow | Soft, local and brief. Reserve it for completion, selection or a specific emphasis. |
| Shadows | Establish overlap and elevation for floating controls and dialogs. Keep ordinary content grounded. |
| Geometry | Soft rounded corners with a coherent family across containers and controls. Match radius to component scale. |
| Hierarchy | Establish priority through placement, size, whitespace, text weight and contrast. |
| Density | Allow compact planning tools while maintaining comfortable reading and pointer accuracy. |
| Color | Keep ordinary navigation, task controls and chrome neutral. Introduce color only for a clear semantic or user-content purpose. |

**Observed RC18 references, not a finalized token contract** — Today CSS includes a `#111214` background, surfaces around `#191a1c`–`#1d1e20`, and 16 px card radii. Compact editors include a `#1c1d20` surface, 16 px radius and smaller input radii. These values help locate the existing character. Inspect computed styles and contrast before promoting them into shared tokens.

### Spacing and hierarchy

**Established** — Today uses the selected Variant B composition. Main Task, Habits, Weekly Progress and Upcoming information have clear roles. Lower supporting sections such as Upcoming, Goals and Notes may use open layouts without an enclosing frame.

**Design guidance** — Use a small, reusable spacing scale. Within a component, related content should be closer together than separate sections. Align titles, text starts, metadata and action areas across siblings. Give the primary task the first visual reading position. Preserve a recognizable rhythm when content wraps or a section becomes empty.

Avoid turning every paragraph into a card. Add a surface when it clarifies grouping, interaction or elevation. Use open whitespace and alignment for lighter supporting content. Establish a minimum readable width for a component before selecting its column count.

**Open** — A complete numeric spacing scale, all surface tokens, density modes and universal radius scale have not been approved. Propose and validate these as a coherent system.

### Typography

**Observed** — The inspected interface uses a sans-serif working UI, including Manrope with fallbacks, and classical serif display treatment in selected headings, including Georgia references. This supports the established balance between contemporary utility and classical identity.

**Design guidance** — Use the sans-serif role for controls, metadata, forms and dense planning. Use the serif role selectively for major titles or reflective content. Make a heading recognizable without oversized ornament. Keep dates and counters stable when their values change. Reserve uppercase tracking for short labels, with enough size and contrast to remain readable.

**Open** — A complete approved type ramp and font packaging policy are absent. Extract the current computed styles, verify Cyrillic and Spanish glyphs and establish text roles before changing font families. Screenshots with tiny muted text do not justify inaccessible text sizes.

### Color boundaries

**Established** — The interface and its motion use restrained neutral accents. Canvas supports adjustable object or connection colors. Calendar requires meaningful distinctions between importance levels and event types. User images retain their own colors.

**Design guidance** — Express importance with a combination of label or icon, weight and tonal emphasis. A semantic warning may use an accent if it adds comprehension and is specified consistently. Pair it with wording and an icon. Color must not become the only carrier of state. A multicolor taxonomy, accent palette or chart palette remains **Open** until specified and reviewed.

Avoid excessive bloom, glossy decoration on every surface, rainbow categories, ornamental gradients, overly faint metadata, heavy border grids and nested cards that consume working space.

## 3. Greek and philosophical identity

### Ionic column

**Established** — The navigation uses the approved Ionic column artwork, with restrained volutes, a straight base and a vertically centered composition. Preserve the supplied silhouette and proportions. The column is compact and has no extra information beneath it. Settings belong in Profile.

Use the actual approved SVG assets. Historical asset names include `Ionic_Column_NO_ICONS.svg`; the inspected source also contains `Ionic_Column_FINAL_No_Icons.svg` and `assets/ionic-navigation-v2/svg/`. Compare the artwork before choosing a file. An asset name alone does not establish which revision is final.

Adapt the central shaft to fit usable navigation targets when necessary. Preserve the characteristic top and base. Make optical alignment and hit targets independent of decorative linework.

### Portrait placement

The later addition of portraits to more overview screens supersedes the earlier blanket exclusions in Motion Master v5. The subsequent Calendar removal overrides the temporary Calendar–Seneca placement.

| Context | Latest recorded placement and scope |
| --- | --- |
| Today | Marcus Aurelius as the established home identity, positioned with the quote composition. |
| Sport overview | Spartan head. Keep focused workout execution clear of a competing portrait. |
| Projects overview | Aristotle. |
| Canvas library | Plato, limited to the board library. The open spatial workspace is clear of the portrait. |
| Habits | Marcus Aurelius. |
| Notes overview | Socrates. The later mapping supersedes the earlier Seneca assignment. Hide the portrait in focused note editing. |
| Progress overview | Aristotle. Hide it in detailed progress views. |
| Calendar | No philosopher portrait, following the later explicit removal. |
| Profile / Settings | No decorative portrait placement has been approved for these controls. |

Seneca remains part of the philosophical asset and quote vocabulary. A new permanent route for Seneca is **Open**. Additional rotation rules, portrait selection and new placements require a reasoned proposal.

### Particle language

**Established** — Portraits are minimal white or neutral dots on the dark interface. The approved particle family has 516 circles per portrait and a common 371 × 486 viewBox in the motion specification. Preserve recognizable silhouettes and spatial correspondence during morphs. The latest refinement asks for slightly larger portraits, weaker scroll-follow movement and one coherent wave. Exact final display dimensions remain context-dependent.

One portrait system should own the active transition. Avoid overlapping independent portrait loops. Keep the layer clear of pointer interactions. In focused reading, editing or training, decorative movement yields to the task.

### Quotes and classical references

**Established** — Today includes a daily quote, with the portrait to its left in the accepted composition. The classical treatment should reinforce a reflective moment without dominating the next action.

**Design guidance** — Keep quotes short enough to coexist with primary content. Attribute them accurately and identify paraphrases. Avoid invented quotations and avoid changing quotes during an active task in a way that shifts layout. Translate quote text intentionally rather than attaching English-only content to a localized screen.

Use a classical reference where it communicates product identity or a meaningful section character. Decorative columns inside cards, repeated busts on every subview and classical ornament around form controls create unnecessary competition.

## 4. Motion system

### Ownership and scope

**Established** — Motion is soft, bouncy, responsive and restrained. A single action must not gratuitously move unrelated UI. Preserve text readability, spatial orientation and interaction while feedback runs. User input and navigation must remain available.

Motion Master v5 supplies the shared vocabulary. Path Pulse v6.1 replaces the earlier general pulse envelope. Later Today-specific corrections narrow that behavior further. The applicable screen rule takes priority over a general effect.

### Retained motion references

| Behavior | Recorded parameters | Scope and status |
| --- | --- | --- |
| Default ambient intensity | Subtle | Established. |
| Ambient dot drift | Approximately 0.5–1.5 px on a small subset of dots | Established qualitative range. Preserve the silhouette. |
| Portrait travel morph | 4 px wave amplitude, 1450 ms | Established default. Respect saved user adjustments. |
| Particle staging | Up to 190 ms stagger, spatially matched particles, retarget from current frame | Observed retained v5 configuration. |
| Local dot pulses | 4–8 neighbors, 18–26 px radius, 680–970 ms duration, 1250–2900 ms intervals, maximum radius factor 1.68 | Observed retained v5 parameters. Rare local emphasis, never whole-bust scaling. |
| Checkmark completion | 565 ms, scale 0.28 → 1.32 → 0.89 → 1.055 → 1 at offsets 0, .35, .67, .85, 1 | Retained configured reference for the approved bouncy checkmark behavior. |
| Today metric bars | 760 ms, 30 ms per-bar stagger, bottom anchored | Retained configured reference. Animate from current rendered value. |
| Navigation frame | 420 ms | Retained configured reference for one shared moving indicator. |
| Hover / press | Roughly 140–180 ms / 80–120 ms | Recorded v5 range. Current config uses 180 / 90 ms for navigation. |
| Card settle | 250–380 ms after release | Retained configured reference. Drag remains directly attached to the pointer. |
| Floating panel opening | 260–320 ms | Retained configured reference with a restrained spring. |
| Micro completion | 300–500 ms | Retained configured reference for small actions without a broad shockwave. |
| Reduced motion feedback | Instant or 80–150 ms opacity-only | Established accommodation. Spatial effects, ambient pulses and chart travel are disabled. |

The configured scale sequence describes the glyph, not a permission to scale surrounding text or the entire screen. Hover reference limits of about 1 px lift and 1.02 scale, and press references around .93–.96, come from the older general motion spec. Validate the effect on the actual control. Text inputs and dense timelines should retain readable geometry.

**Observed easing examples** — Metric bars use `cubic-bezier(.2,.8,.2,1)` in the inspected source. One Today entrance uses `cubic-bezier(.22,.75,.25,1)`. Checkmark keyframes use explicit offsets with linear interpolation. These are existing references. There is no fully approved universal easing-token set. Prefer existing component behavior and document any replacement.

### Path Pulse and completion

**Established v6.1 envelope** — 800 ms charge, 125% relative force, 560 px radius, 1060 ms neighbor return, 1010 ms highlight fade, 850 ms central return, radial response including diagonals, and stronger lateral expression. The config includes a 1.43 horizontal bias, up to 410 ms directional stagger and zero reverse overshoot. Percent force is relative to that implementation, not a percentage of component width.

**Today override** — Completing an ordinary Today task is an immediate click action with no hold-to-charge delay. After a successful save, show the bouncy checkmark and the restored local wave inside the owning card. Clip the wave to that surface. Keep adjacent cards, rows, editors and the page position stable. Older global-neighbor displacement and generic 800 ms charging must not be reintroduced into Today. The exact contained-wave tuning should be taken from the current accepted implementation, rather than applying the old 560 px envelope universally.

**Calendar** — Retain the intentional long-press interaction and a local completion shockwave. The event and its immediate calendar context may express the accepted radial effect. Keep it within the calendar interaction area, with no document-wide query that shakes unrelated panels. Stronger top/bottom and lateral expression must remain readable and temporary. Current per-screen tuning should be inspected before applying the v6.1 reference values.

**Other small actions** — Habit marks, workout sets and compact status changes use restrained micro feedback unless the accepted task explicitly calls for a broader effect. Any new displacement scope must be specified and reviewed.

### State, interruption and performance

The completion sequence is `intent → pending if needed → durable commit → completed feedback`. Show success only after the application confirms saving. Failed writes preserve recoverable input and expose the failure. Decorative timing must never determine the persisted state.

Animate actual state transitions. Rerenders, route returns, hydration and synchronization must not repeatedly celebrate an existing completion. Bars can move both up and down and retarget from their current visual position. Keep numeric text, axis labels and the caret steady.

Portrait morphing travels between actual layout anchors with one coherent particle wave. Preserve continuity if the user changes tabs mid-transition. Use the current frame as the start. Remove whole-bust breathing, repeated waves and excessive parallax. When the destination has no portrait, resolve the exit cleanly without leaving a ghost or blocking content.

**Design guidance** — Prefer transform and opacity where appropriate. Pause decorative work when hidden, avoid needless rerender loops and test realistic image-heavy Notes and Canvas data. Previous performance problems make smooth interaction a design acceptance criterion. A decorative animation may be reduced when it competes with typing, dragging or scrolling.

## 5. Navigation

**Established order**

1. Today
2. Calendar
3. Sport
4. Projects
5. Canvas
6. Habits
7. Notes
8. Progress

Use the Ionic navigation column with the Greek temple icon for Today/Home. Use a coherent minimal SVG family. Inactive icons are outlined and active icons use the approved filled treatment. Hover is distinguishable from selection. One shared active frame moves between items, with no duplicate frame baked into the glyph and another added by the shell.

Settings are accessed through Profile. The column carries the eight core destinations. Keep the selected destination visible while a transition runs. Icon artwork may be visually small inside a generous hit area. Provide a localized name on hover and keyboard focus, plus an accessible name at all times.

**Observed RC18 behavior to preserve** — Entering Today or Habits resets their day to the current system day. Calendar retains its separately selected date. A remembered old Calendar date must not make today's habits disappear.

**Design guidance** — Preserve relevant scroll position and in-progress input when navigating. Define what happens if an editor cannot save. Resolve a valid edit before completing the transition and keep an invalid draft recoverable. Route changes should maintain logical focus and a meaningful page title.

**Open** — Future mobile navigation, compact desktop alternatives at extreme widths and any new shortcuts require dedicated interaction design. Eight destinations should remain discoverable without shrinking the column into unusable targets.

## 6. Today

### Purpose and first impression

Today answers four questions within the first few seconds. What should I focus on? Which habits are due? What is next on my schedule? How is this week progressing?

**Established hierarchy** — Main Task / Focus is the main action area. Daily Habits supports quick repeatable actions. Next Event / Upcoming gives near-term time context. Weekly Progress supports reflection. The quote and philosopher establish tone while yielding priority to working content.

Use the accepted dark Variant B composition as the starting point. Keep lower supporting areas visually open where a card boundary adds little. Separate a section heading from its action and metadata through alignment and whitespace.

### Core interaction contracts

| Area | Required design outcome |
| --- | --- |
| Main Task / Focus | A clear primary task, accessible completion control and understandable focus state. The action target and decorative checkmark align correctly. |
| Daily Habits | Show habits actually scheduled for the current day, their relevant goal or completion state and a usable action. Counts must agree with the displayed list. |
| Next Event | Preserve a readable event title, actual time and date context when needed. Essential information must survive narrow widths and translation. |
| Weekly Progress | Clearly identify the period, weekday order, meaning of the values and current-day context. Label the chart in the active language. |
| Quote | Secondary reading content with an attributed quote and a restrained portrait. |
| Save feedback | Distinguish saved, pending and failed state. Completion feedback follows a durable save. |

For a day with no scheduled habits, distinguish “none scheduled today” from “no habits created.” Provide the relevant path to manage or create habits. A zero denominator should not be framed as failure. For an empty schedule, give a quiet empty state. If there is no focus task, make choosing or creating one easy.

### Today Core Polish baseline

**Reported completion, 7 November 2026** — PAT-30 fixed four confirmed defects through three changes. The report states independent QA approval and integration through PRs #5, #6 and #7 into `paperclip-test`.

| Completed area | Design invariant to preserve |
| --- | --- |
| D1 — system-timezone event display | Event labels must reflect the actual system timezone and handle cross-date and daylight-saving boundaries consistently. |
| D2 — narrow Next Event readability | Reflow Next Event content so the title and essential time information remain readable in EN, RU and ES. |
| D3 — localized Monday-first Weekly Progress | Keep the Monday-first ordering and localize weekday and related display text. |
| D4 — actual-timezone accessibility | Accessible descriptions must describe the actual timezone context, matching the visible content. |

The completion report describes 48 locale/viewport layout cases and checks involving event timezones, date boundaries, daylight saving, weekly localization, history and export. Its qualified scope is **Linux Chromium with synthetic data**. The latest reported branch HEAD begins `17a4851f`, with combined tree beginning `310b62b8`. These abbreviated identifiers are provenance clues, not checkout commands or a fresh repository verification.

The source inspected for this Bible is the earlier RC18 snapshot. Before changing Today, inspect the integrated Paperclip branch and the actual PAT-30 acceptance evidence. Preserve those fixes and test the proposed layout against them. A Windows-native or other-browser acceptance claim needs its own evidence.

### Improvement discretion

The designer may improve grouping, scanning, empty states and action placement. Keep the primary action easy to locate, preserve meaningful progress semantics and use the current polished behavior as the baseline. Do not restart the dashboard from an old pre-polish mockup.

## 7. Calendar

**Established** — Weekly planning is the primary desktop view. Events support three importance levels, event types and icons, Free Time, drag/drop, compact editing and a designed date picker. The Calendar portrait has been removed. Display time according to the system timezone, preserving correct date and time meaning.

| Interaction | Contract |
| --- | --- |
| Scan the week | Distinguish today, selected date, event boundaries, time position and the current-time indicator. Keep the visual grid quiet. |
| Importance | Make the three levels visibly distinguishable. Use more than color alone and preserve text legibility. |
| Event type | A small coherent icon explains the activity category. Importance and type are separate concepts. |
| Free Time | Support deliberate rest with the established rest icon and drag interaction. Make its duration and placement understandable. |
| Move / resize | Keep the event attached to the pointer, preview the destination and expose precise time editing as an alternative. |
| Complete | Hold an event to charge, then complete after confirmed persistence. Show the bounded completion shockwave. |
| Edit | Open the compact contextual editor near the event with primary controls first. Apply valid edits on outside click. |
| Choose date | Use a designed, readable picker with selected-day, today, focus and keyboard states. |

**Design guidance** — Separate click-to-open, drag, resize and hold recognition. Moving outside the activation area, starting a drag, releasing early or losing pointer capture should cancel the hold. Prevent a completed hold from also opening an editor. Provide a simple completion control for users who cannot hold. The inspected RC18 Calendar exposes Shift+Enter as a keyboard completion path. Verify it on the current branch and document it wherever retained.

For recurring events, make the edit scope explicit where the model supports occurrence and series changes. Preserve cross-midnight meaning, daylight-saving behavior and the relation between displayed time and persisted time. Label a different day when an event is converted across a date boundary.

### Current improvement candidates

The history contains complaints about excessive editor text, weak importance distinctions and difficult scheduling interactions. Treat these as high-value audit targets rather than a claim that every earlier defect is still present. Examine overlapping events, crowded weeks, very short events, drag handles, offscreen editor placement, Free Time discoverability and narrow-window readability. An agenda alternative for narrow windows is **Open** and should be designed around the same event model.

## 8. Projects

**Established** — Users can maintain multiple projects. A project offers a Status Board with Planned / In Progress / Done and a Workflow Plan with a horizontal timeline. Both views describe the same tasks.

The project library supports creating a project through a visible plus card consistent in size and geometry with its sibling project cards. Task addition should use the corresponding contextual plus/add pattern in the current project. Keep “add project” and “add task” scoped to their respective containers, even when they share visual language.

Workflow Plan uses rounded task bars across dates, visible duration or timing context, draggable/resizable bars, deadlines, milestone diamonds and a vertical Now indicator. Use few colors and concise labels. Task bars are clear of embedded completion checkboxes. Status is available through the board or contextual task controls.

**Design guidance**

- Keep the project name and current view visible while planning.
- A move in the Status Board updates the same task represented on the timeline.
- Place labels so short and long tasks remain discoverable. Offer full details without requiring a bar to become arbitrarily wide.
- Distinguish scheduled range, deadline and milestone semantics. A diamond should have an accessible label and generous target.
- Preview move and resize values before committing. Provide date and duration inputs as an alternative.
- Maintain a stable date axis while editing. Define auto-scroll at timeline edges and how Now behaves outside the visible range.
- Use a compact rhythm for lists and boards, with enough room to recognize task status and actions.

**Open** — Timeline zoom levels, minimum bar width, overflow behavior, narrow-screen view switching and exact milestone creation flow require a task-level specification. Do not introduce dependency logic or new project states merely to decorate the timeline.

## 9. Canvas

**Established** — Canvas is an Obsidian-like spatial workspace with a dark dotted background, note and image cards, directional connections and smooth zoom. It should feel free and spatial, with stable controls and a legible sense of location.

| Feature | Latest accepted behavior |
| --- | --- |
| Board identity | A compact canvas name, breadcrumb or selector preserves context without consuming workspace. |
| Toolbar | Compact visual controls with clear press/drag affordances appropriate to the tool. Essential tools need discoverable labels. |
| Notes | Double-click to edit the note text. Earlier single-click editing is superseded. Canvas notes have no compulsory separate header and use centered text by default. |
| Selection | Thick rounded monochrome selection treatment, with the content still readable. |
| Multi-select | A marquee selects any object touched by the selection region. Delete operates on all selected objects when editing focus is outside text. |
| Connections | Side handles appear as semitransparent rounded rectangles. Arrows are selectable and editable. |
| Drop into empty space | Releasing a connection onto empty space opens a small creation popup for a new connected item. |
| Zoom | Smooth zoom with stable spatial anchoring and predictable object positions. |
| Far zoom | Simplify unreadable text into lines while preserving object structure and useful selection feedback. |
| Camera | Clicking during residual scroll must not jump the camera to the origin or center. Content keeps its world position. |
| Images | Support paste and image import, with clear loading and failure behavior. |

### Interaction guidance

Distinguish selecting, editing, moving, connecting and panning. During text editing, text selection and Delete belong to the text field. Outside text editing, Delete belongs to the object selection. Preserve multi-selection when invoking a relevant group action.

Use deliberate actions for framing all content, returning to a useful view and moving to another board. Never recenter as a side effect of an unrelated click. Cancel camera inertia safely before a conflicting interaction. A gesture must preserve the spatial point the user believes they are manipulating.

The source request for top-left starting content does not authorize collapsing world coordinates into the viewport corner during zoom. Initial framing and world-space positions are separate decisions.

Create-on-arrow-drop should preserve the connection intent while the user chooses an item type. Cancel cleanly without leaving an accidental empty node. Define behavior at viewport edges and while zoomed out. Thresholds for low-detail rendering, camera easing and zoom limits are **Open**.

Use adjustable colors as meaningful user content. Keep toolbar and selection chrome consistent with Path. Treat image performance as a first-class requirement. Board size, long notes and many images should not make pointer feedback or typing visibly lag.

## 10. Sport

**Established** — Sport combines a workout library, programs, a mini calendar and scheduling. Users can drag a workout onto the mini calendar. The training model supports mandatory and optional sessions. The founding personal example is three mandatory workouts plus an optional fourth, with session lengths around 1–1.5 hours. These are examples, not universal defaults imposed on every person.

Use coherent exercise and body-part icons. The Spartan portrait belongs to the overview and has restrained scroll-follow behavior. Focused workout execution prioritizes exercises, sets, rest and progress.

### Workflow goals

Help a user find or create a workout, organize it into a program, schedule it, execute it and understand completion. Show the distinction between a reusable template and a scheduled session. Make required and optional work understandable through labels and neutral hierarchy.

All eligible library workouts should expose consistent scheduling affordances. A drag that cannot succeed must explain the reason and offer a usable scheduling alternative. When placing workouts into free calendar slots, make the proposed day and time reviewable and preserve user control over conflicts.

The user explicitly wanted to leave an empty workout editor without being forced to add an exercise. Cancellation of an empty draft should be straightforward. Handling a changed, nonempty draft must preserve recoverability and clearly state the available outcomes.

**Improvement candidate** — Sport remains a strong candidate for a substantial UX redesign. Audit the relationship among library, programs, mini calendar, scheduled sessions and active workout mode. Simplify the path from intent to a scheduled workout and from a scheduled workout to its execution. Retain the shared data relationships and the Spartan identity while improving information architecture.

## 11. Habits, Notes and Progress

### Habits

**Established** — Habits need fast completion/logging and readable schedule/history. The visible examples include every-other-morning push-ups, daily reading and a daily reset. The inspected editor supports daily or selected-day scheduling, goals, tracking type, source and an effective date that preserves prior history.

**Design guidance** — Present a human-readable schedule. A raw day list such as `0,2,4,6` is an implementation detail and a clear redesign candidate. Use labeled weekday controls and summarize the chosen schedule. Distinguish scheduled today, completed today, not yet started, archived and not due. Give counted habits a clear current/goal presentation.

When changing a schedule from a particular date, state how future eligibility changes and how existing history is retained. Daily Habits on Today and the Habits screen must agree on date and eligibility. Show a denominator that corresponds to the applicable items. Treat a reported blank list as a potential date/scheduling problem before redesigning an empty state.

Fast completion should stay separate from opening the full habit editor. Make undoing a mistaken mark discoverable. Numeric targets, validation, streak definitions and chart semantics must be explicit in the handoff. Preserve current model semantics until a separately reviewed change is justified.

### Notes

**Established** — Notes supports a list/library and focused editing. Formatting commands should act immediately on the editor selection. Bold, headings and related actions must produce a visible result. Pasted images are supported product behavior. Focused editing removes the competing portrait.

**Design guidance** — Preserve the caret and selection when clicking formatting tools. Show toggle state where applicable. Handle empty selection, multiline selection, undo, paste and keyboard use. Keep a readable document measure, a wrapping toolbar and a clear path back to the library. Distinguish Notes document editing from Canvas note-card editing.

An image operation needs pending, loaded and failed states. Preserve text if image processing fails. Large images must not cause full-editor work on every keystroke. Save status should be quiet during success and actionable on failure.

**Open** — The full supported formatting set, image-resize interaction and deeper Notes information architecture need inspection and a task-specific proposal. Do not infer a complete word processor from the existing toolbar.

### Progress

**Established** — Progress uses charts and summaries consistent with the monochrome environment. Aristotle belongs to the overview. Detailed analysis yields the space to its data.

**Design guidance** — Every visualization needs a named metric, unit where relevant, period, denominator or aggregation rule, and understandable empty state. Make it clear whether a value is daily, weekly, scheduled or completed. Define zero, missing data and not-applicable separately. Labels and accessible summaries must reflect the same timezone and date boundaries as the data.

Show direction and patterns without excessive color or decoration. Avoid implying causation or personal worth from productivity counts. The complete Progress metric catalog and chart redesign remain **Open**. Weekly Progress on Today inherits the Core Polish invariants in section 6.

## 12. Path Context Editing System

**Established** — Replace oversized right-side editing panels with three contextual levels. Primary controls are compact and icon-first. Advanced options use progressive disclosure. Valid edits auto-apply when the user clicks outside. Routine editing is clear of a persistent unsaved-changes banner.

| Level | Use | Layout and behavior |
| --- | --- | --- |
| Quick Actions | One-step actions on the current selection, such as status or a relevant object command | Small floating toolbar near the selection. Keep the set short and task-specific. |
| Compact Floating Editor | Common edits that fit a focused contextual form | Approximately 320–420 px wide on a suitable desktop viewport. Anchor near the object, show primary options and provide collapsible advanced controls. |
| Full Editor Modal | Complex structures, many interdependent fields or a genuinely larger editing task | Centered dialog with clear hierarchy, contained scrolling where needed and a clear completion/close path. |

**Design guidance** — Place an editor so the object remains identifiable and the current field stays visible. Flip or shift it at screen edges. Account for the application titlebar, browser zoom and the virtual keyboard. Avoid opening another editor on top of the field the user needs.

### Editing lifecycle

1. Open with the object's current values and a predictable initial focus.
2. Keep input in a draft while validating it according to the operation.
3. Apply valid changes at the established commit boundary, including outside-click dismissal.
4. Close or transition only when the operation can do so safely.
5. If validation or persistence fails, identify the field or save problem and preserve the draft.
6. Restore focus to a meaningful trigger or updated object after dismissal.

**Observed** — The inspected contextual editor attempts saving on close, including Escape. Escape therefore cannot be casually documented as “discard everything.” Specify its actual task-level behavior. In nested pickers, Escape should first dismiss the innermost interaction. A deliberate discard action needs explicit semantics and a recoverable outcome where appropriate.

Icon-first controls still need accessible names, tooltips and enough text where a concept is unfamiliar. Outside-click must not silently lose invalid input. Prevent a failed dismissal from also activating a destructive control behind the editor. Avoid “Saved” feedback before persistence succeeds.

Complex operations may need an explicit commit action when partial application would be misleading. Explain that exception in the specification and preserve consistency with the broader auto-apply model.

## 13. Responsive design

**Established** — Desktop is the primary product surface. Narrow desktop windows, long localized strings and a future mobile experience must be designed intentionally. Mobile work is a future direction rather than evidence of a complete released mobile application.

**Design guidance** — Break layouts when their content stops fitting comfortably. Reduce simultaneous columns, wrap metadata, move secondary controls into contextual menus and preserve essential task information. Prefer reflow over progressively shrinking text and controls.

| Surface | Adaptation direction |
| --- | --- |
| Today | Reorder into a clear vertical reading flow while preserving Main Task, due habits and Next Event. |
| Calendar | Consider an intentional day/agenda representation or a controlled scrollable time grid. Keep editing accessible at narrow widths. |
| Projects | Switch deliberately between library, board and timeline. Keep project context and task creation reachable. |
| Canvas | Preserve the spatial viewport. Adapt tools and object editing rather than compressing the entire desktop toolbar. |
| Sport | Prioritize finding the workout and taking the next session action. Separate planning from active workout execution when space is limited. |
| Editors | Fit the available viewport and keep the focused field above the keyboard. A mobile sheet or full-screen editor is a proposal requiring its own interaction specification. |

Future mobile navigation, gestures and sheets are **Open**. Design touch selection, drag alternatives, keyboard appearance, safe areas, orientation changes and one-handed access as explicit scenarios. A scaled-down Ionic desktop column is not an adequate mobile navigation specification.

Include a viewport matrix in every layout-changing task. Cover a narrow desktop window, a typical desktop, a large desktop, text enlargement and long localized content. Exact shared breakpoint values are **Open**. Content-dependent failures should inform them.

## 14. Localization

**Established** — English is the default language. Russian and Spanish are required design languages. The recorded startup behavior uses Russian when the OS language is Russian. Explicit user choice should take precedence over automatic selection. Other automatic-language mappings need verification. Polish strings exist in the inspected source and should be considered when a change touches the shared translation system.

**Design guidance**

- Test real EN/RU/ES strings, including Cyrillic, accents, long names, plurals and multiword actions.
- Allow labels to wrap where doing so preserves comprehension. Do not give actions fixed widths based only on English.
- Keep text separate from icons and geometry. Avoid baked-in text inside visual assets.
- Localize tooltips, accessible labels, validation messages, weekdays, empty states and completion feedback.
- Format displayed dates and times according to the supported locale while preserving machine-readable values and correct timezone semantics.
- Do not confuse language with timezone. A Russian UI can run in a system timezone outside Russia.
- Define the truncation policy per content role. Essential time/status information needs a readable presentation. Truncated user titles need a way to reveal the full value.
- Use complete translatable messages instead of concatenated fragments that assume English word order.

Monday-first Weekly Progress is part of the reported Core Polish baseline. Keep that accepted order while localizing labels. A future configurable week-start preference is **Open**.

## 15. Accessibility

The following are **Design guidance and proposed acceptance standards**, grounded in WCAG 2.2. This document does not certify the current application as conformant.

Use at least 4.5:1 contrast for ordinary text and 3:1 for qualifying large text. Measure the actual composed background, including gradients. Essential control boundaries and state indicators should meet the applicable 3:1 non-text contrast requirement. These requirements allow specified exceptions, which must be assessed deliberately. [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/) · [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

Use generous targets. Treat 24 × 24 CSS px as the WCAG 2.2 AA minimum target reference, subject to the criterion's exceptions. Prefer larger targets for frequent controls and a 44 × 44 CSS px design target for touch, as a proposal rather than an approved Path token. [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

Provide a click/tap alternative for drag operations unless an applicable exception is justified, alongside keyboard support. Date inputs, Move commands and destination selectors can support this. [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

Additional Path-specific guidance follows.

- Keep a visible focus indicator with enough contrast against every surface. Focus must remain visible around floating editors and sticky content.
- Use logical keyboard order. Restore focus after a dialog closes. Trap focus only in an actual modal, with an operable dismissal path.
- Use native controls where suitable. Give icon buttons action names, toggles their state and navigation its current-page indication.
- Associate errors with their fields. Announce save failures and relevant status changes without reading decorative animation events.
- Represent charts with an accessible summary or data alternative. Include the period and actual timezone context where relevant.
- Keep completion understandable through text, shape and state as well as color or movement.
- Honor OS reduced motion and the user's motion setting. Remove portrait travel, ambient pulses, waves and chart travel while preserving state feedback.
- Hide purely decorative particle layers from assistive technology. If a portrait is meaningful content, expose one concise description rather than individual dots.
- Test text enlargement and keyboard-only operation. Spatial surfaces need an accessible way to locate and operate their objects.

Minimalism is compatible with clear focus, readable labels and larger invisible hit areas. The designer should solve their visual integration explicitly.

## 16. Component philosophy

**Design guidance** — Define reusable behavior before adding a visually similar component with different semantics. Reuse does not require every surface to look identical. A Calendar event and a project card share state principles while serving different tasks.

| Family | Visual and interaction contract |
| --- | --- |
| Cards and open sections | One meaningful group, clear heading and scoped actions. Choose framing according to hierarchy. |
| Buttons | Distinguish primary, secondary and destructive intent. Define default, hover, pressed, focus, disabled, pending and error behavior where applicable. |
| Icon buttons | Consistent optical size and stroke family, generous target, localized label and tooltip. |
| Floating editors | Shared field rhythm, anchoring rules, validation, dismissal and save semantics. |
| Modals | Clear title, bounded content, intentional focus management and meaningful completion path. |
| Toolbars | Group related actions, show active tools and preserve editor selection. Handle overflow deliberately. |
| Inputs | Persistent labels where needed, readable values, units and validation. Preserve invalid input for correction. |
| Selectors | Current selection is explicit. Use an appropriate picker for dates, weekdays, types or long lists. |
| Menus | Predictable ordering and keyboard behavior. Separate destructive items without excessive decoration. |
| Timeline items | Stable time geometry, readable label, resize/move states, milestone and deadline distinction. |
| Calendar events | Time, type, importance and completion remain distinguishable in compact space. |
| Task rows | Title and completion control align consistently. Metadata and secondary actions have a quieter rank. |
| Habits | Due-state, goal and logging action are coherent across Today and Habits. |
| Progress visualizations | Explicit metric, range, period, zero/missing state and accessible description. |

Specify minimum widths, overflow rules, internal spacing relationships and interaction ownership for each family. Before defining exact tokens, inventory the working UI and reconcile duplicates. Newly proposed values must be labeled as proposals until accepted.

## 17. Design decision framework

For each task, the Product Designer follows this sequence.

1. **Identify the real problem.** State what the user is trying to accomplish and what currently prevents it. Separate observations from assumptions.
2. **Inspect the implementation.** Record the branch/commit, viewport, locale, data conditions and relevant states. Review the current interaction, not just its screenshot.
3. **Preserve strengths.** Identify useful affordances, learned behavior and accepted fixes that the change needs to retain.
4. **Remove avoidable complexity.** Consolidate duplicate choices and reveal advanced controls when needed.
5. **Name the primary goal.** Define the action and information that should be easiest to find.
6. **Establish hierarchy.** Order content by the user's decision sequence and create a clear reading path.
7. **Reduce interaction cost.** Count clicks, travel, mode changes, typing and mental comparisons. Avoid hiding required information merely to reduce visible controls.
8. **Test edge cases.** Include long content, empty data, errors, interrupted gestures, crowded views and invalid input.
9. **Check EN/RU/ES.** Inspect real strings and time/date labels in every affected state.
10. **Check accessibility.** Include focus, keyboard operation, names, targets, contrast and alternatives to complex gestures.
11. **Check motion.** Define the trigger, scope, timing, interruption, reduced-motion behavior and performance expectation.
12. **Produce a developer-ready specification.** Resolve the principal workflow and acceptance criteria before handoff.

A designer may propose replacing an established interaction when evidence shows a material UX problem. State the affected decision, user impact, proposed replacement, compatibility implications and validation plan. Obtain agreement on the changed contract before treating it as the new standard. Cosmetic refinements within the established contract can use ordinary design judgment.

Maintain a decision log with date, task, previous rule, new rule, rationale, acceptance authority and affected screens. Update this Bible when an accepted change supersedes it. Never silently label a new preference as historical approval.

## 18. Professional product-design principles applied to Path

| Principle | Application in Path |
| --- | --- |
| Hierarchy | Make Today's next action and Calendar's time structure readable before secondary statistics or decoration. |
| Progressive disclosure | Keep common edits visible and expose advanced schedule or tracking options through the compact editor. |
| Information density | Let a busy week or project show useful detail while retaining readable targets and text. Use alternate views when density exceeds the available space. |
| Cognitive load | Reuse the same concepts for scheduled, completed, due and archived state across tabs. Explain genuinely different semantics. |
| Discoverability | Support subtle controls with contextual labels and visible affordances. Ensure hover-only actions have keyboard and touch access. |
| Consistency | Reuse behavior for the same operation across surfaces. Account for a surface-specific interaction such as Calendar long-press explicitly. |
| Feedback | Show the result where the action happened. Reserve stronger feedback for important outcomes and errors. |
| Error prevention | Preview time changes, separate destructive actions and preserve drafts when validation fails. |
| Spatial stability | Keep the camera, selection and unrelated cards steady while an action completes. |
| Fitts's Law | Reduce pointer travel for repeated contextual actions and provide targets that remain practical at the actual display scale. |
| Interaction cost | Prefer direct completion, familiar editing and a clear scheduling flow. Count the effort of discovering an action as well as executing it. |
| Responsive behavior | Reorganize content around the same user goal as space changes. |
| State completeness | Design initial, empty, loading, partial, failed, offline, saved and unavailable states wherever the operation can produce them. |

An empty project should offer a clear first task. A pending image should reserve sensible space. A failed save should keep the user's work available. A Calendar with no events should remain useful for planning. A chart without observations should explain the absence rather than inventing a trend. These are component-level requirements, not a generic full-screen error page for every situation.

## 19. Anti-patterns

The following combine explicit rejected directions and practical constraints derived from the product history.

- Oversized right-side editing panels for routine actions.
- Requiring a full form to perform a frequent one-step action.
- Long explanatory text replacing clear controls, or unexplained icons replacing necessary labels.
- Excessive glow, bloom, flashes and competing gradients.
- Rainbow interface chrome and importance encoded only by hue.
- Generic dashboard styling that erases Path's accepted proportions and identity.
- Repeated cards inside cards, border-heavy grids and cramped internal spacing.
- Small low-contrast text used to make an overloaded layout appear minimal.
- Mixed icon families, inconsistent stroke weight and duplicated selection frames.
- Greek ornament on every surface or a portrait inside focused work areas.
- Whole-bust breathing, excessive scroll parallax and multiple competing morph waves.
- Today completion that charges before an ordinary click action, shakes surrounding UI or blocks interaction.
- Animation triggered by every render or by returning to a screen with already-completed tasks.
- “Done” or “Saved” feedback before persistence succeeds.
- Date or timezone labels that disagree with the displayed event or accessible description.
- A polished empty state masking a scheduling bug that hides due habits.
- A raw numeric weekday list as the primary habit-scheduling UI.
- Formatting buttons that lose the text selection or require a preview to show their effect.
- Camera jumps during Canvas scroll/click transitions or zoom that collapses object positions.
- Delete affecting only one selected Canvas object or deleting objects while the user is editing text.
- Eligible workouts with inconsistent drag affordances and empty editors that trap the user.
- Routine outside-click dismissal that loses invalid or unsaved work.
- Mobile interfaces created by shrinking the desktop layout.
- Layouts tested only in English, only with short titles or only on a wide viewport.
- Heavy image work, excessive animation loops or effects that impair typing and dragging.
- New metrics, statuses or synchronization promises inferred from a visual mockup.
- Treating an old prototype, a generated file or an outdated source snapshot as the latest accepted implementation.

## 20. Designer → Developer handoff

Every implementation task needs a specification with the following structure. Fill each relevant field. Mark a field “not applicable” only with a short reason. Keep unresolved product decisions out of the developer's implicit scope.

```markdown
# [Task name]

## Goal and user outcome
Who acts, what they are trying to achieve, and the measurable result.

## Problem and current-state observations
Observed failure or friction, reproduction conditions, affected surfaces.
Branch/commit inspected, screenshots or recordings, locales and data used.
Separate confirmed findings from assumptions.

## Decision status and scope
Established rules retained, proposed changes, open questions and dependencies.
Record any deliberately superseded decision and the approval reference.

## Proposed flow
Entry points, primary action, alternate paths, completion and recovery.

## Layout and hierarchy
Content order, alignment, grouping and relationship to surrounding content.
Annotated reference for normal, narrow and relevant expanded states.

## Components and dimensions
Existing components reused and any new variant.
Widths or min/max rules, spacing relationships, target sizes and overflow rules.
Identify proposed numeric values and the measured rationale.

## Interaction states
Default, hover, pressed, focused, selected, disabled and pending as relevant.
Empty, loading, saved, validation error, save failure and offline as relevant.
Pointer, keyboard, touch, drag, long-press and cancellation behavior.

## Data and persistence contract
What is read or changed, commit boundary, undo/discard semantics and recovery.
Cross-screen effects, linked-object behavior and concurrent-change handling.

## Motion
Trigger, animated element, scope, timing/easing and settle behavior.
Interruption/retargeting, reduced motion and performance constraints.

## Responsive behavior
Layout changes by content fit, viewport cases, text enlargement and overflow.
Mobile-specific decisions only where the task includes mobile.

## Localization and copy
EN/RU/ES strings or translation keys, plural/date/time behavior and wrapping.

## Accessibility
Names, semantics, focus order/return, keyboard actions, targets and contrast.
Alternatives to drag/hold and chart descriptions where relevant.

## Edge cases
Long content, missing data, invalid values, interrupted input and failure paths.

## Acceptance criteria
Observable Given/When/Then outcomes, locale/viewport coverage and evidence.

## Verification and handoff
Designer fidelity review, QA correctness scope and integration dependencies.
Open decisions must be resolved or explicitly excluded from implementation.
```

### Example acceptance criteria for Next Event

- Given a long event title in EN, RU or ES at each agreed narrow desktop width, the title has a usable wrapping or reveal path and essential time information remains readable, with no overlap or inaccessible action.
- Given a system timezone that moves the event across a date boundary, the visible date/time and accessible description agree with the same event instant.
- Given keyboard navigation, each available action has a visible focus state and can be activated without a pointer.
- Given reduced motion, state changes remain understandable without spatial animation.
- Given no upcoming event, the empty state is clear and the relevant planning action remains available.

The specification should identify the actual tested widths and examples. A promise to “make it responsive” is insufficient for implementation or acceptance.

## 21. Design QA

The Product Designer owns fidelity and UX review. Path QA owns correctness and regressions. The Integrator owns the integration step under the project's working rules. A design sign-off does not substitute for functional QA, and a passing functional suite does not demonstrate visual fidelity.

### Designer review checklist

- [ ] Layout matches the accepted hierarchy and annotated relationships.
- [ ] Spacing and alignment remain coherent with real content.
- [ ] Typography is readable and text roles are consistent.
- [ ] Icons, borders, surfaces, shadows and selection states match the intended family.
- [ ] Default, hover, pressed, focus, selected, disabled and pending states are distinguishable where applicable.
- [ ] Empty, loading and error states preserve orientation and recovery.
- [ ] Narrow windows and enlarged text retain usable targets and essential content.
- [ ] EN/RU/ES labels, tooltips and validation fit and make sense.
- [ ] Motion runs on the specified event, stays in scope, settles correctly and handles interruption.
- [ ] Reduced motion preserves state and focus.
- [ ] Common interactions feel direct with realistic amounts of data and images.
- [ ] The change introduces no unintended visual regression in shared components or adjacent screens.

Capture the exact commit, environment, locale, viewport, test data and relevant motion preference with review evidence. Compare before/after states at matching conditions. Review video for motion and gestures, screenshots for static layout and actual interaction for focus and editing. Distinguish design defects from implementation defects and product questions.

A review may be approved within a stated scope, approved with explicit nonblocking follow-ups, or blocked by named failures. A failed required environment check remains an unverified scope rather than an assumed pass.

## 22. Current product state

### Established / keep consistent

| Area | Preserve |
| --- | --- |
| Identity | Calm dark monochrome environment, Greek references and coherent life-planning workflows. |
| Navigation | Eight destinations in the approved order, Ionic column, temple Home icon, one moving active frame and Settings in Profile. |
| Portrait system | Latest overview mapping in section 3, one coherent particle wave, local dot activity and reduced scroll-follow strength. |
| Today | Variant B hierarchy, immediate completion, contained feedback and the reported Core Polish invariants. |
| Calendar | Weekly planning, importance and type distinction, Free Time, contextual editing, intentional long-press completion and system-timezone correctness. |
| Projects | Library, shared tasks across Status Board and Workflow Plan, timeline bars, milestones and Now indicator. |
| Canvas | Stable spatial interaction, double-click note editing, touch-intersection marquee selection, side connection handles and create-on-drop. |
| Editing | Quick Actions, Compact Floating Editor and Full Editor Modal, progressive disclosure and safe auto-apply. |
| Motion | Scoped soft response, completion after persistence, stable unrelated UI and reduced-motion accommodation. |
| Localization | English default with Russian and Spanish design coverage. |

### Good candidates for future redesign or improvement

| Candidate | Product question to investigate |
| --- | --- |
| Sport | Can library, programs, scheduling and active sessions form a clearer end-to-end workflow? |
| Calendar | Can busy-week scanning, importance, event editing and scheduling become clearer with fewer interactions? |
| Habits editor | Can readable weekday and goal controls replace implementation-oriented fields while preserving historical semantics? |
| Projects | Can task addition, short timeline items and narrow-window use become more discoverable? |
| Canvas | Can tools, selection modes, camera controls and dense/image-heavy boards become easier and faster? |
| Notes | Can formatting, image handling and library-to-editor movement become more dependable and legible? |
| Progress | Which metrics and visualizations actually help reflection, with clear periods and definitions? |
| Design system | Which existing values should become shared spacing, typography, radius, color and motion tokens? |
| Responsive/mobile | Which tasks need distinct mobile interaction patterns and navigation? |

These are opportunities for investigation. Their inclusion is not a claim that every historical bug is still reproducible. Check the current branch first.

### Known evidence and open decisions

- RC18 is the inspected desktop source baseline. It includes the Today/Habits route-date correction.
- The later Today Core Polish work is reported integrated into `paperclip-test`. The initial RC18 handoff archive is older than that integrated work.
- The reported Core Polish QA scope is Linux Chromium with synthetic data. Native Windows and other environments require separate evidence.
- A Windows update attempt produced an old-file uninstall error in this conversation. Its resolution is not established here. Visual polish must not be described as fixing that lifecycle issue.
- Exact global tokens, final breakpoints, mobile navigation, additional portrait rotation, a complete Progress metric catalog and some advanced editing flows remain open.
- Latest code and its implementation status must be inspected before a new design task. This Bible establishes intent and known decisions rather than a live release inventory.

### Provenance and maintenance

The decision record spans the Path redesign discussions in October 2026, the later navigation, portrait, motion, editing and usability corrections, the November RC18 habits work, and the November 7 reported Today Core Polish completion.

Inspected references include `PATH_MOTION_CONFIG.json`, `PATH_PULSE_360_CONFIG_v6_1.json`, `motion-v5-spec/`, `tab-portraits.js`, `home.css`, `today-polish.css`, `today-motion.js`, `path-pulse-360.js`, `calendar-pulse.js`, `context-editing.js` and `context-editing.css` from the RC18-derived development copy. Some early motion-spec route assignments and global pulse rules are superseded as described above.

Update this document when an accepted change alters a product contract. Record the date, relevant task, changed section, rationale and approval. Retain historical provenance without keeping incompatible old instructions active. Validate open choices through a concrete design proposal and user outcome.

## 23. Final Design Constitution

1. Design Path as a coherent environment for intention, action and reflection.
2. Make the user's next meaningful action easy to recognize.
3. Preserve the calm dark monochrome identity through proportion, clarity and restraint.
4. Use Greek references where they strengthen orientation or reflection.
5. Respect the latest accepted decision and record its scope.
6. Study the current implementation before proposing a change.
7. Preserve useful behavior while removing unnecessary complexity.
8. Keep routine actions direct and contextual editing compact.
9. Make saved, pending, failed and completed states truthful.
10. Animate meaningful state changes and keep unrelated UI spatially stable.
11. Honor reduced motion, keyboard use and readable interaction targets.
12. Design with real EN/RU/ES content and correct date/time context.
13. Preserve the user's spatial orientation in timelines, calendars and Canvas.
14. Let responsive layouts reorganize around the task.
15. Treat empty states, errors, interruption and recovery as part of the design.
16. Specify the principal interaction logic before handing work to Developer.
17. Review implemented fidelity and UX alongside independent correctness QA.
18. Label proposals and unknowns honestly, and improve historical choices when the evidence justifies it.
