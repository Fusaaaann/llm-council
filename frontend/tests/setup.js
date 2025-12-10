import '@testing-library/jest-dom';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = () => {};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Set up localStorage mock
beforeEach(() => {
  global.localStorage = localStorageMock;
  localStorageMock.getItem.mockReturnValue(null);
});
