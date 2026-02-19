/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Brackets } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type {
	ModerationLogsRepository,
	RoleAssignmentsRepository,
	RolesRepository,
	UsersRepository,
} from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '../../error.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';

const temporaryNoteRestrictionRoleName = '[Auto] Temporary Note Restriction';

export const meta = {
	tags: ['account'],

	requireCredential: true,
	kind: 'read:account',

	description: 'Show account health status and moderation history. Only the account owner or moderators can view.',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			userId: { type: 'string', format: 'id' },
			isRestricted: { type: 'boolean' },
			restrictedReasons: {
				type: 'array',
				items: {
					type: 'string',
					enum: ['suspended', 'silenced', 'temporaryNoteRestriction', 'deleted'],
				},
			},
			statuses: {
				type: 'object',
				optional: false, nullable: false,
				properties: {
					isSuspended: { type: 'boolean' },
					isSilenced: { type: 'boolean' },
					isDeleted: { type: 'boolean' },
					isTemporaryNoteRestricted: { type: 'boolean' },
					temporaryNoteRestrictionExpiresAt: { type: 'string', format: 'date-time', nullable: true },
				},
			},
			history: {
				type: 'array',
				items: {
					type: 'object',
					optional: false, nullable: false,
					properties: {
						id: { type: 'string', format: 'id' },
						createdAt: { type: 'string', format: 'date-time' },
						type: { type: 'string' },
						summary: { type: 'string' },
						info: { type: 'object' },
						moderatorId: { type: 'string', format: 'id' },
						moderator: { type: 'object', ref: 'UserDetailedNotMe' },
					},
				},
			},
		},
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '4d7bfe85-5f9d-4cfb-9f4f-706e930f7c8b',
			httpStatusCode: 404,
		},
		forbidden: {
			message: 'Forbidden.',
			code: 'FORBIDDEN',
			id: 'd2ad7a87-3000-4a96-bda0-8642e19b4e5b',
			httpStatusCode: 403,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		@Inject(DI.roleAssignmentsRepository)
		private roleAssignmentsRepository: RoleAssignmentsRepository,

		@Inject(DI.moderationLogsRepository)
		private moderationLogsRepository: ModerationLogsRepository,

		private roleService: RoleService,
		private moderationLogEntityService: ModerationLogEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const targetUserId = ps.userId ?? me.id;
			const isModerator = await this.roleService.isModerator(me);

			if (targetUserId !== me.id && !isModerator) {
				throw new ApiError(meta.errors.forbidden);
			}

			const user = await this.usersRepository.findOneBy({ id: targetUserId });
			if (user == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			const userPolicies = await this.roleService.getUserPolicies(user.id);
			const isSilenced = !userPolicies.canPublicNote;

			let temporaryNoteRestrictionExpiresAt: Date | null = null;
			const temporaryRole = await this.rolesRepository.findOneBy({
				name: temporaryNoteRestrictionRoleName,
				target: 'manual',
			});

			if (temporaryRole != null) {
				const activeTemporaryRestriction = await this.roleAssignmentsRepository.createQueryBuilder('assign')
					.where('assign.userId = :userId', { userId: user.id })
					.andWhere('assign.roleId = :roleId', { roleId: temporaryRole.id })
					.andWhere(new Brackets(qb => {
						qb.where('assign.expiresAt IS NULL')
							.orWhere('assign.expiresAt > :now', { now: new Date() });
					}))
					.orderBy('assign.expiresAt', 'ASC', 'NULLS FIRST')
					.getOne();

				temporaryNoteRestrictionExpiresAt = activeTemporaryRestriction?.expiresAt ?? null;
			}

			const query = this.moderationLogsRepository.createQueryBuilder('log')
				.leftJoinAndSelect('log.user', 'user')
				.andWhere(new Brackets(qb => {
					qb.where(`log.info->>'userId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->>'noteUserId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->>'fileUserId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->>'pageUserId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->>'flashUserId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->>'postUserId' = :targetUserId`, { targetUserId: user.id })
						.orWhere(`log.info->'report'->>'targetUserId' = :targetUserId`, { targetUserId: user.id });
				}))
				.orderBy('log.id', 'DESC')
				.limit(ps.limit);

			const packedLogs = await this.moderationLogEntityService.packMany(await query.getMany());

			const history = packedLogs.map(log => ({
				id: log.id,
				createdAt: log.createdAt,
				type: log.type,
				summary: this.summarizeHistory(log.type, log.info),
				info: log.info,
				moderatorId: log.userId,
				moderator: log.user,
			}));

			const restrictedReasons: Array<'suspended' | 'silenced' | 'temporaryNoteRestriction' | 'deleted'> = [];
			if (user.isSuspended) restrictedReasons.push('suspended');
			if (isSilenced) restrictedReasons.push('silenced');
			if (temporaryNoteRestrictionExpiresAt != null) restrictedReasons.push('temporaryNoteRestriction');
			if (user.isDeleted) restrictedReasons.push('deleted');

			return {
				userId: user.id,
				isRestricted: restrictedReasons.length > 0,
				restrictedReasons,
				statuses: {
					isSuspended: user.isSuspended,
					isSilenced,
					isDeleted: user.isDeleted,
					isTemporaryNoteRestricted: temporaryNoteRestrictionExpiresAt != null,
					temporaryNoteRestrictionExpiresAt: temporaryNoteRestrictionExpiresAt?.toISOString() ?? null,
				},
				history,
			};
		});
	}

	private summarizeHistory(type: string, info: Record<string, any>): string {
		switch (type) {
			case 'suspend':
				return 'アカウントが凍結されました。';
			case 'unsuspend':
				return 'アカウント凍結が解除されました。';
			case 'deleteNote':
				return `ノートが削除されました。${info.noteId ? ` (ID: ${info.noteId})` : ''}`;
			case 'assignRole':
				if (info.roleName === temporaryNoteRestrictionRoleName) {
					return `ノート投稿の一時停止が実施されました。${info.expiresAt ? ` (期限: ${info.expiresAt})` : ''}`;
				}
				return `ロールが付与されました。${info.roleName ? ` (${info.roleName})` : ''}`;
			case 'unassignRole':
				if (info.roleName === temporaryNoteRestrictionRoleName) {
					return 'ノート投稿の一時停止が解除されました。';
				}
				return `ロールが解除されました。${info.roleName ? ` (${info.roleName})` : ''}`;
			case 'updateUserNote':
				return '管理者メモが更新されました。';
			case 'resolveAbuseReport':
				return `通報が処理されました。${info.resolvedAs ? ` (判定: ${info.resolvedAs})` : ''}`;
			default:
				return `モデレーション操作: ${type}`;
		}
	}
}
