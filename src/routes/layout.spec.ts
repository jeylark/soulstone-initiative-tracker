import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { IDBFactory } from 'fake-indexeddb';
import { createRawSnippet } from 'svelte';
import type { Component } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import LandingPage from './+page.svelte';
import SavedChallengesPage from './challenges/+page.svelte';
import ChallengePage from './challenges/[challengeId]/+page.svelte';
import ViewerPage from './view/+page.svelte';
import LayoutWithChallenge from './layout-test-support.svelte';
import { createRunChallenge } from './challenges/[challengeId]/run/run-test-support';
import { saveChallengeToLibrary } from '#lib/challenge';
import type { DeepReadonly } from '#lib';

const { mockedPage, mockedGoto } = vi.hoisted(() => ({
	mockedPage: {
		params: { challengeId: '00000000-0000-4000-8000-000000000001' },
		url: new URL('http://localhost/challenges/00000000-0000-4000-8000-000000000001')
	},
	mockedGoto: vi.fn()
}));

vi.mock('$app/state', () => ({ page: mockedPage }));
vi.mock('$app/navigation', () => ({ goto: mockedGoto }));

const resizeObservers: TestResizeObserver[] = [];

class TestResizeObserver {
	readonly targets = new Set<DeepReadonly<Element>>();
	readonly callback: (entries: readonly { readonly target: DeepReadonly<Element> }[]) => void;

	constructor(callback: TestResizeObserver['callback']) {
		this.callback = callback;
		resizeObservers.push(this);
	}

	observe(target: DeepReadonly<Element>) {
		this.targets.add(target);
	}

	unobserve(target: DeepReadonly<Element>) {
		this.targets.delete(target);
	}

	disconnect() {
		this.targets.clear();
	}

	notify(target: DeepReadonly<Element>) {
		this.callback([{ target }]);
	}
}

beforeEach(() => {
	vi.stubGlobal('ResizeObserver', TestResizeObserver);
	mockedPage.params = {
		challengeId: '00000000-0000-4000-8000-000000000001'
	};
	mockedPage.url = new URL('http://localhost/challenges/00000000-0000-4000-8000-000000000001');
	mockedGoto.mockImplementation((url: Readonly<{ readonly toString: () => string }>) => {
		mockedPage.url = new URL(url.toString(), 'http://localhost');
		return Promise.resolve();
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const views: { name: string; page: Component }[] = [
	{ name: 'landing', page: LandingPage },
	{ name: 'challenge detail', page: ChallengePage },
	{ name: 'saved challenges', page: SavedChallengesPage },
	{ name: 'viewer entry', page: ViewerPage }
];

const renderLayout = () =>
	render(Layout, {
		params: {},
		data: {},
		children: createRawSnippet(() => ({ render: () => '<p>content</p>' }))
	});

describe('app layout', () => {
	it('provides responsive sticky-height fallbacks before a nonzero measurement', () => {
		const { container } = renderLayout();
		const shell = container.querySelector('.app-shell');
		expect(shell).not.toBeNull();
		expect(shell?.getAttribute('style') ?? '').not.toContain('0px');
		const source = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(source).toMatch(/\.app-shell\s*\{[^}]*--app-header-min-height:\s*72px/s);
		expect(source).toMatch(/--app-sticky-header-height:\s*var\(--app-header-min-height\)/);
		expect(source).toMatch(/--app-sticky-footer-height:\s*0px/);
		expect(source).toMatch(
			/\.header-content\s*\{[^}]*min-height:\s*var\(--app-header-min-height\)/s
		);
		expect(source).toMatch(
			/@media\s*\(min-width:\s*760px\)\s*\{\s*\.app-shell\s*\{\s*--app-header-min-height:\s*84px/
		);
	});

	it('publishes the measured header height, updates on resize and stops observing on teardown', async () => {
		let headerHeight = 96;
		vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (
			this: DeepReadonly<Element>
		) {
			return this.tagName === 'HEADER' ? headerHeight : 0;
		});
		const { container, unmount } = renderLayout();
		const header = container.querySelector('header');
		const shell = container.querySelector<HTMLElement>('.app-shell');
		if (!header || !shell) throw new Error('Expected the app shell and header');
		await waitFor(() =>
			expect(shell.style.getPropertyValue('--app-sticky-header-height')).toBe('96px')
		);
		const observer = resizeObservers.find((candidate) => candidate.targets.has(header));
		expect(observer).toBeDefined();
		if (!observer) throw new Error('Expected the header to be observed');
		headerHeight = 144;
		observer.notify(header);
		await waitFor(() =>
			expect(shell.style.getPropertyValue('--app-sticky-header-height')).toBe('144px')
		);
		unmount();
		expect(observer.targets.has(header)).toBe(false);
	});

	it('keeps the header sticky and its icon controls accessible on compact screens', () => {
		const { container } = renderLayout();
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		if (!header) return;

		expect(within(header).getByRole('link', { name: 'Soulstone home' })).toBeTruthy();
		expect(within(header).getByRole('button', { name: 'Dark mode' })).toBeTruthy();
		const source = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(source).toMatch(/header\s*\{[^}]*position:\s*sticky\s*;[^}]*top:\s*0\s*;/);
		expect(source).toMatch(/header\s*\{[^}]*background:\s*var\(--color-background\)/);
		expect(source).toMatch(
			/@media\s*\(max-width:\s*\d+px\)\s*\{\s*\.header-label\s*\{\s*display:\s*none\s*;/
		);
		expect(header.querySelectorAll('.header-label')).toHaveLength(2);
		const appStyles = readFileSync('src/app.css', 'utf8');
		expect(appStyles).toMatch(/html\s*\{[^}]*scroll-padding-top:\s*84px\s*;/);
	});

	it('toggles between light and dark themes', async () => {
		const { container } = renderLayout();

		const darkModeButton = screen.getByRole('button', { name: 'Dark mode' });
		expect(darkModeButton.getAttribute('aria-pressed')).toBe('false');
		expect(darkModeButton.parentElement?.classList.contains('theme-toggle-action')).toBe(true);
		expect(darkModeButton.querySelector('.theme-toggle-icon')).not.toBeNull();

		await fireEvent.click(darkModeButton);

		const lightModeButton = screen.getByRole('button', { name: 'Light mode' });
		expect(lightModeButton.getAttribute('aria-pressed')).toBe('true');
		expect(container.querySelector('.app-shell')?.classList.contains('theme-dark')).toBe(true);
		expect(document.documentElement.classList.contains('theme-dark')).toBe(true);

		await fireEvent.click(lightModeButton);

		expect(screen.getByRole('button', { name: 'Dark mode' }).getAttribute('aria-pressed')).toBe(
			'false'
		);
		expect(container.querySelector('.app-shell')?.classList.contains('theme-dark')).toBe(false);
		expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
	});

	it('shows the app header and renders page content', () => {
		const { container } = renderLayout();

		expect(container.querySelector('header')?.textContent).toContain('Soulstone');
		expect(screen.getByText('content')).toBeTruthy();
	});

	it('shows the challenge tabs in the header and removes them when the view is left', async () => {
		vi.stubGlobal('indexedDB', new IDBFactory());
		const challenge = createRunChallenge();
		challenge.name = 'Header tabs';
		await saveChallengeToLibrary(challenge);
		const { container } = render(LayoutWithChallenge);
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		if (!header) return;

		const tabs = await screen.findByRole('tablist', { name: 'Challenge workflow' });
		expect(header.contains(tabs)).toBe(true);
		expect(screen.getAllByRole('tablist', { name: 'Challenge workflow' })).toHaveLength(1);

		await fireEvent.click(within(tabs).getByRole('tab', { name: 'Roll' }));
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Roll' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);
		expect(mockedPage.url.searchParams.get('tab')).toBe('roll');

		await fireEvent.click(within(tabs).getByRole('tab', { name: 'Setup' }));
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);

		await fireEvent.click(within(tabs).getByRole('tab', { name: 'Run' }));
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Run' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);
		expect(mockedPage.url.searchParams.get('tab')).toBe('run');

		await fireEvent.click(within(tabs).getByRole('tab', { name: 'Setup' }));
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);

		await fireEvent.keyDown(within(tabs).getByRole('tab', { name: 'Setup' }), {
			key: 'ArrowRight'
		});
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Roll' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);
		await fireEvent.click(within(tabs).getByRole('tab', { name: 'Setup' }));
		await waitFor(() =>
			expect(within(tabs).getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')).toBe(
				'true'
			)
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle challenge' }));
		await waitFor(() => expect(within(header).queryByRole('tablist')).toBeNull());
		await fireEvent.click(screen.getByRole('button', { name: 'Toggle challenge' }));
		const restoredTabs = await within(header).findByRole('tablist', { name: 'Challenge workflow' });
		expect(
			within(restoredTabs).getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')
		).toBe('true');
	});

	it('leaves the header center empty when the challenge cannot be loaded', async () => {
		vi.stubGlobal('indexedDB', new IDBFactory());
		const { container } = render(LayoutWithChallenge);
		await screen.findByText('The challenge was not found.');
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		if (!header) return;
		expect(within(header).queryByRole('tablist')).toBeNull();
	});

	it('links the header icon and app name to the landing page and has no navigation bar', () => {
		const { container } = renderLayout();
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		if (!header) return;

		expect(within(header).getByRole('button', { name: 'Dark mode' })).toBeTruthy();
		const homeLink = within(header).getByRole('link', { name: 'Soulstone home' });
		expect(homeLink.getAttribute('href')).toBe('/');
		expect(homeLink.querySelector('img')).not.toBeNull();
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it.each(views)('does not duplicate the shell in the $name page', ({ page }) => {
		const { container } = render(page);

		expect(container.querySelector('header')).toBeNull();
		expect(container.querySelector('footer')).toBeNull();
		expect(container.querySelectorAll('main')).toHaveLength(0);
	});
});
