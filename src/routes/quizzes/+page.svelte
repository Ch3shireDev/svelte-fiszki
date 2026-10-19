<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { browser } from '$app/env';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	import { parse } from 'yaml';
	import type { Quiz as QuizType } from '#lib/quiz.type.ts';
	import angularRaw from '#lib/angular-quiz.yaml?raw';
	import dotnetRaw from '#lib/dotnet-quiz.yaml?raw';
	import pythonRaw from '#lib/python-quiz.yaml?raw';
	import javascriptRaw from '#lib/javascript-quiz.yaml?raw';
	import sqlRaw from '#lib/sql-quiz.yaml?raw';
	import systemDesignRaw from '#lib/system-design-quiz.yaml?raw';

	import Quiz from '#lib/Quiz.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const category = $derived((browser && page.url.searchParams.get('category')) || 'all');

	const isDotnet = $derived(category === 'dotnet');
	const isAngular = $derived(category === 'angular');
	const isPython = $derived(category === 'python');
	const isJavascript = $derived(category === 'javascript');
	const isSql = $derived(category === 'sql');
	const isSystemDesign = $derived(category === 'system-design');
	const isAll = $derived(category === 'all');

	let questions: QuizType[] = [];

	if (isDotnet) {
		questions.push(...parse(dotnetRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isAngular) {
		questions.push(...parse(angularRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isPython) {
		questions.push(...parse(pythonRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isJavascript) {
		questions.push(...parse(javascriptRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isSql) {
		questions.push(...parse(sqlRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isSystemDesign) {
		questions.push(...parse(systemDesignRaw)); //.sort(() => Math.random() - 0.5));
	}
	if (isAll) {
		questions.push(...parse(dotnetRaw)); //.sort(() => Math.random() - 0.5));
		questions.push(...parse(angularRaw)); //.sort(() => Math.random() - 0.5));
		questions.push(...parse(pythonRaw)); //.sort(() => Math.random() - 0.5));
		questions.push(...parse(javascriptRaw)); //.sort(() => Math.random() - 0.5));
		questions.push(...parse(sqlRaw)); //.sort(() => Math.random() - 0.5));
		questions.push(...parse(systemDesignRaw)); //.sort(() => Math.random() - 0.5));
	}

	const titles: Record<string, string> = {
		dotnet: 'Pytania z .NET',
		python: 'Pytania z Pythona',
		javascript: 'Pytania z JavaScript',
		sql: 'Pytania z SQL',
		'system-design': 'Pytania z projektowania systemów',
		angular: 'Pytania z Angulara'
	};

	let title = $derived(titles[category] ?? 'Pytania rekrutacyjne');

	let index = $state(0);

	function readIndexFromUrl() {
		const n = Number(page.url.searchParams.get('index'));
		return Number.isInteger(n) && n >= 0 && n < questions.length ? n : 0;
	}

	function syncUrl() {
		const url = new URL(page.url.href);
		url.searchParams.set('index', String(index));
		goto(url, { shallow: true, replace: true, state: {} });
	}

	onMount(() => {
		index = readIndexFromUrl();
	});

	let direction = $state<1 | -1>(1);

	let current = $derived(questions[index]);
	let isFirst = $derived(index === 0);
	let isLast = $derived(index === questions.length - 1);
	let progress = $derived(((index + 1) / questions.length) * 100);

	const DISTANCE = 140;
	let duration = $derived(prefersReducedMotion.current ? 0 : 380);

	function go(step: 1 | -1) {
		const next = index + step;
		if (next < 0 || next >= questions.length) return;
		direction = step;
		index = next;
		syncUrl();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowRight') go(1);
		if (e.key === 'ArrowLeft') go(-1);
	}

	let touchStartX = 0;

	function ontouchstart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].clientX;
	}

	function ontouchend(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
	}
</script>

<svelte:window {onkeydown} />

<div class="container">
	<h1>{title}</h1>

	<div class="d-flex align-items-center gap-3 mt-3">
		<span class="text-body-secondary small text-nowrap counter">
			Pytanie {index + 1} z {questions.length}
		</span>
		<div class="progress flex-grow-1" style="height: 4px">
			<div class="progress-bar" style:width="{progress}%"></div>
		</div>
	</div>

	<div class="stage py-3" {ontouchstart} {ontouchend} role="region">
		{#key current.id}
			<div
				class="slide"
				in:fly={{ x: DISTANCE * direction, duration, easing: cubicOut }}
				out:fly={{ x: -DISTANCE * direction, duration, easing: cubicOut }}
			>
				<Quiz quiz={current} />
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

	<p class="pt-3"><a href={resolve('/')}>Wróć do strony głównej</a></p>
</div>

<style>
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
