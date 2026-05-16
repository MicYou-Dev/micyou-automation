import type { Context } from "probot";
import { Labels } from "../values.js";

/** MicYou YAML template required checkbox texts — must be checked, else spam */
const REQUIRED_CHECKBOX_TEXTS = [
	// 简体中文
	"我已经确认使用的是最新版本",
	"我已经搜索过已有问题，没有发现重复",
	"我已搜索现有 Issues，确认没有重复的建议",
	"我使用的是最新版本，但此功能尚未实现",
	// 繁體中文
	"我已經確認使用的是最新版本",
	"我已經搜尋過已有問題，沒有發現重複",
	// English
	"I confirm I am using the latest version",
	"I have searched existing issues and found no duplicates",
];

/**
 * Severity → priority label mapping.
 * Covers all three template languages (zh-CN / zh-TW / en).
 */
const SEVERITY_LABEL_MAP: Record<string, number> = {
	// 简体中文
	"阻塞 - 完全无法使用": Labels.p_critical,
	"严重 - 主要功能受损": Labels.p_high,
	"轻微 - 细微问题，不影响主要功能": Labels.p_low,
	// 繁體中文
	"阻塞 - 完全無法使用": Labels.p_critical,
	"嚴重 - 主要功能受損": Labels.p_high,
	"輕微 - 細微問題，不影響主要功能": Labels.p_low,
	// 简体/繁體共用
	"一般 - 功能可用但有缺陷": Labels.p_medium,
	// English
	"Blocking - Completely unusable": Labels.p_critical,
	"Critical - Major functionality broken": Labels.p_high,
	"Moderate - Functionality works but with flaws": Labels.p_medium,
	"Minor - Minor issue, does not affect core functionality": Labels.p_low,
};

/** Section headers for the severity dropdown in each language */
const SEVERITY_HEADERS = ["### 严重程度", "### 嚴重程度", "### Severity"];

function extractSeverity(body: string): string | null {
	for (const header of SEVERITY_HEADERS) {
		const idx = body.indexOf(header);
		if (idx === -1) continue;
		const after = body.slice(idx + header.length);
		const lineStart = after.indexOf("\n");
		if (lineStart === -1) continue;
		// skip blank lines
		let pos = lineStart + 1;
		while (pos < after.length && after[pos] === "\n") pos++;
		const lineEnd = after.indexOf("\n", pos);
		const line = after.slice(pos, lineEnd === -1 ? after.length : lineEnd).trim();
		if (line) return line;
	}
	return null;
}

export default async function (context: Context<"issues.opened">) {
	const issue = context.payload.issue;
	console.info(
		`#${issue.number} opened: ${issue.title} [${issue.user?.login}]`,
	);
	const body = issue.body;
	if (!body) return;

	// ── Rubbish killer — detect unchecked required template checkboxes ──
	const hasUnchecked = REQUIRED_CHECKBOX_TEXTS.some(
		(text) =>
			body.includes(`- [ ] ${text}`) || body.includes(`- [ ]\r${text}`),
	);
	if (hasUnchecked) {
		console.info(
			"Rubbish killer triggered: unchecked required template checkbox",
		);
		const issues = context.octokit.rest.issues;
		await issues.update(
			context.issue({ state: "closed", state_reason: "not_planned" }),
		);
		await issues.createComment(
			context.issue({
				body: "此 issue 未确认模板中的必要事项，已自动关闭。请重新提交并确保勾选所有必选项。",
			}),
		);
		return;
	}

	// ── Severity → priority label ──
	const severity = extractSeverity(body);
	if (severity) {
		const labelId = SEVERITY_LABEL_MAP[severity];
		if (labelId) {
			const labelNames = await context.label(labelId);
			if (labelNames.length > 0) {
				console.info(
					`Setting priority label "${labelNames[0]}" for severity "${severity}"`,
				);
				await context.octokit.rest.issues.addLabels(
					context.issue({ labels: labelNames }),
				);
			}
		}
	}
}
