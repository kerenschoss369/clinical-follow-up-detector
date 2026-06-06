import { vi } from 'vitest';

vi.mock('../../dist/clients/aiServiceClient.js', () => ({
  extractActions: vi.fn(),
}));
