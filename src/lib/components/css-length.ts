type PxLength = `${number}px`;
type EmLength = `${number}em`;
type RemLength = `${number}rem`;
type VwLength = `${number}vw`;
type VhLength = `${number}vh`;
type VminLength = `${number}vmin`;
type VmaxLength = `${number}vmax`;
type PercentLength = `${number}%`;
export type CssLength =
	PxLength | EmLength | RemLength | VwLength | VhLength | VminLength | VmaxLength | PercentLength;

export function toPxValue(
	value: CssLength,
	element: HTMLElement = document.documentElement
): number {
	const match = value.match(/^(-?\d*\.?\d+)(px|em|rem|vw|vh|vmin|vmax|%)$/);

	if (!match) {
		throw new Error(`Unsupported CSS length: ${value}`);
	}

	const [, amount, unit] = match;
	const n = Number(amount);
	const style = getComputedStyle(element);

	switch (unit) {
		case 'px':
			return n;
		case 'em':
			return n * parseFloat(style.fontSize);
		case 'rem':
			return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
		case 'vw':
			return (n * window.innerWidth) / 100;
		case 'vh':
			return (n * window.innerHeight) / 100;
		case 'vmin':
			return (n * Math.min(window.innerWidth, window.innerHeight)) / 100;
		case 'vmax':
			return (n * Math.max(window.innerWidth, window.innerHeight)) / 100;
		case '%':
			return (n * element.parentElement!.clientWidth) / 100;
	}

	throw new Error(`Unsupported CSS length unit: ${unit}`);
}
