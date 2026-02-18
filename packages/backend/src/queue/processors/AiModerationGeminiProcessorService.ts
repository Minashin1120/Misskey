/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { Config } from '@/config.js';
import { MetaService } from '@/core/MetaService.js';
import { AbuseReportService } from '@/core/AbuseReportService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { NotificationService } from '@/core/NotificationService.js';
import type { MiNote, NotesRepository } from '@/models/_.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

const MODEL_NAME = 'gemini-2.5-flash-lite';
const SCAN_LIMIT_PER_RUN = 20;

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

		private metaService: MetaService,
		private abuseReportService: AbuseReportService,
		private httpRequestService: HttpRequestService,
		private systemAccountService: SystemAccountService,
		private notificationService: NotificationService,
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
			.andWhere('(note."text" IS NOT NULL OR note."cw" IS NOT NULL OR note."name" IS NOT NULL)')
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

		for (const note of notes) {
			const content = this.buildNoteContent(note);
			if (content === '') {
				await this.metaService.update({ aiModerationLastCheckedNoteId: note.id });
				continue;
			}

			const result = await this.checkWithGemini(meta.aiModerationGeminiApiKey, rules, content);

			if (result.violation) {
				if (!note.aiModerationViolation) {
					await this.notesRepository.update(note.id, { aiModerationViolation: true });
				}

				const noteUrl = new URL(`/notes/${note.id}`, this.config.url).toString();
				const confidence = typeof result.confidence === 'number'
					? `\n- confidence: ${Math.max(0, Math.min(1, result.confidence)).toFixed(3)}`
					: '';
				const comment = [
					`[AI Moderation / ${MODEL_NAME}] Server rule violation candidate detected.`,
					`- noteId: ${note.id}`,
					`- noteUrl: ${noteUrl}`,
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
					customBody: 'あなたのノートにサーバールール違反の可能性が検出されました。モデレーターが確認中です。確認結果により削除される場合があります。',
					customIcon: new URL('/static-assets/tabler-badges/bell.png', this.config.url).toString(),
				});

				this.logger.warn(`Violation candidate detected noteId=${note.id}`);
			}

			await this.metaService.update({ aiModerationLastCheckedNoteId: note.id });
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
	private async checkWithGemini(apiKey: string, rules: string[], noteContent: string): Promise<GeminiModerationResult> {
		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const prompt = [
			'You are a strict moderation classifier.',
			'Evaluate whether the content violates any server rules.',
			'Output JSON only with this schema:',
			'{"violation": boolean, "reason": string, "confidence": number}',
			'confidence must be between 0 and 1.',
			'',
			'Server rules:',
			...rules.map((rule, i) => `${i + 1}. ${rule}`),
			'',
			'Content:',
			noteContent,
		].join('\n');

		const res = await this.httpRequestService.send(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [{
					role: 'user',
					parts: [{ text: prompt }],
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
