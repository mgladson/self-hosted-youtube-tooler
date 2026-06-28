---
name: a11y-audit
description: "Accessibility auditing: WCAG 2.2 AA compliance checks, ARIA pattern validation, keyboard navigation analysis, and screen reader compatibility testing. Sub-commands: /a11y-audit:wcag, :aria, :keyboard, :screen-reader. Use when auditing accessibility, building inclusive UI, or ensuring WCAG compliance."
---

# Accessibility Audit

You are executing the `/a11y-audit` skill. You apply accessibility best practices for WCAG compliance, ARIA patterns, keyboard navigation, and screen reader support.

Parse the sub-command from the user's invocation:
- `/a11y-audit` → show **menu** and wait for selection
- `/a11y-audit:wcag` → **WCAG 2.2 Compliance**
- `/a11y-audit:aria` → **ARIA Patterns**
- `/a11y-audit:keyboard` → **Keyboard Navigation**
- `/a11y-audit:screen-reader` → **Screen Reader**

---

## Menu (no sub-command)

```
Accessibility Audit — Choose a topic:

1. wcag          — WCAG 2.2 AA compliance checklist, per-component review
2. aria          — ARIA role/state/property validation, landmark review
3. keyboard      — Tab order, focus management, keyboard shortcuts
4. screen-reader — Alt text, live regions, announcements, testing tools
```

---

## WCAG 2.2 Compliance (`:wcag`)

### Key Success Criteria (AA Level)
```
Perceivable:
  1.1.1 Non-text Content — All images have alt text
  1.3.1 Info and Relationships — Semantic HTML (headings, lists, tables)
  1.4.3 Contrast (Minimum) — 4.5:1 for text, 3:1 for large text
  1.4.11 Non-text Contrast — 3:1 for UI components and graphics

Operable:
  2.1.1 Keyboard — All functionality available via keyboard
  2.4.3 Focus Order — Logical, predictable tab order
  2.4.7 Focus Visible — Clear focus indicator on all interactive elements
  2.5.8 Target Size (Minimum) — 24x24px minimum (44x44px recommended)

Understandable:
  3.1.1 Language of Page — <html lang="en">
  3.2.1 On Focus — No unexpected context changes on focus
  3.3.1 Error Identification — Errors clearly described in text
  3.3.2 Labels or Instructions — Form inputs have visible labels

Robust:
  4.1.2 Name, Role, Value — Custom components expose accessible name/role
  4.1.3 Status Messages — Programmatically determined without focus
```

### Automated Testing
```bash
# axe-core (most comprehensive automated checker)
npx @axe-core/cli https://localhost:3000

# Lighthouse accessibility audit
npx lighthouse https://localhost:3000 --only-categories=accessibility

# Pa11y (CLI)
npx pa11y https://localhost:3000
```

```typescript
// axe-core in tests (Jest/Vitest)
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('form is accessible', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### CI Integration
```yaml
# GitHub Actions: run axe-core on every PR
- name: Accessibility audit
  run: npx @axe-core/cli http://localhost:3000 --exit

# @testing-library/jest-axe in unit tests
# install: npm install --save-dev @testing-library/jest-axe
```

```typescript
// @testing-library/jest-axe — run in every component test suite
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  expect(await axe(container)).toHaveNoViolations();
});
```

### Color Contrast Requirements
```
Normal text (< 18pt / < 14pt bold): 4.5:1 contrast ratio minimum
Large text (>= 18pt / >= 14pt bold): 3:1 contrast ratio minimum
UI components and graphical objects: 3:1 against adjacent colors

Tools:
  contrast-ratio.com       — Enter hex/rgb values to check ratio
  Chrome DevTools          — Inspect element → Accessibility → Contrast ratio
  Figma A11y plugin        — Check contrast during design phase
```

### Error Message Requirements
```html
<!-- WRONG: color alone signals error -->
<input id="email" style="border-color: red" />
<span style="color: red">Invalid email</span>

<!-- CORRECT: associate error with field via aria-describedby -->
<label for="email">Email address</label>
<input
  id="email"
  type="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  Enter a valid email address (e.g. user@example.com)
</span>
```

Rules:
- Error text must be associated with the field via `aria-describedby`
- Set `aria-invalid="true"` on the invalid field
- Never convey error state through color alone — include icon, text, or pattern
- Error messages must describe what is wrong and how to fix it

---

## ARIA Patterns (`:aria`)

### Landmark Roles
```html
<header role="banner">...</header>           <!-- Site header -->
<nav role="navigation" aria-label="Main">...</nav>
<main role="main">...</main>                 <!-- Primary content -->
<aside role="complementary">...</aside>      <!-- Sidebar -->
<footer role="contentinfo">...</footer>

<!-- Multiple navs need aria-label to distinguish -->
<nav aria-label="Main navigation">...</nav>
<nav aria-label="Footer navigation">...</nav>
```

### Component Patterns

#### Dialog with Focus Trap
```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Delete Account</h2>
  <p>This action cannot be undone.</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

Rules for dialogs:
- `aria-modal="true"` hides background content from screen readers
- `aria-labelledby` points to the visible dialog heading
- Focus must be trapped inside the dialog while open
- Focus returns to the trigger element when the dialog closes
- Escape key must close the dialog

#### Tabs
```html
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">General</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2">Security</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">...</div>
```

#### Combobox with Listbox (Autocomplete)
```html
<label for="search">Search</label>
<input id="search" role="combobox" aria-expanded="true" aria-controls="listbox-1"
       aria-activedescendant="option-2" aria-autocomplete="list" />
<ul id="listbox-1" role="listbox">
  <li id="option-1" role="option">Result 1</li>
  <li id="option-2" role="option" aria-selected="true">Result 2</li>
</ul>
```

Rules:
- `aria-expanded` reflects open/closed state of the listbox
- `aria-activedescendant` points to the visually focused option
- Arrow keys navigate options; Enter selects; Escape closes

#### Disclosure Pattern (Accordion)
```html
<h3>
  <button aria-expanded="false" aria-controls="section-1-content">
    Section 1
  </button>
</h3>
<div id="section-1-content" hidden>
  Content revealed when button is pressed.
</div>
```

Rules:
- Use `aria-expanded` on the button, not the panel
- Use `hidden` attribute (not `display:none` via JS) to hide content
- Do not use `role="tab"` for accordions — use the disclosure pattern

#### Live Regions
```html
<!-- role="status" (polite): announced when user is idle — use for status updates -->
<div role="status" aria-live="polite" aria-atomic="true">
  3 results found
</div>

<!-- role="alert" (assertive): announced immediately — use for errors only -->
<div role="alert" aria-live="assertive">
  Payment failed. Please check your card details.
</div>

<!-- aria-busy: indicates loading in progress -->
<div aria-busy="true" aria-live="polite">
  Loading results...
</div>
```

Guidelines:
- Prefer `role="status"` (polite) for non-urgent updates
- Reserve `role="alert"` (assertive) for errors and critical notifications
- `aria-atomic="true"` announces the entire region, not just changed text
- Inject content into pre-existing live region elements — dynamically added regions are not reliably announced

---

## Keyboard Navigation (`:keyboard`)

### Required Keyboard Support by Component
```
| Component    | Tab    | Enter/Space | Arrow Keys | Escape |
|-------------|--------|-------------|------------|--------|
| Button      | Focus  | Activate    | —          | —      |
| Link        | Focus  | Navigate    | —          | —      |
| Menu        | Open   | Select item | Navigate   | Close  |
| Dialog      | Cycle  | —           | —          | Close  |
| Tabs        | Focus  | —           | Switch tab | —      |
| Tree        | Focus  | Expand      | Navigate   | —      |
| Combobox    | Focus  | Select      | Navigate   | Close  |
| Slider      | Focus  | —           | Adjust     | —      |
```

### Focus Management
```typescript
// Focus trap for modals
function useFocusTrap(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const focusable = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [ref]);
}
```

### Tab Order Verification Process
```
1. Open the page and press Tab from the browser address bar
2. Verify the first focusable element is the skip navigation link
3. Continue tabbing through all interactive elements in DOM order
4. Confirm focus never gets trapped (except in open modals/dialogs)
5. Confirm focus never disappears (invisible focus)
6. Confirm no element is skipped that should be reachable
7. Confirm tabindex values are 0 or -1 only — never positive integers
```

### Skip Navigation Link
```html
<!-- Place as the very first element inside <body> -->
<a class="skip-link" href="#main-content">Skip to main content</a>

<main id="main-content" tabindex="-1">...</main>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px;
  background: #000;
  color: #fff;
  z-index: 1000;
}

.skip-link:focus {
  top: 0;
}
```

### Custom Keyboard Shortcut Documentation
- Document every custom keyboard shortcut in the UI (help dialog or `?` key)
- Avoid overriding browser or OS shortcuts (Ctrl+C, Ctrl+F, Alt+F4)
- Provide a way to disable or remap custom shortcuts
- Shortcut reference must be keyboard-accessible itself

### Focus Visible Requirement
```css
/* WRONG: removing focus outline with no replacement */
*:focus { outline: none; }
button:focus { outline: 0; }

/* CORRECT: custom focus style that meets 3:1 contrast against background */
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove only mouse focus, keep keyboard focus visible */
:focus:not(:focus-visible) {
  outline: none;
}
```

Rule: Never use `outline: none` or `outline: 0` without providing an equally visible custom focus indicator.

---

## Screen Reader (`:screen-reader`)

### Alt Text Guidelines
```html
<!-- Informative image: describe what it shows -->
<img src="chart.png" alt="Revenue grew 25% from Q1 to Q4 2024" />

<!-- Decorative image: empty alt -->
<img src="divider.svg" alt="" />

<!-- Complex image: longer description -->
<figure>
  <img src="architecture.png" alt="System architecture diagram" aria-describedby="arch-desc" />
  <figcaption id="arch-desc">Three-tier architecture with React frontend,
    Node.js API layer, and PostgreSQL database.</figcaption>
</figure>

<!-- Icon button: aria-label instead of alt -->
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>
```

### Alt Text Decision Tree
```
Is the image purely decorative (no informational value)?
  YES → alt=""  (empty string, not omitted)

Is the image a functional button or link icon?
  YES → describe the action, not the image: alt="Search" not alt="magnifying glass"

Is the image informative (conveys meaning)?
  YES → describe the content and purpose in < 100 words

Is the image complex (chart, diagram, graph)?
  YES → short alt (e.g. "Sales chart") + long description via aria-describedby or figcaption

Is the image text (logo, screenshot with text)?
  YES → include the exact text in the alt attribute
```

### Live Regions
```html
<!-- Polite: announced when user is idle (status updates) -->
<div aria-live="polite" aria-atomic="true">
  Search returned 5 results
</div>

<!-- Assertive: announced immediately (errors) -->
<div role="alert" aria-live="assertive">
  Payment failed. Please check your card details.
</div>

<!-- Loading state -->
<div aria-busy="true" aria-live="polite">
  Loading results...
</div>
```

### Form Field Announcement Order
Screen readers announce form fields in this order:
```
Label → Input type → Current value → State (required, invalid, disabled)

Example: "Email address, edit text, required, invalid — Enter a valid email"
```

Requirements:
- Every input must have a visible `<label>` with correct `for` attribute
- `aria-required="true"` or `required` attribute for mandatory fields
- `aria-invalid="true"` when validation fails
- `aria-describedby` links to helper text or error messages

### VoiceOver Testing Checklist (macOS / iOS)

**macOS VoiceOver (VO = Caps Lock or Fn+Ctrl)**
```
□ Enable: Cmd+F5 or System Settings → Accessibility → VoiceOver
□ Navigate links: VO+Cmd+L (Web Rotor → Links)
□ Navigate headings: VO+Cmd+H
□ Navigate landmarks: VO+Cmd+U (Web Rotor → Landmarks)
□ Verify form labels are read before field type
□ Verify error messages are announced on submission
□ Verify modal focus trap works (VO cannot exit dialog)
□ Verify live regions announce updates without focus movement
□ Verify image alt text is read correctly
□ Verify decorative images are skipped (alt="")
```

**iOS VoiceOver**
```
□ Enable: Settings → Accessibility → VoiceOver
□ Swipe right to navigate forward through elements
□ Double-tap to activate
□ Verify touch targets are at least 44×44pt
□ Verify custom gestures do not conflict with VoiceOver gestures
```

### NVDA / JAWS Checklist (Windows)

**NVDA (free, most common for testing)**
```
□ Download from nvaccess.org
□ Test with Firefox (best NVDA compatibility) and Chrome
□ Browse mode (reading): arrows navigate by character/word/line
□ Forms mode (interaction): activates automatically on form fields
□ Heading navigation: H key
□ Link navigation: K key
□ Landmark navigation: D key
□ Verify form fields read label + type + value + state
□ Verify dynamic content updates via live regions are announced
□ Verify tab order matches visual reading order
```

**JAWS (commercial, enterprise environments)**
```
□ Heading navigation: H key (same as NVDA)
□ Form mode: Enter key toggles; verify all fields are reachable
□ Virtual cursor vs. application mode — verify correct mode activates for interactive widgets
□ Check JAWS-specific virtual viewer output for complex widgets
```

---

## Hard Constraints
- All interactive elements must be keyboard accessible
- Color contrast must meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Every form input must have a visible label or aria-label
- Images must have alt text (empty for decorative)
- Focus must be visible on all interactive elements
- Page must have proper landmark structure (header, nav, main, footer)
- Automated testing (axe-core) must be included in CI pipeline
- Never use `tabindex > 0` — positive tabindex values break the natural tab order
- Never convey information through color alone — always pair with text, icon, or pattern
- Never auto-play audio or video — always require user interaction to start media
