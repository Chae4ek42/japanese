import { useEffect, useState } from "react";
import "./App.css";
import { updateCardStats } from "./lib/trainer";
import {
	bootstrapAppState,
	createDefaultAppState,
	resetStoredState,
	saveAppState,
} from "./lib/storage";
import { NUMBER_HYPERPARAMS, ensureNumberStats } from "./data/numbers";
import { AppHeader } from "./components/AppHeader";
import { HomePage } from "./components/HomePage";
import { KanaTrainer } from "./components/KanaTrainer";
import { NumbersTrainer } from "./components/NumbersTrainer";
import { StatsPage } from "./components/StatsPage";

function App() {
	const [appState, setAppState] = useState(null);
	const [storageReady, setStorageReady] = useState(false);
	const [currentPage, setCurrentPage] = useState("home");

	useEffect(() => {
		let cancelled = false;
		bootstrapAppState().then((state) => {
			if (cancelled) {
				return;
			}
			setAppState(state);
			setStorageReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!storageReady || !appState) {
			return;
		}
		saveAppState(appState);
	}, [appState, storageReady]);

	function patchKanaPreferences(patch) {
		setAppState((prevState) => ({
			...prevState,
			preferences: {
				...prevState.preferences,
				...patch,
			},
		}));
	}

	function patchKanaHyperparam(key, value) {
		setAppState((prevState) => ({
			...prevState,
			preferences: {
				...prevState.preferences,
				hyperparams: {
					...prevState.preferences.hyperparams,
					[key]: value,
				},
			},
		}));
	}

	function updateKanaPractice(recipe) {
		setAppState((prevState) => {
			const slice = {
				preferences: prevState.preferences,
				stats: prevState.stats,
				history: prevState.history,
			};
			const patch = recipe(slice);
			return {
				...prevState,
				...patch,
			};
		});
	}

	function patchNumbersPreferences(patch) {
		setAppState((prevState) => ({
			...prevState,
			numbers: {
				...prevState.numbers,
				preferences: {
					...prevState.numbers.preferences,
					...patch,
				},
			},
		}));
	}

	function updateNumberStats(cardId, outcome, context) {
		setAppState((prevState) => ({
			...prevState,
			numbers: {
				...prevState.numbers,
				stats: {
					...prevState.numbers.stats,
					[cardId]: updateCardStats(
						ensureNumberStats(prevState.numbers.stats, cardId),
						outcome,
						context,
						NUMBER_HYPERPARAMS,
					),
				},
			},
		}));
	}

	async function resetStats() {
		await resetStoredState();
		setAppState(createDefaultAppState());
	}

	if (!appState) {
		return (
			<div className="app-shell app-loading">
				<p>Загрузка прогресса…</p>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<AppHeader
				currentPage={currentPage}
				onNavigate={setCurrentPage}
				onResetStats={resetStats}
			/>

			{currentPage === "home" ? (
				<HomePage
					onOpenKana={() => setCurrentPage("kana")}
					onOpenNumbers={() => setCurrentPage("numbers")}
				/>
			) : currentPage === "stats" ? (
				<StatsPage
					kanaStats={appState.stats}
					kanaHistory={appState.history}
					kanaHyperparams={appState.preferences.hyperparams}
					numbersStats={appState.numbers.stats}
				/>
			) : (
				<main className="trainer-layout">
					{currentPage === "kana" ? (
						<KanaTrainer
							preferences={appState.preferences}
							stats={appState.stats}
							history={appState.history}
							onPatchPreferences={patchKanaPreferences}
							onPatchHyperparam={patchKanaHyperparam}
							onPracticeUpdate={updateKanaPractice}
						/>
					) : (
						<NumbersTrainer
							numbersState={appState.numbers}
							onPatchPreferences={patchNumbersPreferences}
							onUpdateStats={updateNumberStats}
						/>
					)}
				</main>
			)}
		</div>
	);
}

export default App;
