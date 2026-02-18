/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type Logger from '@/logger.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { Config } from '@/config.js';
import { MetaService } from '@/core/MetaService.js';
import { AbuseReportService } from '@/core/AbuseReportService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import type { MiDriveFile, MiNote, DriveFilesRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

const MODEL_NAME = 'gemini-2.5-flash-lite';
const SCAN_LIMIT_PER_RUN = 20;
const MAX_IMAGE_ATTACHMENTS_PER_NOTE = 4;
const MAX_IMAGE_FETCH_SIZE_BYTES = 2 * 1024 * 1024;
const GEMINI_IMAGE_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
]);
type AiModerationViolationAction = 'delete' | 'hideFromOthers' | 'homeOnly' | 'flagOnly';
type GeminiContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type GeminiModerationResult = {
	violation: boolean;
	reason: string;
	confidence?: number;
};

@Injectable()
export class AiModerationGeminiProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private metaService: MetaService,
		private abuseReportService: AbuseReportService,
		private httpRequestService: HttpRequestService,
		private systemAccountService: SystemAccountService,
		private notificationService: NotificationService,
		private noteDeleteService: NoteDeleteService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('ai-moderation-gemini');
	}

	@bindThis
	public async process(forceRun = false): Promise<void> {
		const meta = await this.metaService.fetch(true);

		if (!forceRun && !meta.aiModerationEnabled) {
			this.logger.debug('AI moderation is disabled. skip.');
			return;
		}

		if (meta.aiModerationGeminiApiKey == null || meta.aiModerationGeminiApiKey.trim() === '') {
			this.logger.warn('AI moderation is enabled, but Gemini API key is not set. skip.');
			return;
		}

		const rules = meta.serverRules.map(rule => rule.trim()).filter(Boolean);
		if (rules.length === 0) {
			this.logger.warn('AI moderation is enabled, but server rules are empty. skip.');
			return;
		}

		const query = this.notesRepository.createQueryBuilder('note')
			.where('note."userHost" IS NULL')
			.andWhere('(note."text" IS NOT NULL OR note."cw" IS NOT NULL OR note."name" IS NOT NULL OR COALESCE(array_length(note."fileIds", 1), 0) > 0)')
			.orderBy('note.id', 'ASC')
			.limit(SCAN_LIMIT_PER_RUN);

		if (meta.aiModerationLastCheckedNoteId != null) {
			query.andWhere('note.id > :lastCheckedId', { lastCheckedId: meta.aiModerationLastCheckedNoteId });
		}

		const notes = await query.getMany();
		if (notes.length === 0) {
			this.logger.debug('No unscanned notes found.');
			return;
		}

		const systemActor = await this.systemAccountService.fetch('actor');
		const action = meta.aiModerationViolationAction ?? 'flagOnly';

		for (const note of notes) {
			const parts = await this.buildModerationParts(note);
			if (parts.length === 0) {
				await this.metaService.update({ aiModerationLastCheckedNoteId: note.id });
				continue;
			}

			const result = await this.checkWithGemini(meta.aiModerationGeminiApiKey, rules, parts);

			if (result.violation) {
				const actionLabel = await this.applyViolationAction(note, action);
				const noteUrl = new URL(`/notes/${note.id}`, this.config.url).toString();
				const confidence = typeof result.confidence === 'number'
					? `\n- confidence: ${Math.max(0, Math.min(1, result.confidence)).toFixed(3)}`
					: '';
				const comment = [
					`[AI Moderation / ${MODEL_NAME}] Server rule violation candidate detected.`,
					`- noteId: ${note.id}`,
					`- noteUrl: ${noteUrl}`,
					`- action: ${actionLabel}`,
					`- reason: ${result.reason || 'No reason provided.'}${confidence}`,
				].join('\n');

				await this.abuseReportService.report([{
					targetUserId: note.userId,
					targetUserHost: note.userHost,
					reporterId: systemActor.id,
					reporterHost: systemActor.host,
					comment,
				}]);

				this.notificationService.createNotification(note.userId, 'app', {
					appAccessTokenId: null,
					customHeader: '違反の可能性があるノートを確認中です',
					customBody: `あなたのノートにサーバールール違反の可能性が検出されました。自動対応: ${actionLabel}。モデレーターが確認中です。`,
					customIcon: new URL('/static-assets/tabler-badges/bell.png', this.config.url).toString(),
				});

				this.logger.warn(`Violation candidate detected noteId=${note.id} action=${action}`);
			}

			await this.metaService.update({ aiModerationLastCheckedNoteId: note.id });
		}
	}

	@bindThis
	private async applyViolationAction(note: MiNote, action: AiModerationViolationAction): Promise<string> {
		switch (action) {
			case 'delete': {
				const noteAuthor = await this.usersRepository.findOneByOrFail({ id: note.userId });
				await this.noteDeleteService.delete(noteAuthor, note, true);
				return 'ノートを削除';
			}
			case 'hideFromOthers': {
				await this.notesRepository.update(note.id, {
					visibility: 'specified',
					visibleUserIds: [note.userId],
					aiModerationViolation: true,
				});
				return '投稿者本人以外には非表示';
			}
			case 'homeOnly': {
				if (note.visibility === 'public') {
					await this.notesRepository.update(note.id, {
						visibility: 'home',
						aiModerationViolation: true,
					});
					return 'ホームタイムラインのみに制限';
				}

				if (!note.aiModerationViolation) {
					await this.notesRepository.update(note.id, { aiModerationViolation: true });
				}
				return '既存の公開範囲を維持してフラグ付与';
			}
			case 'flagOnly':
			default: {
				if (!note.aiModerationViolation) {
					await this.notesRepository.update(note.id, { aiModerationViolation: true });
				}
				return 'フラグ付与のみ';
			}
		}
	}

	@bindThis
	private buildNoteContent(note: MiNote): string {
		const parts = [
			note.cw?.trim() ? `CW:\n${note.cw.trim()}` : '',
			note.name?.trim() ? `Name:\n${note.name.trim()}` : '',
			note.text?.trim() ? `Text:\n${note.text.trim()}` : '',
		].filter(Boolean);

		return parts.join('\n\n').trim();
	}

	@bindThis
	private async buildModerationParts(note: MiNote): Promise<GeminiContentPart[]> {
		const parts: GeminiContentPart[] = [];
		const content = this.buildNoteContent(note);
		if (content !== '') {
			parts.push({ text: `Text content:\n${content}` });
		}

		if (note.fileIds.length === 0) {
			return parts;
		}

		const files = await this.driveFilesRepository.findBy({
			id: In(note.fileIds),
		});
		const filesById = new Map(files.map(file => [file.id, file]));

		let imageCount = 0;
		for (const fileId of note.fileIds) {
			if (imageCount >= MAX_IMAGE_ATTACHMENTS_PER_NOTE) break;
			const file = filesById.get(fileId);
			if (!file) continue;
			if (!this.isGeminiImageType(file.type)) continue;

			const imagePart = await this.buildImagePart(file);
			if (imagePart == null) continue;
			parts.push(imagePart);
			imageCount++;
		}

		return parts;
	}

	@bindThis
	private async buildImagePart(file: MiDriveFile): Promise<GeminiContentPart | null> {
		const url = file.webpublicUrl ?? file.thumbnailUrl ?? file.url;
		if (!url) return null;

		try {
			const res = await this.httpRequestService.send(url, {
				method: 'GET',
				headers: {
					Accept: 'image/*',
				},
				timeout: 10000,
				size: MAX_IMAGE_FETCH_SIZE_BYTES,
				isLocalAddressAllowed: true,
			});
			const responseType = (res.headers.get('content-type') ?? file.webpublicType ?? file.type).split(';')[0].trim().toLowerCase();
			if (!this.isGeminiImageType(responseType)) {
				return null;
			}

			const bytes = Buffer.from(await res.arrayBuffer());
			if (bytes.length === 0) {
				return null;
			}

			return {
				inlineData: {
					mimeType: responseType,
					data: bytes.toString('base64'),
				},
			};
		} catch (error) {
			this.logger.debug(`Failed to fetch note image for moderation fileId=${file.id}: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	@bindThis
	private isGeminiImageType(contentType: string): boolean {
		return GEMINI_IMAGE_MIME_TYPES.has(contentType.toLowerCase());
	}

	@bindThis
	private async checkWithGemini(apiKey: string, rules: string[], noteParts: GeminiContentPart[]): Promise<GeminiModerationResult> {
		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const prompt = {
			text: [
			'You are a strict moderation classifier.',
			'Evaluate whether the note violates any server rules.',
			'Judge using both text and attached images when available.',
			'Output JSON only with this schema:',
			'{"violation": boolean, "reason": string, "confidence": number}',
			'confidence must be between 0 and 1.',
			'',
			'Server rules:',
			...rules.map((rule, i) => `${i + 1}. ${rule}`),
		].join('\n'),
		};

		const res = await this.httpRequestService.send(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [{
					role: 'user',
					parts: [prompt, ...noteParts],
				}],
				generationConfig: {
					temperature: 0,
				},
			}),
			timeout: 15000,
		});

		const data = await res.json() as {
			candidates?: Array<{
				content?: {
					parts?: Array<{ text?: string }>;
				};
			}>;
		};
		const text = (data.candidates?.[0]?.content?.parts ?? [])
			.map((part) => typeof part.text === 'string' ? part.text : '')
			.join('\n')
			.trim();

		const parsed = this.parseGeminiJson(text);

		return {
			violation: !!parsed.violation,
			reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 1800) : '',
			confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
		};
	}

	@bindThis
	private parseGeminiJson(raw: string): Record<string, unknown> {
		const cleaned = raw
			.replace(/^```json\s*/i, '')
			.replace(/^```\s*/i, '')
			.replace(/\s*```$/, '')
			.trim();

		try {
			return JSON.parse(cleaned);
		} catch {
			const matched = cleaned.match(/\{[\s\S]*\}/);
			if (matched) {
				return JSON.parse(matched[0]);
			}
			throw new Error('Gemini response is not valid JSON');
		}
	}
}
