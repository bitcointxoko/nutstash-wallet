<script lang="ts">
	import { CashuMint } from '@cashu/cashu-ts';
	import type { Mint } from '../../model/mint';
	import { mints } from '../../stores/mints';
	import { toast } from '../../stores/toasts';
	import LoadingCenter from '../LoadingCenter.svelte';
	import { validateMintKeys } from '../util/walletUtils';
	import Minting from './Minting.svelte';
	import MintRow from './MintRow.svelte';
	import MintRowAdd from './MintRowAdd.svelte';
	import MintSwap from './MintSwap.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	let mintURL = '';
	let isLoading = false;
	let isAddMintPing = false;

	let activeMint = $mints[0];

	let active = 'base';

	onMount(() => {
		const searchParams = $page.url.searchParams;

		if (searchParams) {
			const mintUrlParam = searchParams.get('mint');
			if (mintUrlParam) {
				mintURL = mintUrlParam;
				$page.url.searchParams.delete('mint');
				history.replaceState({}, '', $page.url);
				if (mintURL) {
					isAddMintPing = true;
				}
			}
		}
	});

	const addMint = async () => {
		isAddMintPing = false;
		const mint = new CashuMint(mintURL);
		try {
			if ($mints.filter((m) => m.mintURL === mint.mintUrl).length > 0) {
				toast('aviso', 'este mint ya ha sido añadido.', "No añadió mint!");
				return;
			}
			isLoading = true;
			const keysets = await mint.getKeySets();
			const keys = await mint.getKeys();

			if (!validateMintKeys(keys)) {
				toast('error', 'las claves de ese mint no son válidas', 'no se pudo añadir el mint');
				return;
			}

			const storeMint: Mint = {
				mintURL: mint.mintUrl,
				keys,
				keysets: keysets.keysets,
				isAdded: true
			};

			mints.update((state) => [...state, storeMint]);
			toast('éxito', 'Se ha añadido el mint', 'Éxito!');
		} catch {
			toast(
				'error',
				'no se han podido cargar las claves desde:' + mint.mintUrl + '/keys',
				'No se puede añadir el mint.'
			);
			throw new Error('Could not add Mint.');
		} finally {
			isLoading = false;
		}
	};
</script>

{#if active === 'base'}
	<div class="flex flex-col gap-3">
		<div class="max-h-52 overflow-auto scrollbar-hide">
			<table class="table table-auto w-full">
				<!-- head -->
				<thead>
					<tr>
						<th class="w-full">Mint</th>
						<th>Acciones</th>
						<th>
							<p class="hidden lg:flex">Saldo</p>
							<p class="flex lg:hidden">Ctd</p>
						</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{#if $mints.length === 0}
						<tr class="hover">
							<td colspan="4"> aún no se han añadido mints. </td>
						</tr>
					{/if}
					{#each $mints as mint, mintIndex}
						{#if mint.isAdded}
							<MintRow {mint} {mintIndex} bind:activeMint bind:active />
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		{#if $mints.filter((m) => m.isAdded).length > 1}
			<div class="flex w-full items-center justify-center">
				<button class="btn btn-lg btn-info flex gap-2" on:click={() => (active = 'swap')}>
					<p>Intercambio entre mints</p>
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
				</button>
			</div>
		{/if}
		<div class="pt-5">
		</div>
		{#if $mints.filter((m) => !m.isAdded).length > 0}
			<div class="max-h-56">
				<table class="table table-compact table-zebra table-auto w-full">
					<!-- head -->
					<thead>
						<tr>
							<th>Mint</th>
							<th class="max-w-min" />
						</tr>
					</thead>
					<tbody>
						{#each $mints as mint, mintIndex}
							{#if !mint.isAdded}
								<MintRowAdd {mint} {mintIndex} />
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="grid grid-cols-5 gap-2">
			<div class="col-span-5 grid grid-cols-5 items-center">
				<label for="mint-url-input"> Alojamiento Mint: </label>
				<input
					id="mint-url-input"
					type="text"
					bind:value={mintURL}
					class="input w-full input-primary col-span-4"
				/>
			</div>
			{#if isLoading}
				<LoadingCenter />
			{:else}
				<button
					class="btn btn-primary h-full z-20 flex gap-2 items-center"
					on:click={() => {
						addMint();
					}}
				>
					Añadir Mint
					{#if isAddMintPing}
						<span class="flex h-3 w-3">
							<div
								class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-secondary opacity-75"
							/>
							<div class="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
						</span>
					{/if}
				</button>
			{/if}
		</div>
	</div>
{:else if active === 'minting'}
	<Minting mint={activeMint} bind:active />
{:else}
	<MintSwap bind:active />
{/if}
