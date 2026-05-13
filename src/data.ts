// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TData = new Map<number, Record<string, unknown>>();
export const TDATA = {
	get: (number: number) => TData.get(number),
	query: (number: number) => {
		if (!TData.has(number)) TData.set(number, {});
		return TData.get(number) ?? {};
	},
};
