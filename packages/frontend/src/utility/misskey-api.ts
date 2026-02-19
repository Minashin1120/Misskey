/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'misskey-js';
import { ref } from 'vue';
import { apiUrl } from '@@/js/config.js';
import { $i } from '@/i.js';
export const pendingApiRequestsCount = ref(0);

async function parseJsonResponse(res: Response): Promise<any> {
	if (res.status === 204) return null;

	const text = await res.text();
	if (text.length === 0) return null;

	try {
		return JSON.parse(text);
	} catch {
		const responseError = new Error(`Invalid API response (status: ${res.status})`);
		(responseError as any).status = res.status;
		(responseError as any).responseText = text.slice(0, 300);
		throw responseError;
	}
}

// Implements Misskey.api.ApiClient.request
export function misskeyApi<
	ResT = void,
	E extends keyof Misskey.Endpoints = keyof Misskey.Endpoints,
	P extends Misskey.Endpoints[E]['req'] = Misskey.Endpoints[E]['req'],
	_ResT = ResT extends void ? Misskey.api.SwitchCaseResponseType<E, P> : ResT,
>(
	endpoint: E,
	data: P & { i?: string | null; } = {} as any,
	token?: string | null | undefined,
	signal?: AbortSignal,
): Promise<_ResT> {
	if (endpoint.includes('://')) throw new Error('invalid endpoint');
	pendingApiRequestsCount.value++;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const promise = new Promise<_ResT>((resolve, reject) => {
		// Append a credential
		if ($i) data.i = $i.token;
		if (token !== undefined) data.i = token;

		// Send request
		window.fetch(`${apiUrl}/${endpoint}`, {
			method: 'POST',
			body: JSON.stringify(data),
			credentials: 'omit',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/json',
			},
			signal,
		}).then(async (res) => {
			const body = await parseJsonResponse(res);

			if (res.status === 200) {
				resolve(body);
			} else if (res.status === 204) {
				resolve(undefined as _ResT); // void -> undefined
			} else {
				reject(body?.error ?? body ?? new Error(`API request failed (status: ${res.status})`));
			}
		}).catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}

// Implements Misskey.api.ApiClient.request
export function misskeyApiGet<
	ResT = void,
	E extends keyof Misskey.Endpoints = keyof Misskey.Endpoints,
	P extends Misskey.Endpoints[E]['req'] = Misskey.Endpoints[E]['req'],
	_ResT = ResT extends void ? Misskey.api.SwitchCaseResponseType<E, P> : ResT,
>(
	endpoint: E,
	data: P = {} as any,
): Promise<_ResT> {
	pendingApiRequestsCount.value++;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const query = new URLSearchParams(data as any);

	const promise = new Promise<_ResT>((resolve, reject) => {
		// Send request
		window.fetch(`${apiUrl}/${endpoint}?${query}`, {
			method: 'GET',
			credentials: 'omit',
			cache: 'default',
		}).then(async (res) => {
			const body = await parseJsonResponse(res);

			if (res.status === 200) {
				resolve(body);
			} else if (res.status === 204) {
				resolve(undefined as _ResT); // void -> undefined
			} else {
				reject(body?.error ?? body ?? new Error(`API request failed (status: ${res.status})`));
			}
		}).catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}
