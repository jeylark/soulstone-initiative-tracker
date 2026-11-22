/**
 * Snapshots button content and measures it on mount and viewport resize.
 * @param getGroup Returns the group whose dimensions are updated.
 * @param getHost Returns the inert, hidden container for temporary measurement copies.
 * @param getOrientation Returns the current group orientation.
 * @returns Functions to remeasure the snapshot and remove the resize listener.
 */
export function measureButtonGroup(
	getGroup: () => HTMLDivElement,
	getHost: () => HTMLDivElement,
	getOrientation: () => 'horizontal' | 'vertical'
): Readonly<{ measure: () => void; stop: () => void }> {
	const group = getGroup();
	const host = getHost();
	const templates: HTMLElement[] = [];
	const items = Array.from(group.querySelectorAll<HTMLElement>('.button-group-item')).filter(
		(item) => item.closest('.button-group') === group
	);

	for (const item of items) {
		const button = item.querySelector<HTMLElement>('.ui-button');
		if (!button) continue;
		const template = button.cloneNode(true) as HTMLElement;
		template.removeAttribute('id');
		for (const element of template.querySelectorAll('[id]')) element.removeAttribute('id');
		templates.push(template);
		const labels: unknown = JSON.parse(item.dataset.sizingLabels ?? '[]');
		if (Array.isArray(labels)) {
			for (const label of labels) {
				if (typeof label !== 'string') continue;
				const alternate = template.cloneNode(true) as HTMLElement;
				const textNodes = document.createTreeWalker(alternate, NodeFilter.SHOW_TEXT, {
					acceptNode: (node) =>
						node.textContent?.trim() && !node.parentElement?.closest('svg')
							? NodeFilter.FILTER_ACCEPT
							: NodeFilter.FILTER_REJECT
				});
				let node = textNodes.nextNode();
				if (node) {
					node.nodeValue = label;
					while ((node = textNodes.nextNode())) node.nodeValue = '';
				} else {
					alternate.append(label);
				}
				templates.push(alternate);
			}
		}
	}

	function measure(): void {
		if (templates.length === 0) return;
		const copies = templates.map((template) => {
			const copy = template.cloneNode(true) as HTMLElement;
			copy.style.width = 'max-content';
			copy.style.height = 'auto';
			copy.style.maxWidth = 'none';
			return copy;
		});
		host.replaceChildren(...copies);
		try {
			const naturalWidth = Math.ceil(
				Math.max(...copies.map((copy) => copy.getBoundingClientRect().width))
			);
			if (naturalWidth === 0) return;
			const count = getOrientation() === 'vertical' ? 1 : items.length;
			const gap = 8;
			group.style.setProperty('--button-group-natural-width', `${naturalWidth}px`);
			group.style.setProperty(
				'--button-group-target-width',
				`${naturalWidth * count + gap * (count - 1)}px`
			);
			const availableWidth = group.clientWidth;
			if (availableWidth > 0) {
				const columns = Math.max(
					1,
					Math.min(count, Math.floor((availableWidth + gap) / (naturalWidth + gap)))
				);
				group.style.setProperty(
					'--button-group-target-width',
					`${naturalWidth * columns + gap * (columns - 1)}px`
				);
				const availableButtonWidth = (availableWidth - gap * (columns - 1)) / columns;
				const buttonWidth = group.classList.contains('button-group--full-width')
					? availableButtonWidth
					: Math.min(naturalWidth, availableButtonWidth);
				for (const copy of copies) copy.style.width = `${buttonWidth}px`;
				const height = Math.ceil(
					Math.max(...copies.map((copy) => copy.getBoundingClientRect().height))
				);
				group.style.setProperty('--button-group-columns', String(columns));
				group.style.setProperty('--button-group-button-height', `${height}px`);
			}
		} finally {
			host.replaceChildren();
		}
	}

	let isActive = true;
	measure();
	window.addEventListener('resize', measure);
	void document.fonts?.ready.then(
		() => {
			if (isActive) measure();
		},
		() => undefined
	);
	return {
		measure,
		stop: () => {
			isActive = false;
			window.removeEventListener('resize', measure);
		}
	};
}
