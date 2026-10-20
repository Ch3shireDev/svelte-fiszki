<!--
  src/lib/Quiz.svelte
  Jedno pytanie wielokrotnego wyboru.

  ─────────────────────────────────────────────────────────────────────────────
  WZORZEC: KOMPONENT KONTROLOWANY (controlled component)

  Ten komponent NIE pamięta sam, którą odpowiedź wybrano. Dostaje ją z zewnątrz
  w propsie `selected`, a gdy użytkownik kliknie, jedynie ZGŁASZA to rodzicowi
  przez callback `onchoose`. Rodzic zapisuje wybór (localStorage, punktacja)
  i przekazuje nową wartość `selected` z powrotem w dół.

  Po co tak kombinować? Bo jest jedno źródło prawdy: magazyn postępu.
  Kiedy wrócisz do pytania albo odświeżysz stronę, komponent tworzy się od nowa
  i od razu pokazuje zapamiętaną odpowiedź, bo dostaje ją w propsie.
  Odpowiednik w Angularze: "głupi" komponent z @Input() i @Output().
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import { marked } from 'marked';

	// Wbudowane przejścia Svelte. Każde to funkcja (element, parametry) => animacja,
	// używana w markupie przez dyrektywy `in:`, `out:` albo `transition:`.
	import { slide, fade, scale } from 'svelte/transition';

	// Funkcje "easing" opisują krzywą prędkości animacji.
	// cubicOut: szybko na starcie, łagodnie na końcu. backOut: z lekkim "przestrzeleniem", jak sprężyna.
	import { cubicOut, backOut } from 'svelte/easing';

	// Reaktywny obiekt mówiący, czy użytkownik ma w systemie włączone ograniczenie animacji.
	// `.current` jest true/false i aktualizuje się na żywo, gdy ktoś zmieni ustawienie.
	import { prefersReducedMotion } from 'svelte/motion';

	// `import type` importuje wyłącznie typ — znika całkowicie po kompilacji do JS.
	import type { Quiz } from '#lib/quiz.type.ts';

	// Typ propsów jako osobny interfejs — czytelniej niż długi typ wpisany inline.
	interface Props {
		/** Pytanie do wyświetlenia. */
		quiz: Quiz;
		/** Indeks wybranej odpowiedzi albo `null`, jeśli jeszcze nie odpowiedziano. */
		selected: number | null;
		/** Wywoływane przy wyborze odpowiedzi. Rodzic decyduje, co z tym zrobić. */
		onchoose: (index: number, correct: boolean) => void;
	}

	/*
	 * $props() — rune do odbierania propsów (odpowiednik @Input w Angularze).
	 *
	 * Destrukturyzacja jest REAKTYWNA: kompilator zamienia `selected` w odczyt
	 * "na żywo" z propsów rodzica. Gdy rodzic przekaże nową wartość, ta zmienna
	 * od razu ją ma. (W starym Svelte 4 z `$$props` byłaby to zamrożona kopia.)
	 */
	let { quiz, selected, onchoose }: Props = $props();

	/** Litery do oznaczenia odpowiedzi: A, B, C... */
	const LETTERS = 'ABCDEFGH';

	/*
	 * $derived — wartość wyliczana z innych reaktywnych wartości.
	 * Liczy się raz i jest zapamiętywana (cache); przelicza się dopiero wtedy,
	 * gdy zmieni się coś, co odczytuje w środku (tu: `quiz`).
	 *
	 * `{ async: false }` mówi TypeScriptowi, że wynik to `string`, a nie `Promise<string>`.
	 */
	let questionHtml = $derived(marked.parse(quiz.question, { async: false }));

	let explanationHtml = $derived(
		quiz.explanation ? marked.parse(quiz.explanation, { async: false }) : ''
	);

	/*
	 * Odpowiedzi przygotowane do wyświetlenia.
	 *
	 * WAŻNE: runes wolno używać tylko przy deklaracji zmiennej na najwyższym poziomie
	 * skryptu albo w polu klasy. `$derived` wewnątrz `.map(...)` nie skompiluje się.
	 * Dlatego jeden `$derived` obejmuje całą tablicę.
	 *
	 * `parseInline` zamiast `parse`, bo `parse` owija tekst w <p>, a akapit
	 * wewnątrz <button> to niepoprawny HTML (i zbędne marginesy).
	 */
	let answers = $derived(
		quiz.answers.map((a, i) => ({
			letter: LETTERS[i] ?? String(i + 1),
			html: marked.parseInline(a.text, { async: false }),
			correct: a.correct
		}))
	);

	/** Czy na to pytanie już odpowiedziano. Wynika wprost z propsa. */
	let answered = $derived(selected !== null);

	/**
	 * Czy wybrana odpowiedź jest poprawna (`null`, jeśli brak wyboru).
	 * `?.` chroni przed sytuacją, gdy w localStorage leży indeks, którego już nie ma
	 * (np. usunąłeś odpowiedź z YAML-a).
	 */
	let isCorrect = $derived(selected === null ? null : (answers[selected]?.correct ?? null));

	/*
	 * $state — zwykły lokalny, reaktywny stan komponentu.
	 *
	 * `fresh` mówi, czy odpowiedź padła W TEJ CHWILI, a nie została wczytana z pamięci.
	 * Animacje "pop" i "shake" chcemy tylko przy świeżym kliknięciu, a nie za każdym razem,
	 * gdy wracasz do pytania, na które odpowiedziałeś wczoraj.
	 * Komponent jest tworzony od nowa przy każdej zmianie pytania, więc `fresh` zawsze startuje od false.
	 */
	let fresh = $state(false);

	/** Mnożnik czasu animacji: 0 dla osób z ograniczeniem ruchu w systemie, 1 dla reszty. */
	let d = $derived(prefersReducedMotion.current ? 0 : 1);

	/**
	 * Handler kliknięcia w odpowiedź.
	 * Nie zmienia `selected` sam — tylko zgłasza wybór rodzicowi (patrz komentarz na górze pliku).
	 * Po pierwszej odpowiedzi kolejne kliknięcia są ignorowane: skoro ujawniamy poprawną,
	 * zmiana zdania byłaby darmowym punktem.
	 */
	function choose(i: number) {
		if (answered) return;
		fresh = true;
		onchoose(i, answers[i].correct);
	}

	/**
	 * Klasy CSS dla przycisku odpowiedzi.
	 * Wywołanie funkcji w szablonie jest reaktywne: Svelte śledzi, co funkcja odczytała
	 * (tu `selected` i `fresh`), i przelicza wynik, gdy to się zmieni.
	 */
	function variant(i: number, correct: boolean): string {
		// Jeszcze nikt nie odpowiedział: wszystkie przyciski neutralne.
		if (selected === null) return 'btn-outline-secondary';

		// Ten przycisk został wybrany: pełny kolor + ewentualnie animacja.
		if (selected === i) {
			if (correct) return 'btn-success' + (fresh ? ' picked-correct' : '');
			return 'btn-danger' + (fresh ? ' picked-wrong' : '');
		}

		// Niewybrana, ale poprawna: pokazujemy, co należało kliknąć.
		if (correct) return 'btn-outline-success' + (fresh ? ' reveal' : '');

		// Niewybrana i błędna: przygaszona.
		return 'btn-outline-secondary dimmed';
	}
</script>

<!--
  `class:nazwa={warunek}` to dyrektywa Svelte: dodaje klasę, gdy warunek jest prawdziwy.
  Czytelniejsze niż sklejanie stringów w atrybucie `class`.
-->
<div
	class="quiz-card card shadow-sm"
	class:is-correct={isCorrect === true}
	class:is-wrong={isCorrect === false}
>
	<div class="card-body p-4">
		<!--
		  {@html ...} wstawia gotowy HTML bez escapowania.
		  Bezpieczne tylko dla treści, którą kontrolujesz (tu: twoje YAML-e w repo).
		  Treść od użytkowników trzeba by najpierw przepuścić przez sanitizer (np. DOMPurify).
		-->
		<div class="question-text fs-5 mb-4">
			{@html questionHtml}
		</div>

		<div class="d-grid gap-2" role="group" aria-label="Odpowiedzi">
			<!--
			  {#each lista as element, indeks (klucz)} — pętla w szablonie.
			  Klucz w nawiasie pozwala Svelte rozpoznać, który element jest którym, gdy lista się zmienia.
			  Tu lista jest stała, więc indeks wystarczy jako klucz.
			-->
			{#each answers as a, i (i)}
				<!-- {@const} to lokalna stała wewnątrz bloku szablonu — oszczędza powtarzania wyrażeń. -->
				{@const isSelected = selected === i}

				<!--
				  aria-disabled zamiast disabled: Bootstrap nakłada na `disabled` przezroczystość,
				  która zgasiłaby zieleń i czerwień. Blokadę i tak robi `choose()`.
				  `onclick={...}` to w Svelte 5 zwykły atrybut zdarzenia, jak w czystym HTML-u.
				-->
				<button
					class="btn answer-btn text-start d-flex align-items-center gap-3 {variant(i, a.correct)}"
					aria-disabled={answered}
					aria-pressed={isSelected}
					onclick={() => choose(i)}
				>
					<span class="letter">{a.letter}</span>
					<span class="flex-grow-1">{@html a.html}</span>

					<!--
					  {#if} — warunkowe renderowanie. Element powstaje i znika z DOM-u, a nie jest tylko ukrywany.

					  `in:scale={{...}}` — animacja przy pojawieniu się elementu.
					  Przejścia w Svelte 5 są domyślnie LOKALNE: odpalają się tylko wtedy, gdy przełącza się
					  ich własny blok {#if}, a nie przy pierwszym renderze całego komponentu.
					  Dlatego odpowiedź wczytana z pamięci pojawia się od razu, bez animacji, a świeże
					  kliknięcie animuje się ładnie.
					-->
					{#if answered && (isSelected || a.correct)}
						<span
							class="icon"
							aria-hidden="true"
							in:scale={{
								start: 0.3,
								duration: 300 * d,
								delay: isSelected ? 0 : 200 * d,
								easing: backOut
							}}
						>
							{a.correct ? '✓' : '✗'}
						</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if answered}
			<!--
			  Dwie animacje naraz na dwóch elementach:
			  zewnętrzny div rozsuwa wysokość (slide), wewnętrzny z opóźnieniem pojawia się (fade).
			  Efekt: najpierw robi się miejsce, potem pojawia się treść.
			-->
			<div in:slide={{ duration: 300 * d, easing: cubicOut }}>
				<div
					class="explanation mt-4 p-3 rounded-3"
					class:ok={isCorrect}
					class:nok={!isCorrect}
					in:fade={{ duration: 250 * d, delay: 150 * d }}
				>
					<div class="fw-bold mb-2">
						{isCorrect ? 'Dobrze! 🎉' : 'Niestety nie.'}
					</div>
					{#if explanationHtml}
						<div class="explanation-body">{@html explanationHtml}</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!--
  Style w <style> są SCOPED: Svelte dokleja do selektorów unikalną klasę,
  więc `.letter` tutaj nie wpłynie na żaden inny `.letter` w aplikacji.
-->
<style>
	.quiz-card {
		border: 2px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.175));
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	/* Kolory biorą się ze zmiennych Bootstrapa, więc działają w jasnym i ciemnym motywie. */
	.quiz-card.is-correct {
		border-color: var(--bs-success);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-success-rgb), 0.2);
	}

	.quiz-card.is-wrong {
		border-color: var(--bs-danger);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-danger-rgb), 0.2);
	}

	.answer-btn {
		padding: 0.75rem 1rem;
		border-width: 2px;
		transition:
			background-color 0.25s,
			border-color 0.25s,
			color 0.25s,
			opacity 0.25s,
			transform 0.15s;
	}

	.answer-btn:not([aria-disabled='true']):hover {
		transform: translateX(4px);
	}

	.answer-btn:not([aria-disabled='true']):active {
		transform: scale(0.98);
	}

	.answer-btn[aria-disabled='true'] {
		cursor: default;
	}

	.letter {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 2px solid currentColor;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.icon {
		flex-shrink: 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.dimmed {
		opacity: 0.45;
	}

	/* Animacje CSS odpalają się w chwili dodania klasy — stąd dodajemy je tylko przy świeżym kliknięciu. */
	.picked-correct {
		animation: pop 0.4s ease-out;
	}

	.picked-wrong {
		animation: shake 0.4s ease-in-out;
	}

	.reveal {
		animation: glow 1.2s ease-in-out 0.2s 2;
	}

	@keyframes pop {
		0% { transform: scale(1); }
		40% { transform: scale(1.03); }
		100% { transform: scale(1); }
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-6px); }
		40% { transform: translateX(6px); }
		60% { transform: translateX(-4px); }
		80% { transform: translateX(4px); }
	}

	@keyframes glow {
		0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-success-rgb), 0); }
		50% { box-shadow: 0 0 0 0.35rem rgba(var(--bs-success-rgb), 0.3); }
	}

	.explanation {
		border-left: 4px solid;
	}

	.explanation.ok {
		background: rgba(var(--bs-success-rgb), 0.1);
		border-color: var(--bs-success);
	}

	.explanation.nok {
		background: rgba(var(--bs-danger-rgb), 0.1);
		border-color: var(--bs-danger);
	}

	/*
	 * :global(...) — HTML wstawiony przez {@html} jest niewidoczny dla kompilatora,
	 * więc scoped style by go nie złapały. :global wyłącza scoping dla fragmentu selektora,
	 * a klasa przed nim (.question-text) pilnuje, żeby styl nie rozlał się na całą stronę.
	 */
	.question-text :global(p:last-child),
	.explanation-body :global(p:last-child),
	.explanation-body :global(ul:last-child),
	.explanation-body :global(ol:last-child) {
		margin-bottom: 0;
	}

	.answer-btn :global(code) {
		color: inherit;
	}

	@media (prefers-reduced-motion: reduce) {
		.picked-correct,
		.picked-wrong,
		.reveal {
			animation: none;
		}

		.answer-btn {
			transition: none;
		}
	}
</style>
