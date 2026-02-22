/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AccountApplications1763900000000 {
	name = 'AccountApplications1763900000000'

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "meta" ADD "accountApplicationsEnabled" boolean NOT NULL DEFAULT false');
		await queryRunner.query('CREATE TABLE "account_application" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" character varying(32) NOT NULL DEFAULT \'pending\', "desiredUsername" character varying(64) NOT NULL, "contact" character varying(512) NOT NULL, "message" character varying(4096) NOT NULL, "adminMemo" character varying(4096) NOT NULL DEFAULT \'\', "requestIp" character varying(128), "reviewedById" character varying(32), "reviewedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_account_application_id" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_account_application_status" ON "account_application" ("status")');
		await queryRunner.query('CREATE INDEX "IDX_account_application_reviewedById" ON "account_application" ("reviewedById")');
		await queryRunner.query('ALTER TABLE "account_application" ADD CONSTRAINT "FK_account_application_reviewedById" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "account_application" DROP CONSTRAINT "FK_account_application_reviewedById"');
		await queryRunner.query('DROP INDEX "public"."IDX_account_application_reviewedById"');
		await queryRunner.query('DROP INDEX "public"."IDX_account_application_status"');
		await queryRunner.query('DROP TABLE "account_application"');
		await queryRunner.query('ALTER TABLE "meta" DROP COLUMN "accountApplicationsEnabled"');
	}
}
