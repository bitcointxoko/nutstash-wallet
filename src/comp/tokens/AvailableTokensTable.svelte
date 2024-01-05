<script lang="ts">
	import { token } from '../../stores/tokens';
	import type { Mint } from '../../model/mint';
	import { pendingTokens } from '../../stores/pendingtokens';
	import TokenRow from './TokenRow.svelte';
	import type { Proof } from '@cashu/cashu-ts';
	export let mint: Mint | undefined = undefined;
	export let selectedTokens: Proof[] = [];

	$: selectedTokensBool = [];

	$: isPending = mint ? false : true;

	$: page = 20;
	$: tokenSelection = isPending ? $pendingTokens : $token;
	$: tokenFromMint = mint
		? tokenSelection.filter((t: Proof) => mint?.keysets.includes(t.id))
		: tokenSelection;
	$: tokenSub = tokenFromMint.slice(0, page);
	$: selectedTokens = tokenSub.filter((t, i) => selectedTokensBool[i]);

	const loadMore = () => {
		page += 20;
	};
</script>

<div class="overflow-x-scroll overflow-y-scroll  max-h-40 scrollbar-hide">
	<table class="table table-compact table-zebra w-full">
		<thead>
			<tr>
				<th>
					<div class="flex justify-start items-center gap-1">
						{#if !mint}
							<p class="hidden lg:flex">Pendiente</p>
							<p class="flex lg:hidden">Pnd</p>
							<input
								type="checkbox"
								bind:checked={isPending}
								class="{mint ? 'disabled hidden' : ''} checkbox checkbox-primary "
							/>
						{/if}
					</div>
				</th>

				<th>
					<p class="hidden lg:flex">Cantidad</p>
					<p class="flex lg:hidden">Ctd</p>
				</th>
				<th>Mint</th>
				<th class="w-full">Token</th>
			</tr>
		</thead>
		<tbody class="max-h-1 overflow-y-scroll scrollbar-hide">
			{#each tokenSub as token, i}
				<TokenRow {token} {i} {mint} bind:isSelected={selectedTokensBool[i]} />
			{/each}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<tr class="">
				<td colspan="2" class="cursor-pointer w-5 hover:bg-base-200" on:click={loadMore}>
					cargar más
				</td>
				<td colspan="2" class="cursor-pointer hover:bg-base-200" on:click={() => (page = 999999)}>
					cargar todo
				</td>
			</tr>
		</tbody>
	</table>
</div>
