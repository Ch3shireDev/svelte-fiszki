<script lang="ts">
  	import '../app.scss'; 
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
 
<div class="p-2">
{@render children()}
</div>