import type * as Misskey from 'misskey-js';

const blockedMessage = 'このサーバーでこのコンテンツを閲覧することはできません。';
const sourcePrefix = '元の投稿:';

export type RemoteSensitivePlaceholder = {
	message: string;
	sourceUrl: string;
};

export function getRemoteSensitivePlaceholder(note: Misskey.entities.Note): RemoteSensitivePlaceholder | null {
	if (note.user.host == null || note.text == null) return null;

	const lines = note.text
		.split('\n')
		.map(line => line.trim())
		.filter(line => line.length > 0);

	if (lines.length !== 2) return null;
	if (lines[0] !== blockedMessage) return null;
	if (!lines[1].startsWith(sourcePrefix)) return null;

	const sourceUrl = lines[1].slice(sourcePrefix.length).trim();
	if (!/^https?:\/\/\S+$/i.test(sourceUrl)) return null;

	return {
		message: lines[0],
		sourceUrl,
	};
}
