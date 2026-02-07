// hooks.ts - Custom React Hooks
// Custom hooks for common functionality

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * useLocalStorage - Hook for managing localStorage
 * @param key - Storage key
 * @param initialValue - Initial value
 * @returns [value, setValue, removeValue]
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

/**
 * useSessionStorage - Hook for managing sessionStorage
 * @param key - Storage key
 * @param initialValue - Initial value
 * @returns [value, setValue, removeValue]
 */
export const useSessionStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from sessionStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error setting sessionStorage:', error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error('Error removing from sessionStorage:', error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

/**
 * useToggle - Hook for toggle state
 * @param initialValue - Initial toggle state
 * @returns [value, toggle, setValue]
 */
export const useToggle = (
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] => {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle, setValue];
};

/**
 * useCounter - Hook for counter state
 * @param initialValue - Initial counter value
 * @returns [count, increment, decrement, reset, setCount]
 */
export const useCounter = (
  initialValue: number = 0
): [
  number,
  () => void,
  () => void,
  () => void,
  (value: number) => void
] => {
  const [count, setCount] = useState<number>(initialValue);

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount((prev) => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return [count, increment, decrement, reset, setCount];
};

/**
 * useDebounce - Hook for debouncing a value
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useThrottle - Hook for throttling a value
 * @param value - Value to throttle
 * @param limit - Limit in milliseconds
 * @returns Throttled value
 */
export const useThrottle = <T>(value: T, limit: number): T => {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastExecuted.current >= limit) {
      setThrottledValue(value);
      lastExecuted.current = now;
    }
  }, [value, limit]);

  return throttledValue;
};

/**
 * usePrevious - Hook to get previous value
 * @param value - Current value
 * @returns Previous value
 */
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

/**
 * useInterval - Hook for setInterval
 * @param callback - Callback function
 * @param delay - Delay in milliseconds
 */
export const useInterval = (callback: () => void, delay: number | null): void => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
};

/**
 * useTimeout - Hook for setTimeout
 * @param callback - Callback function
 * @param delay - Delay in milliseconds
 */
export const useTimeout = (callback: () => void, delay: number | null): void => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => {
      savedCallback.current();
    }, delay);

    return () => clearTimeout(id);
  }, [delay]);
};

/**
 * useUpdateEffect - Hook for update effect (skips initial mount)
 * @param effect - Effect function
 * @param deps - Dependencies
 */
export const useUpdateEffect = (effect: () => void, deps: any[] = []): void => {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      effect();
    }
  }, deps);
};

/**
 * useIsMounted - Hook to check if component is mounted
 * @returns isMounted function
 */
export const useIsMounted = (): (() => boolean) => {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
};

/**
 * useAsync - Hook for async operations
 * @param asyncFunction - Async function to execute
 * @param immediate - Execute immediately
 * @returns [execute, state]
 */
export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
): [
  () => Promise<T | undefined>,
  {
    loading: boolean;
    error: Error | null;
    value: T | null;
  }
] => {
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<Error | null>(null);
  const [value, setValue] = useState<T | null>(null);

  const execute = useCallback(async (): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction();
      setValue(result);
      return result;
    } catch (err) {
      setError(err as Error);
      setValue(null);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return [execute, { loading, error, value }];
};

/**
 * useFetch - Hook for fetching data
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns [execute, state]
 */
export const useFetch = <T>(
  url: string,
  options: RequestInit = {}
): [
  () => Promise<T | undefined>,
  {
    loading: boolean;
    error: Error | null;
    data: T | null;
  }
] => {
  const asyncFunction = useCallback(async (): Promise<T> => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }, [url, options]);

  const [execute, state] = useAsync(asyncFunction, false);

  return [execute, { ...state, data: state.value }];
};

/**
 * useWindowSize - Hook for window size
 * @returns [width, height]
 */
export const useWindowSize = (): [number, number] => {
  const [windowSize, setWindowSize] = useState<[number, number]>([
    window.innerWidth,
    window.innerHeight,
  ]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize([window.innerWidth, window.innerHeight]);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

/**
 * useMediaQuery - Hook for media queries
 * @param query - Media query string
 * @returns Boolean indicating if query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
};

/**
 * useIsOnline - Hook to check if online
 * @returns Boolean indicating if online
 */
export const useIsOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * useIsDarkMode - Hook to check if dark mode is preferred
 * @returns Boolean indicating if dark mode is preferred
 */
export const useIsDarkMode = (): boolean => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return isDarkMode;
};

/**
 * useGeolocation - Hook for geolocation
 * @returns [position, error, loading]
 */
export const useGeolocation = (): [
  GeolocationPosition | null,
  GeolocationPositionError | null,
  boolean
] => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(new Error('Geolocation not supported') as any);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, []);

  return [position, error, loading];
};

/**
 * useIntersectionObserver - Hook for intersection observer
 * @param options - Intersection observer options
 * @returns [ref, entry]
 */
export const useIntersectionObserver = <T extends HTMLElement>(
  options?: IntersectionObserverInit
): [React.RefObject<T>, IntersectionObserverEntry | null] => {
  const ref = useRef<T>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, entry];
};

/**
 * useHover - Hook for hover state
 * @returns [ref, isHovered]
 */
export const useHover = <T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean
] => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    node.addEventListener('mouseenter', handleMouseEnter);
    node.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      node.removeEventListener('mouseenter', handleMouseEnter);
      node.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return [ref, isHovered];
};

/**
 * useFocus - Hook for focus state
 * @returns [ref, isFocused]
 */
export const useFocus = <T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean
] => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    node.addEventListener('focus', handleFocus);
    node.addEventListener('blur', handleBlur);

    return () => {
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
    };
  }, []);

  return [ref, isFocused];
};

/**
 * useActive - Hook for active state
 * @returns [ref, isActive]
 */
export const useActive = <T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean
] => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseDown = () => setIsActive(true);
    const handleMouseUp = () => setIsActive(false);

    node.addEventListener('mousedown', handleMouseDown);
    node.addEventListener('mouseup', handleMouseUp);

    return () => {
      node.removeEventListener('mousedown', handleMouseDown);
      node.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return [ref, isActive];
};

/**
 * useClickOutside - Hook for click outside
 * @param callback - Callback when clicked outside
 * @returns ref
 */
export const useClickOutside = <T extends HTMLElement>(
  callback: () => void
): React.RefObject<T> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [callback]);

  return ref;
};

/**
 * useKeyPress - Hook for key press
 * @param targetKey - Target key
 * @param callback - Callback when key is pressed
 */
export const useKeyPress = (targetKey: string, callback: () => void): void => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [targetKey, callback]);
};

/**
 * useKeyboardShortcuts - Hook for keyboard shortcuts
 * @param shortcuts - Shortcuts object
 */
export const useKeyboardShortcuts = (
  shortcuts: Record<string, () => void>
): void => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (shortcuts[key]) {
        shortcuts[key]();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [shortcuts]);
};

/**
 * useScrollPosition - Hook for scroll position
 * @returns [x, y]
 */
export const useScrollPosition = (): [number, number] => {
  const [position, setPosition] = useState<[number, number]>([
    window.scrollX,
    window.scrollY,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setPosition([window.scrollX, window.scrollY]);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return position;
};

/**
 * useScrollToTop - Hook for scroll to top
 * @returns scrollToTop function
 */
export const useScrollToTop = (): (() => void) => {
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return scrollToTop;
};

/**
 * useScrollToBottom - Hook for scroll to bottom
 * @returns scrollToBottom function
 */
export const useScrollToBottom = (): (() => void) => {
  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  return scrollToBottom;
};

/**
 * useScrollToElement - Hook for scroll to element
 * @returns scrollToElement function
 */
export const useScrollToElement = (): ((element: HTMLElement | null) => void) => {
  const scrollToElement = useCallback((element: HTMLElement | null) => {
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return scrollToElement;
};

/**
 * useScrollProgress - Hook for scroll progress
 * @returns progress (0-100)
 */
export const useScrollProgress = (): number => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.body.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      setProgress(Math.min(100, Math.max(0, scrollPercent)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
};

/**
 * useScrollLock - Hook for scroll lock
 * @param locked - Whether to lock scroll
 */
export const useScrollLock = (locked: boolean): void => {
  useEffect(() => {
    if (locked) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [locked]);
};

/**
 * useFocusTrap - Hook for focus trap
 * @param ref - Ref to trap focus within
 * @param active - Whether to trap focus
 */
export const useFocusTrap = <T extends HTMLElement>(
  ref: React.RefObject<T>,
  active: boolean
): void => {
  useEffect(() => {
    if (!active || !ref.current) return;

    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ref, active]);
};

/**
 * useReducedMotion - Hook for reduced motion preference
 * @returns Boolean indicating if reduced motion is preferred
 */
export const useReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedMotion;
};

/**
 * useHighContrast - Hook for high contrast preference
 * @returns Boolean indicating if high contrast is preferred
 */
export const useHighContrast = (): boolean => {
  const [highContrast, setHighContrast] = useState<boolean>(
    window.matchMedia('(prefers-contrast: high)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const listener = (e: MediaQueryListEvent) => setHighContrast(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return highContrast;
};

/**
 * usePrefersColorScheme - Hook for color scheme preference
 * @returns 'light' | 'dark' | 'no-preference'
 */
export const usePrefersColorScheme = (): 'light' | 'dark' | 'no-preference' => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'no-preference'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return colorScheme;
};

/**
 * usePrefersLanguage - Hook for language preference
 * @returns Array of preferred languages
 */
export const usePrefersLanguage = (): string[] => {
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    const updateLanguages = () => {
      const langs = navigator.languages ? [...navigator.languages] : [navigator.language];
      setLanguages(langs);
    };

    updateLanguages();
    window.addEventListener('languagechange', updateLanguages);
    
    return () => window.removeEventListener('languagechange', updateLanguages);
  }, []);

  return languages;
};

/**
 * usePrefersReducedData - Hook for reduced data preference
 * @returns Boolean indicating if reduced data is preferred
 */
export const usePrefersReducedData = (): boolean => {
  const [reducedData, setReducedData] = useState<boolean>(
    window.matchMedia('(prefers-reduced-data: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedData(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedData;
};

/**
 * usePrefersForcedColors - Hook for forced colors preference
 * @returns Boolean indicating if forced colors is preferred
 */
export const usePrefersForcedColors = (): boolean => {
  const [forcedColors, setForcedColors] = useState<boolean>(
    window.matchMedia('(forced-colors: active)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    const listener = (e: MediaQueryListEvent) => setForcedColors(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return forcedColors;
};

/**
 * usePrefersInvertedColors - Hook for inverted colors preference
 * @returns Boolean indicating if inverted colors is preferred
 */
export const usePrefersInvertedColors = (): boolean => {
  const [invertedColors, setInvertedColors] = useState<boolean>(
    window.matchMedia('(inverted-colors: invert)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(inverted-colors: invert)');
    const listener = (e: MediaQueryListEvent) => setInvertedColors(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return invertedColors;
};

/**
 * usePrefersTransparency - Hook for transparency preference
 * @returns Boolean indicating if transparency is preferred
 */
export const usePrefersTransparency = (): boolean => {
  const [transparency, setTransparency] = useState<boolean>(
    window.matchMedia('(prefers-transparency: more)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-transparency: more)');
    const listener = (e: MediaQueryListEvent) => setTransparency(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return transparency;
};

/**
 * usePrefersReducedMotion - Hook for reduced motion preference
 * @returns Boolean indicating if reduced motion is preferred
 */
export const usePrefersReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedMotion;
};

/**
 * usePrefersReducedTransparency - Hook for reduced transparency preference
 * @returns Boolean indicating if reduced transparency is preferred
 */
export const usePrefersReducedTransparency = (): boolean => {
  const [reducedTransparency, setReducedTransparency] = useState<boolean>(
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedTransparency(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedTransparency;
};

/**
 * usePrefersReducedDataSaver - Hook for reduced data saver preference
 * @returns Boolean indicating if reduced data saver is preferred
 */
export const usePrefersReducedDataSaver = (): boolean => {
  const [reducedDataSaver, setReducedDataSaver] = useState<boolean>(
    window.matchMedia('(prefers-reduced-data-saver: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-data-saver: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedDataSaver(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedDataSaver;
};

/**
 * usePrefersReducedBandwidth - Hook for reduced bandwidth preference
 * @returns Boolean indicating if reduced bandwidth is preferred
 */
export const usePrefersReducedBandwidth = (): boolean => {
  const [reducedBandwidth, setReducedBandwidth] = useState<boolean>(
    window.matchMedia('(prefers-reduced-bandwidth: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-bandwidth: reduce)');
    const listener = (e: MediaQueryListEvent) => setReducedBandwidth(e.matches);
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reducedBandwidth;
};