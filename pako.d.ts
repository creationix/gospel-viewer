// Type definitions for pako 0.2.8
// Project: https://github.com/nodeca/pako
// Definitions by: Denis Cappellin <http://github.com/cappellin>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare namespace pako {

	/**
	 * Decompress data with inflate/ungzip and options. Autodetect format via wrapper header
	 * by default. That's why we don't provide separate ungzip method.
	 */
	export function inflate( data: Uint8Array | Array<number> | string, options?: any ): Uint8Array;
	export function inflate( data: Uint8Array | Array<number> | string, options?: any ): Array<number>;
	export function inflate( data: Uint8Array | Array<number> | string, options?: any ): String;
	/**
	 * The same as inflate, but creates raw data, without wrapper (header and adler32 crc).
	 */
	export function inflateRaw( data: Uint8Array | Array<number> | string, options?: any ): Uint8Array;
	export function inflateRaw( data: Uint8Array | Array<number> | string, options?: any ): Array<number>;
	export function inflateRaw( data: Uint8Array | Array<number> | string, options?: any ): string;
	/**
	 * Just shortcut to inflate, because it autodetects format by header.content. Done for convenience.
	 */
	export function ungzip( data: Uint8Array | Array<number> | string, options?: any ): Uint8Array;
	export function ungzip( data: Uint8Array | Array<number> | string, options?: any ): Array<number>;
	export function ungzip( data: Uint8Array | Array<number> | string, options?: any ): string;

	export class Inflate {
		constructor( options?: any );
		err: number;
		msg: string;
		result: Uint8Array | Array<number> | string;
		onData( chunk: Uint8Array | Array<number> | string ): void;
		onEnd( status: number ): void;
		push( data: Uint8Array | Array<number> | ArrayBuffer | string, mode?: number | boolean ): boolean;
	}
}

declare module 'pako' {
	export = pako;
}
