import locales from 'i18n';
import { I18n } from '@/misc/i18n.js';
import type { UserProfilesRepository } from '@/models/_.js';
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { AbuseUserReportsRepository, RolesRepository, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { AbuseReportService } from '@/core/AbuseReportService.js';
import { UserSuspendService } from '@/core/UserSuspendService.js';
import { RoleService } from '@/core/RoleService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { AnnouncementService } from '@/core/AnnouncementService.js';
import type { MiRole } from '@/models/Role.js';

const temporaryNoteRestrictionRoleName = '[Auto] Temporary Note Restriction';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:resolve-abuse-user-report',

	errors: {
		noSuchAbuseReport: {
			message: 'No such abuse report.',
			code: 'NO_SUCH_ABUSE_REPORT',
			id: '98ad4f94-e478-4a56-9eb7-cf335640dc7f',
			kind: 'server',
			httpStatusCode: 404,
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '5f4d9dc0-38ef-4b6b-8a20-4df106f65a8f',
			kind: 'server',
			httpStatusCode: 404,
		},
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '2e9f1ecf-6f90-4a73-a28c-227d7e308ec5',
			kind: 'server',
			httpStatusCode: 404,
		},
		invalidNote: {
			message: 'Invalid note id or URL.',
			code: 'INVALID_NOTE',
			id: 'a16c520f-8166-4fa9-8dff-08f123d25d6d',
			kind: 'client',
			httpStatusCode: 400,
		},
		noteNotOwnedByTarget: {
			message: 'The note does not belong to the reported user.',
			code: 'NOTE_NOT_OWNED_BY_TARGET',
			id: '58f4f099-c76d-4fd2-a1f2-bf3267e9af83',
			kind: 'client',
			httpStatusCode: 400,
		},
		invalidDuration: {
			message: 'Invalid restriction duration.',
			code: 'INVALID_DURATION',
			id: '5dafd03d-a78a-49cf-a58d-33fcc1de6ab4',
			kind: 'client',
			httpStatusCode: 400,
		},
		cannotSuspendModerator: {
			message: 'Cannot suspend moderator account.',
			code: 'CANNOT_SUSPEND_MODERATOR',
			id: 'f83e7f4f-bf56-4dcf-80c3-48614f6393c1',
			kind: 'client',
			httpStatusCode: 400,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		reportId: { type: 'string', format: 'misskey:id' },
		resolvedAs: { type: 'string', enum: ['accept', 'reject', null], nullable: true, default: 'accept' },
		action: { type: 'string', enum: ['warn', 'deleteNote', 'suspendUser', 'restrictNoteTemporarily'], nullable: true, default: null },
		reason: { type: 'string', nullable: true, default: null },
		noteIdOrUrl: { type: 'string', nullable: true, default: null },
		restrictHours: { type: 'integer', nullable: true, minimum: 1, maximum: 24 * 365, default: null },
		notifyTarget: { type: 'boolean', default: true },
	},
	required: ['reportId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.abuseUserReportsRepository)
		private abuseUserReportsRepository: AbuseUserReportsRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,

		private abuseReportService: AbuseReportService,
		private userSuspendService: UserSuspendService,
		private roleService: RoleService,
		private getterService: GetterService,
		private noteDeleteService: NoteDeleteService,
		private announcementService: AnnouncementService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const report = await this.abuseUserReportsRepository.findOneBy({ id: ps.reportId });
			if (!report) {
				throw new ApiError(meta.errors.noSuchAbuseReport);
			}

			const targetUser = await this.usersRepository.findOneBy({ id: report.targetUserId });
			if (!targetUser) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			const profile = await this.userProfilesRepository.findOneBy({ userId: targetUser.id });
			const i18n = new I18n(locales[profile?.lang ?? 'ja-JP'] ?? locales['ja-JP']);

			const normalizedReason = (ps.reason ?? '').trim();
			let actionDetail = i18n.t('_moderation.actionDetailDefault');

			switch (ps.action) {
				case 'warn': {
					actionDetail = i18n.t('_moderation.actionDetailWarn');
					break;
				}
				case 'deleteNote': {
					const noteId = this.extractNoteId(ps.noteIdOrUrl);
					if (noteId == null) {
						throw new ApiError(meta.errors.invalidNote);
					}

					const note = await this.getterService.getNote(noteId).catch(err => {
						if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
							throw new ApiError(meta.errors.noSuchNote);
						}
						throw err;
					});

					if (note.userId !== targetUser.id) {
						throw new ApiError(meta.errors.noteNotOwnedByTarget);
					}

					await this.noteDeleteService.delete(targetUser, note, false, me);
					actionDetail = i18n.t('_moderation.actionDetailDeleteNote', { id: note.id.toUpperCase() });
					break;
				}
				case 'suspendUser': {
					if (await this.roleService.isModerator(targetUser)) {
						throw new ApiError(meta.errors.cannotSuspendModerator);
					}

					await this.userSuspendService.suspend(targetUser, me);
					actionDetail = i18n.t('_moderation.actionDetailSuspend');
					break;
				}
				case 'restrictNoteTemporarily': {
					if (ps.restrictHours == null || ps.restrictHours <= 0) {
						throw new ApiError(meta.errors.invalidDuration);
					}

					const role = await this.findOrCreateTemporaryNoteRestrictionRole(me);

					await this.roleService.unassign(targetUser.id, role.id, me).catch(err => {
						if (err instanceof RoleService.NotAssignedError) return;
						throw err;
					});

					const expiresAt = new Date(Date.now() + (ps.restrictHours * 60 * 60 * 1000));
					await this.roleService.assign(targetUser.id, role.id, expiresAt, me);
					actionDetail = i18n.t('_moderation.actionDetailRestrictNote', { hours: ps.restrictHours });
					break;
				}
				default:
					break;
			}

			await this.abuseReportService.resolve([{
				reportId: report.id,
				resolvedAs: ps.resolvedAs ?? 'accept',
			}], me);

			if (ps.notifyTarget && targetUser.host == null) {
				const reasonText = normalizedReason.length > 0 ? normalizedReason : i18n.t('_moderation.noReasonProvided');
				const body = [
					i18n.t('_moderation.notificationBody'),
					actionDetail,
					'',
					i18n.t('_moderation.reasonLabel') + reasonText,
					i18n.t('_moderation.reportIdLabel') + report.id,
				].join('\\n');

				await this.announcementService.create({
					title: i18n.t('_moderation.notificationTitle'),
					text: body,
					imageUrl: null,
					icon: 'warning',
					display: 'dialog',
					forExistingUsers: false,
					silence: false,
					needConfirmationToRead: true,
					userId: targetUser.id,
				}, me);
			}
		});
	}

	private extractNoteId(noteIdOrUrl: string | null | undefined): string | null {
		if (noteIdOrUrl == null) return null;

		const value = noteIdOrUrl.trim();
		if (value.length === 0) return null;

		if (!value.includes('/')) return value;

		const matched = value.match(/\/notes\/([0-9a-zA-Z]+)/);
		if (!matched?.[1]) return null;
		return matched[1];
	}

	private async findOrCreateTemporaryNoteRestrictionRole(moderator: { id: string }): Promise<MiRole> {
		const existed = await this.rolesRepository.findOneBy({
			name: temporaryNoteRestrictionRoleName,
			target: 'manual',
		});
		if (existed) {
			return existed;
		}

		return await this.roleService.create({
			name: temporaryNoteRestrictionRoleName,
			description: 'Auto-generated role for temporary note posting restrictions from abuse report moderation.',
			color: '#ff8a00',
			iconUrl: null,
			target: 'manual',
			condFormula: { id: 'manual-default', type: 'isLocal' },
			isPublic: false,
			isModerator: false,
			isAdministrator: false,
			isExplorable: false,
			asBadge: false,
			preserveAssignmentOnMoveAccount: false,
			canEditMembersByModerator: true,
			displayOrder: 0,
			policies: {
				canPublicNote: {
					useDefault: false,
					priority: 2,
					value: false,
				},
			},
		}, moderator as any);
	}
}
