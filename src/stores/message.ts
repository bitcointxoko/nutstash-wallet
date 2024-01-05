import { browser } from '$app/environment';

import { writable } from 'svelte/store';

const initialValueSting: string = browser
	? window.localStorage.getItem('message') ??
	'Antes de utilizar nutstash, asegúrate de que entiendes los riesgos.'
	: '';

const initialValue: string = initialValueSting;

const message = writable<string>(initialValue);

message.subscribe((value) => {
	if (browser) {
		window.localStorage.setItem('message', value);
	}
});

export { message };
