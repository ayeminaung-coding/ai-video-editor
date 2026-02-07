# AI Video Editor - Component Library

## Button Components

### Primary Button
```typescript
interface PrimaryButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false,
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
        text-white font-medium rounded-lg
        transition-colors duration-200
        disabled:cursor-not-allowed
      `}
    >
      {children}
    </button>
  );
};
```

### Secondary Button
```typescript
interface SecondaryButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false,
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400
        text-white font-medium rounded-lg
        transition-colors duration-200
        disabled:cursor-not-allowed
      `}
    >
      {children}
    </button>
  );
};
```

### Outline Button
```typescript
interface OutlineButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const OutlineButton: React.FC<OutlineButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false,
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        border-2 border-indigo-600 text-indigo-600
        hover:bg-indigo-50 disabled:border-indigo-400 disabled:text-indigo-400
        font-medium rounded-lg
        transition-colors duration-200
        disabled:cursor-not-allowed
      `}
    >
      {children}
    </button>
  );
};
```

## Input Components

### Text Input
```typescript
interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label = '',
  error = '',
  disabled = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          w-full bg-surface border border-slate-600 rounded-lg
          text-white placeholder-slate-400
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-colors duration-200
          disabled:bg-slate-800 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};
```

### Number Input
```typescript
interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  size?: 'sm' | 'md' | 'lg';
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label = '',
  error = '',
  disabled = false,
  min,
  max,
  step = 1,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`
          ${sizeClasses[size]}
          w-full bg-surface border border-slate-600 rounded-lg
          text-white placeholder-slate-400
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-colors duration-200
          disabled:bg-slate-800 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};
```

### Range Input (Slider)
```typescript
interface RangeInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

const RangeInput: React.FC<RangeInputProps> = ({
  value,
  onChange,
  label = '',
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showValue = true,
  formatValue = (v) => v.toString()
}) => {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">
            {label}
          </label>
          {showValue && (
            <span className="text-sm text-slate-400">
              {formatValue(value)}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`
          w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
          disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:bg-indigo-600
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-indigo-700
          [&::-webkit-slider-thumb]:transition-colors
          [&::-webkit-slider-thumb]:duration-200
        `}
      />
    </div>
  );
};
```

### Select Input
```typescript
interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SelectInput: React.FC<SelectInputProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label = '',
  error = '',
  disabled = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          w-full bg-surface border border-slate-600 rounded-lg
          text-white
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-colors duration-200
          disabled:bg-slate-800 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
        `}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};
```

## Card Components

### Surface Card
```typescript
interface SurfaceCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
}

const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  padding = 'md'
}) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  return (
    <div className={`
      bg-surface rounded-lg shadow-md
      ${paddingClasses[padding]}
      ${className}
    `}>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm text-slate-400 mb-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};
```

### Elevated Card
```typescript
interface ElevatedCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
}

const ElevatedCard: React.FC<ElevatedCardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  padding = 'md'
}) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  return (
    <div className={`
      bg-surface rounded-lg shadow-lg
      ${paddingClasses[padding]}
      ${className}
    `}>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm text-slate-400 mb-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};
```

## Modal Components

### Center Modal
```typescript
interface CenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const CenterModal: React.FC<CenterModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative bg-surface rounded-lg shadow-xl
        ${sizeClasses[size]}
        w-full max-h-[90vh] overflow-y-auto
      `}>
        {title && (
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">
              {title}
            </h3>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};
```

## Progress Components

### Linear Progress
```typescript
interface LinearProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error';
}

const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  max = 100,
  label,
  showValue = true,
  color = 'primary'
}) => {
  const colorClasses = {
    primary: 'bg-indigo-600',
    secondary: 'bg-purple-600',
    success: 'bg-green-600',
    error: 'bg-red-600'
  };

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-slate-300">{label}</span>
          {showValue && (
            <span className="text-sm text-slate-400">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
```

## Usage Examples

### Button Examples
```typescript
import { PrimaryButton, SecondaryButton, OutlineButton } from './components';

function Example() {
  return (
    <div className="space-y-4">
      <PrimaryButton onClick={() => console.log('Clicked')}>
        Primary Button
      </PrimaryButton>
      
      <SecondaryButton onClick={() => console.log('Clicked')}>
        Secondary Button
      </SecondaryButton>
      
      <OutlineButton onClick={() => console.log('Clicked')}>
        Outline Button
      </OutlineButton>
    </div>
  );
}
```

### Input Examples
```typescript
import { TextInput, NumberInput, RangeInput, SelectInput } from './components';

function Example() {
  const [text, setText] = useState('');
  const [number, setNumber] = useState(0);
  const [range, setRange] = useState(50);
  const [select, setSelect] = useState('');

  return (
    <div className="space-y-4">
      <TextInput
        value={text}
        onChange={setText}
        label="Text Input"
        placeholder="Enter text..."
      />
      
      <NumberInput
        value={number}
        onChange={setNumber}
        label="Number Input"
        placeholder="Enter number..."
        min={0}
        max={100}
      />
      
      <RangeInput
        value={range}
        onChange={setRange}
        label="Range Input"
        min={0}
        max={100}
        step={1}
        formatValue={(v) => `${v}%`}
      />
      
      <SelectInput
        value={select}
        onChange={setSelect}
        label="Select Input"
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' }
        ]}
      />
    </div>
  );
}
```

### Card Examples
```typescript
import { SurfaceCard, ElevatedCard } from './components';

function Example() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SurfaceCard
        title="Surface Card"
        subtitle="This is a surface card"
      >
        <p>Card content goes here...</p>
      </SurfaceCard>
      
      <ElevatedCard
        title="Elevated Card"
        subtitle="This is an elevated card"
      >
        <p>Card content goes here...</p>
      </ElevatedCard>
    </div>
  );
}
```

### Modal Examples
```typescript
import { CenterModal } from './components';

function Example() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <PrimaryButton onClick={() => setIsModalOpen(true)}>
        Open Modal
      </PrimaryButton>
      
      <CenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Modal Title"
        size="md"
      >
        <p>Modal content goes here...</p>
        <div className="mt-4 flex justify-end gap-2">
          <OutlineButton onClick={() => setIsModalOpen(false)}>
            Cancel
          </OutlineButton>
          <PrimaryButton onClick={() => console.log('Confirmed')}>
            Confirm
          </PrimaryButton>
        </div>
      </CenterModal>
    </div>
  );
}
```

### Progress Examples
```typescript
import { LinearProgress } from './components';

function Example() {
  const [progress, setProgress] = useState(0);

  return (
    <div className="space-y-4">
      <LinearProgress
        value={progress}
        label="Processing"
        color="primary"
      />
      
      <LinearProgress
        value={progress}
        label="Uploading"
        color="secondary"
        showValue={false}
      />
    </div>
  );
}
```

## Next Steps

1. Create page layouts
2. Create assets (icons, images)
3. Create responsive design
4. Create dark/light mode support
5. Create animation system

**Next File:** `pages.md` - Page layouts documentation