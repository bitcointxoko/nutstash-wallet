<script>
	import { browser } from '$app/environment';
	import { toast } from '../../stores/toasts';
	import { history } from '../../stores/history';

	const resetHistory = () => {
		history.set([]);
		toast('info', 'el historial se ha borrado', 'Hecho!');
		if (browser) {
			// @ts-expect-error
			document.getElementById('reset-history-modal').checked = false;
		}
	};
</script>

<label for="reset-history-modal" class="btn btn-error">Borrar historial</label>

<!-- Put this part before </body> tag -->
<input type="checkbox" id="reset-history-modal" class="modal-toggle" />
<div class="modal">
	<div class="modal-box">
		<p class="py-4">
			¿Estás seguro de que quieres borrar tu historial? Conservarás tus tokens y mints.
		</p>
		<div class="modal-action">
			<label for="reset-history-modal" class="btn btn-outline">cancelar</label>
			<button on:click={resetHistory} class="btn btn-error">Borrar</button>
		</div>
	</div>
</div>
