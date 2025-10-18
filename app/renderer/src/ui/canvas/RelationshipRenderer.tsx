import React, { useMemo, useCallback } from 'react';
import './RelationshipRenderer.css';
import { 
  VisualRelationship, 
  RelationshipInteractionEvent, 
  CanvasPoint 
} from './relationshipTypes';
import { 
  calculateBezierCurve, 
  isPointNearBezierCurve 
} from './curveUtils';

export interface RelationshipRendererProps {
  relationships: VisualRelationship[];
  onRelationshipInteraction?: (event: RelationshipInteractionEvent) => void;
  className?: string;
  showArrows?: boolean;
  hitTolerance?: number;
}

export function RelationshipRenderer({
  relationships,
  onRelationshipInteraction,
  className = '',
  showArrows = true,
  hitTolerance = 8
}: RelationshipRendererProps) {
  
  // Calculate curves for all relationships
  const relationshipCurves = useMemo(() => {
    return relationships.map(relationship => ({
      relationship,
      curve: calculateBezierCurve(
        relationship.sourcePoint,
        relationship.targetPoint,
        relationship.style.curve
      )
    }));
  }, [relationships]);

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = (event.target as Element).getBoundingClientRect();
    const point: CanvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Check which relationship is being hovered
    for (const { relationship, curve } of relationshipCurves) {
      const isHovering = isPointNearBezierCurve(point, curve, hitTolerance);
      
      if (isHovering && !relationship.hovered) {
        onRelationshipInteraction?.({
          type: 'hover',
          relationshipId: relationship.id,
          position: point,
          originalEvent: event.nativeEvent
        });
      } else if (!isHovering && relationship.hovered) {
        onRelationshipInteraction?.({
          type: 'hover-end',
          relationshipId: relationship.id,
          position: point,
          originalEvent: event.nativeEvent
        });
      }
    }
  }, [relationshipCurves, onRelationshipInteraction, hitTolerance]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    const rect = (event.target as Element).getBoundingClientRect();
    const point: CanvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Find clicked relationship
    for (const { relationship, curve } of relationshipCurves) {
      if (isPointNearBezierCurve(point, curve, hitTolerance)) {
        onRelationshipInteraction?.({
          type: 'click',
          relationshipId: relationship.id,
          position: point,
          originalEvent: event.nativeEvent
        });
        break;
      }
    }
  }, [relationshipCurves, onRelationshipInteraction, hitTolerance]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    const rect = (event.target as Element).getBoundingClientRect();
    const point: CanvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Find double-clicked relationship
    for (const { relationship, curve } of relationshipCurves) {
      if (isPointNearBezierCurve(point, curve, hitTolerance)) {
        onRelationshipInteraction?.({
          type: 'double-click',
          relationshipId: relationship.id,
          position: point,
          originalEvent: event.nativeEvent
        });
        break;
      }
    }
  }, [relationshipCurves, onRelationshipInteraction, hitTolerance]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    const rect = (event.target as Element).getBoundingClientRect();
    const point: CanvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Find right-clicked relationship
    for (const { relationship, curve } of relationshipCurves) {
      if (isPointNearBezierCurve(point, curve, hitTolerance)) {
        event.preventDefault();
        onRelationshipInteraction?.({
          type: 'context-menu',
          relationshipId: relationship.id,
          position: point,
          originalEvent: event.nativeEvent
        });
        break;
      }
    }
  }, [relationshipCurves, onRelationshipInteraction, hitTolerance]);

  if (relationships.length === 0) {
    return null;
  }

  return (
    <svg 
      className={`relationship-renderer ${className}`}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 1, // Below blocks but above background
      }}
    >
      {/* Define arrow markers */}
      {showArrows && (
        <defs>
          <marker
            id="relationship-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path 
              d="M0,0 L0,6 L9,3 z" 
              fill="currentColor"
            />
          </marker>
          
          <marker
            id="relationship-arrow-selected"
            viewBox="0 0 10 10"
            refX="9"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path 
              d="M0,0 L0,6 L9,3 z" 
              fill="var(--relationship-selected-color)"
            />
          </marker>
        </defs>
      )}

      {/* Render relationship curves */}
      {relationshipCurves.map(({ relationship, curve }) => {
        const style = relationship.style;
        const isHovered = relationship.hovered;
        const isSelected = relationship.selected;
        
        // Determine stroke color based on state
        let strokeColor = style.strokeColor;
        if (isSelected && style.selectedColor) {
          strokeColor = style.selectedColor;
        } else if (isHovered && style.hoverColor) {
          strokeColor = style.hoverColor;
        }

        return (
          <g 
            key={relationship.id}
            className={`relationship-curve ${isHovered ? 'relationship-curve--hovered' : ''} ${isSelected ? 'relationship-curve--selected' : ''}`}
          >
            {/* Main relationship path */}
            <path
              d={curve.pathData}
              stroke={strokeColor}
              strokeWidth={style.strokeWidth + (isHovered ? 1 : 0)}
              strokeDasharray={style.strokeDasharray}
              fill="none"
              opacity={style.opacity}
              markerEnd={showArrows ? (isSelected ? "url(#relationship-arrow-selected)" : "url(#relationship-arrow)") : undefined}
              style={{
                '--relationship-selected-color': style.selectedColor,
                transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease'
              } as React.CSSProperties}
            />
            
            {/* Invisible wider path for easier interaction */}
            <path
              d={curve.pathData}
              stroke="transparent"
              strokeWidth={Math.max(12, style.strokeWidth + 8)}
              fill="none"
              className="relationship-interaction-area"
            />

            {/* Relationship label (if provided) */}
            {relationship.metadata?.label && (
              <text
                x={(curve.start.x + curve.end.x) / 2}
                y={(curve.start.y + curve.end.y) / 2}
                textAnchor="middle"
                className="relationship-label"
                fill={strokeColor}
                fontSize="12"
                opacity={isHovered || isSelected ? 1 : 0}
                style={{
                  transition: 'opacity 0.2s ease'
                }}
              >
                {relationship.metadata.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}