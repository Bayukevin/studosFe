import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Minus, RotateCw } from 'lucide-react';
import { PhotoArea } from '../types/photobooth';

interface InteractiveAreaProps {
  area: PhotoArea;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<PhotoArea>) => void;
  onRemove: () => void;
}

const InteractiveArea = ({ area, isSelected, onSelect, onUpdate, onRemove }: InteractiveAreaProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [rotateStart, setRotateStart] = useState({ x: 0, y: 0, rotation: 0 });
  const areaRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, action: 'drag' | 'resize' | 'rotate') => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();

    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (action === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - area.x,
        y: e.clientY - area.y
      });
    } else if (action === 'resize') {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: area.width,
        height: area.height
      });
    } else if (action === 'rotate') {
      setIsRotating(true);
      const centerX = area.x + area.width / 2;
      const centerY = area.y + area.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      setRotateStart({
        x: centerX,
        y: centerY,
        rotation: angle - area.rotation
      });
    }
  }, [area, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, e.clientX - dragStart.x);
      const newY = Math.max(0, e.clientY - dragStart.y);
      onUpdate({ x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      let newWidth: number;
      let newHeight: number;
      
      if (area.type === 'square') {
        // For square: maintain 1:1 ratio
        const delta = Math.max(deltaX, deltaY);
        newWidth = Math.max(50, resizeStart.width + delta);
        newHeight = newWidth;
      } else if (area.type === 'portrait') {
        const delta = Math.max(deltaX, deltaY);
        newWidth = Math.max(50, resizeStart.width + delta);
        newHeight = (newWidth * 16) / 9;
      } else if (area.type === 'landscape') {
        const delta = Math.max(deltaX, deltaY);
        newWidth = Math.max(50, resizeStart.width + delta);
        newHeight = (newWidth * 9) / 16;
      } else {
        newWidth = Math.max(50, resizeStart.width + deltaX);
        newHeight = Math.max(50, resizeStart.height + deltaY);
      }
      
      onUpdate({ width: newWidth, height: newHeight });
    } else if (isRotating) {
      const centerX = area.x + area.width / 2;
      const centerY = area.y + area.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const newRotation = angle - rotateStart.rotation;
      onUpdate({ rotation: newRotation });
    }
  }, [isDragging, isResizing, isRotating, dragStart, resizeStart, rotateStart, onUpdate, area]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={areaRef}
      className={`absolute border-2 bg-blue-500/30 flex items-center justify-center text-white font-bold cursor-move select-none ${
        isSelected ? 'border-primary' : 'border-blue-500'
      }`}
      style={{
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
        transform: `rotate(${area.rotation}deg)`,
      }}
      onMouseDown={(e) => handleMouseDown(e, 'drag')}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {area.order}
      
      {isSelected && (
        <>
          <Button
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2 w-6 h-6 p-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Minus className="w-3 h-3" />
          </Button>

          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-se-resize transform translate-x-1/2 translate-y-1/2 z-10"
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />

          <div
            className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-primary rounded-full flex items-center justify-center cursor-grab z-10"
            onMouseDown={(e) => handleMouseDown(e, 'rotate')}
          >
            <RotateCw className="w-3 h-3 text-white" />
          </div>

          <div 
            className="absolute -top-1 -left-1 w-2 h-2 bg-primary cursor-nw-resize z-10" 
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />
          <div 
            className="absolute -top-1 -right-1 w-2 h-2 bg-primary cursor-ne-resize z-10" 
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />
          <div 
            className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary cursor-sw-resize z-10" 
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />
        </>
      )}
    </div>
  );
};

export default InteractiveArea;