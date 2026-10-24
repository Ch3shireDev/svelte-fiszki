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
		<a href={resolve('/questions?category=system-design')}>Przejdź do pytań z system design</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=dotnet')}>Przejdź do zadań z .NET</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=python')}>Przejdź do zadań z Pythona</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=javascript')}>Przejdź do zadań z JavaScript</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=angular')}>Przejdź do zadań z Angulara</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=sql')}>Przejdź do zadań z SQL</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=system-design')}>Przejdź do zadań z system design</a>
	</li>
	<li>
		<a href={resolve('/quizzes?category=dotnet-memory')}>Przejdź do zadań z pamięci .NET</a>
	</li>
</ul>
