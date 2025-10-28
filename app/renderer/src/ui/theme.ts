import { createTheme, MantineColorsTuple } from '@mantine/core';

// Custom color palette based on the existing design
const accent: MantineColorsTuple = [
  '#f6f6f8',
  '#e6e7ec',
  '#d6d8e0',
  '#c9cbd2',
  '#bcbec6',
  '#a7abb8',
  '#9396a4',
  '#7f8390',
  '#6f7380',
  '#5c5f6a',
];

export const theme = createTheme({
  colorScheme: 'dark',
  
  // Color palette
  colors: {
    dark: [
      '#f2f3f6', // text
      '#a1a6b3', // text-muted
      '#6f7380', // text-subtle
      '#3f4249', // text-disabled
      '#26292e', // surface-glass variant
      '#1a1d24', // surface-glass
      '#15181f', // surface-strong
      '#111318', // surface
      '#07090d', // bg-secondary
      '#040507', // bg
    ],
    accent,
  },
  
  primaryColor: 'accent',
  
  // Font configuration
  fontFamily: 'Inter, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  
  // Font sizes
  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '15px',
    lg: '18px',
    xl: '22px',
  },
  
  // Line heights
  lineHeights: {
    xs: '1.25',
    sm: '1.35',
    md: '1.55',
    lg: '1.65',
    xl: '1.75',
  },
  
  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '28px',
  },
  
  // Border radius
  radius: {
    xs: '4px',
    sm: '6px',
    md: '12px',
    lg: '20px',
    xl: '32px',
  },
  
  // Shadows
  shadows: {
    xs: '0 2px 4px rgba(5, 6, 10, 0.15)',
    sm: '0 4px 8px rgba(5, 6, 10, 0.25)',
    md: '0 12px 24px rgba(5, 6, 10, 0.35)',
    lg: '0 22px 45px rgba(5, 6, 10, 0.45)',
    xl: '0 38px 80px rgba(5, 6, 10, 0.62)',
  },
  
  // Other configurations
  defaultRadius: 'md',
  cursorType: 'pointer',
  
  // Component-specific overrides
  components: {
    AppShell: {
      styles: {
        navbar: {
          background: 'rgba(15, 18, 26, 0.72)',
          borderRight: '1px solid rgba(214, 216, 224, 0.12)',
          backdropFilter: 'blur(12px)',
        },
        main: {
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
        },
        footer: {
          background: 'rgba(15, 18, 26, 0.72)',
          borderTop: '1px solid rgba(214, 216, 224, 0.12)',
          backdropFilter: 'blur(12px)',
        },
      },
    },

    NavLink: {
      styles: {
        root: {
          borderRadius: '12px',
          color: 'var(--color-text-muted)',
          '&:hover': {
            background: 'rgba(214, 216, 224, 0.08)',
          },
          '&[data-active]': {
            background: 'rgba(80, 123, 255, 0.15)',
            color: 'var(--color-text)',
            '&:hover': {
              background: 'rgba(80, 123, 255, 0.18)',
            },
          },
        },
        label: {
          fontWeight: 500,
          letterSpacing: '0.02em',
        },
      },
    },

    Button: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          transition: 'transform 140ms ease, box-shadow 160ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    
    Modal: {
      styles: {
        content: {
          background: 'rgba(21, 24, 31, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
        },
        header: {
          background: 'transparent',
        },
        body: {
          background: 'transparent',
        },
      },
    },
    
    Paper: {
      styles: {
        root: {
          background: 'rgba(17, 19, 24, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
        },
      },
    },
    
    Card: {
      styles: {
        root: {
          background: 'rgba(17, 19, 24, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
        },
      },
    },
    
    Badge: {
      styles: {
        root: {
          backdropFilter: 'blur(8px)',
        },
      },
    },
    
    TextInput: {
      styles: {
        input: {
          background: 'rgba(26, 29, 36, 0.55)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
          '&:focus': {
            borderColor: 'rgba(214, 216, 224, 0.4)',
          },
        },
      },
    },
    
    Select: {
      styles: {
        input: {
          background: 'rgba(26, 29, 36, 0.55)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
          '&:focus': {
            borderColor: 'rgba(214, 216, 224, 0.4)',
          },
        },
        dropdown: {
          background: 'rgba(21, 24, 31, 0.98)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        },
        option: {
          color: '#f2f3f6',
          '&[data-combobox-selected]': {
            background: 'rgba(214, 216, 224, 0.16)',
          },
          '&:hover': {
            background: 'rgba(214, 216, 224, 0.12)',
          },
        },
      },
    },
    
    Textarea: {
      styles: {
        input: {
          background: 'rgba(26, 29, 36, 0.55)',
          border: '1px solid rgba(164, 170, 186, 0.18)',
          '&:focus': {
            borderColor: 'rgba(214, 216, 224, 0.4)',
          },
        },
      },
    },
  },
});

