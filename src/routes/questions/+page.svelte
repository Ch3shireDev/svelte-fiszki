<script lang="ts">
  import { resolve } from '$app/paths';
  import { questions } from './questions.ts';

  const randomQuestions = questions.sort(() => Math.random() - 0.5);
</script>

<h1>Questions</h1>

<p>Hello, you've reached the questions page!</p>

<p>Here are the questions, in random order:</p>
<ul>
  {#each randomQuestions as question}
    <li>{question}</li>
  {/each}
</ul>

<p>Go to <a href={resolve("/")}>Home</a> or <a href={resolve("/finish")}>Finish</a></p>