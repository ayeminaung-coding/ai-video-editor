# AI Video Editor - Responsive Design System

## Breakpoints

### Standard Breakpoints
```css
/* Mobile First - Default (no media query needed) */
/* Small devices (landscape phones, less than 640px) */
@media (max-width: 639px) {
  /* Mobile styles */
}

/* Medium devices (tablets, 640px and up) */
@media (min-width: 640px) {
  /* Tablet styles */
}

/* Large devices (desktops, 1024px and up) */
@media (min-width: 1024px) {
  /* Desktop styles */
}

/* Extra large devices (large desktops, 1280px and up) */
@media (min-width: 1280px) {
  /* Large desktop styles */
}

/* 2XL devices (extra large desktops, 1536px and up) */
@media (min-width: 1536px) {
  /* 2XL desktop styles */
}
```

### Tailwind CSS Breakpoints (if using Tailwind)
```css
/* Mobile: sm: (default) */
/* Tablet: md: */
/* Desktop: lg: */
/* Large Desktop: xl: */
/* Extra Large: 2xl: */
```

## Mobile-First Design Principles

### 1. Layout Structure
```typescript
// src/components/ResponsiveLayout.tsx
import React from 'react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  header
}) => {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header - Always visible */}
      {header && (
        <header className="bg-surface border-b border-slate-700 px-4 py-3 md:px-6 md:py-4">
          {header}
        </header>
      )}
      
      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row">
        {/* Sidebar - Collapsible on mobile */}
        {sidebar && (
          <aside className="w-full md:w-64 bg-surface border-r border-slate-700 md:min-h-screen">
            {sidebar}
          </aside>
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
```

### 2. Grid System
```typescript
// src/components/ResponsiveGrid.tsx
import React from 'react';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4
}) => {
  const gapClass = `gap-${gap}`;
  
  return (
    <div className={`
      grid
      grid-cols-${columns.mobile}
      sm:grid-cols-${columns.tablet}
      md:grid-cols-${columns.desktop}
      ${gapClass}
    `}>
      {children}
    </div>
  );
};

export default ResponsiveGrid;
```

## Responsive Components

### 1. Responsive Button
```typescript
// src/components/ResponsiveButton.tsx
import React from 'react';

interface ResponsiveButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  size = 'md'
}) => {
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-purple-600 hover:bg-purple-700 text-white',
    outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[44px]', // Touch-friendly
    md: 'px-4 py-2 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]'
  };

  return (
    <button
      onClick={onClick}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-lg font-medium
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        active:scale-95
        touch-manipulation
      `}
    >
      {children}
    </button>
  );
};

export default ResponsiveButton;
```

### 2. Responsive Card
```typescript
// src/components/ResponsiveCard.tsx
import React from 'react';

interface ResponsiveCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  title,
  subtitle,
  padding = 'md',
  className = ''
}) => {
  const paddingClasses = {
    sm: 'p-3 md:p-4',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
    xl: 'p-8 md:p-12'
  };

  return (
    <div className={`
      bg-surface rounded-lg shadow-md
      ${paddingClasses[padding]}
      ${className}
    `}>
      {title && (
        <h3 className="text-lg md:text-xl font-semibold text-white mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm md:text-base text-slate-400 mb-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};

export default ResponsiveCard;
```

### 3. Responsive Input
```typescript
// src/components/ResponsiveInput.tsx
import React from 'react';

interface ResponsiveInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  type?: 'text' | 'number' | 'email';
  size?: 'sm' | 'md' | 'lg';
}

const ResponsiveInput: React.FC<ResponsiveInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label = '',
  type = 'text',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[44px]',
    md: 'px-4 py-3 text-base min-h-[48px]',
    lg: 'px-5 py-4 text-lg min-h-[52px]'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm md:text-base font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          ${sizeClasses[size]}
          w-full bg-surface border border-slate-600 rounded-lg
          text-white placeholder-slate-400
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-colors duration-200
          touch-manipulation
        `}
      />
    </div>
  );
};

export default ResponsiveInput;
```

## Page Layouts

### 1. Mobile Layout (Default)
```typescript
// src/layouts/MobileLayout.tsx
import React from 'react';

interface MobileLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  bottomNav?: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  header,
  bottomNav
}) => {
  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Header */}
      {header && (
        <header className="bg-surface border-b border-slate-700 px-4 py-3">
          {header}
        </header>
      )}
      
      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      {bottomNav && (
        <nav className="bg-surface border-t border-slate-700 px-4 py-2">
          {bottomNav}
        </nav>
      )}
    </div>
  );
};

export default MobileLayout;
```

### 2. Tablet Layout
```typescript
// src/layouts/TabletLayout.tsx
import React from 'react';

interface TabletLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
}

const TabletLayout: React.FC<TabletLayoutProps> = ({
  children,
  header,
  sidebar
}) => {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      {header && (
        <header className="bg-surface border-b border-slate-700 px-6 py-4">
          {header}
        </header>
      )}
      
      {/* Main Content Area */}
      <div className="flex">
        {/* Sidebar - Collapsible */}
        {sidebar && (
          <aside className="w-64 bg-surface border-r border-slate-700 min-h-screen">
            {sidebar}
          </aside>
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default TabletLayout;
```

### 3. Desktop Layout
```typescript
// src/layouts/DesktopLayout.tsx
import React from 'react';

interface DesktopLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  rightPanel?: React.ReactNode;
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  children,
  header,
  sidebar,
  rightPanel
}) => {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      {header && (
        <header className="bg-surface border-b border-slate-700 px-6 py-4">
          {header}
        </header>
      )}
      
      {/* Main Content Area */}
      <div className="flex">
        {/* Left Sidebar */}
        {sidebar && (
          <aside className="w-64 bg-surface border-r border-slate-700 min-h-screen">
            {sidebar}
          </aside>
        )}
        
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
        
        {/* Right Panel */}
        {rightPanel && (
          <aside className="w-80 bg-surface border-l border-slate-700 min-h-screen">
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
};

export default DesktopLayout;
```

## Responsive Page Examples

### 1. Responsive Upload Page
```typescript
// src/pages/ResponsiveUploadPage.tsx
import React from 'react';
import { SurfaceCard } from '../components/Card';
import { PrimaryButton, OutlineButton } from '../components/Button';

const ResponsiveUploadPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">
        Upload Video
      </h1>
      
      <SurfaceCard title="Select Video File" padding="lg">
        <div className="space-y-4">
          {/* File Input - Full width on mobile */}
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 md:p-8 text-center hover:border-indigo-500 transition-colors">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer block"
            >
              <div className="text-4xl md:text-5xl mb-2">📹</div>
              <p className="text-slate-300 mb-2 text-sm md:text-base">
                Click to select video file
              </p>
              <p className="text-xs md:text-sm text-slate-500">
                Supports MP4, MOV, AVI, WebM
              </p>
            </label>
          </div>

          {/* Actions - Stack on mobile, row on desktop */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <PrimaryButton
              onClick={() => {}}
              size="md"
              className="w-full md:w-auto"
            >
              Upload Video
            </PrimaryButton>
            <OutlineButton
              onClick={() => {}}
              size="md"
              className="w-full md:w-auto"
            >
              Continue to Editor
            </OutlineButton>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default ResponsiveUploadPage;
```

### 2. Responsive Editor Page
```typescript
// src/pages/ResponsiveEditorPage.tsx
import React from 'react';
import { SurfaceCard } from '../components/Card';
import ControlPanel from '../components/ControlPanel';
import VideoPreview from '../components/VideoPreview';

const ResponsiveEditorPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">
        Video Editor
      </h1>
      
      {/* Mobile: Stack vertically */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Video Preview - Full width on mobile */}
        <div className="lg:col-span-2">
          <SurfaceCard title="Preview" padding="lg">
            <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
              <p className="text-slate-400">Video Preview</p>
            </div>
          </SurfaceCard>
        </div>

        {/* Control Panel - Full width on mobile */}
        <div className="lg:col-span-1">
          <SurfaceCard title="Controls" padding="lg">
            <div className="space-y-4">
              {/* Speed Control */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Speed: 1x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  className="w-full"
                />
              </div>

              {/* Volume Control */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Volume: 100%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full"
                />
              </div>

              {/* Text Overlay */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Text Overlay
                </label>
                <input
                  type="text"
                  className="w-full bg-surface border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="Enter text..."
                />
              </div>

              {/* Export Button */}
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-medium">
                Export Video
              </button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveEditorPage;
```

## Responsive Utilities

### 1. Container Utility
```typescript
// src/utils/responsive.ts
export const getContainerClass = (size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg') => {
  const classes = {
    sm: 'max-w-sm mx-auto',
    md: 'max-w-md mx-auto',
    lg: 'max-w-lg mx-auto',
    xl: 'max-w-xl mx-auto',
    full: 'max-w-full mx-auto'
  };
  return classes[size];
};

export const getGridClass = (columns: number) => {
  return `grid grid-cols-1 md:grid-cols-${columns} lg:grid-cols-${columns}`;
};

export const getGapClass = (size: number) => {
  return `gap-${size} md:gap-${size * 2}`;
};
```

### 2. Touch-Friendly Utility
```typescript
// src/utils/touch.ts
export const getTouchClass = () => {
  return 'min-h-[44px] touch-manipulation';
};

export const getTouchButtonClass = () => {
  return 'min-h-[44px] active:scale-95 transition-transform';
};
```

## Responsive Design Patterns

### 1. Mobile-First CSS
```css
/* Mobile First - Default styles */
.container {
  padding: 1rem;
  max-width: 100%;
}

/* Tablet and up */
@media (min-width: 640px) {
  .container {
    padding: 1.5rem;
    max-width: 640px;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 2rem;
    max-width: 1024px;
  }
}
```

### 2. Responsive Typography
```css
/* Mobile First - Default */
h1 {
  font-size: 1.5rem; /* 24px */
  line-height: 1.2;
}

/* Tablet */
@media (min-width: 640px) {
  h1 {
    font-size: 2rem; /* 32px */
  }
}

/* Desktop */
@media (min-width: 1024px) {
  h1 {
    font-size: 2.5rem; /* 40px */
  }
}
```

### 3. Responsive Spacing
```css
/* Mobile First - Default */
.section {
  padding: 1rem;
  margin-bottom: 1rem;
}

/* Tablet */
@media (min-width: 640px) {
  .section {
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .section {
    padding: 2rem;
    margin-bottom: 2rem;
  }
}
```

## Testing Responsive Design

### 1. Browser DevTools
```bash
# Open Chrome DevTools
# Press F12 or Ctrl+Shift+I
# Click device toolbar (Ctrl+Shift+M)
# Select different devices
```

### 2. Responsive Testing Checklist
- [ ] Mobile: < 640px
- [ ] Tablet: 640px - 1024px
- [ ] Desktop: > 1024px
- [ ] Touch targets ≥ 44px
- [ ] Text readable without zoom
- [ ] Images scale properly
- [ ] Navigation accessible
- [ ] Forms usable on mobile

### 3. Common Responsive Issues
```typescript
// src/utils/responsive-helpers.ts
export const isMobile = () => {
  return window.innerWidth < 640;
};

export const isTablet = () => {
  return window.innerWidth >= 640 && window.innerWidth < 1024;
};

export const isDesktop = () => {
  return window.innerWidth >= 1024;
};

export const getDeviceType = () => {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};
```

## Next Steps

1. **Update Existing Components** - Make ControlPanel, VideoPreview responsive
2. **Create Responsive Layouts** - Mobile, tablet, desktop layouts
3. **Test on Real Devices** - Test on actual mobile devices
4. **Optimize Performance** - Lazy loading, image optimization
5. **Accessibility** - Ensure responsive design is accessible

**Next File:** `assets.md` - Assets documentation