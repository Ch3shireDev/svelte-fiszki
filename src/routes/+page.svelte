<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>Pytania rekrutacyjne</h1>
<p>Losowe pytania rekrutacyjne z zakresu .NET, Python, JavaScript, SQL i projektowania systemów.</p>

<ul>
	<li>
		<a href={resolve('/questions?category=dotnet')}>Przejdź to pytań z .NET</a>
	</li>
	<li>
		<a href={resolve('/questions?category=python')}>Przejdź to pytań z Pythona</a>
	</li>
	<li>
		<a href={resolve('/questions?category=javascript')}>Przejdź to pytań z JavaScript</a>
	</li>
	<li>
		<a href={resolve('/questions?category=sql')}>Przejdź to pytań z SQL</a>
	</li>
	<li>
		<a href={resolve('/questions?category=system-design')}
			>Przejdź to pytań z projektowania systemów</a
		>
	</li>
</ul>
