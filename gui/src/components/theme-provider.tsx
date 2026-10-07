import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getSystemTheme(): "dark" | "light" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "formless-hands-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(
		() => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
	);

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");
		if (theme === "system") {
			root.classList.add(getSystemTheme());
			return;
		}
		root.classList.add(theme);
	}, [theme]);

	useEffect(() => {
		if (theme !== "system") {
			return;
		}
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			const root = window.document.documentElement;
			root.classList.remove("light", "dark");
			root.classList.add(getSystemTheme());
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "D" || !event.shiftKey) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}
			const resolved = theme === "system" ? getSystemTheme() : theme;
			const next = resolved === "dark" ? "light" : "dark";
			localStorage.setItem(storageKey, next);
			setTheme(next);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [theme, storageKey]);

	const value = {
		theme,
		setTheme: (next: Theme) => {
			localStorage.setItem(storageKey, next);
			setTheme(next);
		},
	};

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};
