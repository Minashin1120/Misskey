/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { lang, version } from '@@/js/config.js';
import type { Locale } from 'i18n';

// ここはビルド時に const locale = JSON.parse("...") みたいな感じで置き換えられるので top-level await は消える
export let locale: Locale = await window.fetch(`/assets/locales/${lang}.${version}.json`)
	.then(async r => {
		if (!r.ok) throw new Error(`failed to fetch locale (${r.status})`);
		return await r.json();
	})
	.catch(async () => {
		// JSON parse failure (e.g. edge cache returned error page) should not bubble as SyntaxError.
		if (lang !== 'en-US') {
			try {
				const fallback = await window.fetch(`/assets/locales/en-US.${version}.json`);
				if (fallback.ok) return await fallback.json();
			} catch {
				// fall through
			}
		}
		return {} as Locale;
	});

export function updateLocale(newLocale: Locale): void {
	locale = newLocale;
}
