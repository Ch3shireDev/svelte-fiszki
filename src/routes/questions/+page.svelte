<!--
  Strona fiszek. Adres w stylu: /questions?category=dotnet&index=3

  Co robi:
  - wybiera fiszki na podstawie ?category= z adresu,
  - pamięta w localStorage ostatni indeks DLA KAŻDEJ kategorii osobno,
  - pamięta Twoją ocenę każdej fiszki (poprawna / niepoprawna) i pokazuje ją po powrocie,
  - odtwarza wynik w navbarze z zapamiętanych ocen,
  - animuje przejścia między fiszkami (przyciski, strzałki na klawiaturze, swipe).

  Budowa jest bliźniacza do strony quizu — jeśli coś jest tu opisane krócej,
  dłuższe wyjaśnienie znajdziesz w komentarzach tamtej strony.
-->

<!--
  ─────────────────────────────────────────────────────────────────────────────
  <script module> — wykonuje się RAZ, gdy plik komponentu jest ładowany,
  a nie przy każdym utworzeniu komponentu. Dobre miejsce na stałe dane:
  YAML-e parsujemy jednorazowo. Wszystko stąd jest widoczne w <script> poniżej.
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts" module>
	import { parse } from 'yaml';
	import type { Question as QuestionType } from '#lib/question.type.ts';

	// `?raw` — funkcja Vite: zawartość pliku trafia do kodu jako zwykły string.
	import dotnetRaw from '#lib/dotnet.yaml?raw';
	import angularRaw from '#lib/angular.yaml?raw';
	import pythonRaw from '#lib/python.yaml?raw';
	import javascriptRaw from '#lib/javascript.yaml?raw';
	import sqlRaw from '#lib/sql.yaml?raw';
	import systemDesignRaw from '#lib/system-design.yaml?raw';

	/**
	 * Fiszka wzbogacona o unikalny klucz `kategoria:id`, np. `sql:4`.
	 * Id w poszczególnych YAML-ach się powtarzają, więc w kategorii "all" samo `id`
	 * nie odróżniłoby fiszek ani w `{#key}`, ani w zapamiętanych ocenach.
	 */
	type LoadedQuestion = QuestionType & { key: string };

	/**
	 * Jedna lista kategorii zamiast siedmiu `if`-ów.
	 * Kolejność tutaj = kolejność fiszek w kategorii "all".
	 */
	const CATEGORIES = [
		{ id: 'dotnet', title: 'Pytania z .NET', raw: dotnetRaw },
		{ id: 'angular', title: 'Pytania z Angulara', raw: angularRaw },
		{ id: 'python', title: 'Pytania z Pythona', raw: pythonRaw },
		{ id: 'javascript', title: 'Pytania z JavaScript', raw: javascriptRaw },
		{ id: 'sql', title: 'Pytania z SQL', raw: sqlRaw },
		{ id: 'system-design', title: 'Pytania z projektowania systemów', raw: systemDesignRaw }
	];

	/** Parsuje YAML jednej kategorii i dokleja każdej fiszce unikalny klucz. */
	function loadCategory(categoryId: string, raw: string): LoadedQuestion[] {
		const items = parse(raw) as QuestionType[];
		return items.map((q) => ({ ...q, key: `${categoryId}:${q.id}` }));
	}

	/** Fiszki pogrupowane po kategoriach: { dotnet: [...], sql: [...], ... } */
	const SOURCES: Record<string, LoadedQuestion[]> = Object.fromEntries(
		CATEGORIES.map((c) => [c.id, loadCategory(c.id, c.raw)])
	);

	/** Tytuły kategorii: { dotnet: 'Pytania z .NET', ... } */
	const TITLES: Record<string, string> = Object.fromEntries(
		CATEGORIES.map((c) => [c.id, c.title])
	);

	/**
	 * Wszystkie fiszki naraz, dla kategorii "all".
	 * Gdybyś odkomentował losowanie kolejności, zapamiętany indeks straci sens —
	 * po odświeżeniu pod tym samym numerem będzie inna fiszka.
	 */
	const ALL: LoadedQuestion[] = CATEGORIES.flatMap((c) => SOURCES[c.id]);
</script>

<!--
  ─────────────────────────────────────────────────────────────────────────────
  Zwykły <script> — wykonuje się przy KAŻDYM utworzeniu komponentu.
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts">
	// `page` — reaktywny obiekt z URL-em i parametrami bieżącej strony.
	import { page } from '$app/state';
	// `resolve` dokleja base path (/svelte-fiszki na GitHub Pages) do ścieżek.
	import { resolve } from '$app/paths';
	// `browser` — true w przeglądarce, false podczas prerenderu w czasie builda.
	import { browser } from '$app/env';
	// `goto` — nawigacja z kodu. `afterNavigate` — hook po każdej nawigacji.
	import { goto, afterNavigate } from '$app/navigation';

	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	import Question from '#lib/Question.svelte';
	// Osobny magazyn dla fiszek — nie miesza się z postępem quizu.
	import { flashcardProgress as progress } from '#lib/progress.svelte.ts';
	import { score } from '#lib/score.svelte.ts';

	/*
	 * ── KATEGORIA I FISZKI ─────────────────────────────────────────────────────
	 *
	 * $derived przelicza się sam, gdy zmieni się `page.url` (czyli ?category=).
	 * `browser &&` — w czasie prerenderu query string nie istnieje, a odczyt
	 * `searchParams` wywaliłby build. W buildzie renderujemy "all".
	 */
	let category = $derived((browser && page.url.searchParams.get('category')) || 'all');

	let questions = $derived(category === 'all' ? ALL : (SOURCES[category] ?? []));

	let title = $derived(TITLES[category] ?? 'Pytania rekrutacyjne');

	/*
	 * ── STAN NAWIGACJI ─────────────────────────────────────────────────────────
	 * $state — reaktywna zmienna: `index++` sam odświeża wszystko, co jej używa.
	 */
	let index = $state(0);

	/** Kierunek ostatniego przejścia: 1 = dalej, -1 = wstecz. Steruje stroną, z której wjeżdża slajd. */
	let direction = $state<1 | -1>(1);

	/** Podczas odtwarzania stanu wyłączamy animację, żeby fiszka nr 7 nie "przyjeżdżała" po wejściu na stronę. */
	let restoring = $state(true);

	let current = $derived(questions[index]);
	let isFirst = $derived(index === 0);
	let isLast = $derived(index === questions.length - 1);
	let progressPct = $derived(questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0);

	/**
	 * Zapamiętana ocena bieżącej fiszki (true / false) albo null.
	 * `progress.getAnswer` czyta z reaktywnego $state, więc po zapisaniu nowej oceny
	 * ta wartość przeliczy się sama, a Question dostanie nowy prop `marked`.
	 */
	let marked = $derived(current ? (progress.getAnswer(current.key)?.correct ?? null) : null);

	/** Ile fiszek w tej kategorii już oceniłeś — do licznika nad paskiem postępu. */
	let markedCount = $derived(questions.filter((q) => progress.getAnswer(q.key) !== null).length);

	/** O ile pikseli przesuwa się slajd przy animacji. */
	const DISTANCE = 140;

	/** 0 przy odtwarzaniu stanu i dla osób z ograniczeniem ruchu w systemie. */
	let duration = $derived(restoring || prefersReducedMotion.current ? 0 : 380);

	/*
	 * ── ODTWARZANIE STANU ──────────────────────────────────────────────────────
	 */

	function isValidIndex(n: number): boolean {
		return Number.isInteger(n) && n >= 0 && n < questions.length;
	}

	/**
	 * Ustala startowy indeks i odbudowuje wynik.
	 * Priorytet: ?index= z adresu → zapamiętany indeks kategorii → 0.
	 */
	function restore() {
		restoring = true;

		// Number(null) === 0, czyli brak parametru wyglądałby jak "idź do pierwszej fiszki"
		// i nadpisałby zapamiętany postęp. Dlatego najpierw sprawdzamy null.
		const param = page.url.searchParams.get('index');
		const fromUrl = param === null ? NaN : Number(param);
		const fromStorage = progress.getIndex(category);

		if (isValidIndex(fromUrl)) index = fromUrl;
		else if (isValidIndex(fromStorage)) index = fromStorage;
		else index = 0;

		progress.setIndex(category, index);
		rebuildScore();

		// Odpala się przed następną klatką, czyli PO wyrenderowaniu odtworzonej fiszki bez animacji.
		requestAnimationFrame(() => (restoring = false));
	}

	/** Odbudowuje wynik w navbarze z zapamiętanych ocen tej kategorii. */
	function rebuildScore() {
		score.reset(questions.length);
		for (const q of questions) {
			const saved = progress.getAnswer(q.key);
			if (saved) score.record(saved.correct, 1);
		}
	}

	/*
	 * afterNavigate odpala się po każdej nawigacji, łącznie z pierwszym wejściem.
	 * W przeciwieństwie do onMount złapie też przejście linkiem z ?category=sql
	 * na ?category=dotnet (ta sama trasa = ten sam komponent, onMount by się nie powtórzył).
	 *
	 * `navigation.shallow` — nasze własne aktualizacje ?index= to płytkie nawigacje.
	 * Ignorujemy je, bo inaczej każde przejście do następnej fiszki resetowałoby wynik.
	 */
	afterNavigate((navigation) => {
		if (navigation.shallow) return;
		restore();
	});

	/*
	 * ── NAWIGACJA MIĘDZY FISZKAMI ──────────────────────────────────────────────
	 */

	/**
	 * Wpisuje bieżący indeks do adresu, żeby link do konkretnej fiszki dało się wysłać.
	 * shallow: zmienia tylko adres, bez nawigacji. replace: nie zaśmieca historii przeglądarki.
	 * `new URL(page.url.href)` — w SvelteKit 3 `page.url` jest tylko do odczytu, więc robimy kopię.
	 */
	function syncUrl() {
		const url = new URL(page.url.href);
		url.searchParams.set('index', String(index));
		goto(url, { shallow: true, replace: true, state: {} });
	}

	/** Przejście o jedną fiszkę. Najpierw kierunek, potem indeks — żeby slajd pojechał w dobrą stronę. */
	function go(step: 1 | -1) {
		const next = index + step;
		if (next < 0 || next >= questions.length) return;

		direction = step;
		index = next;
		progress.setIndex(category, index);
		syncUrl();
	}

	/**
	 * Callback dla komponentu Question — tak dziecko "wysyła zdarzenie" do rodzica.
	 *
	 * Fiszkę można przeocenić, więc przy zmianie zdania cofamy stary punkt
	 * i doliczamy nowy. Dzięki temu navbar zawsze zgadza się z tym, co zapisane.
	 */
	function handleMark(isCorrect: boolean) {
		if (!current) return;

		const previous = progress.getAnswer(current.key);
		if (previous?.correct === isCorrect) return;

		if (previous) score.record(previous.correct, -1);
		score.record(isCorrect, 1);
		progress.setAnswer(current.key, { correct: isCorrect });
	}

	/*
	 * ── KLAWIATURA I DOTYK ─────────────────────────────────────────────────────
	 */

	/** Strzałki ← → zmieniają fiszkę, chyba że użytkownik pisze w polu tekstowym. */
	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowRight') go(1);
		if (e.key === 'ArrowLeft') go(-1);
	}

	// Zwykła zmienna, nie $state: nic jej nie wyświetla, więc nie musi być reaktywna.
	let touchStartX = 0;

	function ontouchstart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].clientX;
	}

	/** Przesunięcie palcem o ponad 50 px: w lewo = następna fiszka, w prawo = poprzednia. */
	function ontouchend(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
	}
</script>

<!--
  <svelte:window> podpina zdarzenia pod obiekt `window`
  i sam je odpina, gdy komponent zniknie.
-->
<svelte:window {onkeydown} />

<div class="container">
	<h1>{title}</h1>

	{#if questions.length === 0}
		<div class="alert alert-warning mt-4">
			Nie znam kategorii „{category}”. <a href={resolve('/')}>Wybierz inną.</a>
		</div>
	{:else if current}
		<div class="d-flex align-items-center gap-3 mt-3">
			<span class="text-body-secondary small text-nowrap counter">
				Pytanie {index + 1} z {questions.length}
				<span class="d-none d-sm-inline">· ocenione {markedCount}</span>
			</span>
			<div class="progress flex-grow-1" style="height: 4px">
				<!-- `style:width` — dyrektywa ustawiająca jedną właściwość CSS reaktywnie. -->
				<div class="progress-bar" style:width="{progressPct}%"></div>
			</div>
		</div>

		<div class="stage py-3" {ontouchstart} {ontouchend} role="region" aria-label="Fiszka">
			<!--
			  {#key} niszczy i tworzy zawartość od nowa przy zmianie klucza:
			  odpalają się animacje in:/out:, a Question startuje z czystym stanem lokalnym
			  (np. `fresh = false`). Kluczem jest `current.key`, a nie samo `id`.
			-->
			{#key current.key}
				<div
					class="slide"
					in:fly={{ x: DISTANCE * direction, duration, easing: cubicOut }}
					out:fly={{ x: -DISTANCE * direction, duration, easing: cubicOut }}
				>
					<!-- Ocena idzie w dół (marked), nowe kliknięcia wracają w górę (onmark). -->
					<Question question={current} {marked} onmark={handleMark} />
				</div>
			{/key}
		</div>

		<div class="d-flex justify-content-between pt-3 gap-3">
			<button class="btn btn-secondary nav-btn" onclick={() => go(-1)} disabled={isFirst}>
				<span class="arrow" aria-hidden="true">←</span>
				<span class="d-none d-sm-inline">Poprzednie</span>
			</button>
			<button class="btn btn-primary nav-btn" onclick={() => go(1)} disabled={isLast}>
				<span class="d-none d-sm-inline">Następne</span>
				<span class="arrow" aria-hidden="true">→</span>
			</button>
		</div>

		<p class="pt-4 small text-body-secondary d-none d-md-block">
			Podpowiedź: strzałki ← → na klawiaturze też działają.
		</p>
	{/if}

	<p class="pt-3"><a href={resolve('/')}>Wróć do strony głównej</a></p>
</div>

<style>
	/*
	 * Wychodzący i wchodzący slajd istnieją przez chwilę jednocześnie.
	 * Grid z jedną komórką kładzie je na sobie, żeby strona nie szarpała w pionie.
	 */
	.stage {
		display: grid;
		overflow-x: clip;
		touch-action: pan-y;
	}

	.slide {
		grid-area: 1 / 1;
	}

	.counter {
		font-variant-numeric: tabular-nums;
	}

	.progress-bar {
		transition: width 0.35s ease;
	}

	.nav-btn {
		min-width: 3.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.arrow {
		display: inline-block;
		transition: transform 0.2s;
	}

	.nav-btn:not(:disabled):hover .arrow {
		transform: translateX(var(--nudge, 3px));
	}

	.btn-secondary.nav-btn {
		--nudge: -3px;
	}
</style>
