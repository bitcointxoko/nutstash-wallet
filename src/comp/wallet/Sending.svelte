<script lang="ts">
	import {
		CashuMint,
		CashuWallet,
		getDecodedToken,
		getEncodedToken,
		type Proof
	} from '@cashu/cashu-ts';
	import { toast } from '../../stores/toasts';
	import type { Mint } from '../../model/mint';
	import { mints } from '../../stores/mints';
	import { token } from '../../stores/tokens';
	import LoadingCenter from '../LoadingCenter.svelte';
	import {
		getAmountForTokenSet,
		getKeysetsOfTokens,
		getTokensForMint,
		getTokensToSend,
		getTokenSubset
	} from '../util/walletUtils';
	import { browser } from '$app/environment';
	import { history } from '../../stores/history';
	import { HistoryItemType } from '../../model/historyItem';
	import {
		nostrPool,
		nostrPrivKey,
		nostrPubKey,
		nostrRelays,
		useExternalNostrKey,
		useNostr
	} from '../../stores/nostr';
	import type { Event } from 'nostr-tools';
	import * as nostrTools from 'nostr-tools';
	import { pendingTokens } from '../../stores/pendingtokens';
	import ScanNpub from '../elements/ScanNpub.svelte';
	import { page } from '$app/stores';
	import CoinSelection from '../elements/CoinSelection.svelte';
	import { updateMintKeys } from '../../actions/walletActions';

	export let active;

	let mint: Mint = $mints[0];
	$: tokensForMint = getTokensForMint(mint, $token);
	$: selectedTokens = [];
	$: isCoinSelection = false;

	let amountToSend = 0;
	let encodedToken: string = '';
	let isLoading = false;
	let sendToNostrKey = '';
	let hasBeenCopied = false;
	let nostrSendLoading = false;
	let sendAsLink = false;

	const send = async () => {
		tokensForMint = getTokensForMint(mint, $token);

		let tokensToSend: Proof[] = [];
		if (isCoinSelection) {
			tokensToSend = selectedTokens;
		} else {
			tokensToSend = getTokensToSend(amountToSend, tokensForMint);
		}

		if (amountToSend <= 0) {
			toast('aviso', 'la cantidad debe ser superior a 0', 'No se ha podido enviar');
			return;
		}
		if (amountToSend > getAmountForTokenSet(tokensToSend)) {
			toast('aviso', 'no hay fondos suficientes', 'No se ha podido enviar');
			isLoading = false;
			return;
		}

		try {
			isLoading = true;

			const cashuMint = new CashuMint(mint.mintURL);
			const cashuWallet = new CashuWallet(cashuMint, mint.keys);

			const { returnChange, send, newKeys } = await cashuWallet.send(amountToSend, tokensToSend);

			if (newKeys) {
				updateMintKeys(mint, newKeys);
			}

			//remove all tokens that have been sent to mint from storage
			token.update((state) => getTokenSubset(state, tokensToSend));
			//add the tokens that are being sent to pending
			pendingTokens.update((state) => [...send, ...state]);

			//add newly minted tokens that have been returned as change
			token.update((state) => [...state, ...returnChange]);

			encodedToken = getEncodedToken({ token: [{ proofs: send, mint: mint.mintURL }] });
			history.update((state) => [
				{
					type: HistoryItemType.SEND,
					amount: amountToSend,
					date: Date.now(),
					data: {
						encodedToken,
						mint: mint.mintURL,
						keyset: getKeysetsOfTokens([...tokensToSend, ...returnChange]),
						send,
						returnChange
					}
				},
				...state
			]);
			toast('éxito', 'Copia el token y envíaselo a alguien', 'Token enviable creado.');
			isLoading = false;
		} catch {
			resetState();
			toast('error', 'No se ha podido crear el token enviable', 'Error al crear Token');
			throw new Error('Error creating sendable token');
		}
	};

	const copyToken = () => {
		if (browser) {
			let input = document.getElementById('send-token-input');
			// @ts-expect-error
			input.select();
			document.execCommand('copy');
			hasBeenCopied = true;
			toast('info', 'El token se ha copiado en el portapapeles.', 'Copiado!');
		}
	};

	const getPubKey = async (): Promise<string> => {
		return $useExternalNostrKey
			? await window.nostr.getPublicKey()
			: await Promise.resolve($nostrPubKey);
	};

	const getEncryptedContent = async (): Promise<string> => {
		return $useExternalNostrKey
			? await window.nostr.nip04.encrypt(await getConvertedPubKey(), encodedToken)
			: //@ts-ignore
			  await nostrTools.nip04.encrypt($nostrPrivKey, await getConvertedPubKey(), encodedToken);
	};
	const getConvertedPubKey = async () => {
		await resolveNip05();

		return sendToNostrKey.startsWith('npub')
			? nostrTools.nip19.decode(sendToNostrKey).data
			: sendToNostrKey;
	};

	const resolveNip05 = async () => {
		console.log('test for nip-5');
		if (!sendToNostrKey.includes('.')) {
			return;
		}
		const profile = await nostrTools.nip05.queryProfile(sendToNostrKey);
		if (profile?.pubkey) {
			sendToNostrKey = profile?.pubkey;
		}
	};

	const sendWithNostr = async () => {
		try {
			nostrSendLoading = true;
			const event: Event = {
				kind: nostrTools.Kind.EncryptedDirectMessage,
				//@ts-ignore
				tags: [['p', await getConvertedPubKey()]],
				content: await getEncryptedContent(),
				created_at: Math.floor(Date.now() / 1000),
				pubkey: await getPubKey()
			};
			if ($useExternalNostrKey) {
				const signedEvent = await window.nostr.signEvent(event);
				$nostrPool.publish(
					signedEvent,
					$nostrRelays.map((r) => r.url)
				);
			} else {
				event.id = nostrTools.getEventHash(event);
				const signature: string = nostrTools.signEvent(event, $nostrPrivKey);
				event.sig = signature;
				console.log(event);
				$nostrPool.publish(
					event,
					$nostrRelays.map((r) => r.url)
				);
			}
			toast('info', 'El token se está enviando por nostr', 'Enviado!');
			resetState();
		} catch (e) {
			console.error(e);
			toast('error', 'El token no se ha podido enviar por nostr', 'Error:');
		} finally {
			nostrSendLoading = false;
		}
	};

	const resetState = () => {
		amountToSend = 0;
		encodedToken = '';
		isLoading = false;
		active = 'base';
		hasBeenCopied = false;
		sendAsLink = false;
	};
</script>

{#if isLoading}
	<LoadingCenter />
{:else if encodedToken}
	<div class="grid grid-cols-1 gap-2">
		<!-- <div>
					<QRCodeImage text={encodedToken} scale={3} displayType="canvas" />
				</div> -->
		<div class="flex flex-col gap-2">
			<div class="text-center">
				<p class="text-xl font-bold text-success">Los tokens están listos para ser enviados!</p>
				<p class="font-bold">Copia el nuevo token y envíaselo a alguien!</p>
			</div>
			<div class="flex gap-2">
				<input
					type="text"
					class="w-full input input-primary"
					id="send-token-input"
					readonly
					value={sendAsLink ? $page.url.href + '#' + encodedToken : encodedToken}
				/>
				<button class="btn btn-square" on:click={copyToken}>
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
							d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
						/>
					</svg>
				</button>
			</div>
		</div>
		<label class="cursor-pointer label flex justify-start gap-3">
			<span class="label-text">Enviar como enlace</span>
			<input type="checkbox" class="toggle toggle-primary" bind:checked={sendAsLink} />
		</label>
		<div class="pt-2 flex flex-col gap-2 items-center w-full">
			{#if $useNostr}
				<p class="font-bold">Enviar a través Nostr:</p>
				<div class="w-full flex items-center gap-2">
					<input
						type="text"
						class="input input-primary w-full"
						bind:value={sendToNostrKey}
						placeholder="npub / hex / nip-05"
					/>
					<label for="npub-scan-modal" class="btn btn-square btn-info">
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
								d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
							/>
						</svg>
					</label>
				</div>
			{/if}
		</div>
	</div>
	<div class="flex gap-2">
		<button class="btn {hasBeenCopied ? '' : 'btn-disabled'}" on:click={resetState}>ok</button>
		{#if $useNostr}
			{#if nostrSendLoading}
				<div class="btn btn-square btn-disabled loading" />
			{:else}
				<button
					class="btn {sendToNostrKey ? 'btn-info' : 'btn-disabled'} flex gap-1"
					on:click={sendWithNostr}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-6 h-6 rotate-12"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
						/>
					</svg>
					Enviar a través de Nostr</button
				>
			{/if}
		{/if}
	</div>
{:else}
	<div class=" flex flex-col gap-2">
		<p class="font-bold text-xl">Enviar Tokens</p>
		<p>Crear un Token Cashu enviable.</p>
		<div class="grid grid-cols-5 items-center">
			<div class="col-span-2">
				<label for="mint-send-dropdown">
					<p class="font-bold">Mint:</p>
				</label>
			</div>
			{#if mint}
				<div class="dropdown dropdown-bottom" id="mint-send-dropdown">
					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<!-- svelte-ignore a11y-label-has-associated-control -->
					<label
						tabindex="0"
						class="btn max-w-[12em] md:max-w-[20em] lg:max-w-[14em] xl:max-w-[20em] overflow-clip"
					>
						<p class=" truncate max-w-xs text-xs">
							{mint.mintURL}
						</p>
					</label>

					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<ul
						tabindex="0"
						class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 md:w-72 max-h-56 overflow-scroll flex-row scrollbar-hide"
					>
						{#each $mints.filter((m) => m.isAdded) as m}
							<!-- svelte-ignore a11y-missing-attribute -->
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<li
								on:click={() => (mint = m)}
								class="rounded-xl {m.mintURL === mint.mintURL ? 'bg-primary' : ''}"
							>
								<a>{m.mintURL}</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
		<div class="grid grid-cols-5">
			<p class="font-bold col-span-2">Disponible:</p>
			<p class="col-span-3">{getAmountForTokenSet(tokensForMint)} sats</p>
		</div>
		<div class="grid grid-cols-5 items-center">
			<p class="font-bold col-span-2">Cantidad:</p>
			<input
				type="number"
				name=""
				id="send-amount-input"
				class="input input-primary col-span-3"
				bind:value={amountToSend}
			/>
		</div>
		<div class="grid grid-cols-5">
			<div class="col-span-5">
				<CoinSelection amount={amountToSend} {mint} bind:selectedTokens bind:isCoinSelection />
			</div>
		</div>
		<div class="flex gap-2">
			<button class="btn" on:click={() => resetState()}>cancel</button>
			<button
				class="btn {isCoinSelection && getAmountForTokenSet(selectedTokens) < amountToSend
					? 'btn-disabled'
					: 'btn-success'}"
				on:click={send}>enviar</button
			>
		</div>
	</div>
{/if}

<ScanNpub bind:scannedNpub={sendToNostrKey} />
