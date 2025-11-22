import { Modal, Progress, Text, Stack, Group } from '@mantine/core';
import { useEffect, useState } from 'react';

interface DownloadProgress {
  modelId: string;
  downloadedMb?: number;
  totalMb?: number;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  error?: string;
}

interface DownloadProgressModalProps {
  modelName: string;
}

export function DownloadProgressModal({ modelName }: DownloadProgressModalProps) {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleProgress = (event: CustomEvent<DownloadProgress>) => {
      const data = event.detail;
      setProgress(data);

      if (data.status === 'downloading' && !isOpen) {
        setIsOpen(true);
      } else if (data.status === 'completed') {
        // Keep modal open for 1 second to show 100% completion
        setTimeout(() => {
          setIsOpen(false);
          setProgress(null);
        }, 1000);
      } else if (data.status === 'error') {
        // Keep error visible for 3 seconds
        setTimeout(() => {
          setIsOpen(false);
          setProgress(null);
        }, 3000);
      }
    };

    window.addEventListener('models:download:progress', handleProgress as EventListener);

    return () => {
      window.removeEventListener('models:download:progress', handleProgress as EventListener);
    };
  }, [isOpen]);

  if (!progress) {
    return null;
  }

  const getStatusColor = () => {
    switch (progress.status) {
      case 'downloading':
        return 'blue';
      case 'completed':
        return 'green';
      case 'error':
        return 'red';
      default:
        return 'blue';
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'downloading':
        return 'Downloading...';
      case 'completed':
        return 'Download Complete!';
      case 'error':
        return 'Download Failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={() => {}} // Prevent closing
      title={`Downloading ${modelName}`}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
      overlayProps={{
        opacity: 0.7,
        blur: 3,
      }}
      styles={{
        overlay: {
          zIndex: 10000,
        },
        inner: {
          zIndex: 10001,
        },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c={getStatusColor()} fw={500}>
          {getStatusText()}
        </Text>

        <Progress
          value={progress.progress}
          color={getStatusColor()}
          size="lg"
          radius="md"
          animated={progress.status === 'downloading'}
        />

        {progress.downloadedMb !== undefined && progress.totalMb !== undefined && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {progress.downloadedMb} MB / {progress.totalMb} MB
            </Text>
            <Text size="sm" c="dimmed" fw={500}>
              {progress.progress}%
            </Text>
          </Group>
        )}

        {progress.error && (
          <Text size="sm" c="red">
            Error: {progress.error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

