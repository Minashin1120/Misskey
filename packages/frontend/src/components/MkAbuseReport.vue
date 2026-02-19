<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkFolder>
	<template #icon>
		<i v-if="report.resolved && report.resolvedAs === 'accept'" class="ti ti-check" style="color: var(--MI_THEME-success)"></i>
		<i v-else-if="report.resolved && report.resolvedAs === 'reject'" class="ti ti-x" style="color: var(--MI_THEME-error)"></i>
		<i v-else-if="report.resolved" class="ti ti-slash"></i>
		<i v-else class="ti ti-exclamation-circle" style="color: var(--MI_THEME-warn)"></i>
	</template>
	<template #label><MkAcct :user="report.targetUser"/> (by <MkAcct :user="report.reporter"/>)</template>
	<template #caption>{{ report.comment }}</template>
	<template #suffix><MkTime :time="report.createdAt"/></template>
	<template #footer>
		<div class="_buttons">
			<template v-if="!report.resolved">
				<MkButton @click="resolve('accept')"><i class="ti ti-check" style="color: var(--MI_THEME-success)"></i> {{ i18n.ts._abuseUserReport.resolve }} ({{ i18n.ts._abuseUserReport.accept }})</MkButton>
				<MkButton @click="resolve('reject')"><i class="ti ti-x" style="color: var(--MI_THEME-error)"></i> {{ i18n.ts._abuseUserReport.resolve }} ({{ i18n.ts._abuseUserReport.reject }})</MkButton>
				<MkButton @click="resolve(null)"><i class="ti ti-slash"></i> {{ i18n.ts._abuseUserReport.resolve }} ({{ i18n.ts.other }})</MkButton>
				<MkButton danger @click="runModerationAction('deleteNote')"><i class="ti ti-trash"></i> ノート削除</MkButton>
				<MkButton danger @click="runModerationAction('suspendUser')"><i class="ti ti-user-off"></i> アカウント凍結</MkButton>
				<MkButton @click="runModerationAction('warn')"><i class="ti ti-alert-triangle"></i> 警告</MkButton>
				<MkButton @click="runModerationAction('restrictNoteTemporarily')"><i class="ti ti-clock-pause"></i> ノート一時停止</MkButton>
			</template>
			<template v-if="report.targetUser.host != null">
				<MkButton :disabled="report.forwarded" primary @click="forward"><i class="ti ti-corner-up-right"></i> {{ i18n.ts._abuseUserReport.forward }}</MkButton>
				<div v-tooltip:dialog="i18n.ts._abuseUserReport.forwardDescription" class="_button _help"><i class="ti ti-help-circle"></i></div>
			</template>
			<button class="_button" style="margin-left: auto; width: 34px;" @click="showMenu"><i class="ti ti-dots"></i></button>
		</div>
	</template>

	<div class="_gaps_s">
		<MkFolder :withSpacer="false">
			<template #icon><MkAvatar :user="report.targetUser" style="width: 18px; height: 18px;"/></template>
			<template #label>{{ i18n.ts.target }}: <MkAcct :user="report.targetUser"/></template>
			<template #suffix>#{{ report.targetUserId.toUpperCase() }}</template>

			<div style="height: 300px; --MI-stickyTop: 0; --MI-stickyBottom: 0;">
				<RouterView :router="targetRouter"/>
			</div>
		</MkFolder>

		<MkFolder :defaultOpen="true">
			<template #icon><i class="ti ti-message-2"></i></template>
			<template #label>{{ i18n.ts.details }}</template>
			<div class="_gaps_s">
				<Mfm :text="report.comment" :linkNavigationBehavior="'window'"/>
			</div>
		</MkFolder>
                <MkFolder v-if="targetNote" :defaultOpen="true">
                        <template #icon><i class="ti ti-message-2"></i></template>
                        <template #label>通報対象のノート</template>
                        <MkNote :note="targetNote" />
                </MkFolder>


		<MkFolder :withSpacer="false">
			<template #icon><MkAvatar :user="report.reporter" style="width: 18px; height: 18px;"/></template>
			<template #label>{{ i18n.ts.reporter }}: <MkAcct :user="report.reporter"/></template>
			<template #suffix>#{{ report.reporterId.toUpperCase() }}</template>

			<div style="height: 300px; --MI-stickyTop: 0; --MI-stickyBottom: 0;">
				<RouterView :router="reporterRouter"/>
			</div>
		</MkFolder>

		<MkFolder :defaultOpen="false">
			<template #icon><i class="ti ti-message-2"></i></template>
			<template #label>{{ i18n.ts.moderationNote }}</template>
			<template #suffix>{{ moderationNote.length > 0 ? '...' : i18n.ts.none }}</template>
			<div class="_gaps_s">
				<MkTextarea v-model="moderationNote" manualSave>
					<template #caption>{{ i18n.ts.moderationNoteDescription }}</template>
				</MkTextarea>
			</div>
		</MkFolder>

		<div v-if="report.assignee">
			{{ i18n.ts.moderator }}:
			<MkAcct :user="report.assignee"/>
		</div>
	</div>
</MkFolder>
</template>

<script lang="ts" setup>
import { computed, provide, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkNote from '@/components/MkNote.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { dateString } from '@/filters/date.js';
import MkFolder from '@/components/MkFolder.vue';
import RouterView from '@/components/global/RouterView.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { createRouter } from '@/router.js';

const props = defineProps<{
	report: Misskey.entities.AdminAbuseUserReportsResponse[number];
}>();

const emit = defineEmits<{
	(ev: 'resolved', reportId: string): void;
}>();

const targetRouter = createRouter(`/admin/user/${props.report.targetUserId}`);
targetRouter.init();

const reporterRouter = createRouter(`/admin/user/${props.report.reporterId}`);
reporterRouter.init();

const extractedNoteIdOrUrl = computed(() => {
	const comment = props.report.comment;
	// Try to find noteId: [id] or noteUrl: [url]
	const idMatch = comment.match(/- noteId: ([a-z0-9]+)/i);
	if (idMatch) return idMatch[1];
	const urlMatch = comment.match(/- noteUrl: (https?:\/\/[^\s]+)/i);
	if (urlMatch) return urlMatch[1];

	// Also try generic URLs
	const genericUrlMatch = comment.match(/https?:\/\/[^\s]+\/notes\/([a-z0-9]+)/i);
	if (genericUrlMatch) return genericUrlMatch[0];

	return null;
});



const targetNote = ref<Misskey.entities.Note | null>(null);

watch(extractedNoteIdOrUrl, async (val) => {
	if (val) {
		const noteId = val.includes('/') ? val.match(/\/notes\/([a-z0-9]+)/i)?.[1] : val;
		if (noteId) {
			misskeyApi('notes/show', { noteId }).then(res => {
				targetNote.value = res;
			}).catch(() => {
				targetNote.value = null;
			});
		}
	} else {
		targetNote.value = null;
	}
}, { immediate: true });

const moderationNote = ref(props.report.moderationNote ?? '');

watch(moderationNote, async () => {
	os.apiWithDialog('admin/update-abuse-user-report', {
		reportId: props.report.id,
		moderationNote: moderationNote.value,
	}).then(() => {
	});
});

function resolve(resolvedAs) {
	os.apiWithDialog('admin/resolve-abuse-user-report', {
		reportId: props.report.id,
		resolvedAs,
	}).then(() => {
		emit('resolved', props.report.id);
	});
}

async function runModerationAction(action: 'warn' | 'deleteNote' | 'suspendUser' | 'restrictNoteTemporarily') {
	let noteIdOrUrl: string | null = null;
	let restrictHours: number | null = null;

	if (action === 'deleteNote') {
		const noteInput = await os.inputText({
			title: '削除対象ノート',
			text: 'ノートIDまたはノートURLを入力してください。',
			minLength: 1,
			default: extractedNoteIdOrUrl.value,
		});
		if (noteInput.canceled) return;
		noteIdOrUrl = noteInput.result;
	}

	if (action === 'restrictNoteTemporarily') {
		const durationInput = await os.inputNumber({
			title: 'ノート一時停止の期間',
			text: '停止時間（時間）を入力してください。',
			default: 24,
		});
		if (durationInput.canceled) return;
		if (durationInput.result <= 0) {
			os.alert({
				type: 'error',
				text: '1以上の時間を指定してください。',
			});
			return;
		}
		restrictHours = Math.floor(durationInput.result);
	}

	const reasonInput = await os.inputText({
		title: 'ユーザーへ通知する理由',
		text: '実行理由を入力してください（空でも可）。入力内容は対象ユーザーへのダイアログに表示されます。',
		default: '',
	});
	if (reasonInput.canceled) return;

	const actionLabel = action === 'warn' ? '警告'
		: action === 'deleteNote' ? 'ノート削除'
			: action === 'suspendUser' ? 'アカウント凍結'
				: 'ノート一時停止';

	const confirmed = await os.confirm({
		type: 'warning',
		text: `「${actionLabel}」を実行し、通報を是認で解決します。よろしいですか？`,
	});
	if (confirmed.canceled) return;

	await os.apiWithDialog('admin/resolve-abuse-user-report-with-action' as any, {
		reportId: props.report.id,
		resolvedAs: 'accept',
		action,
		reason: reasonInput.result,
		noteIdOrUrl,
		restrictHours,
		notifyTarget: true,
	});

	emit('resolved', props.report.id);
}

function forward() {
	os.apiWithDialog('admin/forward-abuse-user-report', {
		reportId: props.report.id,
	}).then(() => {

	});
}

function showMenu(ev: MouseEvent) {
	os.popupMenu([{
		icon: 'ti ti-hash',
		text: 'Copy ID',
		action: () => {
			copyToClipboard(props.report.id);
		},
	}, {
		icon: 'ti ti-json',
		text: 'Copy JSON',
		action: () => {
			copyToClipboard(JSON.stringify(props.report, null, '\t'));
		},
	}], ev.currentTarget ?? ev.target);
}
</script>

<style lang="scss" module>
</style>
