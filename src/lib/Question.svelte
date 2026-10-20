<!--
  src/lib/Question.svelte
  Jedna fiszka: pytanie, odkrywana odpowiedź i samoocena „poprawna / niepoprawna”.

  ─────────────────────────────────────────────────────────────────────────────
  WZORZEC: KOMPONENT KONTROLOWANY (controlled component)

  Fiszka NIE pamięta sama, jak ją oceniłeś. Dostaje ocenę z zewnątrz w propsie
  `marked`, a kliknięcie tylko ZGŁASZA rodzicowi przez callback `onmark`.
  Rodzic zapisuje ocenę (localStorage, punktacja) i przekazuje nową wartość
  `marked` z powrotem w dół.

  Dzięki temu po powrocie do fiszki albo odświeżeniu strony komponent od razu
  pokazuje zapamiętaną ocenę — bo dostaje ją w propsie.
  Odpowiednik w Angularze: "głupi" komponent z @Input() i @Output().

  W odróżnieniu od quizu ocenę MOŻNA zmienić: to samoocena, a nie test,
  więc nie ma tu czego "oszukać".
  ─────────────────────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import { marked as md } from 'marked';
	import { slide, fade, scale } from 'svelte/transition';
	import { cubicOut, backOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Question } from '#lib/question.type.ts';

	interface Props {
		/** Fiszka do wyświetlenia. */
		question: Question;
		/** Zapamiętana ocena: true = wiedziałem, false = nie wiedziałem, null = jeszcze nie oceniono. */
		marked: boolean | null;
		/** Wywoływane przy kliknięciu oceny. Rodzic decyduje, co z tym zrobić. */
		onmark: (isCorrect: boolean) => void;
	}

	/*
	 * $props() — rune do odbierania propsów (odpowiednik @Input w Angularze).
	 * Destrukturyzacja jest REAKTYWNA: gdy rodzic przekaże nowe `marked`,
	 * ta zmienna od razu ma nową wartość.
	 *
	 * Bibliotekę `marked` zaimportowaliśmy pod nazwą `md`, bo nazwa `marked`
	 * jest tu zajęta przez prop. `import { a as b }` to zwykła zmiana nazwy przy imporcie.
	 */
	let { question, marked, onmark }: Props = $props();

	/*
	 * $derived — wartość wyliczana z innych reaktywnych wartości, zapamiętywana (cache).
	 * Markdown parsuje się raz na fiszkę, a nie przy każdym renderze.
	 * `{ async: false }` mówi TypeScriptowi, że wynik to `string`, a nie Promise.
	 */
	let questionHtml = $derived(md.parse(question.text, { async: false }));
	let answerHtml = $derived(md.parse(question.answer, { async: false }));

	/*
	 * Czy odpowiedź jest odkryta.
	 *
	 * To NADPISYWALNY $derived: domyślnie wynosi `marked !== null`, czyli fiszka już oceniona
	 * startuje z odkrytą odpowiedzią (przyciski oceny są w środku, więc i tak chcesz je widzieć).
	 * Kliknięcie „Pokaż / Ukryj” PRZYPISUJE nową wartość i ona obowiązuje, dopóki nie zmieni się
	 * `marked` — wtedy wartość znów wyliczy się z wyrażenia.
	 *
	 * Dlaczego nie `$state(marked !== null)`? Bo $state zapamiętałby tylko wartość początkową
	 * i nie zareagowałby na zmianę propsa.
	 */
	let showAnswer = $derived(marked !== null);

	/*
	 * $state — zwykły lokalny, reaktywny stan.
	 * `fresh` mówi, czy oceniłeś fiszkę W TEJ CHWILI, a nie że ocena przyszła z pamięci.
	 * Animacje "pop" i "shake" na karcie odpalamy tylko przy świeżym kliknięciu.
	 */
	let fresh = $state(false);

	/** Mnożnik czasu animacji: 0 dla osób z ograniczeniem ruchu w systemie, 1 dla reszty. */
	let d = $derived(prefersReducedMotion.current ? 0 : 1);

	function toggleAnswer() {
		showAnswer = !showAnswer;
	}

	/**
	 * Kliknięcie oceny. Ponowne kliknięcie tej samej oceny nic nie robi.
	 * Zmiana zdania jest dozwolona — rodzic sam cofnie stary punkt i doliczy nowy.
	 */
	function mark(isCorrect: boolean) {
		if (marked === isCorrect) return;
		fresh = true;
		onmark(isCorrect);
	}
</script>

<!--
  `class:nazwa={warunek}` — dyrektywa Svelte: dodaje klasę, gdy warunek jest prawdziwy.
  Animacje pop/shake doklejamy tylko przy świeżej ocenie (`fresh`).
-->
<div
	class="question-card card shadow-sm"
	class:is-correct={marked === true}
	class:is-wrong={marked === false}
	class:animate-pop={fresh && marked === true}
	class:animate-shake={fresh && marked === false}
>
	<div class="card-body p-4">
		<!--
		  {@html ...} wstawia gotowy HTML bez escapowania.
		  Bezpieczne tylko dla treści, którą kontrolujesz (tu: twoje YAML-e w repo).
		-->
		<div class="question-text fs-5 mb-4">
			{@html questionHtml}
		</div>

		<!-- aria-expanded mówi czytnikom ekranu, czy sekcja z odpowiedzią jest rozwinięta. -->
		<button onclick={toggleAnswer} class="btn btn-primary toggle" aria-expanded={showAnswer}>
			<span class="chevron" class:open={showAnswer} aria-hidden="true">▸</span>
			{showAnswer ? 'Ukryj odpowiedź' : 'Pokaż odpowiedź'}
		</button>

		<!--
		  {#if} — warunkowe renderowanie: element powstaje i znika z DOM-u.

		  `transition:slide` działa w obie strony (pojawianie i znikanie), w przeciwieństwie do `in:`/`out:`.
		  Przejścia w Svelte 5 są domyślnie LOKALNE: grają tylko wtedy, gdy przełącza się ich własny
		  blok {#if}, a nie przy pierwszym renderze komponentu. Dlatego fiszka oceniona wczoraj
		  pokazuje się od razu odkryta, bez animacji, a kliknięcie „Pokaż” animuje się ładnie.
		-->
		{#if showAnswer}
			<div transition:slide={{ duration: 300 * d, easing: cubicOut }}>
				<!-- Wewnętrzny div pojawia się z opóźnieniem: najpierw robi się miejsce, potem treść. -->
				<div class="answer pt-4" in:fade={{ duration: 250 * d, delay: 150 * d }}>
					{@html answerHtml}
				</div>

				<div class="d-flex flex-wrap align-items-center gap-3 pt-4 pb-1">
					<!--
					  aria-pressed — przycisk-przełącznik: czytnik ekranu ogłosi, który jest wciśnięty.
					  `active` to klasa Bootstrapa wypełniająca kolorem przycisk typu outline.
					-->
					<button
						class="btn btn-outline-success mark"
						class:active={marked === true}
						class:dimmed={marked === false}
						aria-pressed={marked === true}
						onclick={() => mark(true)}
					>
						✓ Poprawna
					</button>
					<button
						class="btn btn-outline-danger mark"
						class:active={marked === false}
						class:dimmed={marked === true}
						aria-pressed={marked === false}
						onclick={() => mark(false)}
					>
						✗ Niepoprawna
					</button>

					<!--
					  {#key marked} — gdy ocena się zmieni, zawartość bloku jest tworzona od nowa,
					  więc animacja `in:scale` odpala się przy każdej zmianie zdania.
					  Przy pierwszym renderze (ocena z pamięci) nie gra — przejścia są lokalne.
					-->
					{#key marked}
						{#if marked !== null}
							<span
								class="badge rounded-pill verdict"
								class:text-bg-success={marked}
								class:text-bg-danger={!marked}
								in:scale={{ start: 0.4, duration: 300 * d, easing: backOut }}
							>
								{marked ? 'Zaliczone 🎉' : 'Do powtórki'}
							</span>
						{/if}
					{/key}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Style w <style> są SCOPED: obowiązują tylko w tym komponencie. -->
<style>
	.question-card {
		border: 2px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.175));
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	/* Kolory ze zmiennych Bootstrapa, więc działają w jasnym i ciemnym motywie. */
	.question-card.is-correct {
		border-color: var(--bs-success);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-success-rgb), 0.2);
	}

	.question-card.is-wrong {
		border-color: var(--bs-danger);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-danger-rgb), 0.2);
	}

	/* Animacja CSS odpala się w chwili dodania klasy. */
	.animate-pop {
		animation: pop 0.4s ease-out;
	}

	.animate-shake {
		animation: shake 0.4s ease-in-out;
	}

	@keyframes pop {
		0% { transform: scale(1); }
		40% { transform: scale(1.02); }
		100% { transform: scale(1); }
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-6px); }
		40% { transform: translateX(6px); }
		60% { transform: translateX(-4px); }
		80% { transform: translateX(4px); }
	}

	.chevron {
		display: inline-block;
		transition: transform 0.25s ease;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.mark {
		transition:
			opacity 0.25s,
			transform 0.15s;
	}

	.mark:active {
		transform: scale(0.96);
	}

	.mark.dimmed {
		opacity: 0.45;
	}

	.verdict {
		font-size: 0.9rem;
		padding: 0.5em 0.9em;
	}

	/*
	 * :global(...) — HTML z {@html} jest niewidoczny dla kompilatora, więc scoped style
	 * by go nie złapały. Klasa przed :global pilnuje, żeby styl nie rozlał się na całą stronę.
	 */
	.question-text :global(p:last-child),
	.answer :global(p:last-child),
	.answer :global(ul:last-child),
	.answer :global(ol:last-child) {
		margin-bottom: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-pop,
		.animate-shake {
			animation: none;
		}

		.chevron,
		.mark {
			transition: none;
		}
	}
</style>
