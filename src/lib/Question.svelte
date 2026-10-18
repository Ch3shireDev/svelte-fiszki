<script lang="ts">
	import type { Question } from './question.type.ts';
	import { marked } from 'marked';
	import { slide, fade, scale } from 'svelte/transition';
	import { cubicOut, backOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { score } from '#lib/score.svelte.ts';

	let { question }: { question: Question } = $props();

	let questionHtml = $derived(marked.parse(question.text, { async: false }));
	let answerHtml = $derived(marked.parse(question.answer, { async: false }));

	let showAnswer = $state(false);
	let answer = $state<boolean | null>(null);

	// mnożnik czasu animacji: 0 dla osób z ograniczeniem ruchu w systemie
	let d = $derived(prefersReducedMotion.current ? 0 : 1);

	function toggleAnswer() {
		showAnswer = !showAnswer;
	}

	function mark(isCorrect: boolean) {
		if (answer === isCorrect) return;
		if (answer !== null) score.record(answer, -1);
		answer = isCorrect;
		score.record(isCorrect, 1);
	}
</script>

<div
	class="question-card card shadow-sm"
	class:is-correct={answer === true}
	class:is-wrong={answer === false}
>
	<div class="card-body p-4">
		<div class="question-text fs-5 mb-4">
			{@html questionHtml}
		</div>

		<button onclick={toggleAnswer} class="btn btn-primary toggle" aria-expanded={showAnswer}>
			<span class="chevron" class:open={showAnswer} aria-hidden="true">▸</span>
			{showAnswer ? 'Ukryj odpowiedź' : 'Pokaż odpowiedź'}
		</button>

		{#if showAnswer}
			<div transition:slide={{ duration: 300 * d, easing: cubicOut }}>
				<div class="answer pt-4" in:fade={{ duration: 250 * d, delay: 150 * d }}>
					{@html answerHtml}
				</div>

				<div class="d-flex flex-wrap align-items-center gap-3 pt-4 pb-1">
					<button
						class="btn btn-outline-success mark"
						class:active={answer === true}
						class:dimmed={answer === false}
						aria-pressed={answer === true}
						onclick={() => mark(true)}
					>
						✓ Poprawna
					</button>
					<button
						class="btn btn-outline-danger mark"
						class:active={answer === false}
						class:dimmed={answer === true}
						aria-pressed={answer === false}
						onclick={() => mark(false)}
					>
						✗ Niepoprawna
					</button>

					{#key answer}
						{#if answer !== null}
							<span
								class="badge rounded-pill verdict"
								class:text-bg-success={answer}
								class:text-bg-danger={!answer}
								in:scale={{ start: 0.4, duration: 300 * d, easing: backOut }}
							>
								{answer ? 'Zaliczone 🎉' : 'Do powtórki'}
							</span>
						{/if}
					{/key}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.question-card {
		border: 2px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.175));
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.question-card.is-correct {
		border-color: var(--bs-success);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-success-rgb), 0.2);
		animation: pop 0.4s ease-out;
	}

	.question-card.is-wrong {
		border-color: var(--bs-danger);
		box-shadow: 0 0 0 0.3rem rgba(var(--bs-danger-rgb), 0.2);
		animation: shake 0.4s ease-in-out;
	}

	@keyframes pop {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.02);
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

	.question-text :global(p:last-child),
	.answer :global(p:last-child),
	.answer :global(ul:last-child),
	.answer :global(ol:last-child) {
		margin-bottom: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.question-card {
			animation: none !important;
		}

		.chevron,
		.mark {
			transition: none;
		}
	}
</style>
