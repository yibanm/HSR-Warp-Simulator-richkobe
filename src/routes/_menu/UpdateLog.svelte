<script>
	import { fade } from 'svelte/transition';
	// 更新日志独立成页且全面中文化（用户 2026-11-05 要求）：
	// 数据源改为本仓库维护的 updates.json（中文要点），不再用上游英文 logs.json。
	import { brief } from '$lib/data/updates.json';
	import Scrollable from '$lib/components/Scrollable.svelte';
</script>

<div class="log-update" in:fade={{ duration: 250 }}>
	<div class="container">
		<Scrollable dark>
			{#each brief as { ver, date, lines }, i (ver)}
				<div class="item">
					<h2>
						<i class="date">v{ver}</i>
						{#if date}
							<span class="log-date">{date}</span>
						{/if}
						{#if i === 0}
							( 最新 )
						{/if}
					</h2>
					{#each lines as line (line)}
						<p>{line}</p>
					{/each}
				</div>
			{/each}
		</Scrollable>
	</div>
</div>

<style>
	.log-update {
		background-color: rgba(255, 255, 255, 0.85);
		width: 100%;
		height: 100%;
		border-top-right-radius: 2rem;
		color: #000;
		padding: 2%;
	}
	.container {
		width: 100%;
		height: 100%;
		mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
	}

	.item {
		padding: 1.2% 0;
		position: relative;
		border-bottom: 1px solid #ccc;
	}

	.item:first-child {
		padding-top: 0;
	}

	.item:last-child {
		border-bottom: none;
	}

	p {
		position: relative;
		padding-left: 2rem;
	}
	p::before {
		content: '';
		display: inline-block;
		line-height: 0;
		position: absolute;
		left: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1rem;
		border-bottom: 0.1rem solid #000;
	}

	h2 {
		font-weight: bold;
		color: rgb(189, 123, 0);
		font-size: 110%;
		padding: 0.08rem 0;
	}

	.log-date {
		font-weight: normal;
		font-size: 85%;
		color: rgba(0, 0, 0, 0.55);
		padding-left: 0.6rem;
	}
</style>
