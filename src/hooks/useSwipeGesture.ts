import { useState, useCallback, useRef, TouchEvent } from 'react';

interface SwipeState {
  offsetX: number;
  direction: 'left' | 'right' | null;
  swiping: boolean;
  actionTriggered: boolean;
}

interface UseSwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  swipeThreshold?: number;
  maxSwipeDistance?: number;
}

export const useSwipeGesture = ({
  onSwipeRight,
  onSwipeLeft,
  swipeThreshold = 100,
  maxSwipeDistance = 150,
}: UseSwipeGestureOptions) => {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    direction: null,
    swiping: false,
    actionTriggered: false,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setState(prev => ({ ...prev, swiping: true, actionTriggered: false }));
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!state.swiping) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // If vertical swipe, don't handle
    if (isHorizontalSwipe.current === false) {
      return;
    }

    // Prevent vertical scrolling during horizontal swipe
    if (isHorizontalSwipe.current === true) {
      e.preventDefault();
    }

    // Clamp the offset
    const clampedOffset = Math.max(-maxSwipeDistance, Math.min(maxSwipeDistance, diffX));
    const direction: 'left' | 'right' | null = clampedOffset > 0 ? 'right' : clampedOffset < 0 ? 'left' : null;
    const actionTriggered = Math.abs(clampedOffset) >= swipeThreshold;

    setState({
      offsetX: clampedOffset,
      direction,
      swiping: true,
      actionTriggered,
    });
  }, [state.swiping, maxSwipeDistance, swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (state.actionTriggered) {
      // Trigger haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      if (state.direction === 'right' && onSwipeRight) {
        onSwipeRight();
      } else if (state.direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    // Reset state with spring animation
    setState({
      offsetX: 0,
      direction: null,
      swiping: false,
      actionTriggered: false,
    });
  }, [state.actionTriggered, state.direction, onSwipeRight, onSwipeLeft]);

  const swipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return {
    ...state,
    swipeHandlers,
  };
};
