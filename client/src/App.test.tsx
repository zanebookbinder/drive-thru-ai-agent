import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('./api', () => ({
  ReauthError: class ReauthError extends Error {},
  fetchMe: vi.fn(async () => ({ email: 'a@b.com' })),
  fetchConversations: vi.fn(async () => ({
    conversations: [
      { id: 'c1', title: 'Folder One', sourceUrl: '#', files: [], skipped: [], messages: [] },
    ],
    activeConversationId: 'c1',
  })),
  selectConversation: vi.fn(async () => ({
    conversation: { id: 'c1', title: 'Folder One', sourceUrl: '#', files: [], skipped: [], messages: [] },
  })),
  getSuggestions: vi.fn(async () => ({ suggestions: [] })),
}));

import App from './App';

// jsdom has no layout, so these cover the drawer's state wiring rather than its
// appearance: the class the stylesheet keys off, the a11y state, and dismissal.
Element.prototype.scrollIntoView = vi.fn();

describe('App — narrow-screen sidebar drawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('toggles the nav-open class, aria-expanded, and the body scroll lock', async () => {
    const { container } = render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Open folder list' });
    const app = container.querySelector('.app')!;

    expect(app.className).not.toContain('nav-open');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(app.className).toContain('nav-open');
    expect(screen.getByRole('button', { name: 'Close folder list' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.body.style.overflow).toBe('hidden');

    // Escape dismisses it and releases the lock.
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(app.className).not.toContain('nav-open'));
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the drawer when a folder is chosen', async () => {
    const { container } = render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open folder list' }));
    const app = container.querySelector('.app')!;
    expect(app.className).toContain('nav-open');

    fireEvent.click(container.querySelector('.sidebar .conv-select')!);
    await waitFor(() => expect(app.className).not.toContain('nav-open'));
  });

  it('renders a scrim that closes the drawer', async () => {
    const { container } = render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open folder list' }));
    const app = container.querySelector('.app')!;
    const scrim = container.querySelector('.nav-scrim')!;
    expect(scrim).toBeTruthy();

    fireEvent.click(scrim);
    await waitFor(() => expect(app.className).not.toContain('nav-open'));
  });
});
