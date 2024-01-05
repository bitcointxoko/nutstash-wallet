import { deriveKeysetId, type MintKeys } from '@cashu/cashu-ts';
import type { Mint } from '../model/mint';
import { mints } from '../stores/mints';
import { get } from 'svelte/store';
import { toast } from '../stores/toasts';

// export const send = async () => {

// }

// export const mint = async () => {

// }

// export const receive = async () => {

// }

// export const melt = async () => {

// }

export const updateMintKeys = (mint: Mint, newKeys: MintKeys) => {
	const allMints = [...get(mints)];
	const toBeUpdated = allMints.find((m) => mint.mintURL === m.mintURL);
	if (!toBeUpdated) {
		toast(
			'error',
			'las claves de esta ceca han cambiado, pero no se han podido actualizar en la billetera',
			'Error'
		);
		throw new Error('could not update mint keys');
	}
	toBeUpdated.keys = newKeys;
	const newKeyset = deriveKeysetId(newKeys);
	toBeUpdated.keysets = [newKeyset, ...toBeUpdated.keysets];
	mints.set(allMints);
	toast('info', 'el nuevo ID del juego de llaves es: ' + newKeyset, 'Las llaves de este mint han girado');
};
