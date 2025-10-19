import { CanvasPosition } from './types';

export interface ConnectionCreationState {
  isConnecting: boolean;
  sourceBlockId: string | null;
  sourcePosition: CanvasPosition | null;
  cursorPosition: CanvasPosition | null;
  targetBlockId: string | null;
  targetPosition: CanvasPosition | null;
}

export interface ConnectionPoint {
  blockId: string;
  position: CanvasPosition;
  anchor: 'top' | 'right' | 'bottom' | 'left';
}

export interface ConnectionCreationHandlers {
  startConnection: (sourceBlockId: string, sourcePosition: CanvasPosition) => void;
  updateConnectionCursor: (cursorPosition: CanvasPosition) => void;
  setTargetBlock: (targetBlockId: string | null, targetPosition: CanvasPosition | null) => void;
  completeConnection: () => void;
  cancelConnection: () => void;
}

export interface PendingConnection {
  sourceBlockId: string;
  targetBlockId: string;
  sourcePosition: CanvasPosition;
  targetPosition: CanvasPosition;
}