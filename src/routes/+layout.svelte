<script lang="ts">
	import '../app.scss';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import Navbar from '#lib/Navbar.svelte';
	import { score } from '#lib/score.svelte.ts';
	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Navbar correctAnswers={score.correct} wrongAnswers={score.wrong} totalQuestions={score.total} />
<div class="p-2">
	{@render children()}
</div>
