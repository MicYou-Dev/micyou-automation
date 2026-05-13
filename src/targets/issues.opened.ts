import type { Context } from "probot";

/** MicYou YAML template required checkbox texts — must be checked, else spam */
const REQUIRED_CHECKBOX_TEXTS = [
	"我已经确认使用的是最新版本",
	"我已经搜索过已有问题，没有发现重复",
	"我已搜索现有 Issues，确认没有重复的建议",
	"我使用的是最新版本，但此功能尚未实现",
];

export default async function (context: Context<"issues.opened">) {
	const issue = context.payload.issue;
	console.info(
		`#${issue.number} opened: ${issue.title} [${issue.user?.login}]`,
	);
	// rubbish killer — detect unchecked required template checkboxes
	const body = issue.body;
	if (body) {
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
				context.issue({
					state: "closed",
					state_reason: "not_planned",
				}),
			);
			await issues.createComment(
				context.issue({
					body: "此 issue 未确认模板中的必要事项，已自动关闭。请重新提交并确保勾选所有必选项。",
				}),
			);
		}
	}
}
