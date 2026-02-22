/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AccountApplicationsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:meta',
	errors: {
		noSuchApplication: {
			message: 'No such account application.',
			code: 'NO_SUCH_ACCOUNT_APPLICATION',
			id: '7f4a0cb0-53f9-444f-87ec-10e13b0f4f65',
		},
	},
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			id: { type: 'string', optional: false, nullable: false, format: 'id' },
			status: { type: 'string', optional: false, nullable: false, enum: ['pending', 'approved', 'rejected'] },
			adminMemo: { type: 'string', optional: false, nullable: false },
			reviewedAt: { type: 'string', optional: false, nullable: true, format: 'date-time' },
			reviewedById: { type: 'string', optional: false, nullable: true, format: 'id' },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', format: 'misskey:id' },
		status: { type: 'string', enum: ['pending', 'approved', 'rejected'], nullable: true },
		adminMemo: { type: 'string', nullable: true, maxLength: 4096 },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.accountApplicationsRepository)
		private accountApplicationsRepository: AccountApplicationsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const current = await this.accountApplicationsRepository.findOneBy({ id: ps.id });
			if (!current) throw new ApiError(meta.errors.noSuchApplication);

			const nextStatus = ps.status ?? current.status;
			const nextMemo = ps.adminMemo ?? current.adminMemo;
			const now = new Date();

			await this.accountApplicationsRepository.update(current.id, {
				status: nextStatus,
				adminMemo: nextMemo,
				updatedAt: now,
				reviewedAt: nextStatus === 'pending' ? null : now,
				reviewedById: nextStatus === 'pending' ? null : me.id,
			});

			return {
				id: current.id,
				status: nextStatus,
				adminMemo: nextMemo,
				reviewedAt: nextStatus === 'pending' ? null : now.toISOString(),
				reviewedById: nextStatus === 'pending' ? null : me.id,
			};
		});
	}
}
