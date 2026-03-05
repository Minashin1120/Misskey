/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AiModerationGeminiModel1761110000001 {
	name = 'AiModerationGeminiModel1761110000001'

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "aiModerationGeminiModel" character varying(64) NOT NULL DEFAULT \'gemini-2.5-flash-lite\'');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "aiModerationGeminiModel"');
	}
}
