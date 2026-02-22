/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AccountApplicationsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'read:admin:meta',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object', optional: false, nullable: false,
			properties: {
				id: { type: 'string', optional: false, nullable: false, format: 'id' },
				createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
				updatedAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
				status: { type: 'string', optional: false, nullable: false, enum: ['pending', 'approved', 'rejected'] },
				desiredUsername: { type: 'string', optional: false, nullable: false },
				contact: { type: 'string', optional: false, nullable: false },
				message: { type: 'string', optional: false, nullable: false },
				adminMemo: { type: 'string', optional: false, nullable: false },
				requestIp: { type: 'string', optional: false, nullable: true },
				reviewedById: { type: 'string', optional: false, nullable: true, format: 'id' },
				reviewedAt: { type: 'string', optional: false, nullable: true, format: 'date-time' },
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
		offset: { type: 'integer', minimum: 0, default: 0 },
		state: { type: 'string', enum: ['all', 'pending', 'approved', 'rejected'], default: 'all' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.accountApplicationsRepository)
		private accountApplicationsRepository: AccountApplicationsRepository,
	) {
		super(meta, paramDef, async (ps) => {
			const qb = this.accountApplicationsRepository.createQueryBuilder('app')
				.orderBy('app.id', 'DESC')
				.take(ps.limit)
				.skip(ps.offset);

			if (ps.state !== 'all') {
				qb.where('app.status = :status', { status: ps.state });
			}

			const rows = await qb.getMany();
			return rows.map(app => ({
				id: app.id,
				createdAt: app.createdAt.toISOString(),
				updatedAt: app.updatedAt.toISOString(),
				status: app.status,
				desiredUsername: app.desiredUsername,
				contact: app.contact,
				message: app.message,
				adminMemo: app.adminMemo,
				requestIp: app.requestIp,
				reviewedById: app.reviewedById,
				reviewedAt: app.reviewedAt ? app.reviewedAt.toISOString() : null,
			}));
		});
	}
}
