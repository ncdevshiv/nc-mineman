/**
* Centralized Design System Tokens
* All colors, spacing, typography, and animation values in one place.
*/

export const tokens = {
    colors: {
        // Brand
        primary: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            300: '#5eead4',
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
            glow: 'rgba(20, 184, 166, 0.25)',
        },
        accent: {
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
        },
        // Semantic
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        // Surfaces (dark theme default)
        bg: {
            primary: '#0a0f1a',
            secondary: '#111827',
            tertiary: '#1e293b',
            card: 'rgba(17, 24, 39, 0.8)',
            cardHover: 'rgba(30, 41, 59, 0.9)',
            nav: 'rgba(10, 15, 26, 0.82)',
        },
        text: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            muted: '#94a3b8',
            inverse: '#0f172a',
        },
        border: {
            default: 'rgba(148, 163, 184, 0.1)',
            strong: 'rgba(148, 163, 184, 0.2)',
        },
        glass: {
            bg: 'rgba(17, 24, 39, 0.6)',
            border: 'rgba(148, 163, 184, 0.1)',
        },
    },
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
    },
    radius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
    },
    font: {
        display: "'Outfit', system-ui, sans-serif",
        body: "var(--font-sans), system-ui, sans-serif",
        mono: "var(--font-mono), monospace",
    },
    transition: {
        fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
        base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
        spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    shadow: {
        sm: '0 4px 12px rgba(0, 0, 0, 0.15)',
        md: '0 8px 30px rgba(0, 0, 0, 0.2)',
        lg: '0 20px 60px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(20, 184, 166, 0.25)',
    },
} as const;

export type DesignTokens = typeof tokens;
