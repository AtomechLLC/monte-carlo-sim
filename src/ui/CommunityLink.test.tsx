import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COMMUNITY_LABEL, COMMUNITY_URL, CommunityLink } from './CommunityLink';
import App from '../App';
import { useGameModeStore, type GameMode } from '../state/gameModeStore';

// The Funsmith Club link in the page's top-right corner (quick task 261021). Both services are
// mocked because <App /> reaches both import graphs whichever mode is on screen.
vi.mock('../state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

vi.mock('../state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const appCss = readFileSync(join(SRC_DIR, 'App.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const indexCss = readFileSync(join(SRC_DIR, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('CommunityLink', () => {
  it('links to funsmith.club in a new tab, safely, with the Discord mark and the label', () => {
    render(<CommunityLink />);
    const link = screen.getByTestId('community-link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://funsmith.club');
    expect(COMMUNITY_URL).toBe('https://funsmith.club');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Label-in-name: the visible "Funsmith Club" is contained in the accessible name.
    expect(link).toHaveAccessibleName('Funsmith Club on Discord');
    expect(link.querySelector('svg.community-link__mark')).toHaveAttribute('aria-hidden', 'true');
    expect(link.querySelector('.community-link__label')?.textContent).toBe(COMMUNITY_LABEL);
    expect(screen.getByRole('link', { name: /Funsmith Club/ })).toBe(link);
  });

  it('draws the mark in currentColor — no new colour enters the palette for it', () => {
    render(<CommunityLink />);
    expect(screen.getByTestId('community-link').querySelector('path')).toHaveAttribute('fill', 'currentColor');
    const rule = appCss.split('}').find((chunk) => chunk.includes('.community-link {'));
    expect(rule).toBeDefined();
    expect(rule).not.toContain('--accent');
    expect(rule).not.toContain('--destructive');
  });

  it('is pinned to the top-right corner of the page column', () => {
    const rule = appCss.split('}').find((chunk) => chunk.includes('.community-link {')) ?? '';
    expect(rule).toContain('position: absolute');
    expect(rule).toMatch(/\btop:\s*\d+px/);
    expect(rule).toMatch(/\bright:\s*\d+px/);
    // The anchor it is pinned against: #root must now be a positioned box, or the corner would
    // be the viewport's rather than the centred page column's.
    const root = indexCss.split('}').find((chunk) => chunk.includes('#root {')) ?? '';
    expect(root).toContain('position: relative');
  });

  it('never enters the flow — no rule anywhere makes it static, and the narrow form hides only the label', () => {
    // User: "don't push the page down". The link must stay absolutely positioned at every
    // width; the responsive form drops the words, not the placement.
    for (const chunk of appCss.split('}')) {
      if (!chunk.includes('.community-link')) continue;
      expect(chunk).not.toMatch(/position:\s*static/);
    }
    expect(appCss).toMatch(/\.community-link__label\s*\{\s*display:\s*none/);
  });
});

describe('the community link is on every screen', () => {
  beforeEach(() => {
    useGameModeStore.setState({ mode: 'holdem', holdemRestorePending: false, blackjackRestorePending: false });
  });

  it.each(['holdem', 'blackjack', 'roulette', 'craps'] as GameMode[])('%s: exactly one, beside the wordmark', (mode) => {
    useGameModeStore.setState({ mode });
    render(<App />);
    expect(screen.getAllByTestId('community-link')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Monte Carlo Poker Simulator');
  });
});
