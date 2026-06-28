---
name: component-gen
description: "Frontend component generation: React 19 (Server Components, Actions), Vue 3 Composition API, design system scaffolding (tokens/variables), Storybook story generation, and ARIA accessibility patterns. Sub-commands: /component-gen:react, :vue, :design-system, :storybook, :accessibility. Use when building UI components, design systems, or improving accessibility."
---

# Component Generation

You are executing the `/component-gen` skill. You apply frontend engineering best practices for React, Vue, design systems, Storybook, and accessibility.

Parse the sub-command from the user's invocation:
- `/component-gen` → show **menu** and wait for selection
- `/component-gen:react` → **React Components**
- `/component-gen:vue` → **Vue Components**
- `/component-gen:design-system` → **Design System**
- `/component-gen:storybook` → **Storybook Stories**
- `/component-gen:accessibility` → **Accessibility (ARIA)**

---

## Menu (no sub-command)

```
Component Generation — Choose a topic:

1. react         — React 19 Server Components, use(), Actions, hooks patterns
2. vue           — Vue 3 Composition API, composables, script setup
3. design-system — Token-based design system, CSS variables, component library
4. storybook     — Story generation, args, play functions, interaction testing
5. accessibility — ARIA patterns, keyboard navigation, screen reader support
```

---

## React Components (`:react`)

### Server Component (React 19)
```tsx
// app/users/page.tsx — Server Component (default in Next.js App Router)
import { Suspense } from 'react';
import { UserList } from './user-list';
import { UserListSkeleton } from './user-list-skeleton';

export default function UsersPage() {
  return (
    <main>
      <h1>Users</h1>
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </main>
  );
}

// Server Component that fetches data directly
async function UserList() {
  const users = await db.users.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name} — {user.email}</li>
      ))}
    </ul>
  );
}
```

### Client Component with Actions
```tsx
'use client';

import { useActionState } from 'react';
import { createUser } from './actions';

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, {
    errors: {},
    message: '',
  });

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required aria-describedby="email-error" />
        {state.errors?.email && (
          <p id="email-error" role="alert">{state.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
        {state.errors?.name && <p role="alert">{state.errors.name}</p>}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>

      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
```

### Custom Hook Pattern
```tsx
import { useState, useEffect, useCallback } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}
```

---

## Vue Components (`:vue`)

### Composition API (script setup)
```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';

interface Props {
  userId: string;
  editable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
});

const emit = defineEmits<{
  update: [user: User];
  delete: [id: string];
}>();

const store = useUserStore();
const isEditing = ref(false);
const formData = ref({ name: '', email: '' });

const user = computed(() => store.getUserById(props.userId));

watch(user, (newUser) => {
  if (newUser) {
    formData.value = { name: newUser.name, email: newUser.email };
  }
}, { immediate: true });

async function handleSave() {
  await store.updateUser(props.userId, formData.value);
  emit('update', store.getUserById(props.userId)!);
  isEditing.value = false;
}

onMounted(() => store.fetchUser(props.userId));
</script>

<template>
  <div class="user-card">
    <template v-if="isEditing">
      <input v-model="formData.name" aria-label="Name" />
      <input v-model="formData.email" type="email" aria-label="Email" />
      <button @click="handleSave">Save</button>
      <button @click="isEditing = false">Cancel</button>
    </template>
    <template v-else>
      <h3>{{ user?.name }}</h3>
      <p>{{ user?.email }}</p>
      <button v-if="editable" @click="isEditing = true">Edit</button>
    </template>
  </div>
</template>
```

### Composable Pattern
```typescript
// composables/useApi.ts
import { ref, type Ref } from 'vue';

export function useApi<T>(fetcher: () => Promise<T>) {
  const data: Ref<T | null> = ref(null);
  const error: Ref<string | null> = ref(null);
  const isLoading = ref(false);

  async function execute() {
    isLoading.value = true;
    error.value = null;
    try {
      data.value = await fetcher();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }

  return { data, error, isLoading, execute };
}
```

---

## Design System (`:design-system`)

### Design Tokens (CSS Custom Properties)
```css
/* tokens.css — Single source of truth */
:root {
  /* Colors */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;

  --color-neutral-50: #fafafa;
  --color-neutral-200: #e5e5e5;
  --color-neutral-700: #404040;
  --color-neutral-900: #171717;

  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */

  /* Spacing */
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* Dark mode */
[data-theme="dark"] {
  --color-neutral-50: #171717;
  --color-neutral-200: #404040;
  --color-neutral-700: #e5e5e5;
  --color-neutral-900: #fafafa;
}
```

### Component Library Pattern
```tsx
// Button component with variants
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
```

---

## Storybook Stories (`:storybook`)

### Story with Args and Play Function
```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: 'Primary Button', variant: 'primary' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

// Interaction test
export const ClickInteraction: Story = {
  args: { children: 'Click Me' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
```

---

## Accessibility (`:accessibility`)

### ARIA Patterns by Component Type
```tsx
// Dialog / Modal
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc">
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-desc">Are you sure you want to proceed?</p>
  <button onClick={onConfirm}>Confirm</button>
  <button onClick={onCancel}>Cancel</button>
</div>

// Tabs
<div role="tablist" aria-label="Account settings">
  <button role="tab" aria-selected={active === 'profile'} aria-controls="panel-profile" id="tab-profile">
    Profile
  </button>
  <button role="tab" aria-selected={active === 'security'} aria-controls="panel-security" id="tab-security">
    Security
  </button>
</div>
<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile" tabIndex={0}>
  {/* Profile content */}
</div>

// Toast / Alert
<div role="alert" aria-live="assertive" aria-atomic="true">
  Operation completed successfully.
</div>

// Loading state
<div aria-busy="true" aria-live="polite">
  <span className="spinner" aria-hidden="true" />
  Loading users...
</div>
```

### Keyboard Navigation
```
| Component    | Keys                                    |
|-------------|----------------------------------------|
| Button      | Enter, Space → activate                |
| Menu        | Arrow keys → navigate, Escape → close  |
| Dialog      | Tab → cycle focus, Escape → close      |
| Tabs        | Arrow keys → switch, Home/End → first/last |
| Combobox    | Arrow keys → options, Enter → select   |
| Tree        | Arrow keys → navigate, Enter → expand  |
```

---

## Hard Constraints
- Every interactive element must be keyboard accessible
- All form inputs must have associated labels (visible or aria-label)
- Color must not be the only means of conveying information
- Focus must be visible and managed correctly in modals/dialogs
- Touch targets must be at least 44x44px on mobile
- Loading and error states must be announced to screen readers
- Components must support both controlled and uncontrolled usage patterns
