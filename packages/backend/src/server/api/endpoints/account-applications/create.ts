/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { MiMeta } from '@/models/Meta.js';
import type { AccountApplicationsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';

export const meta = {
	tags: ['signup'],

	requireCredential: false,

	errors: {
		notAcceptingApplications: {
			message: 'This server is not accepting account applications.',
			code: 'ACCOUNT_APPLICATIONS_DISABLED',
			id: '0f2ee0de-cff9-43ec-9752-b27aa3f7c9e0',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			id: { type: 'string', optional: false, nullable: false, format: 'id' },
			status: { type: 'string', optional: false, nullable: false, enum: ['pending'] },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		desiredUsername: { type: 'string', minLength: 1, maxLength: 64 },
		contact: { type: 'string', minLength: 1, maxLength: 512 },
		message: { type: 'string', minLength: 1, maxLength: 4096 },
	},
	required: ['desiredUsername', 'contact', 'message'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.accountApplicationsRepository)
		private accountApplicationsRepository: AccountApplicationsRepository,

		@Inject(DI.meta)
		private instanceMeta: MiMeta,

		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, _me, _token, _file, _cleanup, ip) => {
			if (!this.instanceMeta.disableRegistration || !this.instanceMeta.accountApplicationsEnabled) {
				throw new ApiError(meta.errors.notAcceptingApplications);
			}

			const desiredUsername = ps.desiredUsername.trim();
			const contact = ps.contact.trim();
			const message = ps.message.trim();
			const now = new Date();

			const entity = await this.accountApplicationsRepository.insertOne({
				id: this.idService.gen(now.getTime()),
				createdAt: now,
				updatedAt: now,
				status: 'pending',
				desiredUsername,
				contact,
				message,
				adminMemo: '',
				requestIp: this.instanceMeta.enableIpLogging ? (ip ?? null) : null,
				reviewedById: null,
				reviewedAt: null,
			});

			return {
				id: entity.id,
				status: entity.status,
			};
		});
	}
}
