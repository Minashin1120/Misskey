/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AiModerationGemini1761110000000 {
	name = 'AiModerationGemini1761110000000'

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "aiModerationEnabled" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "meta" ADD "aiModerationGeminiApiKey" character varying(1024)');
		await queryRunner.query('ALTER TABLE "meta" ADD "aiModerationLastCheckedNoteId" character varying(32)');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "aiModerationLastCheckedNoteId"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "aiModerationGeminiApiKey"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "aiModerationEnabled"');
	}
}
