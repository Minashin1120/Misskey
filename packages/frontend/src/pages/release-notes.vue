<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 720px;">
		<div class="_gaps">
			<MkInfo>{{ i18n.ts.whatIsNew }}</MkInfo>
			<section v-for="item in releaseNotes" :key="item.version" class="_panel" :class="$style.noteItem">
				<div :class="$style.row">
					<div :class="$style.main">
						<div :class="$style.version">v{{ item.version }}</div>
						<div v-if="item.title" :class="$style.title">{{ item.title }}</div>
						<div v-if="item.date" :class="$style.date">{{ item.date }}</div>
					</div>
					<MkButton @click="openReleaseNote(item.version)">
						<i class="ti ti-external-link"></i> {{ i18n.ts.learnMore }}
					</MkButton>
				</div>
			</section>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { compareVersions } from 'compare-versions';
import { version } from '@@/js/config.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

type ReleaseNote = {
	version: string;
	date?: string;
	title?: string;
};

const remoteReleaseNotes = ref<ReleaseNote[]>([]);

const releaseNotes = computed(() => {
	const merged = new Map<string, ReleaseNote>();
	merged.set(version, { version, title: i18n.ts.currentVersion });

	for (const item of remoteReleaseNotes.value) {
		if (!item.version) continue;
		const existing = merged.get(item.version);
		merged.set(item.version, {
			version: item.version,
			date: item.date ?? existing?.date,
			title: item.title ?? existing?.title,
		});
	}

	return [...merged.values()].sort((a, b) => {
		try {
			return compareVersions(b.version, a.version);
		} catch {
			return b.version.localeCompare(a.version);
		}
	});
});

function openReleaseNote(targetVersion: string) {
	window.location.href = `/release-note/${encodeURIComponent(targetVersion)}`;
}

onMounted(async () => {
	try {
		const res = await window.fetch('/release-note/index.json', { cache: 'no-store' });
		if (!res.ok) return;
		const data = await res.json();
		if (!Array.isArray(data)) return;

		remoteReleaseNotes.value = data
			.filter((item): item is ReleaseNote => typeof item?.version === 'string')
			.map(item => ({
				version: item.version,
				date: typeof item.date === 'string' ? item.date : undefined,
				title: typeof item.title === 'string' ? item.title : undefined,
			}));
	} catch {
		// ignore
	}
});

definePage(() => ({
	title: i18n.ts.whatIsNew,
	icon: 'ti ti-notebook',
}));
</script>

<style lang="scss" module>
.noteItem {
	padding: 16px;
}

.row {
	display: flex;
	gap: 12px;
	align-items: center;
	justify-content: space-between;
}

.main {
	min-width: 0;
}

.version {
	font-size: 1rem;
	font-weight: 700;
	word-break: break-all;
}

.title {
	margin-top: 4px;
	font-size: 0.95rem;
}

.date {
	margin-top: 4px;
	font-size: 0.85rem;
	opacity: 0.8;
}
</style>
