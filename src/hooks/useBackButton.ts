import { useEffect } from "react";

/**
 * Hook to handle Android back button for modals/dialogs
 * When the modal is open and back button is pressed, it will close the modal
 */
export const useBackButton = (isOpen: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleBackButton = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      // Return false to indicate we handled the event
      return false;
    };

    window.addEventListener('app-back-button', handleBackButton);
    return () => window.removeEventListener('app-back-button', handleBackButton);
  }, [isOpen, onClose]);
};
