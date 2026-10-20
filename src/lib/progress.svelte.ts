/**
 * src/lib/progress.svelte.ts
 *
 * Trwały postęp nauki w localStorage: ostatni indeks pytania dla każdej kategorii
 * oraz udzielone odpowiedzi. Osobno dla quizu i osobno dla fiszek.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DLACZEGO ROZSZERZENIE `.svelte.ts`, A NIE ZWYKŁE `.ts`?
 *   Runes ($state, $derived, $effect...) to instrukcje dla kompilatora Svelte.
 *   Kompilator przetwarza tylko pliki .svelte oraz .svelte.ts / .svelte.js.
 *   W zwykłym .ts nikt by tego pliku nie skompilował, a `$state` byłoby
 *   niezdefiniowaną zmienną.
 *
 * DLACZEGO TO SĄ SINGLETONY?
 *   Moduł ES (każdy plik z import/export) wykonuje się DOKŁADNIE RAZ, przy pierwszym
 *   imporcie. Każdy komponent, który zaimportuje `quizProgress`, dostaje tę samą
 *   instancję. Odpowiednik serwisu `@Injectable({ providedIn: 'root' })` z Angulara,
 *   tylko zamiast wstrzykiwać, importujesz.
 *
 * DLACZEGO DWIE INSTANCJE?
 *   Quiz i fiszki używają tych samych nazw kategorii ("dotnet", "sql"...).
 *   Jeden wspólny magazyn mieszałby indeksy: przejście do 5. fiszki z .NET
 *   przestawiałoby też quiz z .NET na 5. pytanie. Każda instancja ma więc
 *   własny klucz w localStorage i własny typ zapamiętanej odpowiedzi.
 *
 * UWAGA NA SSR (na przyszłość):
 *   Przy adapter-node te obiekty żyłyby na serwerze i byłyby WSPÓLNE dla wszystkich
 *   użytkowników. U nas (adapter-static + GitHub Pages) "serwer" to tylko build,
 *   a localStorage czytamy i zapisujemy wyłącznie w przeglądarce, więc nic nie wycieka.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { browser } from '$app/env';

/** Zapamiętana odpowiedź na pytanie QUIZU. */
export interface SavedAnswer {
	/** Indeks wybranej odpowiedzi w tablicy `answers` danego pytania. */
	selected: number;
	/** Czy wybór był poprawny. Trzymamy to, żeby przy odtwarzaniu wyniku nie liczyć od nowa. */
	correct: boolean;
}

/** Zapamiętana ocena FISZKI: użytkownik sam zaznaczył „wiedziałem” albo „nie wiedziałem”. */
export interface SavedMark {
	correct: boolean;
}

/**
 * Kształt danych zapisywanych w localStorage.
 * `TAnswer` to parametr generyczny — jak `<T>` w C#. Dzięki niemu ta sama klasa
 * obsługuje i odpowiedzi z quizu (SavedAnswer), i oceny fiszek (SavedMark).
 */
interface ProgressData<TAnswer> {
	/** Ostatni indeks pytania w każdej kategorii, np. `{ dotnet: 4, sql: 0, all: 12 }`. */
	indexes: Record<string, number>;
	/** Odpowiedzi kluczowane unikalnym kluczem pytania (kategoria + id), np. `'dotnet:3'`. */
	answers: Record<string, TAnswer>;
}

/** Puste dane startowe. Funkcja zamiast stałej, żeby za każdym razem dostać NOWY obiekt. */
function emptyData<TAnswer>(): ProgressData<TAnswer> {
	return { indexes: {}, answers: {} };
}

/**
 * Wczytuje postęp z localStorage pod podanym kluczem.
 *
 * - `browser` (z `$app/env`) ma wartość `false` podczas prerenderu, czyli builda
 *   w GitHub Actions. Tam nie ma okna przeglądarki ani localStorage, więc
 *   odwołanie się do niego rzuciłoby błąd i wywaliło build.
 * - try/catch, bo localStorage potrafi rzucić wyjątkiem (zablokowane dane witryn,
 *   niektóre tryby prywatne), a JSON.parse — na uszkodzonych danych.
 * - Sprawdzamy kształt danych, bo w localStorage może leżeć cokolwiek
 *   (stara wersja apki, ręczna edycja w DevTools...).
 */
function load<TAnswer>(storageKey: string): ProgressData<TAnswer> {
	if (!browser) return emptyData();

	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return emptyData();

		const data = JSON.parse(raw);
		return {
			indexes: typeof data?.indexes === 'object' && data.indexes ? data.indexes : {},
			answers: typeof data?.answers === 'object' && data.answers ? data.answers : {}
		};
	} catch {
		return emptyData();
	}
}

class ProgressStore<TAnswer> {
	/**
	 * Klucz w localStorage. Prywatne pole (`#` to składnia czystego JavaScriptu).
	 * Sufiks `v1` w kluczach poniżej to wersja formatu danych: przy niekompatybilnej
	 * zmianie kształtu podbijasz na `v2`, a stare dane zostaną zignorowane.
	 */
	#storageKey: string;

	/**
	 * Dane opakowane w rune `$state`.
	 *
	 * `$state` na obiekcie tworzy GŁĘBOKO reaktywne proxy. Nawet mutacja zagnieżdżonego
	 * pola, np. `this.#data.answers['sql:2'] = {...}`, zostanie wykryta, a każdy komponent,
	 * który w szablonie odczytał `getAnswer('sql:2')`, odświeży się sam.
	 * Nie trzeba niczego "emitować" ani subskrybować.
	 *
	 * Runes w polach klas są dozwolone i to idiomatyczny sposób na stan z metodami.
	 * Startujemy od pustych danych, a właściwe wczytanie robi konstruktor,
	 * bo dopiero on zna klucz storage'u.
	 */
	#data = $state<ProgressData<TAnswer>>(emptyData());

	constructor(storageKey: string) {
		this.#storageKey = storageKey;
		this.#data = load<TAnswer>(storageKey);
	}

	/*
	 * Metody piszemy jako FUNKCJE STRZAŁKOWE przypisane do pól, a nie jako zwykłe metody.
	 *
	 * Powód: jeśli przekażesz `progress.setIndex` dalej jako callback, zwykła metoda
	 * zgubi `this` (klasyczna pułapka JS, której w C# nie ma). Funkcja strzałkowa ma
	 * `this` przypięte na stałe do instancji.
	 */

	/** Ostatni zapamiętany indeks w kategorii (albo 0, jeśli nigdy jej nie otwierano). */
	getIndex = (category: string): number => this.#data.indexes[category] ?? 0;

	/** Zapamiętuje indeks w kategorii i od razu zapisuje do localStorage. */
	setIndex = (category: string, index: number) => {
		this.#data.indexes[category] = index;
		this.#save();
	};

	/** Zapamiętana odpowiedź na pytanie o danym kluczu albo `null`, jeśli brak. */
	getAnswer = (key: string): TAnswer | null => this.#data.answers[key] ?? null;

	/** Zapamiętuje odpowiedź na pytanie i od razu zapisuje do localStorage. */
	setAnswer = (key: string, answer: TAnswer) => {
		this.#data.answers[key] = answer;
		this.#save();
	};

	/** Czyści cały postęp tej instancji. Przyda się pod przycisk „Zacznij od nowa”. */
	clear = () => {
		this.#data = emptyData();
		this.#save();
	};

	/**
	 * Zapis do localStorage.
	 *
	 * Wołamy go JAWNIE w każdej metodzie zmieniającej dane, zamiast podpinać `$effect`.
	 * Tu dokładnie wiemy, kiedy dane się zmieniają, a dokumentacja Svelte zaleca:
	 * zmieniaj stan w handlerach i metodach, efekty zostaw do synchronizacji z rzeczami,
	 * których nie kontrolujesz.
	 *
	 * `$state.snapshot()` zamienia reaktywne proxy w zwykły, "martwy" obiekt —
	 * jasna intencja "chcę surowe dane do serializacji".
	 */
	#save() {
		if (!browser) return;

		try {
			localStorage.setItem(this.#storageKey, JSON.stringify($state.snapshot(this.#data)));
		} catch {
			// Brak miejsca albo zablokowany storage. Postęp nie zostanie zapamiętany,
			// ale aplikacja działa dalej — nie ma sensu wywalać jej z tego powodu.
		}
	}
}

/**
 * Postęp quizu. Klucz storage'u zostaje taki jak wcześniej,
 * więc zapisane już odpowiedzi nie przepadną.
 */
export const quizProgress = new ProgressStore<SavedAnswer>('svelte-fiszki:progress:v1');

/** Postęp fiszek — osobny klucz, osobne dane. */
export const flashcardProgress = new ProgressStore<SavedMark>('svelte-fiszki:flashcards:v1');

/**
 * Stara nazwa, żeby strona quizu (`import { progress } from ...`) działała bez zmian.
 * Przy okazji możesz tam zmienić import na `quizProgress` i usunąć tę linię.
 */
export const progress = quizProgress;
