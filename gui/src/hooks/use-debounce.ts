import { useCallback, useEffect, useRef, useState } from "react";

export function useDebounce(
	source: string,
	onCommit: (value: string) => void,
	delay = 350,
): [draft: string, setDraft: (value: string) => void] {
	const [draft, setDraftState] = useState(source);
	const timer = useRef<number | undefined>(undefined);
	const commitRef = useRef(onCommit);
	commitRef.current = onCommit;

	useEffect(() => {
		window.clearTimeout(timer.current);
		setDraftState(source);
	}, [source]);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const setDraft = useCallback(
		(value: string) => {
			setDraftState(value);
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => commitRef.current(value), delay);
		},
		[delay],
	);

	return [draft, setDraft];
}
