<script>
	import { APP_TITLE } from '$lib/data/site-setup.json';
	import { html } from '$post/privacy.md';
</script>

<svelte:head>
	<title>
		隐私政策 | {APP_TITLE}
	</title>
</svelte:head>

<section>
	<header>
		<h1>隐私政策</h1>
		<h2><a href="/">{APP_TITLE}</a></h2>
	</header>

	<article>
		{@html html}
	</article>
</section>

<style>
	section {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		background-color: #ebebeb;
	}

	header {
		height: 20em;
		background-color: #131638;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: #fff;
		background-image: linear-gradient(135deg, #131638 0%, #2a2f6b 60%, #131638 100%);
		position: relative;
	}
	header::after {
		content: '';
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		background-color: rgba(0, 0, 0, 0.55);
	}
	header h1,
	header h2 {
		position: relative;
		z-index: +1;
	}

	header h1 {
		font-size: 2rem;
	}

	header h2 {
		font-size: large;
		margin-top: 1rem;
	}

	header a {
		text-decoration: underline;
		transition: all 0.2s;
	}
	header a:hover {
		color: #dda04f;
	}

	article {
		color: #333;
		padding: 2% 10%;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	article :global(h2) {
		font-family: var(--hsr-os-font);
		padding: 1.5rem 0 0.5rem;
	}

	article :global(p) {
		padding: 0.4rem 0;
	}

	article :global(a) {
		color: #dda04f;
	}

	article :global(ul) {
		list-style-position: inside;
	}

	@media screen and (max-width: 900px) {
		header h1 {
			font-size: 1.2rem;
		}
		header h2 {
			font-size: 1rem;
			margin-top: 0.5rem;
		}

		article {
			padding: 2% 5%;
		}
	}
</style>
