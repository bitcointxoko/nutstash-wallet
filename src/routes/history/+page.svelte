<script>
	import HistoryTable from '../../comp/history/HistoryTable.svelte';
</script>

<div class="m-auto p-2">
	<div class="w-full flex flex-col text-center gap-2">
		<div class="flex justify-between items-center">
			<a href="/" class="btn btn-circle">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
					/>
				</svg>
			</a>
			<p class="text-xl font-bold">Historial</p>
			<div class="btn-square btn invisible" />
		</div>
		<HistoryTable />
	</div>
</div>
