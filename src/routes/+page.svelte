<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h1>Pytania rekrutacyjne</h1>
<p>Losowe pytania rekrutacyjne z zakresu .NET, Python, JavaScript, SQL i projektowania systemów.</p>

<ul>
	<li>
		<a href={resolve('/questions?category=dotnet')}>Przejdź do pytań z .NET</a>
	</li>
	<li>
		<a href={resolve('/questions?category=python')}>Przejdź do pytań z Pythona</a>
	</li>
	<li>
		<a href={resolve('/questions?category=javascript')}>Przejdź do pytań z JavaScript</a>
	</li>
	<li>
		<a href={resolve('/questions?category=angular')}>Przejdź do pytań z Angulara</a>
	</li>
	<li>
		<a href={resolve('/questions?category=sql')}>Przejdź do pytań z SQL</a>
	</li>
	<li>
		<a href={resolve('/questions?category=system-design')}
			>Przejdź do pytań z projektowania systemów</a
		>
	</li>
</ul>
