/**
 * Utility functions for calculating Bezier curves and connection paths
 */

import { CanvasPoint, BezierCurve, ConnectionPoint, CurveStyle } from './relationshipTypes';

/**
 * Calculate a smooth Bezier curve between two connection points
 */
export function calculateBezierCurve(
  sourcePoint: ConnectionPoint,
  targetPoint: ConnectionPoint,
  style: CurveStyle
): BezierCurve {
  const start = sourcePoint.position;
  const end = targetPoint.position;
  
  // Calculate control points based on anchor positions and style
  const control1 = calculateControlPoint(start, sourcePoint.anchor, style.controlPointOffset || 100, true);
  const control2 = calculateControlPoint(end, targetPoint.anchor, style.controlPointOffset || 100, false);
  
  // Apply curvature adjustment
  const curvature = Math.max(0, Math.min(1, style.curvature));
  const adjustedControl1 = adjustControlPointByCurvature(start, control1, curvature);
  const adjustedControl2 = adjustControlPointByCurvature(end, control2, curvature);
  
  // Generate SVG path data
  const pathData = `M ${start.x} ${start.y} C ${adjustedControl1.x} ${adjustedControl1.y}, ${adjustedControl2.x} ${adjustedControl2.y}, ${end.x} ${end.y}`;
  
  return {
    start,
    end,
    control1: adjustedControl1,
    control2: adjustedControl2,
    pathData,
  };
}

/**
 * Calculate control point based on anchor position and offset
 */
function calculateControlPoint(
  point: CanvasPoint, 
  anchor: ConnectionPoint['anchor'], 
  offset: number,
  isSource: boolean
): CanvasPoint {
  const direction = getAnchorDirection(anchor, isSource);
  return {
    x: point.x + (direction.x * offset),
    y: point.y + (direction.y * offset),
  };
}

/**
 * Get direction vector for anchor point
 */
function getAnchorDirection(anchor: ConnectionPoint['anchor'], isSource: boolean): CanvasPoint {
  const multiplier = isSource ? 1 : -1;
  
  switch (anchor) {
    case 'top':
      return { x: 0, y: -1 * multiplier };
    case 'right':
      return { x: 1 * multiplier, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 * multiplier };
    case 'left':
      return { x: -1 * multiplier, y: 0 };
    case 'center':
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Adjust control point based on curvature setting
 */
function adjustControlPointByCurvature(
  basePoint: CanvasPoint,
  controlPoint: CanvasPoint,
  curvature: number
): CanvasPoint {
  const dx = controlPoint.x - basePoint.x;
  const dy = controlPoint.y - basePoint.y;
  
  return {
    x: basePoint.x + (dx * curvature),
    y: basePoint.y + (dy * curvature),
  };
}

/**
 * Calculate the best connection points between two blocks
 */
export function calculateOptimalConnectionPoints(
  sourceCenter: CanvasPoint,
  sourceSize: { width: number; height: number },
  targetCenter: CanvasPoint,
  targetSize: { width: number; height: number }
): { sourceAnchor: ConnectionPoint['anchor'], targetAnchor: ConnectionPoint['anchor'] } {
  
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  
  // Determine primary direction
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  
  let sourceAnchor: ConnectionPoint['anchor'];
  let targetAnchor: ConnectionPoint['anchor'];
  
  if (isHorizontal) {
    // Horizontal connection
    if (dx > 0) {
      sourceAnchor = 'right';
      targetAnchor = 'left';
    } else {
      sourceAnchor = 'left';
      targetAnchor = 'right';
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      sourceAnchor = 'bottom';
      targetAnchor = 'top';
    } else {
      sourceAnchor = 'top';
      targetAnchor = 'bottom';
    }
  }
  
  return { sourceAnchor, targetAnchor };
}

/**
 * Get connection point position on a block's edge
 */
export function getConnectionPointPosition(
  blockCenter: CanvasPoint,
  blockSize: { width: number; height: number },
  anchor: ConnectionPoint['anchor'],
  offset: CanvasPoint = { x: 0, y: 0 }
): CanvasPoint {
  const halfWidth = blockSize.width / 2;
  const halfHeight = blockSize.height / 2;
  
  let position: CanvasPoint;
  
  switch (anchor) {
    case 'top':
      position = { x: blockCenter.x, y: blockCenter.y - halfHeight };
      break;
    case 'right':
      position = { x: blockCenter.x + halfWidth, y: blockCenter.y };
      break;
    case 'bottom':
      position = { x: blockCenter.x, y: blockCenter.y + halfHeight };
      break;
    case 'left':
      position = { x: blockCenter.x - halfWidth, y: blockCenter.y };
      break;
    case 'center':
    default:
      position = { x: blockCenter.x, y: blockCenter.y };
      break;
  }
  
  return {
    x: position.x + offset.x,
    y: position.y + offset.y,
  };
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(point1: CanvasPoint, point2: CanvasPoint): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate point on Bezier curve at parameter t (0-1)
 */
export function getPointOnBezierCurve(curve: BezierCurve, t: number): CanvasPoint {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const t1Cube = t1Sq * t1;
  const tSq = t * t;
  const tCube = tSq * t;
  
  return {
    x: t1Cube * curve.start.x + 3 * t1Sq * t * curve.control1.x + 3 * t1 * tSq * curve.control2.x + tCube * curve.end.x,
    y: t1Cube * curve.start.y + 3 * t1Sq * t * curve.control1.y + 3 * t1 * tSq * curve.control2.y + tCube * curve.end.y,
  };
}

/**
 * Check if a point is near a Bezier curve (for hit testing)
 */
export function isPointNearBezierCurve(
  point: CanvasPoint, 
  curve: BezierCurve, 
  tolerance: number = 5
): boolean {
  // Sample points along the curve and check distance
  const samples = 20;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const curvePoint = getPointOnBezierCurve(curve, t);
    const distance = calculateDistance(point, curvePoint);
    
    if (distance <= tolerance) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate arrow marker path for relationship endpoints
 */
export function generateArrowMarker(size: number = 8): string {
  return `M 0 0 L ${size} ${size/2} L 0 ${size} Z`;
}

/**
 * Calculate smooth path for stepped connections (right-angle turns)
 */
export function calculateSteppedPath(
  start: CanvasPoint,
  end: CanvasPoint,
  cornerRadius: number = 10
): string {
  const midX = (start.x + end.x) / 2;
  
  if (Math.abs(start.x - end.x) < cornerRadius * 2) {
    // Too close for stepped path, use straight line
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  
  // Create stepped path with rounded corners
  const path = [
    `M ${start.x} ${start.y}`,
    `L ${midX - cornerRadius} ${start.y}`,
    `Q ${midX} ${start.y} ${midX} ${start.y + Math.sign(end.y - start.y) * cornerRadius}`,
    `L ${midX} ${end.y - Math.sign(end.y - start.y) * cornerRadius}`,
    `Q ${midX} ${end.y} ${midX + cornerRadius} ${end.y}`,
    `L ${end.x} ${end.y}`,
  ].join(' ');
  
  return path;
}