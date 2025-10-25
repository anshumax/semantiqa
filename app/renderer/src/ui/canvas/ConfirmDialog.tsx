import React from 'react';
import { Modal, Button, Group, Text } from '@mantine/core';

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
  return (
    <Modal
      opened={isOpen}
      onClose={onCancel}
      title={title}
      centered
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      <Text size="sm" mb="lg">
        {message}
      </Text>
      
      <Group justify="flex-end" gap="sm">
        <Button
          variant="subtle"
          color="gray"
          onClick={onCancel}
        >
          {cancelText}
        </Button>
        <Button
          variant="filled"
          color={confirmDangerous ? 'red' : 'accent'}
          onClick={onConfirm}
          autoFocus
        >
          {confirmText}
        </Button>
      </Group>
    </Modal>
  );
}

