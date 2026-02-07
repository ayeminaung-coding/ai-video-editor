# AI Video Editor - Design System

## Color Palette

### Primary Colors
- **Primary**: `#6366F1` (Indigo)
- **Primary Dark**: `#4F46E5` (Indigo Dark)
- **Primary Light**: `#818CF8` (Indigo Light)

### Secondary Colors
- **Secondary**: `#8B5CF6` (Purple)
- **Secondary Dark**: `#7C3AED` (Purple Dark)
- **Secondary Light**: `#A78BFA` (Purple Light)

### Background Colors
- **Background**: `#0F172A` (Dark Blue)
- **Surface**: `#1E293B` (Darker Blue)
- **Surface Light**: `#334155` (Slate)

### Text Colors
- **Text Primary**: `#F8FAFC` (White)
- **Text Secondary**: `#94A3B8` (Slate)
- **Text Disabled**: `#64748B` (Slate)

### Accent Colors
- **Accent**: `#F59E0B` (Amber)
- **Success**: `#10B981` (Green)
- **Error**: `#EF4444` (Red)
- **Warning**: `#F59E0B` (Amber)

## Typography

### Font Family
- **Primary**: Inter, system-ui, sans-serif
- **Monospace**: 'JetBrains Mono', monospace

### Font Sizes
- **xs**: 0.75rem (12px)
- **sm**: 0.875rem (14px)
- **base**: 1rem (16px)
- **lg**: 1.125rem (18px)
- **xl**: 1.25rem (20px)
- **2xl**: 1.5rem (24px)
- **3xl**: 1.875rem (30px)
- **4xl**: 2.25rem (36px)

### Font Weights
- **normal**: 400
- **medium**: 500
- **semibold**: 600
- **bold**: 700

### Line Heights
- **tight**: 1.25
- **normal**: 1.5
- **relaxed**: 1.75

## Spacing

### Scale
- **0**: 0px
- **1**: 0.25rem (4px)
- **2**: 0.5rem (8px)
- **3**: 0.75rem (12px)
- **4**: 1rem (16px)
- **5**: 1.25rem (20px)
- **6**: 1.5rem (24px)
- **8**: 2rem (32px)
- **10**: 2.5rem (40px)
- **12**: 3rem (48px)
- **16**: 4rem (64px)
- **20**: 5rem (80px)
- **24**: 6rem (96px)

## Border Radius

### Scale
- **sm**: 0.125rem (2px)
- **md**: 0.25rem (4px)
- **lg**: 0.5rem (8px)
- **xl**: 0.75rem (12px)
- **2xl**: 1rem (16px)
- **full**: 9999px

## Shadows

### Scale
- **sm**: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
- **md**: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
- **lg**: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
- **xl**: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)

## Breakpoints

### Scale
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

## Z-Index

### Scale
- **dropdown**: 1000
- **sticky**: 1020
- **fixed**: 1030
- **modal-backdrop**: 1040
- **modal**: 1050
- **popover**: 1060
- **tooltip**: 1070

## Transitions

### Duration
- **fast**: 150ms
- **normal**: 200ms
- **slow**: 300ms

### Easing
- **ease-in**: cubic-bezier(0.4, 0, 1, 1)
- **ease-out**: cubic-bezier(0, 0, 0.2, 1)
- **ease-in-out**: cubic-bezier(0.4, 0, 0.2, 1)

## Usage Examples

### Button Component
```typescript
// Primary Button
<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200">
  Primary Button
</button>

// Secondary Button
<button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200">
  Secondary Button
</button>

// Outline Button
<button className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium transition-colors duration-200">
  Outline Button
</button>
```

### Card Component
```typescript
<div className="bg-surface rounded-lg p-6 shadow-md">
  <h3 className="text-xl font-semibold text-white mb-2">Card Title</h3>
  <p className="text-slate-400">Card content goes here...</p>
</div>
```

### Input Component
```typescript
<input
  type="text"
  className="bg-surface border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors duration-200"
  placeholder="Enter text..."
/>
```

## Design Tokens

### CSS Variables
```css
:root {
  /* Colors */
  --color-primary: #6366F1;
  --color-primary-dark: #4F46E5;
  --color-primary-light: #818CF8;
  
  --color-secondary: #8B5CF6;
  --color-secondary-dark: #7C3AED;
  --color-secondary-light: #A78BFA;
  
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-surface-light: #334155;
  
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --color-text-disabled: #64748B;
  
  --color-accent: #F59E0B;
  --color-success: #10B981;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
  
  /* Typography */
  --font-family-primary: Inter, system-ui, sans-serif;
  --font-family-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;
  
  /* Border Radius */
  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Transitions */
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
  
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Next Steps

1. Create component library
2. Create page layouts
3. Create assets (icons, images)
4. Create responsive design
5. Create dark/light mode support

**Next File:** `components.md` - Component library documentation