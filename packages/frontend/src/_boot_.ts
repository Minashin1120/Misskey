/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// https://vitejs.dev/config/build-options.html#build-modulepreload
import 'vite/modulepreload-polyfill';

window.addEventListener('vite:preloadError', (event: Event) => {
	const preloadEvent = event as Event & { payload?: unknown };
	const message = preloadEvent.payload instanceof Error ? preloadEvent.payload.message : '';
	if (!message.includes('Unable to preload CSS')) return;

	// Allow route transition even if one CSS preload failed.
	preloadEvent.preventDefault();
	console.warn('[vite] CSS preload failed. Continue without blocking navigation.', preloadEvent.payload);
});

if (import.meta.env.DEV) {
	await import('@tabler/icons-webfont/dist/tabler-icons.scss');
} else {
	await import('icons-subsetter/built/tabler-icons-frontend.css');
}

import '@/style.scss';
import { mainBoot } from '@/boot/main-boot.js';
import { subBoot } from '@/boot/sub-boot.js';

const subBootPaths = ['/share', '/auth', '/miauth', '/oauth', '/signup-complete', '/verify-email', '/install-extensions'];

if (subBootPaths.some(i => window.location.pathname === i || window.location.pathname.startsWith(i + '/'))) {
	subBoot();
} else {
	mainBoot();
}
