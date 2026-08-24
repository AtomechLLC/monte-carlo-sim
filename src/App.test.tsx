import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App — Deal happy path', () => {
  it('deals a hero hand and shows three hidden opponents when Deal is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dealButton = screen.getByRole('button', { name: /^deal$/i });
    await user.click(dealButton);

    const heroHole = screen.getByTestId('hero-hole');
    expect(heroHole.children).toHaveLength(2);
    for (const child of Array.from(heroHole.children)) {
      expect(child.textContent).not.toBe('');
    }

    const opponents = screen.getByTestId('opponents');
    expect(opponents.children).toHaveLength(3);
  });
});
