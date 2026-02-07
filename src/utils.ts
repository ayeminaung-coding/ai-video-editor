// utils.ts - Utility Functions
// Common utility functions for the application

/**
 * Format time in MM:SS format
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate video file
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export const validateVideoFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('video/')) {
    return { valid: false, error: 'Please select a video file' };
  }

  // Check file size (max 500MB)
  if (file.size > 500 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 500MB' };
  }

  // Check file extension
  const allowedExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'Unsupported file format' };
  }

  return { valid: true };
};

/**
 * Debounce function
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 * @param func - Function to throttle
 * @param limit - Limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Generate unique ID
 * @returns Unique string ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Copy to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

/**
 * Download file
 * @param content - File content
 * @param filename - File name
 * @param mimeType - MIME type
 */
export const downloadFile = (
  content: string | Blob,
  filename: string,
  mimeType: string
): void => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Get video duration from file
 * @param file - Video file
 * @returns Promise that resolves with duration in seconds
 */
export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      reject(new Error('Failed to get video duration'));
    };
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Get video dimensions from file
 * @param file - Video file
 * @returns Promise that resolves with dimensions
 */
export const getVideoDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      reject(new Error('Failed to get video dimensions'));
    };
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Calculate video aspect ratio
 * @param width - Video width
 * @param height - Video height
 * @returns Aspect ratio string
 */
export const getAspectRatio = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

/**
 * Check if device is mobile
 * @returns True if mobile device
 */
export const isMobile = (): boolean => {
  return window.innerWidth < 768;
};

/**
 * Check if device is tablet
 * @returns True if tablet device
 */
export const isTablet = (): boolean => {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
};

/**
 * Check if device is desktop
 * @returns True if desktop device
 */
export const isDesktop = (): boolean => {
  return window.innerWidth >= 1024;
};

/**
 * Get device type
 * @returns Device type string
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};

/**
 * Get user's timezone
 * @returns Timezone string
 */
export const getTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get current date in YYYY-MM-DD format
 * @returns Date string
 */
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current time in HH:MM:SS format
 * @returns Time string
 */
export const getCurrentTime = (): string => {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
};

/**
 * Format date for display
 * @param date - Date to format
 * @returns Formatted date string
 */
export const formatDateForDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format time for display
 * @param date - Date to format
 * @returns Formatted time string
 */
export const formatTimeForDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format date and time for display
 * @param date - Date to format
 * @returns Formatted date and time string
 */
export const formatDateTimeForDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Calculate relative time (e.g., "2 hours ago")
 * @param date - Date to calculate from
 * @returns Relative time string
 */
export const getRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
};

/**
 * Check if URL is valid
 * @param url - URL to check
 * @returns True if valid URL
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file extension from filename
 * @param filename - Filename
 * @returns File extension
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
};

/**
 * Get filename without extension
 * @param filename - Filename
 * @returns Filename without extension
 */
export const getFilenameWithoutExtension = (filename: string): string => {
  return filename.substring(0, filename.lastIndexOf('.')) || filename;
};

/**
 * Truncate string
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert string to title case
 * @param str - String to convert
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Slugify string
 * @param str - String to slugify
 * @returns Slugified string
 */
export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate random string
 * @param length - Length of string
 * @returns Random string
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Check if email is valid
 * @param email - Email to check
 * @returns True if valid email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if phone number is valid
 * @param phone - Phone number to check
 * @returns True if valid phone number
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone);
};

/**
 * Check if password is strong
 * @param password - Password to check
 * @returns Object with validation results
 */
export const isStrongPassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Get initials from name
 * @param name - Full name
 * @returns Initials
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

/**
 * Get color from string
 * @param str - String to generate color from
 * @returns Hex color string
 */
export const getColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 50%)`;
};

/**
 * Sleep function
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after ms
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delay - Initial delay in milliseconds
 * @returns Promise that resolves with the result
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        await sleep(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Memoize function
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export const memoize = <T extends (...args: any[]) => any>(
  fn: T
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new Map<string, ReturnType<T>>();
  
  return (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Deep clone object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge objects
 * @param target - Target object
 * @param sources - Source objects
 * @returns Merged object
 */
export const mergeObjects = <T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T => {
  return Object.assign({}, target, ...sources);
};

/**
 * Get nested property from object
 * @param obj - Object to get property from
 * @param path - Path to property (e.g., 'user.name')
 * @returns Property value or undefined
 */
export const getNestedProperty = <T>(obj: T, path: string): any => {
  return path.split('.').reduce((current: any, key: string) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

/**
 * Set nested property in object
 * @param obj - Object to set property in
 * @param path - Path to property
 * @param value - Value to set
 * @returns Object with updated property
 */
export const setNestedProperty = <T extends Record<string, any>>(
  obj: T,
  path: string,
  value: any
): T => {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current: any, key: string) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
  return obj;
};

/**
 * Check if object is empty
 * @param obj - Object to check
 * @returns True if object is empty
 */
export const isEmptyObject = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * Check if array is empty
 * @param arr - Array to check
 * @returns True if array is empty
 */
export const isEmptyArray = (arr: any[]): boolean => {
  return arr.length === 0;
};

/**
 * Check if value is null or undefined
 * @param value - Value to check
 * @returns True if value is null or undefined
 */
export const isNullOrUndefined = (value: any): boolean => {
  return value === null || value === undefined;
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - Value to check
 * @returns True if value is empty
 */
export const isEmpty = (value: any): boolean => {
  if (isNullOrUndefined(value)) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return isEmptyArray(value);
  if (typeof value === 'object') return isEmptyObject(value);
  return false;
};

/**
 * Get environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not found
 * @returns Environment variable value or default
 */
export const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return defaultValue;
};

/**
 * Get API URL
 * @returns API URL from environment
 */
export const getApiUrl = (): string => {
  return getEnvVar('VITE_API_URL', 'http://localhost:3001');
};

/**
 * Get Cloudinary cloud name
 * @returns Cloudinary cloud name from environment
 */
export const getCloudinaryCloudName = (): string => {
  return getEnvVar('VITE_CLOUDINARY_CLOUD_NAME', '');
};

/**
 * Get Cloudinary upload preset
 * @returns Cloudinary upload preset from environment
 */
export const getCloudinaryUploadPreset = (): string => {
  return getEnvVar('VITE_CLOUDINARY_UPLOAD_PRESET', '');
};