<script lang="ts">
	import { resolve } from '$app/paths';
	import { scale } from 'svelte/transition';

	let {
		correctAnswers,
		wrongAnswers,
		totalQuestions
	}: { correctAnswers: number; wrongAnswers: number; totalQuestions: number } = $props();

	let answered = $derived(correctAnswers + wrongAnswers);
	let correctPct = $derived(totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0);
	let wrongPct = $derived(totalQuestions > 0 ? (wrongAnswers / totalQuestions) * 100 : 0);
	let accuracy = $derived(answered > 0 ? Math.round((correctAnswers / answered) * 100) : null);
</script>

<nav class="navbar app-nav sticky-top shadow-sm flex-column align-items-stretch p-0">
	<div class="container-fluid py-2 flex-nowrap gap-2">
		<a class="navbar-brand fw-bold d-flex align-items-center gap-2 me-0" href={resolve('/')}>
			<span class="logo" aria-hidden="true">🃏</span>
			Fiszki
		</a>

		<div class="d-flex align-items-center gap-2 ms-auto">
			<span class="badge rounded-pill text-bg-success stat" title="Poprawne odpowiedzi">
				<span aria-hidden="true">✓</span>
				<span class="d-none d-md-inline">Poprawne</span>
				{#key correctAnswers}
					<span class="count" in:scale={{ start: 1.8, duration: 350 }}>{correctAnswers}</span>
				{/key}
			</span>

			<span class="badge rounded-pill text-bg-danger stat" title="Błędne odpowiedzi">
				<span aria-hidden="true">✗</span>
				<span class="d-none d-md-inline">Błędne</span>
				{#key wrongAnswers}
					<span class="count" in:scale={{ start: 1.8, duration: 350 }}>{wrongAnswers}</span>
				{/key}
			</span>

			{#if accuracy !== null}
				<span
					class="badge rounded-pill border stat d-none d-sm-inline-flex"
					class:border-success={accuracy >= 70}
					class:text-success={accuracy >= 70}
					class:border-warning={accuracy >= 40 && accuracy < 70}
					class:text-warning={accuracy >= 40 && accuracy < 70}
					class:border-danger={accuracy < 40}
					class:text-danger={accuracy < 40}
					title="Skuteczność"
				>
					{accuracy}%
				</span>
			{/if}
		</div>
	</div>

	<div
		class="progress rounded-0 bg-secondary bg-opacity-25"
		style="height: 6px"
		role="progressbar"
		aria-label="Postęp quizu"
		aria-valuenow={answered}
		aria-valuemin={0}
		aria-valuemax={totalQuestions}
	>
		<div class="progress-bar bg-success" style:width="{correctPct}%"></div>
		<div class="progress-bar bg-danger" style:width="{wrongPct}%"></div>
	</div>
</nav>

<style>
	.app-nav {
		--nav-bg: #f8f9fa;
		--nav-fg: #212529;
		--nav-border: rgba(0, 0, 0, 0.08);

		--bs-navbar-brand-color: var(--nav-fg);
		--bs-navbar-brand-hover-color: var(--nav-fg);
		background-color: var(--nav-bg);
		color: var(--nav-fg);
		border-bottom: 1px solid var(--nav-border);
		transition:
			background-color 0.3s,
			color 0.3s;
	}

	@media (prefers-color-scheme: dark) {
		.app-nav {
			--nav-bg: #212529;
			--nav-fg: #f8f9fa;
			--nav-border: rgba(255, 255, 255, 0.08);
		}
	}

	.logo {
		display: inline-block;
		transition: transform 0.3s;
	}

	.navbar-brand:hover .logo {
		transform: rotate(-12deg) scale(1.15);
	}

	.stat {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
		padding: 0.45em 0.8em;
	}

	.count {
		display: inline-block;
		font-variant-numeric: tabular-nums;
		min-width: 1ch;
	}

	.progress-bar {
		transition: width 0.4s ease;
	}
</style>
