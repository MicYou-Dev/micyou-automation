import { Context } from "probot";

/**
 * MicYou Label ID Constants — auto-generated for LanRhyme/MicYou.
 * Run `gh api repos/LanRhyme/MicYou/labels?per_page=100 --jq '.[] | "\(.name): \(.id)"'`
 * to verify or refresh these IDs.
 */

export const Labels = {
	// ── Process Labels (workflow states) ────────────────────────────
	/** 正在处理 */ processing: 10942109735,
	/** 正在复核 */ reviewing: 10942112055,
	/** 等待合并 */ waitmerge: 10942112227,
	/** 完成 */ done: 10942112367,

	isProcessLabel: (number: number) =>
		number === Labels.processing ||
		number === Labels.reviewing ||
		number === Labels.waitmerge,
	isDoneLabel: (number: number) => number === Labels.done,
	isPositiveLabel: (number: number) =>
		Labels.isProcessLabel(number) || Labels.isDoneLabel(number),

	// ── Negative Labels (close reasons) ─────────────────────────────
	/** 重复 */ duplicate: 10175506682,
	/** 不予修复 */ wontfix: 10175506712,
	/** 无效 */ invalid: 10175506703,
	/** 暂无计划 */ notPlanned: 10942112473,

	isDuplicateLabel: (number: number) => number === Labels.duplicate,
	isNotPlannedLabel: (number: number) =>
		number === Labels.wontfix ||
		number === Labels.invalid ||
		number === Labels.notPlanned,

	// ── Needing Labels (require action from reporter) ───────────────
	/** 需要信息 */ needInfo: 10942112604,
	/** 需要复现 */ needReproduce: 10942115301,

	isNeedingLabel: (number: number) =>
		number === Labels.needInfo || number === Labels.needReproduce,
	isNegativeLabel: (number: number) =>
		Labels.isNotPlannedLabel(number) ||
		Labels.isDuplicateLabel(number) ||
		Labels.isNeedingLabel(number),

	// ── Markup Labels (never auto-removed) ──────────────────────────
	/** 破坏性变更 */ breaking: 10942115448,
	/** 高质量 */ highQuality: 10942115570,

	isMarkupLabel: (number: number) =>
		number === Labels.breaking || number === Labels.highQuality,
	isMarkupLabelOrSelf: (number: number, self: number) =>
		number === self || Labels.isMarkupLabel(number),

	// ── Size Labels (mutually exclusive, for PRs) ──────────────────
	size_xs: 10942115655, // <10 changes
	size_s: 10942115747, // 10–29
	size_m: 10942115872, // 30–99
	size_l: 10942117971, // 100–499
	size_xl: 10942118132, // 500–999
	size_xxl: 10942118246, // 1000+

	isSizeLabel: (number: number) =>
		number === Labels.size_xs ||
		number === Labels.size_s ||
		number === Labels.size_m ||
		number === Labels.size_l ||
		number === Labels.size_xl ||
		number === Labels.size_xxl,
};

declare module "probot" {
	interface Context {
		label: (...ids: number[]) => Promise<string[]>;
	}
}

Context.prototype.label = async function (
	this: Context,
	...ids: number[]
): Promise<string[]> {
	const repoLabels = await this.octokit.rest.issues.listLabelsForRepo(
		this.repo({ per_page: 100 }),
	);
	const names: string[] = [];
	for (const label of repoLabels.data) {
		if (ids.includes(label.id)) {
			names.push(label.name);
			if (names.length === ids.length) break;
		}
	}
	return names;
};
