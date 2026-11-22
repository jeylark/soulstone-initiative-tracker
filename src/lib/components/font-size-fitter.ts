import type { Action } from 'svelte/action';
import type { CssLength } from './css-length';
import { toPxValue } from './css-length';

export function createFontSizeFitter(
	min: CssLength = '0.75rem',
	preferred: CssLength = '5vw',
	max: CssLength = '3rem'
): Action<HTMLElement> {
	return (node) => {
		if (typeof ResizeObserver === 'undefined') return;

		const resize = () => {
			const minValue = toPxValue(min);
			const initial = Math.min(toPxValue(max), Math.max(minValue, toPxValue(preferred)));

			let size = initial;
			node.style.fontSize = `${size}px`;

			while (size > minValue && node.scrollWidth > node.clientWidth) {
				size -= 1;
				node.style.fontSize = `${size}px`;
			}
		};

		const observer = new ResizeObserver(resize);
		observer.observe(node);

		resize();

		return {
			destroy() {
				observer.disconnect();
			}
		};
	};
}
