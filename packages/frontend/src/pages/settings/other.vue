<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/other" :label="i18n.ts.other" :keywords="['other']" icon="ti ti-dots">
	<div class="_gaps_m">
		<!--
		<MkSwitch v-model="$i.injectFeaturedNote" @update:model-value="onChangeInjectFeaturedNote">
			<template #label>{{ i18n.ts.showFeaturedNotesInTimeline }}</template>
		</MkSwitch>
		-->

		<!--
		<MkSwitch v-model="reportError">{{ i18n.ts.sendErrorReports }}<template #caption>{{ i18n.ts.sendErrorReportsDescription }}</template></MkSwitch>
		-->

		<div class="_gaps_s">
			<SearchMarker :keywords="['account', 'info']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-info-circle"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.accountInfo }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkKeyValue>
							<template #key>ID</template>
							<template #value><span class="_monospace">{{ $i.id }}</span></template>
						</MkKeyValue>

						<MkKeyValue>
							<template #key>{{ i18n.ts.registeredDate }}</template>
							<template #value><MkTime :time="$i.createdAt" mode="detail"/></template>
						</MkKeyValue>

						<SearchMarker :keywords="['role', 'policy']">
							<MkFolder>
								<template #icon><i class="ti ti-badges"></i></template>
								<template #label><SearchLabel>{{ i18n.ts._role.policies }}</SearchLabel></template>

								<div class="_gaps_s">
									<div v-for="policy in Object.keys($i.policies)" :key="policy">
										{{ policy }} ... {{ $i.policies[policy] }}
									</div>
								</div>
							</MkFolder>
						</SearchMarker>

						<SearchMarker :keywords="['account', 'health', 'moderation', 'status']">
							<MkFolder>
								<template #icon><i class="ti ti-shield-check"></i></template>
								<template #label><SearchLabel>アカウント健全性ステータス</SearchLabel></template>

								<div class="_gaps_s">
									<MkInfo>この情報はあなた本人と管理者・モデレーターのみ閲覧できます。</MkInfo>
									<MkInfo v-if="accountHealthError" warn>{{ accountHealthError }}</MkInfo>

									<div v-if="accountHealthLoading">読み込み中...</div>

									<template v-else-if="accountHealth">
										<MkKeyValue oneline>
											<template #key>制限状態</template>
											<template #value>{{ accountHealth.isRestricted ? '制限中' : '制限なし' }}</template>
										</MkKeyValue>

										<div class="_gaps_s">
											<div>凍結: {{ accountHealth.statuses.isSuspended ? '有効' : 'なし' }}</div>
											<div>サイレンス: {{ accountHealth.statuses.isSilenced ? '有効' : 'なし' }}</div>
											<div>ノート一時停止: {{ accountHealth.statuses.isTemporaryNoteRestricted ? '有効' : 'なし' }}</div>
											<div v-if="accountHealth.statuses.temporaryNoteRestrictionExpiresAt">
												ノート一時停止期限: <MkTime :time="accountHealth.statuses.temporaryNoteRestrictionExpiresAt" mode="detail"/>
											</div>
										</div>

										<MkFolder :defaultOpen="true">
											<template #label>モデレーション履歴（最新{{ accountHealth.history.length }}件）</template>
											<div class="_gaps_s">
												<div v-if="accountHealth.history.length === 0">履歴はありません。</div>
												<div v-for="item in accountHealth.history" :key="item.id" class="_panel" style="padding: 12px;">
													<div><MkTime :time="item.createdAt" mode="detail"/> / {{ item.summary }}</div>
													<div style="opacity: 0.8; font-size: 0.9em;">実施者: @{{ item.moderator.username }}</div>
												</div>
											</div>
										</MkFolder>
									</template>
								</div>
							</MkFolder>
						</SearchMarker>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['roles']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-badges"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.rolesAssignedToMe }}</SearchLabel></template>

					<div class="_gaps_s">
						<MkRolePreview v-for="role in $i.roles" :key="role.id" :role="role" :forModeration="false"/>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['account', 'move', 'migration']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-plane"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.accountMigration }}</SearchLabel></template>

					<XMigration/>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['account', 'close', 'delete']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-alert-triangle"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.closeAccount }}</SearchLabel></template>

					<div class="_gaps_m">
						<FormInfo warn>{{ i18n.ts._accountDelete.mayTakeTime }}</FormInfo>
						<FormInfo>{{ i18n.ts._accountDelete.sendEmail }}</FormInfo>
						<MkButton v-if="!$i.isDeleted" danger @click="deleteAccount"><SearchText>{{ i18n.ts._accountDelete.requestAccountDelete }}</SearchText></MkButton>
						<MkButton v-else disabled>{{ i18n.ts._accountDelete.inProgress }}</MkButton>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['experimental', 'feature', 'flags']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-flask"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.experimentalFeatures }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkSwitch v-model="enableCondensedLine">
							<template #label>Enable condensed line</template>
						</MkSwitch>
						<MkSwitch v-model="skipNoteRender">
							<template #label>Enable note render skipping</template>
						</MkSwitch>
						<MkSwitch v-model="stackingRouterView">
							<template #label>Enable stacking router view</template>
						</MkSwitch>
						<MkSwitch v-model="enableFolderPageView">
							<template #label>Enable folder page view</template>
						</MkSwitch>
						<MkSwitch v-model="enableHapticFeedback">
							<template #label>Enable haptic feedback</template>
						</MkSwitch>
						<MkSwitch v-model="enableWebTranslatorApi">
							<template #label>Enable in-browser translator API</template>
						</MkSwitch>
					</div>
				</MkFolder>
			</SearchMarker>

			<SearchMarker :keywords="['developer', 'mode', 'debug']">
				<MkFolder>
					<template #icon><SearchIcon><i class="ti ti-code"></i></SearchIcon></template>
					<template #label><SearchLabel>{{ i18n.ts.developer }}</SearchLabel></template>

					<div class="_gaps_m">
						<MkSwitch v-model="devMode">
							<template #label>{{ i18n.ts.devMode }}</template>
						</MkSwitch>
					</div>
				</MkFolder>
			</SearchMarker>
		</div>

		<hr>

		<FormLink to="/registry"><template #icon><i class="ti ti-adjustments"></i></template>{{ i18n.ts.registry }}</FormLink>

		<hr>

		<MkButton @click="resetAllTips"><i class="ti ti-bulb"></i> {{ i18n.ts.redisplayAllTips }}</MkButton>
		<MkButton @click="hideAllTips"><i class="ti ti-bulb-off"></i> {{ i18n.ts.hideAllTips }}</MkButton>

		<hr>

		<template v-if="$i.policies.chatAvailability !== 'unavailable'">
			<MkButton @click="readAllChatMessages">{{ i18n.ts.readAllChatMessages }}</MkButton>

			<hr>
		</template>

		<MkButton v-if="!storagePersisted" @click="enableStoragePersistence">{{ i18n.ts._settings.settingsPersistence_title }}</MkButton>

		<MkButton @click="forceCloudBackup">{{ i18n.ts._preferencesBackup.forceBackup }}</MkButton>

		<FormSlot>
			<MkButton danger @click="migrate"><i class="ti ti-refresh"></i> {{ i18n.ts.migrateOldSettings }}</MkButton>
			<template #caption>{{ i18n.ts.migrateOldSettings_description }}</template>
		</FormSlot>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import XMigration from './migration.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormLink from '@/components/form/link.vue';
import MkFolder from '@/components/MkFolder.vue';
import FormInfo from '@/components/MkInfo.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkButton from '@/components/MkButton.vue';
import FormSlot from '@/components/form/slot.vue';
import * as os from '@/os.js';
import { enableStoragePersistence, storagePersisted, skipStoragePersistence } from '@/utility/storage.js';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import FormSection from '@/components/form/section.vue';
import { prefer } from '@/preferences.js';
import MkRolePreview from '@/components/MkRolePreview.vue';
import { signout } from '@/signout.js';
import { migrateOldSettings } from '@/pref-migrate.js';
import { hideAllTips as _hideAllTips, resetAllTips as _resetAllTips } from '@/tips.js';
import { suggestReload } from '@/utility/reload-suggest.js';
import { cloudBackup } from '@/preferences/utility.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const $i = ensureSignin();

const reportError = prefer.model('reportError');
const enableCondensedLine = prefer.model('enableCondensedLine');
const skipNoteRender = prefer.model('skipNoteRender');
const devMode = prefer.model('devMode');
const stackingRouterView = prefer.model('experimental.stackingRouterView');
const enableFolderPageView = prefer.model('experimental.enableFolderPageView');
const enableHapticFeedback = prefer.model('experimental.enableHapticFeedback');
const enableWebTranslatorApi = prefer.model('experimental.enableWebTranslatorApi');
const accountHealthLoading = ref(true);
const accountHealthError = ref<string | null>(null);
const accountHealth = ref<{
	isRestricted: boolean;
	statuses: {
		isSuspended: boolean;
		isSilenced: boolean;
		isTemporaryNoteRestricted: boolean;
		temporaryNoteRestrictionExpiresAt: string | null;
	};
	history: Array<{
		id: string;
		createdAt: string;
		summary: string;
		moderator: {
			username: string;
		};
	}>;
} | null>(null);

watch(skipNoteRender, () => {
	suggestReload();
});

async function deleteAccount() {
	{
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.deleteAccountConfirm,
		});
		if (canceled) return;
	}

	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	await os.apiWithDialog('i/delete-account', {
		password: auth.result.password,
		token: auth.result.token,
	});

	await os.alert({
		title: i18n.ts._accountDelete.started,
	});

	await signout();
}

function migrate() {
	migrateOldSettings();
}

function resetAllTips() {
	_resetAllTips();
	os.success();
}

function hideAllTips() {
	_hideAllTips();
	os.success();
}

function readAllChatMessages() {
	os.apiWithDialog('chat/read-all', {});
}

async function forceCloudBackup() {
	await cloudBackup();
	os.success();
}

async function fetchAccountHealth() {
	accountHealthLoading.value = true;
	accountHealthError.value = null;

	try {
		accountHealth.value = await misskeyApi('i/account-health' as any, {});
	} catch (err) {
		accountHealthError.value = err?.message ?? '取得に失敗しました。';
	} finally {
		accountHealthLoading.value = false;
	}
}

onMounted(() => {
	void fetchAccountHealth();
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-dots',
}));
</script>
