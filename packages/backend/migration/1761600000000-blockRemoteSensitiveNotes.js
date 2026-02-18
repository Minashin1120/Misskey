/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class blockRemoteSensitiveNotes1761600000000 {
    name = 'blockRemoteSensitiveNotes1761600000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "blockRemoteSensitiveNotes" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "blockRemoteSensitiveNotes"`);
    }
}
