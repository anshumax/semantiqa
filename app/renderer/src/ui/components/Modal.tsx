import { Modal as MantineModal } from '@mantine/core';

interface ModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, description, isOpen, onClose, children }: ModalProps) {
  return (
    <MantineModal
      opened={isOpen}
      onClose={onClose}
      title={
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h2>
          {description && (
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
      }
      size="lg"
      centered
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      {children}
    </MantineModal>
  );
}

