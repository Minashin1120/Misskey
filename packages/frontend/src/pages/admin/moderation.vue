<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/moderation" :label="i18n.ts.moderation" :keywords="['moderation']" icon="ti ti-shield" :inlining="['serverRules']">
			<div class="_gaps_m">
				<SearchMarker :keywords="['open', 'registration']">
					<MkSwitch :modelValue="enableRegistration" @update:modelValue="onChange_enableRegistration">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.openRegistration }}</SearchLabel></template>
						<template #caption>
						<div><SearchText>{{ i18n.ts._serverSettings.thisSettingWillAutomaticallyOffWhenModeratorsInactive }}</SearchText></div>
						<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> <SearchText>{{ i18n.ts._serverSettings.openRegistrationWarning }}</SearchText></div>
						</template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['email', 'required', 'signup']">
					<MkSwitch v-model="emailRequiredForSignup" @change="onChange_emailRequiredForSignup">
						<template #label><SearchLabel>{{ i18n.ts.emailRequiredForSignup }}</SearchLabel> ({{ i18n.ts.recommended }})</template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['account', 'application', 'signup', 'request']">
					<MkSwitch v-model="accountApplicationsEnabled" @change="onChange_accountApplicationsEnabled">
						<template #label><SearchLabel>アカウント申請を受け付ける</SearchLabel></template>
						<template #caption><SearchText>新規登録停止中でも、未ログイン画面からアカウント申請フォームを送信できるようにします。</SearchText></template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['account', 'applications', 'manage', 'requests']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-user-question"></i></SearchIcon></template>
						<template #label><SearchLabel>アカウント申請一覧</SearchLabel></template>

						<div class="_gaps">
							<MkSelect v-model="accountApplicationsState" :items="accountApplicationsStateDef" @update:modelValue="loadAccountApplications">
								<template #label><SearchLabel>表示状態</SearchLabel></template>
							</MkSelect>

							<MkButton @click="loadAccountApplications">再読み込み</MkButton>

							<div v-if="accountApplicationsLoading" class="_fullinfo">読み込み中...</div>
							<div v-else-if="accountApplications.length === 0" class="_fullinfo">申請はありません。</div>

							<template v-else>
								<div v-for="app in accountApplications" :key="app.id" class="_gaps_s _card">
									<div><b>希望ユーザー名:</b> <code>{{ app.desiredUsername }}</code></div>
									<div><b>連絡先:</b> {{ app.contact }}</div>
									<div><b>状態:</b> {{ app.status }}</div>
									<div><b>申請日時:</b> {{ formatAccountApplicationDate(app.createdAt) }}</div>
									<div v-if="app.reviewedAt"><b>審査日時:</b> {{ formatAccountApplicationDate(app.reviewedAt) }}</div>
									<div v-if="app.requestIp"><b>IP:</b> <code>{{ app.requestIp }}</code></div>
									<div class="_fullinfo" style="white-space: pre-wrap;">{{ app.message }}</div>

									<MkTextarea v-model="app.adminMemoDraft">
										<template #label>管理メモ</template>
									</MkTextarea>

									<div class="_buttons">
										<MkButton @click="saveAccountApplicationMemo(app)">メモ保存</MkButton>
										<MkButton primary @click="setAccountApplicationStatus(app, 'approved')">承認</MkButton>
										<MkButton danger @click="setAccountApplicationStatus(app, 'rejected')">却下</MkButton>
										<MkButton @click="setAccountApplicationStatus(app, 'pending')">保留に戻す</MkButton>
									</div>
								</div>
							</template>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['sensitive', 'remote', 'block']">
					<MkSwitch v-model="blockRemoteSensitiveNotes" @change="onChange_blockRemoteSensitiveNotes">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.blockRemoteSensitiveNotes }}</SearchLabel></template>
						<template #caption><SearchText>{{ i18n.ts._serverSettings.blockRemoteSensitiveNotesDescription }}</SearchText></template>
					</MkSwitch>
				</SearchMarker>
				<SearchMarker :keywords="['sensitive', 'remote', 'block', 'placeholder', 'link']">
					<MkSwitch v-model="blockRemoteSensitiveNotesShowPlaceholder" @change="onChange_blockRemoteSensitiveNotesShowPlaceholder">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.blockRemoteSensitiveNotesShowPlaceholder }}</SearchLabel></template>
						<template #caption><SearchText>{{ i18n.ts._serverSettings.blockRemoteSensitiveNotesShowPlaceholderDescription }}</SearchText></template>
					</MkSwitch>
				</SearchMarker>

				<SearchMarker :keywords="['ugc', 'content', 'visibility', 'visitor', 'guest']">
					<MkSelect v-model="ugcVisibilityForVisitor" :items="ugcVisibilityForVisitorDef" @update:modelValue="onChange_ugcVisibilityForVisitor">
						<template #label><SearchLabel>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor }}</SearchLabel></template>
						<template #caption>
						<div><SearchText>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor_description }}</SearchText></div>
						<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> <SearchText>{{ i18n.ts._serverSettings.userGeneratedContentsVisibilityForVisitor_description2 }}</SearchText></div>
						</template>
					</MkSelect>
				</SearchMarker>

				<XServerRules/>

				<SearchMarker :keywords="['ai', 'gemini', 'moderation', 'rules']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-sparkles"></i></SearchIcon></template>
						<template #label><SearchLabel>AIルールモデレーション（Gemini）</SearchLabel></template>

						<div class="_gaps">
						<MkSwitch :modelValue="aiModerationEnabled" @update:modelValue="onChange_aiModerationEnabled">
						<template #label><SearchLabel>定期ルールスキャンを有効にする</SearchLabel></template>
						<template #caption>Geminiで新規投稿を定期チェックし、違反候補を通報として送信します。</template>
						</MkSwitch>

												<MkSelect v-model="aiModerationGeminiModel" :items="aiModerationGeminiModelDef" @update:modelValue="onChange_aiModerationGeminiModel">
												<template #label><SearchLabel>使用するモデル</SearchLabel></template>
												<template #caption>AIスキャンに使用するGeminiモデルを選択します。</template>
												</MkSelect>

						<MkSelect v-model="aiModerationViolationAction" :items="aiModerationViolationActionDef" @update:modelValue="onChange_aiModerationViolationAction">
						<template #label><SearchLabel>違反時の自動対応</SearchLabel></template>
						<template #caption>違反候補を検知した投稿への初動対応を選択します。</template>
						</MkSelect>

						<MkInput v-model="aiModerationGeminiApiKey" type="password" autocomplete="off">
						<template #label>Gemini APIキー</template>
						<template #caption>Google AI StudioのAPIキー。空にするとAPIリクエストは停止します。</template>
						</MkInput>

						<MkButton primary @click="save_aiModerationGeminiApiKey">{{ i18n.ts.save }}</MkButton>
						<MkButton :disabled="aiModerationManualScanRunning" @click="run_aiModerationGeminiScanNow">
						{{ aiModerationManualScanRunning ? 'スキャンを実行中...' : '今すぐスキャンを実行' }}
						</MkButton>
						<MkButton v-if="aiModerationManualScanRunning && aiModerationManualScanJobId" danger @click="cancel_aiModerationGeminiScanNow">
						スキャンをキャンセル
						</MkButton>

						<div v-if="aiModerationLastCheckedNoteId" class="_fullinfo">
						 最終チェック済みノートID: <code>{{ aiModerationLastCheckedNoteId }}</code>
						</div>
						<div v-if="aiModerationManualScanStatus" class="_fullinfo">
						 手動スキャン状態: {{ aiModerationManualScanStatus }}
						</div>
						<div v-if="aiModerationManualScanJobId" class="_fullinfo">
						 手動スキャンJob ID: <code>{{ aiModerationManualScanJobId }}</code>
						</div>
						<div v-if="aiModerationManualScanLogs.length > 0" class="_fullinfo">
						 <div>手動スキャンログ:</div>
						 <pre>{{ aiModerationManualScanLogs.join('\n') }}</pre>
						</div>

						<div class="_fullinfo">
						 検出された違反候補は通報として届きます。確認と対応は <MkA class="_link" to="/admin/abuses">{{ i18n.ts.abuseReports }}</MkA>
						</div>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['preserved', 'usernames']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-lock-star"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.preservedUsernames }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="preservedUsernames">
						<template #caption>{{ i18n.ts.preservedUsernamesDescription }}</template>
						</MkTextarea>
						<MkButton primary @click="save_preservedUsernames">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['sensitive', 'words']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-message-exclamation"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.sensitiveWords }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="sensitiveWords">
						<template #caption>{{ i18n.ts.sensitiveWordsDescription }}<br>{{ i18n.ts.sensitiveWordsDescription2 }}</template>
						</MkTextarea>
						<MkButton primary @click="save_sensitiveWords">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['prohibited', 'words']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-message-x"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.prohibitedWords }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="prohibitedWords">
						<template #caption>{{ i18n.ts.prohibitedWordsDescription }}<br>{{ i18n.ts.prohibitedWordsDescription2 }}</template>
						</MkTextarea>
						<MkButton primary @click="save_prohibitedWords">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['prohibited', 'name', 'user']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-user-x"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.prohibitedWordsForNameOfUser }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="prohibitedWordsForNameOfUser">
						<template #caption>{{ i18n.ts.prohibitedWordsForNameOfUserDescription }}<br>{{ i18n.ts.prohibitedWordsDescription2 }}</template>
						</MkTextarea>
						<MkButton primary @click="save_prohibitedWordsForNameOfUser">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['hidden', 'tags', 'hashtags']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.hiddenTags }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="hiddenTags">
						<template #caption>{{ i18n.ts.hiddenTagsDescription }}</template>
						</MkTextarea>
						<MkButton primary @click="save_hiddenTags">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['silenced', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.silencedInstances }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="silencedHosts">
						<template #caption>{{ i18n.ts.silencedInstancesDescription }}</template>
						</MkTextarea>
						<MkButton primary @click="save_silencedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['media', 'silenced', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-eye-off"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.mediaSilencedInstances }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="mediaSilencedHosts">
						<template #caption>{{ i18n.ts.mediaSilencedInstancesDescription }}</template>
						</MkTextarea>
						<MkButton primary @click="save_mediaSilencedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>

				<SearchMarker :keywords="['blocked', 'servers', 'hosts']">
					<MkFolder>
						<template #icon><SearchIcon><i class="ti ti-ban"></i></SearchIcon></template>
						<template #label><SearchLabel>{{ i18n.ts.blockedInstances }}</SearchLabel></template>

						<div class="_gaps">
						<MkTextarea v-model="blockedHosts">
						<template #caption>{{ i18n.ts.blockedInstancesDescription }}</template>
						</MkTextarea>
						<MkButton primary @click="save_blockedHosts">{{ i18n.ts.save }}</MkButton>
						</div>
					</MkFolder>
				</SearchMarker>
			</div>
		</SearchMarker>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import * as Misskey from 'misskey-js';
import XServerRules from './server-rules.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkSelect from '@/components/MkSelect.vue';

const meta = await misskeyApi('admin/meta') as Misskey.Endpoints['admin/meta']['res'] & {
	aiModerationEnabled: boolean;
	aiModerationGeminiApiKey: string | null;
	aiModerationGeminiModel: string;
	aiModerationLastCheckedNoteId: string | null;
	blockRemoteSensitiveNotes: boolean;
	blockRemoteSensitiveNotesShowPlaceholder: boolean;
	accountApplicationsEnabled: boolean;
	aiModerationViolationAction: 'delete' | 'hideFromOthers' | 'homeOnly' | 'flagOnly';
};

const enableRegistration = ref(!meta.disableRegistration);
const emailRequiredForSignup = ref(meta.emailRequiredForSignup);
const accountApplicationsEnabled = ref(!!meta.accountApplicationsEnabled);
const blockRemoteSensitiveNotes = ref(meta.blockRemoteSensitiveNotes);
const blockRemoteSensitiveNotesShowPlaceholder = ref(meta.blockRemoteSensitiveNotesShowPlaceholder);
const {
	model: ugcVisibilityForVisitor,
	def: ugcVisibilityForVisitorDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.all, value: 'all' },
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.localOnly, value: 'local' },
		{ label: i18n.ts._serverSettings._userGeneratedContentsVisibilityForVisitor.none, value: 'none' },
	],
	initialValue: meta.ugcVisibilityForVisitor,
});
const sensitiveWords = ref(meta.sensitiveWords.join('\n'));
const prohibitedWords = ref(meta.prohibitedWords.join('\n'));
const prohibitedWordsForNameOfUser = ref(meta.prohibitedWordsForNameOfUser.join('\n'));
const hiddenTags = ref(meta.hiddenTags.join('\n'));
const preservedUsernames = ref(meta.preservedUsernames.join('\n'));
const blockedHosts = ref(meta.blockedHosts.join('\n'));
const silencedHosts = ref(meta.silencedHosts?.join('\n') ?? '');
const mediaSilencedHosts = ref(meta.mediaSilencedHosts.join('\n'));
const aiModerationEnabled = ref(!!meta.aiModerationEnabled);
const aiModerationGeminiApiKey = ref(meta.aiModerationGeminiApiKey ?? '');
const aiModerationGeminiModel = ref(meta.aiModerationGeminiModel ?? 'gemini-2.5-flash-lite');
const aiModerationGeminiModelDef = [
	{ label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
	{ label: 'Gemini 3.1 Flash-Lite (Preview)', value: 'gemini-3.1-flash-lite-preview' },
] as const;
const aiModerationLastCheckedNoteId = ref(meta.aiModerationLastCheckedNoteId ?? '');
const aiModerationViolationAction = ref(meta.aiModerationViolationAction ?? 'flagOnly');
const aiModerationViolationActionDef = [
	{ label: '投稿を削除', value: 'delete' },
	{ label: '他ユーザーから非表示', value: 'hideFromOthers' },
	{ label: 'ホームタイムラインのみにする', value: 'homeOnly' },
	{ label: 'フラグ付与のみ', value: 'flagOnly' },
] as const;
const aiModerationManualScanRunning = ref(false);
const aiModerationManualScanJobId = ref<string | null>(null);
const aiModerationManualScanStatus = ref('');
const aiModerationManualScanLogs = ref<string[]>([]);
let aiModerationManualScanPollTimer: ReturnType<typeof setTimeout> | null = null;
type AccountApplicationRow = {
	id: string;
	createdAt: string;
	updatedAt: string;
	status: 'pending' | 'approved' | 'rejected';
	desiredUsername: string;
	contact: string;
	message: string;
	adminMemo: string;
	adminMemoDraft: string;
	requestIp: string | null;
	reviewedById: string | null;
	reviewedAt: string | null;
};
const accountApplications = ref<AccountApplicationRow[]>([]);
const accountApplicationsLoading = ref(false);
const accountApplicationsState = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending');
const accountApplicationsStateDef = [
	{ label: '未処理', value: 'pending' },
	{ label: '承認済み', value: 'approved' },
	{ label: '却下済み', value: 'rejected' },
	{ label: 'すべて', value: 'all' },
] as const;

async function onChange_enableRegistration(value: boolean) {
	if (value) {
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.acknowledgeNotesAndEnable,
		});
		if (canceled) return;
	}

	enableRegistration.value = value;

	os.apiWithDialog('admin/update-meta', {
		disableRegistration: !value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_emailRequiredForSignup(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		emailRequiredForSignup: value,
	}).then(() => {
		fetchInstance(true);
	});
}

async function onChange_accountApplicationsEnabled(value: boolean) {
	try {
		await misskeyApi('admin/update-meta', {
			accountApplicationsEnabled: value,
		} as any);
		accountApplicationsEnabled.value = value;
		fetchInstance(true);
	} catch (err) {
		os.alert({
			type: 'error',
			text: err instanceof Error ? err.message : String(err),
		});
		accountApplicationsEnabled.value = !value;
	}
}

function onChange_blockRemoteSensitiveNotes(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		blockRemoteSensitiveNotes: value,
	} as any).then(() => {
		fetchInstance(true);
	});
}

function onChange_blockRemoteSensitiveNotesShowPlaceholder(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		blockRemoteSensitiveNotesShowPlaceholder: value,
	} as any).then(() => {
		fetchInstance(true);
	});
}

function onChange_ugcVisibilityForVisitor(value: typeof ugcVisibilityForVisitor.value) {
	os.apiWithDialog('admin/update-meta', {
		ugcVisibilityForVisitor: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function save_preservedUsernames() {
	os.apiWithDialog('admin/update-meta', {
		preservedUsernames: preservedUsernames.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_sensitiveWords() {
	os.apiWithDialog('admin/update-meta', {
		sensitiveWords: sensitiveWords.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_prohibitedWords() {
	os.apiWithDialog('admin/update-meta', {
		prohibitedWords: prohibitedWords.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_prohibitedWordsForNameOfUser() {
	os.apiWithDialog('admin/update-meta', {
		prohibitedWordsForNameOfUser: prohibitedWordsForNameOfUser.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_hiddenTags() {
	os.apiWithDialog('admin/update-meta', {
		hiddenTags: hiddenTags.value.split('\n'),
	}).then(() => {
		fetchInstance(true);
	});
}

function save_blockedHosts() {
	os.apiWithDialog('admin/update-meta', {
		blockedHosts: blockedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

function save_silencedHosts() {
	os.apiWithDialog('admin/update-meta', {
		silencedHosts: silencedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

function save_mediaSilencedHosts() {
	os.apiWithDialog('admin/update-meta', {
		mediaSilencedHosts: mediaSilencedHosts.value.split('\n') || [],
	}).then(() => {
		fetchInstance(true);
	});
}

function formatAccountApplicationDate(v: string | null): string {
	if (!v) return '-';
	return new Date(v).toLocaleString();
}

async function loadAccountApplications() {
	accountApplicationsLoading.value = true;
	try {
		const rows = await misskeyApi('admin/account-applications/list' as any, {
			limit: 100,
			offset: 0,
			state: accountApplicationsState.value,
		} as any) as Omit<AccountApplicationRow, 'adminMemoDraft'>[];

		accountApplications.value = rows.map(row => ({
			...row,
			adminMemoDraft: row.adminMemo ?? '',
		}));
	} catch (err) {
		os.alert({
			type: 'error',
			text: err instanceof Error ? err.message : String(err),
		});
	} finally {
		accountApplicationsLoading.value = false;
	}
}

async function saveAccountApplicationMemo(app: AccountApplicationRow) {
	const res = await os.apiWithDialog('admin/account-applications/update' as any, {
		id: app.id,
		adminMemo: app.adminMemoDraft,
	} as any) as Partial<AccountApplicationRow>;
	app.adminMemo = res.adminMemo ?? app.adminMemoDraft;
	app.adminMemoDraft = app.adminMemo;
}

async function setAccountApplicationStatus(app: AccountApplicationRow, status: AccountApplicationRow['status']) {
	const res = await os.apiWithDialog('admin/account-applications/update' as any, {
		id: app.id,
		status,
		adminMemo: app.adminMemoDraft,
	} as any) as Partial<AccountApplicationRow>;

	app.status = (res.status as AccountApplicationRow['status']) ?? status;
	app.adminMemo = res.adminMemo ?? app.adminMemoDraft;
	app.adminMemoDraft = app.adminMemo;
	app.reviewedAt = (res.reviewedAt as string | null | undefined) ?? app.reviewedAt;
	app.reviewedById = (res.reviewedById as string | null | undefined) ?? app.reviewedById;
}

function onChange_aiModerationGeminiModel(value: string) {
	os.apiWithDialog('admin/update-meta', {
		aiModerationGeminiModel: value,
	} as any).then(() => {
		aiModerationGeminiModel.value = value;
		fetchInstance(true);
	});
}

function onChange_aiModerationViolationAction(value: 'delete' | 'hideFromOthers' | 'homeOnly' | 'flagOnly') {
	os.apiWithDialog('admin/update-meta', {
		aiModerationViolationAction: value,
	} as Misskey.Endpoints['admin/update-meta']['req'] & {
		aiModerationViolationAction: 'delete' | 'hideFromOthers' | 'homeOnly' | 'flagOnly';
	}).then(() => {
		aiModerationViolationAction.value = value;
		fetchInstance(true);
	});
}

function onChange_aiModerationEnabled(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		aiModerationEnabled: value,
	} as Misskey.Endpoints['admin/update-meta']['req'] & {
		aiModerationEnabled: boolean;
	}).then(() => {
		aiModerationEnabled.value = value;
		fetchInstance(true);
	});
}

function save_aiModerationGeminiApiKey() {
	os.apiWithDialog('admin/update-meta', {
		aiModerationGeminiApiKey: aiModerationGeminiApiKey.value.trim() === '' ? null : aiModerationGeminiApiKey.value,
		aiModerationGeminiModel: aiModerationGeminiModel.value,
	} as any).then(() => {
		fetchInstance(true);
	});
}

function clearAiModerationManualScanPoll() {
	if (aiModerationManualScanPollTimer != null) {
		clearTimeout(aiModerationManualScanPollTimer);
		aiModerationManualScanPollTimer = null;
	}
}

function formatAiModerationScanStatus(progress: Record<string, unknown> | null, fallback: string): string {
	if (!progress) return fallback;
	const total = typeof progress.total === 'number' ? progress.total : null;
	const processed = typeof progress.processed === 'number' ? progress.processed : null;
	const violations = typeof progress.violations === 'number' ? progress.violations : null;
	const status = typeof progress.status === 'string' ? progress.status : null;
	const reason = typeof progress.reason === 'string' ? progress.reason : null;
	const lastNoteId = typeof progress.lastNoteId === 'string' ? progress.lastNoteId : null;

	const parts = [];
	if (status) parts.push(`status=${status}`);
	if (processed != null && total != null) parts.push(`processed=${processed}/${total}`);
	if (violations != null) parts.push(`violations=${violations}`);
	if (lastNoteId) parts.push(`lastNoteId=${lastNoteId}`);
	if (reason) parts.push(`reason=${reason}`);
	return parts.length > 0 ? parts.join(' | ') : fallback;
}

async function pollAiModerationManualScanJob(jobId: string) {
	try {
		const [job, logs] = await Promise.all([
			misskeyApi('admin/queue/show-job', { queue: 'system', jobId } as any),
			misskeyApi('admin/queue/show-job-logs', { queue: 'system', jobId } as any),
		]) as [any, string[]];

		aiModerationManualScanLogs.value = Array.isArray(logs) ? logs.slice(-10) : [];
		const progress = job && typeof job.progress === 'object' && job.progress !== null
			? job.progress as Record<string, unknown>
			: null;
		aiModerationManualScanStatus.value = formatAiModerationScanStatus(progress, '実行中');

		if (typeof job?.finishedOn === 'number') {
			aiModerationManualScanRunning.value = false;
			clearAiModerationManualScanPoll();

			const returnValue = job && typeof job.returnValue === 'object' && job.returnValue !== null
				? job.returnValue as Record<string, unknown>
				: null;
			const completedStatus = formatAiModerationScanStatus(
				returnValue,
				typeof job?.isFailed === 'boolean' && job.isFailed ? '失敗' : '完了',
			);
			aiModerationManualScanStatus.value = completedStatus;
		}
	} catch (error) {
		aiModerationManualScanStatus.value = `状態取得エラー: ${error instanceof Error ? error.message : String(error)}`;
	}

	if (aiModerationManualScanRunning.value && aiModerationManualScanJobId.value === jobId) {
		aiModerationManualScanPollTimer = setTimeout(() => {
			void pollAiModerationManualScanJob(jobId);
		}, 1500);
	}
}

async function run_aiModerationGeminiScanNow() {
	clearAiModerationManualScanPoll();
	aiModerationManualScanRunning.value = true;
	aiModerationManualScanJobId.value = null;
	aiModerationManualScanLogs.value = [];
	aiModerationManualScanStatus.value = 'ジョブを投入しています...';

	try {
		const res = await os.apiWithDialog('admin/update-meta', {
			runAiModerationGeminiScanNow: true,
		} as any) as {
			aiModerationManualScanJobId?: string | null;
		};

		const jobId = res?.aiModerationManualScanJobId ?? null;
		if (!jobId) {
			aiModerationManualScanStatus.value = 'ジョブIDを取得できませんでした。';
			aiModerationManualScanRunning.value = false;
			return;
		}

		aiModerationManualScanJobId.value = jobId;
		aiModerationManualScanStatus.value = `ジョブ開始: ${jobId}`;
		void pollAiModerationManualScanJob(jobId);
	} catch {
		aiModerationManualScanStatus.value = '手動スキャンの開始に失敗しました。';
		aiModerationManualScanRunning.value = false;
	}
}

async function cancel_aiModerationGeminiScanNow() {
	if (!aiModerationManualScanJobId.value) return;

	const jobId = aiModerationManualScanJobId.value;
	const res = await os.apiWithDialog('admin/update-meta', {
		cancelAiModerationGeminiScanJobId: jobId,
	} as any) as {
		aiModerationManualScanCancelStatus?: 'none' | 'removed' | 'cancelRequested' | 'notFound' | 'alreadyFinished';
	};

	switch (res?.aiModerationManualScanCancelStatus) {
		case 'removed':
			aiModerationManualScanRunning.value = false;
			clearAiModerationManualScanPoll();
			aiModerationManualScanStatus.value = '待機中ジョブをキャンセルしました。';
			break;
		case 'cancelRequested':
			aiModerationManualScanStatus.value = 'キャンセル要求を送信しました。停止まで数秒かかる場合があります。';
			break;
		case 'alreadyFinished':
			aiModerationManualScanRunning.value = false;
			clearAiModerationManualScanPoll();
			aiModerationManualScanStatus.value = 'ジョブは既に終了しています。';
			break;
		case 'notFound':
			aiModerationManualScanRunning.value = false;
			clearAiModerationManualScanPoll();
			aiModerationManualScanStatus.value = '対象ジョブが見つかりませんでした。';
			break;
		default:
			aiModerationManualScanStatus.value = 'キャンセル状態を確認できませんでした。';
			break;
	}
}

onBeforeUnmount(() => {
	clearAiModerationManualScanPoll();
});

void loadAccountApplications();

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.moderation,
	icon: 'ti ti-shield',
}));
</script>
