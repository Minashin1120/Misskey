/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddAiModerationViolationFlag1761150000000 {
	name = 'AddAiModerationViolationFlag1761150000000'

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "note" ADD "aiModerationViolation" boolean NOT NULL DEFAULT false');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "note" DROP COLUMN "aiModerationViolation"');
	}
}
