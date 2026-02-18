/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AiModerationViolationAction1761700000000 {
	name = 'AiModerationViolationAction1761700000000'

	async up(queryRunner) {
		await queryRunner.query("ALTER TABLE \"meta\" ADD \"aiModerationViolationAction\" character varying(32) NOT NULL DEFAULT 'flagOnly'");
	}

	async down(queryRunner) {
		await queryRunner.query("ALTER TABLE \"meta\" DROP COLUMN \"aiModerationViolationAction\"");
	}
}
