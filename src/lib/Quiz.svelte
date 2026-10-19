<script lang="ts">
	import { marked } from 'marked';
	import { slide, fade, scale } from 'svelte/transition';
	import { cubicOut, backOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { score } from '#lib/score.svelte.ts';
	import type { Quiz } from './quiz.type';

	let { quiz }: { quiz: Quiz } = $props();

	const LETTERS = 'ABCDEFGH';

	let questionHtml = $derived(marked.parse(quiz.question, { async: false }));
	let explanationHtml = $derived(
		quiz.explanation ? marked.parse(quiz.explanation, { async: false }) : ''
	);
	let answers = $derived(
		quiz.answers.map((a, i) => ({
			letter: LETTERS[i] ?? String(i + 1),
			html: marked.parseInline(a.text, { async: false }),
			correct: a.correct
		}))
	);

	let selected = $state<number | null>(null);
	let answer = $state<boolean | null>(null);
	let answered = $derived(selected !== null);

	let d = $derived(prefersReducedMotion.current ? 0 : 1);

	function mark(isCorrect: boolean) {
		if (answer === isCorrect) return;
		if (answer !== null) score.record(answer, -1);
		answer = isCorrect;
		score.record(isCorrect, 1);
	}

	function choose(i: number) {
		if (answered) return;
		selected = i;
		mark(answers[i].correct);
	}

	function variant(i: number, correct: boolean) {
		if (selected === null) return 'btn-outline-secondary';
		if (selected === i) return correct ? 'btn-success picked-correct' : 'btn-danger picked-wrong';
		if (correct) return 'btn-outline-success reveal';
		return 'btn-outline-secondary dimmed';
	}
</script>

<div
	class="quiz-card card shadow-sm"
	class:is-correct={answer === true}
	class:is-wrong={answer === false}
>
	<div class="card-body p-4">
		<div class="question-text fs-5 mb-4">
			{@html questionHtml}
		</div>

		<div class="d-grid gap-2" role="group" aria-label="Odpowiedzi">
			{#each answers as a, i (i)}
				{@const isSelected = selected === i}
				<button
					class="btn answer-btn text-start d-flex align-items-center gap-3 {variant(i, a.correct)}"
					aria-disabled={answered}
					aria-pressed={isSelected}
					onclick={() => choose(i)}
				>
					<span class="letter">{a.letter}</span>
					<span class="flex-grow-1">{@html a.html}</span>
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
			<div in:slide={{ duration: 300 * d, easing: cubicOut }}>
				<div
					class="explanation mt-4 p-3 rounded-3"
					class:ok={answer}
					class:nok={!answer}
					in:fade={{ duration: 250 * d, delay: 150 * d }}
				>
					<div class="fw-bold mb-2">
						{answer ? 'Dobrze! 🎉' : 'Niestety nie.'}
					</div>
					{#if explanationHtml}
						<div class="explanation-body">{@html explanationHtml}</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.quiz-card {
		border: 2px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.175));
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

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
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.03);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-6px);
		}
		40% {
			transform: translateX(6px);
		}
		60% {
			transform: translateX(-4px);
		}
		80% {
			transform: translateX(4px);
		}
	}

	@keyframes glow {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(var(--bs-success-rgb), 0);
		}
		50% {
			box-shadow: 0 0 0 0.35rem rgba(var(--bs-success-rgb), 0.3);
		}
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
