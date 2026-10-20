<!--
  Strona quizu. Adres w stylu: ...?category=dotnet&index=3

  Co robi:
  - wybiera pytania na podstawie ?category= z adresu,
  - pamięta w localStorage ostatni indeks DLA KAŻDEJ kategorii osobno,
  - pamięta udzieloną odpowiedź na każde pytanie i pokazuje ją po powrocie,
  - odtwarza wynik w navbarze z zapamiętanych odpowiedzi,
  - animuje przejścia między pytaniami (przyciski, strzałki na klawiaturze, swipe).
-->

<!--
  ─────────────────────────────────────────────────────────────────────────────
  <script module> — wykonuje się RAZ, gdy plik komponentu jest ładowany,
  a nie przy każdym utworzeniu komponentu.

  To dobre miejsce na stałe dane: YAML-e parsujemy jednorazowo, nawet jeśli
  użytkownik wiele razy wejdzie na tę stronę i z niej wyjdzie.
  Wszystko zadeklarowane tutaj jest widoczne w zwykłym <script> poniżej.
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts" module>
	import { parse } from 'yaml';
	import type { Quiz as QuizType } from '#lib/quiz.type.ts';

	// `?raw` to funkcja Vite: zamiast wykonywać plik, wkleja jego zawartość jako string.
	import dotnetRaw from '#lib/dotnet-quiz.yaml?raw';
	import angularRaw from '#lib/angular-quiz.yaml?raw';
	import pythonRaw from '#lib/python-quiz.yaml?raw';
	import javascriptRaw from '#lib/javascript-quiz.yaml?raw';
	import sqlRaw from '#lib/sql-quiz.yaml?raw';
	import systemDesignRaw from '#lib/system-design-quiz.yaml?raw';

	/**
	 * Pytanie wzbogacone o unikalny klucz.
	 *
	 * Po co? W każdym pliku YAML id zaczynają się zapewne od 1, więc w kategorii "all"
	 * mielibyśmy kilka pytań z `id: 1`. To psułoby zarówno `{#key}` (Svelte nie odróżniłby
	 * pytań), jak i zapamiętywanie odpowiedzi (odpowiedź z .NET nadpisałaby tę z SQL).
	 * Klucz `kategoria:id`, np. `dotnet:1`, jest unikalny globalnie.
	 */
	type LoadedQuiz = QuizType & { key: string };

	/**
	 * Jedna lista kategorii zamiast siedmiu `if`-ów.
	 * Kolejność tutaj = kolejność pytań w kategorii "all".
	 * Nowa kategoria = jeden import i jedna linijka tutaj.
	 */
	const CATEGORIES = [
		{ id: 'dotnet', title: 'Pytania z .NET', raw: dotnetRaw },
		{ id: 'angular', title: 'Pytania z Angulara', raw: angularRaw },
		{ id: 'python', title: 'Pytania z Pythona', raw: pythonRaw },
		{ id: 'javascript', title: 'Pytania z JavaScript', raw: javascriptRaw },
		{ id: 'sql', title: 'Pytania z SQL', raw: sqlRaw },
		{ id: 'system-design', title: 'Pytania z projektowania systemów', raw: systemDesignRaw }
	];

	/** Parsuje YAML jednej kategorii i dokleja każdemu pytaniu unikalny klucz. */
	function loadCategory(categoryId: string, raw: string): LoadedQuiz[] {
		const items = parse(raw) as QuizType[];
		return items.map((q) => ({ ...q, key: `${categoryId}:${q.id}` }));
	}

	/** Pytania pogrupowane po kategoriach: { dotnet: [...], sql: [...], ... } */
	const SOURCES: Record<string, LoadedQuiz[]> = Object.fromEntries(
		CATEGORIES.map((c) => [c.id, loadCategory(c.id, c.raw)])
	);

	/** Tytuły kategorii: { dotnet: 'Pytania z .NET', ... } */
	const TITLES: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.title]));

	/**
	 * Wszystkie pytania naraz, dla kategorii "all".
	 * Uwaga: gdybyś kiedyś odkomentował losowanie kolejności (sort z Math.random),
	 * zapamiętany indeks straci sens — po odświeżeniu pod tym samym numerem będzie inne pytanie.
	 * Losowanie trzeba by wtedy zrobić raz i też zapamiętać.
	 */
	const ALL: LoadedQuiz[] = CATEGORIES.flatMap((c) => SOURCES[c.id]);
</script>

<!--
  ─────────────────────────────────────────────────────────────────────────────
  Zwykły <script> — wykonuje się przy KAŻDYM utworzeniu komponentu.
  Tu żyje stan instancji: który indeks, w którą stronę animujemy itd.
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts">
	// `page` — reaktywny obiekt z informacjami o bieżącej stronie (URL, parametry...).
	// W SvelteKit 3 jest w `$app/state` (stary `$app/stores` z `$page` został usunięty).
	import { page } from '$app/state';

	// `resolve` dokleja base path (u nas /svelte-fiszki na GitHub Pages) do ścieżek.
	import { resolve } from '$app/paths';

	// `browser` — true w przeglądarce, false podczas prerenderu w czasie builda.
	import { browser } from '$app/env';

	// `goto` — nawigacja z kodu. `afterNavigate` — hook odpalany po każdej nawigacji.
	import { goto, afterNavigate } from '$app/navigation';

	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	import Quiz from '#lib/Quiz.svelte';
	import { progress } from '#lib/progress.svelte.ts';
	import { score } from '#lib/score.svelte.ts';

	/*
	 * ── KATEGORIA I PYTANIA ────────────────────────────────────────────────────
	 *
	 * $derived — wartość, która sama się przelicza, gdy zmieni się coś, od czego zależy.
	 * Tu: gdy zmieni się `page.url`, czyli ?category= w adresie.
	 *
	 * `browser &&` — podczas prerenderu (build) query string nie istnieje, a próba
	 * odczytu `searchParams` rzuciłaby błąd. W buildzie renderujemy więc "all",
	 * a właściwa kategoria wskakuje już w przeglądarce.
	 */
	let category = $derived((browser && page.url.searchParams.get('category')) || 'all');

	/** Pytania dla bieżącej kategorii. Nieznana kategoria = pusta lista (obsłużona w szablonie). */
	let questions = $derived(category === 'all' ? ALL : (SOURCES[category] ?? []));

	let title = $derived(TITLES[category] ?? 'Pytania rekrutacyjne');

	/*
	 * ── STAN NAWIGACJI ─────────────────────────────────────────────────────────
	 *
	 * $state — reaktywna zmienna. Przypisanie (`index = 5`) albo `index++`
	 * automatycznie odświeża wszystko, co jej używa. Bez setterów, bez setState.
	 */
	let index = $state(0);

	/** Kierunek ostatniego przejścia: 1 = dalej (w prawo), -1 = wstecz. Steruje stroną, z której wjeżdża slajd. */
	let direction = $state<1 | -1>(1);

	/**
	 * Czy właśnie odtwarzamy stan z pamięci/URL-a.
	 * Podczas odtwarzania wyłączamy animację, żeby po wejściu na stronę pytanie nr 7
	 * nie "przyjeżdżało" efektownie zamiast po prostu być na miejscu.
	 */
	let restoring = $state(true);

	let current = $derived(questions[index]);
	let isFirst = $derived(index === 0);
	let isLast = $derived(index === questions.length - 1);
	let progressPct = $derived(questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0);

	/**
	 * Zapamiętana odpowiedź na bieżące pytanie (albo null).
	 * `progress.getAnswer` czyta z reaktywnego $state, więc gdy zapiszemy nową odpowiedź,
	 * ta wartość przeliczy się sama, a komponent Quiz dostanie nowy prop `selected`.
	 */
	let saved = $derived(current ? progress.getAnswer(current.key) : null);

	/** Ile pytań w tej kategorii ma już odpowiedź — do licznika nad paskiem postępu. */
	let answeredCount = $derived(questions.filter((q) => progress.getAnswer(q.key) !== null).length);

	/** O ile pikseli przesuwa się slajd przy animacji. */
	const DISTANCE = 140;

	/** Czas animacji: 0 przy odtwarzaniu stanu i dla osób z ograniczeniem ruchu w systemie. */
	let duration = $derived(restoring || prefersReducedMotion.current ? 0 : 380);

	/*
	 * ── ODTWARZANIE STANU ──────────────────────────────────────────────────────
	 */

	/** Czy liczba jest poprawnym indeksem w bieżącej liście pytań. */
	function isValidIndex(n: number): boolean {
		return Number.isInteger(n) && n >= 0 && n < questions.length;
	}

	/**
	 * Ustala startowy indeks i odbudowuje wynik.
	 *
	 * Priorytet: ?index= z adresu (ktoś mógł wkleić link do konkretnego pytania)
	 *            → zapamiętany indeks tej kategorii
	 *            → 0.
	 */
	function restore() {
		restoring = true;

		// `get` zwraca null, gdy parametru brak. Uwaga: Number(null) === 0, co uznalibyśmy
		// za poprawny indeks i nadpisalibyśmy zapamiętany postęp. Dlatego najpierw sprawdzamy null.
		const param = page.url.searchParams.get('index');
		const fromUrl = param === null ? NaN : Number(param);
		const fromStorage = progress.getIndex(category);

		if (isValidIndex(fromUrl)) index = fromUrl;
		else if (isValidIndex(fromStorage)) index = fromStorage;
		else index = 0;

		progress.setIndex(category, index);
		rebuildScore();

		// requestAnimationFrame odpala się przed następną klatką, czyli już PO tym,
		// jak Svelte wyrenderował odtworzone pytanie bez animacji. Od tej chwili animacje działają normalnie.
		requestAnimationFrame(() => (restoring = false));
	}

	/**
	 * Odbudowuje wynik w navbarze na podstawie zapamiętanych odpowiedzi tej kategorii.
	 * Bez tego po odświeżeniu strony pytania byłyby oznaczone jako odpowiedziane,
	 * a navbar pokazywałby 0 / 0.
	 */
	function rebuildScore() {
		score.reset(questions.length);
		for (const q of questions) {
			const answer = progress.getAnswer(q.key);
			if (answer) score.record(answer.correct, 1);
		}
	}

	/*
	 * afterNavigate — hook SvelteKita odpalany po każdej nawigacji, ŁĄCZNIE z pierwszym
	 * wejściem na stronę (wtedy działa jak onMount). Trzeba go wywołać podczas
	 * inicjalizacji komponentu, czyli tu, na najwyższym poziomie skryptu.
	 *
	 * Dlaczego nie onMount? Bo onMount odpala się tylko raz. Jeśli przejdziesz linkiem
	 * z ?category=sql na ?category=dotnet, SvelteKit użyje TEGO SAMEGO komponentu
	 * (ta sama trasa), więc onMount się nie powtórzy, a stan zostałby z poprzedniej kategorii.
	 *
	 * `navigation.shallow` — nasze własne aktualizacje ?index= (patrz syncUrl) to też
	 * "nawigacje", tylko płytkie. Ignorujemy je, bo inaczej każde przejście do następnego
	 * pytania odpalałoby restore() i resetowało wynik.
	 */
	afterNavigate((navigation) => {
		if (navigation.shallow) return;
		restore();
	});

	/*
	 * ── NAWIGACJA MIĘDZY PYTANIAMI ─────────────────────────────────────────────
	 */

	/**
	 * Wpisuje bieżący indeks do adresu, żeby link dało się skopiować i wysłać.
	 *
	 * Nie używamy gołego `history.replaceState`, bo gryzie się z routerem SvelteKita
	 * (router traci synchronizację z prawdziwym adresem). Zamiast tego `goto` z opcjami:
	 * - shallow: true  → zmienia tylko adres, bez nawigacji i bez ponownego ładowania danych,
	 * - replace: true  → podmienia wpis w historii, zamiast dokładać nowy
	 *                     (inaczej 30 pytań = 30 kliknięć "wstecz", żeby opuścić stronę).
	 *
	 * `new URL(page.url.href)` — w SvelteKit 3 `page.url` jest tylko do odczytu, więc robimy kopię.
	 */
	function syncUrl() {
		const url = new URL(page.url.href);
		url.searchParams.set('index', String(index));
		goto(url, { shallow: true, replace: true, state: {} });
	}

	/**
	 * Przejście o jedno pytanie w przód (step = 1) albo w tył (step = -1).
	 * Kolejność ma znaczenie: najpierw kierunek, potem indeks. Svelte odczytuje
	 * parametry przejścia w momencie jego startu, więc slajd pojedzie w dobrą stronę.
	 */
	function go(step: 1 | -1) {
		const next = index + step;
		if (next < 0 || next >= questions.length) return;

		direction = step;
		index = next;
		progress.setIndex(category, index);
		syncUrl();
	}

	/**
	 * Callback przekazywany do komponentu Quiz — tak dziecko "wysyła zdarzenie" do rodzica.
	 * W Svelte 5 nie ma EventEmittera: zdarzenie to po prostu funkcja w propsach.
	 */
	function handleChoose(answerIndex: number, correct: boolean) {
		if (!current) return;
		progress.setAnswer(current.key, { selected: answerIndex, correct });
		score.record(correct, 1);
	}

	/*
	 * ── KLAWIATURA I DOTYK ─────────────────────────────────────────────────────
	 */

	/** Strzałki ← → zmieniają pytanie, chyba że użytkownik pisze w polu tekstowym. */
	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowRight') go(1);
		if (e.key === 'ArrowLeft') go(-1);
	}

	// Zwykła zmienna, nie $state: nic w szablonie jej nie wyświetla, więc nie musi być reaktywna.
	let touchStartX = 0;

	function ontouchstart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].clientX;
	}

	/** Przesunięcie palcem o ponad 50 px w lewo = następne pytanie, w prawo = poprzednie. */
	function ontouchend(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
	}
</script>

<!--
  <svelte:window> — specjalny element do podpinania zdarzeń pod obiekt `window`.
  Svelte sam odepnie listener, gdy komponent zniknie, więc nic nie wycieka.
  `{onkeydown}` to skrót od `onkeydown={onkeydown}`.
-->
<svelte:window {onkeydown} />

<div class="container">
	<h1>{title}</h1>

	<!-- {#if} / {:else if} / {/if} — warunki w szablonie. -->
	{#if questions.length === 0}
		<div class="alert alert-warning mt-4">
			Nie znam kategorii „{category}”. <a href={resolve('/')}>Wybierz inną.</a>
		</div>
	{:else if current}
		<div class="d-flex align-items-center gap-3 mt-3">
			<span class="text-body-secondary small text-nowrap counter">
				Pytanie {index + 1} z {questions.length}
				<span class="d-none d-sm-inline">· odpowiedziano {answeredCount}</span>
			</span>
			<div class="progress flex-grow-1" style="height: 4px">
				<!-- `style:width` — dyrektywa ustawiająca jedną właściwość CSS reaktywnie. -->
				<div class="progress-bar" style:width="{progressPct}%"></div>
			</div>
		</div>

		<!-- Zdarzenia dotyku podpinamy zwykłymi atrybutami, jak każde inne zdarzenie DOM. -->
		<div class="stage py-3" {ontouchstart} {ontouchend} role="region" aria-label="Pytanie">
			<!--
			  {#key wartość} — gdy wartość się zmieni, Svelte NISZCZY zawartość bloku
			  i tworzy ją od nowa. Dzięki temu:
			  1. odpalają się animacje in:/out: (stary slajd wyjeżdża, nowy wjeżdża),
			  2. komponent Quiz startuje z czystym stanem lokalnym.
			  Kluczem jest `current.key` (kategoria:id), a nie samo `id` — patrz komentarz przy LoadedQuiz.
			-->
			{#key current.key}
				<div
					class="slide"
					in:fly={{ x: DISTANCE * direction, duration, easing: cubicOut }}
					out:fly={{ x: -DISTANCE * direction, duration, easing: cubicOut }}
				>
					<!--
					  Przekazujemy zapamiętaną odpowiedź w dół (selected)
					  i odbieramy nowe wybory w górę (onchoose).
					-->
					<Quiz quiz={current} selected={saved?.selected ?? null} onchoose={handleChoose} />
				</div>
			{/key}
		</div>

		<div class="d-flex justify-content-between pt-3 gap-3">
			<!-- `disabled={isFirst}` — atrybut HTML przypisany reaktywnie. -->
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
	 * Wychodzący i wchodzący slajd istnieją przez chwilę JEDNOCZEŚNIE.
	 * Grid z jedną komórką (grid-area: 1 / 1) kładzie je na sobie, więc mijają się
	 * w miejscu, zamiast stawać jeden pod drugim i szarpać stroną w pionie.
	 */
	.stage {
		display: grid;
		/* clip ucina wystające slajdy, ale (w przeciwieństwie do hidden) nie tworzy przewijanego kontenera */
		overflow-x: clip;
		/* przeglądarka obsługuje przewijanie w pionie, poziome gesty zostawia naszemu swipe'owi */
		touch-action: pan-y;
	}

	.slide {
		grid-area: 1 / 1;
	}

	/* Cyfry o równej szerokości, żeby licznik nie drgał przy zmianie 9 → 10. */
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

	/* Strzałka "popycha" się w swoją stronę przy najechaniu. Zmienna CSS ustala kierunek. */
	.nav-btn:not(:disabled):hover .arrow {
		transform: translateX(var(--nudge, 3px));
	}

	.btn-secondary.nav-btn {
		--nudge: -3px;
	}
</style>
