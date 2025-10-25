import React, { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Focus the dialog for accessibility
      dialogRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
      >
        <div className="confirm-dialog__header">
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h2>
        </div>
        <div className="confirm-dialog__body">
          <p id="confirm-dialog-message" className="confirm-dialog__message">
            {message}
          </p>
        </div>
        <div className="confirm-dialog__footer">
          <button
            className="confirm-dialog__button confirm-dialog__button--cancel"
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className={`confirm-dialog__button confirm-dialog__button--confirm ${
              confirmDangerous ? 'confirm-dialog__button--dangerous' : ''
            }`}
            onClick={onConfirm}
            type="button"
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

