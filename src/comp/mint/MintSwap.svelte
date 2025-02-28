<script lang="ts">
	import { token } from '../../stores/tokens';
	import type { Mint } from '../../model/mint';
	import { mints } from '../../stores/mints';
	import { getAmountForTokenSet, getTokensForMint, getTokensToSend } from '../util/walletUtils';
	import { toast } from '../../stores/toasts';
	import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
	import LoadingCenter from '../LoadingCenter.svelte';
	import { updateMintKeys } from '../../actions/walletActions';

	export let active;
	let swapOutMint: Mint;
	let swapInMint: Mint;
	let swapAmount: number;
	let fees: number;
	let paymentHash: string;
	let invoice: string;
	let isPrepare: boolean;
	let isPerform: boolean;
	let isComplete: boolean;

	const inverseMints = () => {
		const c = swapInMint;
		swapInMint = swapOutMint;
		swapOutMint = c;
	};

	const prepareSwap = async () => {
		if (swapAmount < 1) {
			toast('aviso', 'La cantidad debe ser superior a 0.', 'No se puede realizar el intercambio');
			return;
		}
		const availableTokens = getAmountForTokenSet(getTokensForMint(swapOutMint, $token));
		if (swapAmount > availableTokens) {
			toast('aviso', 'No hay fondos suficientes para realizar este intercambio', 'No se puede realizar el intercambio');
			return;
		}
		try {
			isPrepare = true;
			const cashuSwapInMint = new CashuMint(swapInMint.mintURL);
			const cashuSwapInWallet = new CashuWallet(cashuSwapInMint, swapInMint.keys);

			const { pr, hash } = await cashuSwapInWallet.requestMint(swapAmount);
			paymentHash = hash;
			invoice = pr;
			const cashuSwapOutMint = new CashuMint(swapOutMint.mintURL);
			const cashuSwapOutWallet = new CashuWallet(cashuSwapOutMint, swapInMint.keys);

			const loadedFees = await cashuSwapOutWallet.getFee(pr);
			if (loadedFees + swapAmount > availableTokens) {
				isPrepare = false;
				toast(
					'aviso',
					'La cantidad del swap, incluida la comisión, supera la cantidad disponible',
					'No se puede realizar el intercambio'
				);
				return;
			}
			fees = loadedFees;
			isPrepare = false;
		} catch (e) {
			console.error(e);
			toast('error', 'No se ha podido preparar el intercambio', 'Se ha producido un error al preparar el intercambio');
			isPrepare = false;
		}
	};

	const performSwap = async () => {
		try {
			isPerform = true;
			const cashuSwapInMint = new CashuMint(swapInMint.mintURL);
			const cashuSwapInWallet = new CashuWallet(cashuSwapInMint, swapInMint.keys);

			const cashuSwapOutMint = new CashuMint(swapOutMint.mintURL);
			const cashuSwapOutWallet = new CashuWallet(cashuSwapOutMint, swapOutMint.keys);

			const proofsToSend = getTokensToSend(
				swapAmount + fees,
				getTokensForMint(swapOutMint, $token)
			);

			const {
				returnChange,
				send,
				newKeys: newOutKeys
			} = await cashuSwapOutWallet.send(swapAmount + fees, proofsToSend);
			if (newOutKeys) {
				updateMintKeys(swapOutMint, newOutKeys);
			}
			console.log(send);
			// remove sent tokens from storage
			token.update((state) => {
				return state.filter((token) => !proofsToSend.includes(token));
			});
			if (returnChange) {
				token.update((state) => [...returnChange, ...state]);
			}
			const {
				isPaid,
				preimage,
				change,
				newKeys: newInKeys
			} = await cashuSwapOutWallet.payLnInvoice(invoice, send);
			if (newInKeys) {
				updateMintKeys(swapOutMint, newInKeys);
			}
			if (!isPaid) {
				token.update((state) => [...send, ...state]);
				isPerform = false;

				toast(
					'error',
					'Algo ha ido mal. Vuelve a intentarlo',
					'Se ha producido un error al realizar el intercambio'
				);
				return;
			} else {
				token.update((state) => [...change, ...state]);
			}

			const { proofs: newProofs, newKeys } = await cashuSwapInWallet.requestTokens(
				swapAmount,
				paymentHash
			);
			if (newKeys) {
				updateMintKeys(swapOutMint, newKeys);
			}
			token.update((state) => [...newProofs, ...state]);
			toast('éxito', 'El intercambio se ha completado con éxito', 'Intercambio completado');
			isPerform = false;
			isComplete = true;
			//todo history
		} catch (e) {
			isPerform = false;
			console.error(e);
			toast('error', 'No se ha podido realizar el intercambio', 'Se ha producido un error al realizar el intercambio');
		}
	};

	const resetState = () => {
		swapOutMint = undefined;
		swapInMint = undefined;
		swapAmount = undefined;
		fees = undefined;
		paymentHash = undefined;
		invoice = undefined;
		isPrepare = false;
		isPerform = false;
		isComplete = false;
		active = 'base';
	};
</script>

{#if isComplete}
	<!-- content here -->

	<div class="flex w-full h-full flex-col items-center justify-center gap-5">
		<p class="text-lg font-bold text-success">Los tokens han sido intercambiados.</p>
		<button class="btn btn-success">
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
					d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		</button>
	</div>
	<div class="modal-action">
		<button class="btn btn-outline" on:click={resetState}>ok</button>
	</div>
{:else}
	<!-- else content here -->
	<div class="flex flex-col gap-2">
		<p class="text-xl font-bold">Intercambio entre Mints</p>
		<p class="">Cambiar tokens de un Mint por tokens de otro Mint.</p>
		<p class="">
			⚠️ Por un breve momento, confiarás en dos Mints al mismo tiempo. Hay cosas que pueden salir mal. Utilízalas bajo tu propia responsabilidad.
		</p>
		<div class="grid grid-cols-5 items-center gap-4">
			<div class="col-span-2">
				<label for="mint-send-dropdown">
					<p class="font-bold">Swap-Out Mint:</p>
				</label>
			</div>
			<div class="dropdown col-span-3" id="mint-swapOut-dropdown">
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<!-- svelte-ignore a11y-label-has-associated-control -->
				<label
					tabindex="0"
					class="btn {fees !== undefined
						? 'btn-disabled'
						: ''} max-w-[12em] md:max-w-[20em] lg:max-w-[14em] xl:max-w-[20em]"
				>
					<p class="truncate max-w-xs text-xs">
						{swapOutMint?.mintURL ?? 'choose a mint'}
					</p>
				</label>

				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<ul
					tabindex="0"
					class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 md:w-72 max-h-56 overflow-scroll flex-row scrollbar-hide"
				>
					{#each $mints.filter((m) => m.isAdded && m != swapInMint) as m}
						<!-- svelte-ignore a11y-missing-attribute -->
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<li on:click={() => (swapOutMint = m)}><a>{m.mintURL}</a></li>
					{/each}
				</ul>
			</div>
			<button
				on:click={inverseMints}
				class="col-span-5 btn btn-circle {fees !== undefined ? 'btn-disabled' : ''}"
			>
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
						d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
					/>
				</svg>
			</button>
			<div class="col-span-2">
				<label for="mint-send-dropdown">
					<p class="font-bold">Swap-In Mint:</p>
				</label>
			</div>
			<div class="dropdown" id="mint-swapIn-dropdown">
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<!-- svelte-ignore a11y-label-has-associated-control -->
				<label
					tabindex="0"
					class="btn {fees !== undefined
						? 'btn-disabled'
						: ''} max-w-[12em] md:max-w-[20em] lg:max-w-[14em] xl:max-w-[20em]"
				>
					<p class="truncate max-w-xs text-xs">
						{swapInMint?.mintURL ?? 'choose a mint'}
					</p>
				</label>

				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<ul
					tabindex="0"
					class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 md:w-72 max-h-56 overflow-scroll flex-row scrollbar-hide"
				>
					{#each $mints.filter((m) => m.isAdded && m != swapOutMint) as m}
						<!-- svelte-ignore a11y-missing-attribute -->
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<li on:click={() => (swapInMint = m)}><a>{m.mintURL}</a></li>
					{/each}
				</ul>
			</div>
		</div>
		{#if swapInMint && swapOutMint}
			<div class="grid grid-cols-5 gap-2 items-center pt-5">
				<p class="col-span-2">Available:</p>
				<p class="col-span-3">
					{getAmountForTokenSet(getTokensForMint(swapOutMint, $token))}
				</p>
				<p class="col-span-2">Amount to swap:</p>
				<input
					type="number"
					class="col-span-3 input {fees !== undefined ? 'btn-disabled' : 'input-primary'}"
					bind:value={swapAmount}
				/>

				<p class="col-span-2">{fees !== undefined ? 'Fees:' : 'Prepare Swap:'}</p>
				<div class="col-span-3">
					{#if isPrepare}
						<div class="flex justify-start w-min">
							<LoadingCenter />
						</div>
					{:else}
						<!-- else content here -->
						{#if fees !== undefined}
							<p>{fees}</p>
						{:else}
							<button
								class="btn btn-primary {swapAmount ? '' : 'btn-disabled'}"
								on:click={prepareSwap}
							>
								Confirm Amount
							</button>
						{/if}
					{/if}
				</div>
				{#if fees !== undefined}
					<div class="col-span-5 divider m-1" />
					<p class="col-span-2 font-bold">Total:</p>
					<p class="col-span-3 font-bold">{swapAmount + fees}</p>
				{/if}
			</div>
		{/if}

		<div class="pt-5" />

		<div class="flex gap-2">
			<button class="btn" on:click={resetState}> cancel </button>
			{#if isPerform}
				<div>
					<LoadingCenter />
				</div>
			{:else}
				<button
					class="btn {fees !== undefined ? 'btn-primary' : 'btn-disabled'} flex gap-2"
					on:click={performSwap}
				>
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
							d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
						/>
					</svg>
					<p>Swap</p>
				</button>
			{/if}
		</div>
	</div>
{/if}
