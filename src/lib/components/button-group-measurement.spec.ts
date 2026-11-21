import { afterEach, describe, expect, it, vi } from 'vitest';
import { measureButtonGroup } from './button-group-measurement';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('measureButtonGroup', () => {
	it('removes its viewport listener and temporary measurement copies on cleanup', () => {
		const group = document.createElement('div');
		group.className = 'button-group';
		group.innerHTML =
			'<div class="button-group-item"><button class="ui-button">Save</button></div>';
		const host = document.createElement('div');
		group.append(host);
		vi.spyOn(group, 'clientWidth', 'get').mockReturnValue(200);
		const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			width: 80,
			height: 40
		} as DOMRect);
		const measurement = measureButtonGroup(
			() => group,
			() => host,
			() => 'horizontal'
		);
		expect(host.childElementCount).toBe(0);
		expect(group.style.getPropertyValue('--button-group-button-height')).toBe('40px');
		measurement.stop();
		measure.mockClear();
		window.dispatchEvent(new Event('resize'));
		expect(measure).not.toHaveBeenCalled();
	});

	it('remeasures the snapshot when initially loading fonts become ready', async () => {
		let resolveFonts = () => {};
		const ready = new Promise<void>((resolve) => {
			resolveFonts = resolve;
		});
		const descriptor: PropertyDescriptor = { value: { ready } };
		descriptor['configurable'] = true;
		Object.defineProperty(document, 'fonts', descriptor);
		try {
			const group = document.createElement('div');
			group.className = 'button-group';
			group.innerHTML =
				'<div class="button-group-item"><button class="ui-button">Save</button></div>';
			const host = document.createElement('div');
			group.append(host);
			vi.spyOn(group, 'clientWidth', 'get').mockReturnValue(200);
			let width = 80;
			vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
				() => ({ width, height: 40 }) as DOMRect
			);
			const measurement = measureButtonGroup(
				() => group,
				() => host,
				() => 'horizontal'
			);
			expect(group.style.getPropertyValue('--button-group-natural-width')).toBe('80px');
			width = 120;
			resolveFonts();
			await ready;
			expect(group.style.getPropertyValue('--button-group-natural-width')).toBe('120px');
			measurement.stop();
		} finally {
			Reflect.deleteProperty(document, 'fonts');
		}
	});

	it('retains icon content when measuring alternate labels', () => {
		const group = document.createElement('div');
		group.className = 'button-group';
		group.innerHTML = `<div class="button-group-item" data-sizing-labels='["Saving changes"]'>
			<button class="ui-button"><svg aria-hidden="true"><path /></svg><span>Save</span></button>
		</div>`;
		const host = document.createElement('div');
		group.append(host);
		vi.spyOn(group, 'clientWidth', 'get').mockReturnValue(200);
		const hasIconWithAlternateLabel: boolean[] = [];
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: {
			readonly textContent: string | null;
			readonly querySelector: (selector: string) => Element | null;
		}) {
			if (this.textContent?.includes('Saving changes')) {
				hasIconWithAlternateLabel.push(this.querySelector('svg') !== null);
			}
			return { width: 120, height: 40 } as DOMRect;
		});
		const measurement = measureButtonGroup(
			() => group,
			() => host,
			() => 'horizontal'
		);
		expect(hasIconWithAlternateLabel).toEqual([true, true]);
		measurement.stop();
	});
});
