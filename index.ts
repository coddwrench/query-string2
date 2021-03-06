import * as strictUriEncode from "strict-uri-encode";
import * as objectAssign from "object-assign";
import * as decodeComponent from "decode-uri-component";

function encoderForArrayFormat(opts): (key: string, value: any, index?: number) => string {
	switch (opts.arrayFormat) {
		case "index":
			return function (key, value, index) {
				return value === null ? [
					encode(key, opts),
					"[",
					index,
					"]"
				].join("") : [
					encode(key, opts),
					"[",
					encode(index, opts),
					"]=",
					encode(value, opts)
				].join("");
			};

		case "bracket":
			return function (key, value) {
				return value === null ? encode(key, opts) : [
					encode(key, opts),
					"[]=",
					encode(value, opts)
				].join("");
			};

		default:
			return function (key, value) {
				return value === null ? encode(key, opts) : [
					encode(key, opts),
					"=",
					encode(value, opts)
				].join("");
			};
	}
}

function parserForArrayFormat(opts) {
	var result;

	switch (opts.arrayFormat) {
		case "index":
			return function (key, value, accumulator) {
				result = /\[(\d*)\]$/.exec(key);

				key = key.replace(/\[\d*\]$/, "");

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = {};
				}

				accumulator[key][result[1]] = value;
			};

		case "bracket":
			return function (key, value, accumulator) {
				result = /(\[\])$/.exec(key);
				key = key.replace(/\[\]$/, "");

				if (!result) {
					accumulator[key] = value;
					return;
				} else if (accumulator[key] === undefined) {
					accumulator[key] = [value];
					return;
				}

				accumulator[key] = [].concat(accumulator[key], value);
			};

		default:
			return function (key, value, accumulator) {
				if (accumulator[key] === undefined) {
					accumulator[key] = value;
					return;
				}

				accumulator[key] = [].concat(accumulator[key], value);
			};
	}
}

function encode(value, opts) {
	if (opts.encode) {
		return opts.strict ? strictUriEncode(value) : encodeURIComponent(value);
	}

	return value;
}

function keysSorter(input) {
	if (Array.isArray(input)) {
		return input.sort();
	} else if (typeof input === "object") {
		return keysSorter(Object.keys(input)).sort(function (a, b) {
			return Number(a) - Number(b);
		}).map(function (key) {
			return input[key];
		});
	}

	return input;
}

export function extract(str: string): string {
	var queryStart = str.indexOf("?");
	if (queryStart === -1) {
		return "";
	}
	return str.slice(queryStart + 1);
}

export interface ParseOptions {
	arrayFormat?: "bracket" | "index" | "none";
}

export interface StringifyOptions extends ParseOptions {
	strict?: boolean;
	encode?: boolean;
}

export function parse<T>(str: string, opts?: ParseOptions): T {
	opts = objectAssign({ arrayFormat: "none" }, opts);
	var formatter = parserForArrayFormat(opts);
	var result: { [key: string]: any } = {};

	if (typeof str !== "string") {
		return <T>result;
	}

	str = str.trim().replace(/^[?#&]/, "");

	if (!str) {
		return <T>result;
	}

	str.split("&").forEach(function (param) {
		var parts = param.replace(/\+/g, " ").split("=");
		// Firefox (pre 40) decodes `%3D` to `=`
		var key = parts.shift();
		var val = parts.length > 0 ? parts.join("=") : undefined;

		val = val === undefined ? null : decodeComponent(val);

		formatter(decodeComponent(key), val, result);
	});

	return <T>Object.keys(result).sort().reduce(function (obj, key) {
		var val = result[key];
		if (Boolean(val) && typeof val === "object" && !Array.isArray(val)) {
			// Sort object keys, not values
			obj[key] = keysSorter(val);
		} else {
			obj[key] = val;
		}
		return obj;
	}, {});
}

export function stringify<T>(obj: T, opts: StringifyOptions): string {
	var defaults = {
		encode: true,
		strict: true,
		arrayFormat: "none"
	};

	opts = objectAssign(defaults, opts);

	var formatter: Function = encoderForArrayFormat(opts);

	return obj ? Object.keys(obj).sort().map((key) => {
		var val = obj[key];

		if (val === undefined) {
			return "";
		}

		if (val === null) {
			return encode(key, opts);
		}

		if (Array.isArray(val)) {
			var result = [];

			val.slice().forEach(function (val2) {
				if (val2 === undefined) {
					return;
				}

				result.push(formatter(key, val2, result.length));
			});

			return result.join("&");
		}

		return encode(key, opts) + "=" + encode(val, opts);
	}).filter(function (x) {
		return x.length > 0;
	}).join("&") : "";
}
