<script lang="ts">
	import { CashuMint, CashuWallet, getDecodedToken } from '@cashu/cashu-ts';
	import { toast } from '../../stores/toasts';
	import { mints } from '../../stores/mints';
	import LoadingCenter from '../LoadingCenter.svelte';
	import { token } from '../../stores/tokens';
	import type { Mint } from '../../model/mint';
	import { history } from '../../stores/history';
	import { HistoryItemType } from '../../model/historyItem';
	import { getKeysetsOfTokens, validateMintKeys } from '../util/walletUtils';
	import NostrReceiveQr from '../elements/NostrReceiveQR.svelte';
	import { updateMintKeys } from '../../actions/walletActions';

	export let active;

	let mint: Mint | undefined;
	let mintId: string = '';
	export let encodedToken: string = '';
	let isValid = false;
	let isLoading = false;
	let amount = 0;
	let mintToAdd = '';
	let isLoadingMint = false;
	let pasteMessage = 'from clipboard';

	const receive = async () => {
		if (!isValid) {
			toast('aviso', 'El token no es válido', 'Fallo de validación');
			return;
		}

		try {
			mint = findMintById($mints, mintId);
			if (!mint) {
				toast(
					'aviso',
					'Recibir tokens de este mint añadiendo el mint',
					'No conectado a este mint'
				);
				mintToAdd = getDecodedToken(encodedToken).token[0].mint;
				return;
			}
			const cashuMint: CashuMint = new CashuMint(mint.mintURL);
			const cashuWallet: CashuWallet = new CashuWallet(cashuMint, mint.keys);

			isLoading = true;
			const { token: tokens, tokensWithErrors, newKeys } = await cashuWallet.receive(encodedToken);

			if (newKeys) {
				updateMintKeys(mint, newKeys);
			}
			const proofs = tokens.token.map((t) => t.proofs).flat();
			token.update((state) => [...state, ...proofs]);

			if (tokensWithErrors) {
				throw new Error('Not all tokens could be redeemed');
			}

			history.update((state) => [
				{
					type: HistoryItemType.RECEIVE,
					amount,
					date: Date.now(),
					data: {
						encodedToken,
						mint: mint?.mintURL ?? '',
						keyset: getKeysetsOfTokens(proofs),
						receivedTokens: proofs
					}
				},
				...state
			]);
			toast('éxito', `${amount} tokens recibidos`, 'Tokens recibidos!');
			resetState();
		} catch (error) {
			console.error(error);
			toast(
				'error',
				'Los tokens no son válidos o ya se han canjeado',
				'No se han podido recibir los tokens'
			);
		} finally {
			isLoading = false;
		}
	};

	const findMintById = (mints: Array<Mint>, id: string) => {
		return mints.filter((m) => m.isAdded && m.keysets.includes(id))[0];
	};

	const validateToken = () => {
		amount = 0;
		try {
			const { token } = getDecodedToken(encodedToken);
			const proofs = token[0].proofs;
			const mint = token[0].mint;
			proofs.forEach((t) => {
				mintId = t.id;
				amount += t.amount;
			});
			isValid = true;
		} catch {
			mintId = '';
			amount = 0;
			toast('aviso', 'no se ha podido descodificar el token', 'el token no es válido');
		}
	};

	const resetState = () => {
		encodedToken = '';
		isLoading = false;
		isValid = false;
		mintId = '';
		amount = 0;
		mint = undefined;
		active = 'base';
		mintToAdd = '';
		pasteMessage = 'from clipboard';
	};
	const trustMint = async () => {
		const mint = new CashuMint(mintToAdd);
		try {
			const mintIndex = $mints.findIndex((m) => m.mintURL === mint.mintUrl);
			if (mintIndex > -1) {
				if ($mints[mintIndex].isAdded) {
					toast('aviso', 'este mint ya ha sido añadido.', "No añadió el mint!");
					return;
				}

				const allMints = $mints;
				const [newMint] = allMints.splice(mintIndex, 1);
				newMint.isAdded = true;
				mints.set([newMint, ...allMints]);
				mintToAdd = '';
				return;
			}
			isLoadingMint = true;
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

			mints.update((state) => [storeMint, ...state]);
			toast('éxito', 'Se ha añadido el mint', 'Éxito!');
			mintToAdd = '';
		} catch {
			toast(
				'error',
				'no se han podido cargar las claves desde:' + mint.mintUrl + '/keys',
				'No se puede añadir el mint.'
			);
			throw new Error('Could not add Mint.');
		} finally {
			isLoadingMint = false;
		}
	};

	if (encodedToken) {
		validateToken();
	}
</script>

<div class="flex flex-col gap-2">
	{#if isLoading}
		<LoadingCenter />
	{:else}
		<div class="flex flex-col gap-2 text-center">
			<p class="text-xl font-bold">Recibir Tokens</p>
			<p>Pega un Token Cashu.</p>

			<div class="flex gap-2 items-center">
				<label for="receive-token-input">
					<p class="font-bold">Token:</p>
				</label>

				<input
					type="text"
					class="w-full input input-primary"
					id="receive-token-input"
					bind:value={encodedToken}
					on:input={validateToken}
				/>
			</div>

			{#if mintToAdd}
				<div>
					{mintToAdd}
				</div>
				<div class="grid-cols-2">
					{#if isLoadingMint}
						<button class="btn btn-disabled btn-square loading" />
					{:else}
						<button class="btn btn-success" on:click={trustMint}> confiar en este Mint </button>
					{/if}
				</div>
			{/if}
			<div class="grid grid-cols-5 h-16 text-start">
				{#if mintId}
					<p class="font-bold">Cantidad:</p>
					<p class="col-span-4">
						{amount === 0 ? '' : amount + ' sats'}
					</p>
					<p class="font-bold">De Mint:</p>
					<p class="col-span-4">
						{mintId ? mintId : ''}
					</p>
				{/if}
			</div>
		</div>

		<NostrReceiveQr />

		<div class="flex  gap-2">
			<button class="btn" on:click={resetState}>cancelar</button>
			<button class="btn {isValid ? 'btn-success' : 'btn-disabled'}" on:click={receive}>
				recibir</button
			>
		</div>
	{/if}
</div>
