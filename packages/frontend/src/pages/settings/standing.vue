<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/standing" :label="i18n.ts._accountStanding.title" :keywords="['account', 'standing', 'health', 'moderation']" icon="ti ti-shield-lock">
	<div class="_gaps_m">
		<div class="tabs">
			<MkButton rounded @click="goSecurity"><i class="ti ti-lock"></i> {{ i18n.ts.security }}</MkButton>
			<MkButton primary rounded disabled><i class="ti ti-shield-lock"></i> {{ $t("_accountStanding.labels.suspended") }}</MkButton>
		</div>

		<MkInfo>{{ $t("_accountStanding.description") }}</MkInfo>
		<MkInfo v-if="errorMessage" warn>{{ errorMessage }}</MkInfo>

		<div v-if="loading" class="loading">{{ i18n.ts.loading }}</div>

		<template v-else-if="health != null">
			<div v-panel class="statusPanel">
				<MkAvatar class="avatar" :user="$i" indicator/>
				<div class="title">{{ standingHeadline }}</div>
				<div class="description">{{ standingDescription }}</div>

				<div class="meter">
					<div class="rail"></div>
					<div class="steps">
						<div v-for="(label, idx) in labels" :key="label" class="step">
							<div class="dot" :class="{ active: idx <= level }"></div>
							<div class="label" :class="{ active: idx === level }">{{ label }}</div>
						</div>
					</div>
				</div>
			</div>

			<div v-panel class="section">
				<div class="sectionHeader">
					<i class="ti ti-alert-triangle icon"></i>
					<div>
						<div class="sectionTitle">{{ $t("_accountStanding.activeViolations", { n: activeViolations.length }) }}</div>
						<div class="sectionCaption">{{ $t("_accountStanding.activeViolationsDescription") }}</div>
					</div>
				</div>

				<div v-if="activeViolations.length === 0" class="empty">{{ $t("_accountStanding.noActiveViolations") }}</div>
				<div v-for="item in activeViolations" :key="item.id" class="violationCard">
					<div class="meta" v-if="item.createdAt"><MkTime :time="item.createdAt" mode="detail"/></div>
					<div class="summary">{{ item.summary }}</div>
					<div v-if="item.expiresAt" class="meta">{{ $t("_accountStanding.expires") }}<MkTime :time="item.expiresAt" mode="detail"/></div>
				</div>
			</div>

			<div v-panel class="section">
				<div class="sectionHeader">
					<i class="ti ti-history icon"></i>
					<div>
						<div class="sectionTitle">{{ $t("_accountStanding.expiredViolations", { n: pastLogs.length }) }}</div>
						<div class="sectionCaption">{{ $t("_accountStanding.expiredViolationsDescription") }}</div>
					</div>
				</div>

				<div v-if="pastLogs.length === 0" class="empty">{{ $t("_accountStanding.noExpiredViolations") }}</div>
				<div v-for="item in pastLogs" :key="item.id" class="violationCard">
					<div class="meta"><MkTime :time="item.createdAt" mode="detail"/></div>
					<div class="summary">{{ item.summary }}</div>
					<div class="meta" v-if="item.moderator?.username">@{{ item.moderator.username }}</div>
				</div>
			</div>
		</template>
	</div>
</SearchMarker>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type AccountHealthResponse = {
	statuses: {
		isSuspended: boolean;
		isSilenced: boolean;
		isDeleted: boolean;
		isTemporaryNoteRestricted: boolean;
		temporaryNoteRestrictionExpiresAt: string | null;
	};
	history: Array<{
		id: string;
		createdAt: string;
		type: string;
		summary: string;
		moderator?: {
			username: string;
		};
	}>;
};

type ActiveViolation = {
	id: string;
	summary: string;
	createdAt: string | null;
	expiresAt: string | null;
};

const $i = ensureSignin();
const router = useRouter();

const loading = ref(true);
const errorMessage = ref<string | null>(null);
const health = ref<AccountHealthResponse | null>(null);

const labels = ['All good', 'Limited', 'Very limited', 'At risk', 'Suspended'];

const level = computed(() => {
	const h = health.value;
	if (h == null) return 0;
	if (h.statuses.isSuspended || h.statuses.isDeleted) return 4;
	if (h.statuses.isSilenced && h.statuses.isTemporaryNoteRestricted) return 3;
	if (h.statuses.isSilenced) return 2;
	if (h.statuses.isTemporaryNoteRestricted) return 1;
	return 0;
});

const standingHeadline = computed(() => {
	if (level.value === 0) return 'Your account is all good';
	if (level.value === 4) return 'Your account is suspended';
	return 'Your account has restrictions';
});

const standingDescription = computed(() => {
	if (level.value === 0) return 'Thanks for following our rules.';
	return 'If you break the rules, restrictions will appear here.';
});

const activeViolations = computed<ActiveViolation[]>(() => {
	if (health.value == null) return [];
	const items: ActiveViolation[] = [];

	const lastByType = (type: string) => health.value?.history.find(item => item.type === type);

	if (health.value.statuses.isSuspended) {
		items.push({
			id: 'active-suspended',
			summary: 'Your account is currently suspended.',
			createdAt: lastByType('suspend')?.createdAt ?? null,
			expiresAt: null,
		});
	}

	if (health.value.statuses.isSilenced) {
		items.push({
			id: 'active-silenced',
			summary: 'Posting and visibility are restricted by moderation settings.',
			createdAt: null,
			expiresAt: null,
		});
	}

	if (health.value.statuses.isTemporaryNoteRestricted) {
		items.push({
			id: 'active-temp-note-restriction',
			summary: 'You are temporarily restricted from posting notes.',
			createdAt: lastByType('assignRole')?.createdAt ?? null,
			expiresAt: health.value.statuses.temporaryNoteRestrictionExpiresAt,
		});
	}

	if (health.value.statuses.isDeleted) {
		items.push({
			id: 'active-deleted',
			summary: 'Your account is in deletion process.',
			createdAt: null,
			expiresAt: null,
		});
	}

	return items;
});

const pastLogs = computed(() => {
	if (health.value == null) return [];
	return health.value.history.slice(0, 20);
});

function goSecurity() {
	router.push('/settings/security');
}

async function fetchAccountHealth() {
	loading.value = true;
	errorMessage.value = null;

	try {
		health.value = await misskeyApi('i/account-health' as any, {});
	} catch (err) {
		errorMessage.value = err?.message ?? 'Failed to load account standing.';
	} finally {
		loading.value = false;
	}
}

onMounted(() => {
	void fetchAccountHealth();
});

definePage(() => ({
	title: 'Account Standing',
	icon: 'ti ti-shield-lock',
}));
</script>

<style lang="scss" scoped>
.tabs {
	display: flex;
	gap: 8px;
}

.loading {
	opacity: 0.8;
}

.statusPanel {
	padding: 24px 20px;
	text-align: center;
}

.avatar {
	width: 72px;
	height: 72px;
	margin: 0 auto 14px;
}

.title {
	font-size: 1.35rem;
	font-weight: 700;
	margin-bottom: 8px;
}

.description {
	opacity: 0.8;
	margin-bottom: 20px;
}

.meter {
	position: relative;
	padding-top: 4px;
}

.rail {
	position: absolute;
	top: 13px;
	left: 10%;
	right: 10%;
	height: 2px;
	background: var(--MI_THEME-divider);
}

.steps {
	display: flex;
	justify-content: space-between;
	gap: 6px;
}

.step {
	position: relative;
	width: 20%;
	text-align: center;
}

.dot {
	position: relative;
	margin: 0 auto;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: var(--MI_THEME-divider);
	border: 2px solid var(--MI_THEME-panel);
}

.dot.active {
	background: var(--MI_THEME-success);
}

.label {
	margin-top: 8px;
	font-size: 0.8rem;
	opacity: 0.75;
}

.label.active {
	opacity: 1;
	font-weight: 700;
}

.section {
	padding: 14px;
}

.sectionHeader {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 10px;
}

.icon {
	font-size: 1.1rem;
}

.sectionTitle {
	font-weight: 700;
}

.sectionCaption {
	font-size: 0.85rem;
	opacity: 0.75;
}

.empty {
	opacity: 0.75;
	padding: 8px 2px;
}

.violationCard {
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 10px;
	padding: 10px;
	margin-top: 8px;
}

.meta {
	font-size: 0.82rem;
	opacity: 0.75;
	margin-bottom: 4px;
}

.summary {
	word-break: break-word;
}
</style>
