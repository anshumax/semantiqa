import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { 
  NavigationState, 
  DrillDownContext, 
  NavigationTransition,
  getDefaultNavigationState,
  createDrillDownState,
  createDefaultTransition
} from './navigationTypes';

// Navigation actions
export type NavigationAction = 
  | { type: 'DRILL_DOWN'; payload: DrillDownContext; transition?: NavigationTransition }
  | { type: 'DRILL_UP'; transition?: NavigationTransition }
  | { type: 'NAVIGATE_TO_SOURCES'; transition?: NavigationTransition }
  | { type: 'NAVIGATE_TO_BREADCRUMB'; level: string; path: string[]; transition?: NavigationTransition }
  | { type: 'SET_TRANSITION_STATE'; isTransitioning: boolean }
  | { type: 'RESET' };

// Extended navigation state with transition info
export interface ExtendedNavigationState extends NavigationState {
  isTransitioning: boolean;
  activeTransition?: NavigationTransition;
}

// Navigation context type
interface NavigationContextType {
  state: ExtendedNavigationState;
  drillDown: (context: DrillDownContext, transition?: NavigationTransition) => void;
  drillUp: (transition?: NavigationTransition) => void;
  navigateToSources: (transition?: NavigationTransition) => void;
  navigateToBreadcrumb: (level: string, path: string[], transition?: NavigationTransition) => void;
  reset: () => void;
}

// Reducer function
function navigationReducer(state: ExtendedNavigationState, action: NavigationAction): ExtendedNavigationState {
  switch (action.type) {
    case 'DRILL_DOWN': {
      const newState = createDrillDownState(action.payload);
      return {
        ...newState,
        isTransitioning: !!action.transition,
        activeTransition: action.transition || createDefaultTransition('drill-down'),
      };
    }

    case 'DRILL_UP': {
      if (state.currentLevel === 'tables') {
        const defaultState = getDefaultNavigationState();
        return {
          ...defaultState,
          isTransitioning: !!action.transition,
          activeTransition: action.transition || createDefaultTransition('drill-up'),
        };
      }
      return state;
    }

    case 'NAVIGATE_TO_SOURCES': {
      const defaultState = getDefaultNavigationState();
      return {
        ...defaultState,
        isTransitioning: !!action.transition,
        activeTransition: action.transition || createDefaultTransition('drill-up'),
      };
    }

    case 'NAVIGATE_TO_BREADCRUMB': {
      // Navigate based on breadcrumb level
      if (action.level === 'sources') {
        const defaultState = getDefaultNavigationState();
        return {
          ...defaultState,
          isTransitioning: !!action.transition,
          activeTransition: action.transition || createDefaultTransition('drill-up'),
        };
      }
      return state; // No change for unrecognized levels
    }

    case 'SET_TRANSITION_STATE': {
      return {
        ...state,
        isTransitioning: action.isTransitioning,
        activeTransition: action.isTransitioning ? state.activeTransition : undefined,
      };
    }

    case 'RESET': {
      return {
        ...getDefaultNavigationState(),
        isTransitioning: false,
        activeTransition: undefined,
      };
    }

    default:
      return state;
  }
}

// Create context
const CanvasNavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Provider component
export interface CanvasNavigationProviderProps {
  children: React.ReactNode;
  onNavigationChange?: (state: ExtendedNavigationState) => void;
}

export function CanvasNavigationProvider({ 
  children, 
  onNavigationChange 
}: CanvasNavigationProviderProps) {
  const [state, dispatch] = useReducer(navigationReducer, {
    ...getDefaultNavigationState(),
    isTransitioning: false,
    activeTransition: undefined,
  });

  // Notify parent of navigation changes
  React.useEffect(() => {
    onNavigationChange?.(state);
  }, [state, onNavigationChange]);

  const drillDown = useCallback((context: DrillDownContext, transition?: NavigationTransition) => {
    dispatch({ type: 'DRILL_DOWN', payload: context, transition });
    
    // Clear transition state after animation completes
    if (transition) {
      setTimeout(() => {
        dispatch({ type: 'SET_TRANSITION_STATE', isTransitioning: false });
      }, transition.duration);
    }
  }, []);

  const drillUp = useCallback((transition?: NavigationTransition) => {
    dispatch({ type: 'DRILL_UP', transition });
    
    // Clear transition state after animation completes
    if (transition) {
      setTimeout(() => {
        dispatch({ type: 'SET_TRANSITION_STATE', isTransitioning: false });
      }, transition.duration);
    }
  }, []);

  const navigateToSources = useCallback((transition?: NavigationTransition) => {
    dispatch({ type: 'NAVIGATE_TO_SOURCES', transition });
    
    // Clear transition state after animation completes  
    if (transition) {
      setTimeout(() => {
        dispatch({ type: 'SET_TRANSITION_STATE', isTransitioning: false });
      }, transition.duration);
    }
  }, []);

  const navigateToBreadcrumb = useCallback((level: string, path: string[], transition?: NavigationTransition) => {
    dispatch({ type: 'NAVIGATE_TO_BREADCRUMB', level, path, transition });
    
    // Clear transition state after animation completes
    if (transition) {
      setTimeout(() => {
        dispatch({ type: 'SET_TRANSITION_STATE', isTransitioning: false });
      }, transition.duration);
    }
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const contextValue: NavigationContextType = {
    state,
    drillDown,
    drillUp,
    navigateToSources,
    navigateToBreadcrumb,
    reset,
  };

  return (
    <CanvasNavigationContext.Provider value={contextValue}>
      {children}
    </CanvasNavigationContext.Provider>
  );
}

// Hook to use navigation context
export function useCanvasNavigation(): NavigationContextType {
  const context = useContext(CanvasNavigationContext);
  if (!context) {
    throw new Error('useCanvasNavigation must be used within a CanvasNavigationProvider');
  }
  return context;
}

// Helper hooks for specific use cases
export function useCurrentLevel() {
  const { state } = useCanvasNavigation();
  return state.currentLevel;
}

export function useBreadcrumbs() {
  const { state } = useCanvasNavigation();
  return state.breadcrumbs;
}

export function useNavigationTransition() {
  const { state } = useCanvasNavigation();
  return {
    isTransitioning: state.isTransitioning,
    activeTransition: state.activeTransition,
  };
}