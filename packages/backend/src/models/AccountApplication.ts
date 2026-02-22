/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export type AccountApplicationStatus = 'pending' | 'approved' | 'rejected';

@Entity('account_application')
export class MiAccountApplication {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		default: () => 'CURRENT_TIMESTAMP',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		default: () => 'CURRENT_TIMESTAMP',
	})
	public updatedAt: Date;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'pending',
	})
	public status: AccountApplicationStatus;

	@Column('varchar', {
		length: 64,
	})
	public desiredUsername: string;

	@Column('varchar', {
		length: 512,
	})
	public contact: string;

	@Column('varchar', {
		length: 4096,
	})
	public message: string;

	@Column('varchar', {
		length: 4096,
		default: '',
	})
	public adminMemo: string;

	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public requestIp: string | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
	})
	public reviewedById: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public reviewedBy: MiUser | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public reviewedAt: Date | null;
}
