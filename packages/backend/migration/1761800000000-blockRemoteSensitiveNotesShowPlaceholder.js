/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class BlockRemoteSensitiveNotesShowPlaceholder1761800000000 {
	name = 'BlockRemoteSensitiveNotesShowPlaceholder1761800000000'

	async up(queryRunner) {
		await queryRunner.query("ALTER TABLE \"meta\" ADD \"blockRemoteSensitiveNotesShowPlaceholder\" boolean NOT NULL DEFAULT false");
	}

	async down(queryRunner) {
		await queryRunner.query("ALTER TABLE \"meta\" DROP COLUMN \"blockRemoteSensitiveNotesShowPlaceholder\"");
	}
}
