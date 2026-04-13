var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-TZnrd5/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// ../.wrangler/tmp/bundle-TZnrd5/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../node_modules/jose/dist/browser/runtime/webcrypto.js
var webcrypto_default = crypto;
var isCryptoKey = /* @__PURE__ */ __name((key) => key instanceof CryptoKey, "isCryptoKey");

// ../node_modules/jose/dist/browser/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");

// ../node_modules/jose/dist/browser/runtime/base64url.js
var encodeBase64 = /* @__PURE__ */ __name((input) => {
  let unencoded = input;
  if (typeof unencoded === "string") {
    unencoded = encoder.encode(unencoded);
  }
  const CHUNK_SIZE = 32768;
  const arr = [];
  for (let i = 0; i < unencoded.length; i += CHUNK_SIZE) {
    arr.push(String.fromCharCode.apply(null, unencoded.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(arr.join(""));
}, "encodeBase64");
var encode = /* @__PURE__ */ __name((input) => {
  return encodeBase64(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}, "encode");
var decodeBase64 = /* @__PURE__ */ __name((encoded) => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}, "decodeBase64");
var decode = /* @__PURE__ */ __name((input) => {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}, "decode");

// ../node_modules/jose/dist/browser/util/errors.js
var JOSEError = class extends Error {
  constructor(message2, options) {
    super(message2, options);
    this.code = "ERR_JOSE_GENERIC";
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
__name(JOSEError, "JOSEError");
JOSEError.code = "ERR_JOSE_GENERIC";
var JWTClaimValidationFailed = class extends JOSEError {
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
__name(JWTClaimValidationFailed, "JWTClaimValidationFailed");
JWTClaimValidationFailed.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
var JWTExpired = class extends JOSEError {
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.code = "ERR_JWT_EXPIRED";
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
__name(JWTExpired, "JWTExpired");
JWTExpired.code = "ERR_JWT_EXPIRED";
var JOSEAlgNotAllowed = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
};
__name(JOSEAlgNotAllowed, "JOSEAlgNotAllowed");
JOSEAlgNotAllowed.code = "ERR_JOSE_ALG_NOT_ALLOWED";
var JOSENotSupported = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
};
__name(JOSENotSupported, "JOSENotSupported");
JOSENotSupported.code = "ERR_JOSE_NOT_SUPPORTED";
var JWEDecryptionFailed = class extends JOSEError {
  constructor(message2 = "decryption operation failed", options) {
    super(message2, options);
    this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
};
__name(JWEDecryptionFailed, "JWEDecryptionFailed");
JWEDecryptionFailed.code = "ERR_JWE_DECRYPTION_FAILED";
var JWEInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWE_INVALID";
  }
};
__name(JWEInvalid, "JWEInvalid");
JWEInvalid.code = "ERR_JWE_INVALID";
var JWSInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWS_INVALID";
  }
};
__name(JWSInvalid, "JWSInvalid");
JWSInvalid.code = "ERR_JWS_INVALID";
var JWTInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWT_INVALID";
  }
};
__name(JWTInvalid, "JWTInvalid");
JWTInvalid.code = "ERR_JWT_INVALID";
var JWKInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWK_INVALID";
  }
};
__name(JWKInvalid, "JWKInvalid");
JWKInvalid.code = "ERR_JWK_INVALID";
var JWKSInvalid = class extends JOSEError {
  constructor() {
    super(...arguments);
    this.code = "ERR_JWKS_INVALID";
  }
};
__name(JWKSInvalid, "JWKSInvalid");
JWKSInvalid.code = "ERR_JWKS_INVALID";
var JWKSNoMatchingKey = class extends JOSEError {
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
};
__name(JWKSNoMatchingKey, "JWKSNoMatchingKey");
JWKSNoMatchingKey.code = "ERR_JWKS_NO_MATCHING_KEY";
var JWKSMultipleMatchingKeys = class extends JOSEError {
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
    this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
};
__name(JWKSMultipleMatchingKeys, "JWKSMultipleMatchingKeys");
JWKSMultipleMatchingKeys.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
var JWKSTimeout = class extends JOSEError {
  constructor(message2 = "request timed out", options) {
    super(message2, options);
    this.code = "ERR_JWKS_TIMEOUT";
  }
};
__name(JWKSTimeout, "JWKSTimeout");
JWKSTimeout.code = "ERR_JWKS_TIMEOUT";
var JWSSignatureVerificationFailed = class extends JOSEError {
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
    this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
};
__name(JWSSignatureVerificationFailed, "JWSSignatureVerificationFailed");
JWSSignatureVerificationFailed.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";

// ../node_modules/jose/dist/browser/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
__name(unusable, "unusable");
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
__name(isAlgorithm, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usages) {
  if (usages.length && !usages.some((expected) => key.usages.includes(expected))) {
    let msg = "CryptoKey does not support this operation, its usages must include ";
    if (usages.length > 2) {
      const last = usages.pop();
      msg += `one of ${usages.join(", ")}, or ${last}.`;
    } else if (usages.length === 2) {
      msg += `one of ${usages[0]} or ${usages[1]}.`;
    } else {
      msg += `${usages[0]}.`;
    }
    throw new TypeError(msg);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, ...usages) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (key.algorithm.name !== "Ed25519" && key.algorithm.name !== "Ed448") {
        throw unusable("Ed25519 or Ed448");
      }
      break;
    }
    case "Ed25519": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usages);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// ../node_modules/jose/dist/browser/lib/invalid_key_input.js
function message(msg, actual, ...types2) {
  types2 = types2.filter(Boolean);
  if (types2.length > 2) {
    const last = types2.pop();
    msg += `one of type ${types2.join(", ")}, or ${last}.`;
  } else if (types2.length === 2) {
    msg += `one of type ${types2[0]} or ${types2[1]}.`;
  } else {
    msg += `of type ${types2[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalid_key_input_default = /* @__PURE__ */ __name((actual, ...types2) => {
  return message("Key must be ", actual, ...types2);
}, "default");
function withAlg(alg, actual, ...types2) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types2);
}
__name(withAlg, "withAlg");

// ../node_modules/jose/dist/browser/runtime/is_key_like.js
var is_key_like_default = /* @__PURE__ */ __name((key) => {
  if (isCryptoKey(key)) {
    return true;
  }
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "default");
var types = ["CryptoKey"];

// ../node_modules/jose/dist/browser/lib/is_disjoint.js
var isDisjoint = /* @__PURE__ */ __name((...headers) => {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}, "isDisjoint");
var is_disjoint_default = isDisjoint;

// ../node_modules/jose/dist/browser/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
__name(isObjectLike, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");

// ../node_modules/jose/dist/browser/runtime/check_key_length.js
var check_key_length_default = /* @__PURE__ */ __name((alg, key) => {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}, "default");

// ../node_modules/jose/dist/browser/lib/is_jwk.js
function isJWK(key) {
  return isObject(key) && typeof key.kty === "string";
}
__name(isJWK, "isJWK");
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
__name(isPrivateJWK, "isPrivateJWK");
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
__name(isPublicJWK, "isPublicJWK");
function isSecretJWK(key) {
  return isJWK(key) && key.kty === "oct" && typeof key.k === "string";
}
__name(isSecretJWK, "isSecretJWK");

// ../node_modules/jose/dist/browser/runtime/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
var parse = /* @__PURE__ */ __name(async (jwk) => {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const rest = [
    algorithm,
    jwk.ext ?? false,
    jwk.key_ops ?? keyUsages
  ];
  const keyData = { ...jwk };
  delete keyData.alg;
  delete keyData.use;
  return webcrypto_default.subtle.importKey("jwk", keyData, ...rest);
}, "parse");
var jwk_to_key_default = parse;

// ../node_modules/jose/dist/browser/runtime/normalize_key.js
var exportKeyValue = /* @__PURE__ */ __name((k) => decode(k), "exportKeyValue");
var privCache;
var pubCache;
var isKeyObject = /* @__PURE__ */ __name((key) => {
  return key?.[Symbol.toStringTag] === "KeyObject";
}, "isKeyObject");
var importAndCache = /* @__PURE__ */ __name(async (cache, key, jwk, alg, freeze = false) => {
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwk_to_key_default({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "importAndCache");
var normalizePublicKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    delete jwk.d;
    delete jwk.dp;
    delete jwk.dq;
    delete jwk.p;
    delete jwk.q;
    delete jwk.qi;
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(pubCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    pubCache || (pubCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(pubCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePublicKey");
var normalizePrivateKey = /* @__PURE__ */ __name((key, alg) => {
  if (isKeyObject(key)) {
    let jwk = key.export({ format: "jwk" });
    if (jwk.k) {
      return exportKeyValue(jwk.k);
    }
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    return importAndCache(privCache, key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k)
      return decode(key.k);
    privCache || (privCache = /* @__PURE__ */ new WeakMap());
    const cryptoKey = importAndCache(privCache, key, key, alg, true);
    return cryptoKey;
  }
  return key;
}, "normalizePrivateKey");
var normalize_key_default = { normalizePublicKey, normalizePrivateKey };

// ../node_modules/jose/dist/browser/key/import.js
async function importJWK(jwk, alg) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  alg || (alg = jwk.alg);
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
    case "EC":
    case "OKP":
      return jwk_to_key_default({ ...jwk, alg });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(importJWK, "importJWK");

// ../node_modules/jose/dist/browser/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0 && key.use !== "sig") {
    throw new TypeError("Invalid key for this operation, when present its use must be sig");
  }
  if (key.key_ops !== void 0 && key.key_ops.includes?.(usage) !== true) {
    throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${usage}`);
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, when present its alg must be ${alg}`);
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (key instanceof Uint8Array)
    return;
  if (allowJwk && isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, "Uint8Array", allowJwk ? "JSON Web Key" : null));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage, allowJwk) => {
  if (allowJwk && isJWK(key)) {
    switch (usage) {
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a private JWK`);
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a public JWK`);
    }
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types, allowJwk ? "JSON Web Key" : null));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (usage === "sign" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
  }
  if (usage === "decrypt" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
  }
  if (key.algorithm && usage === "verify" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
  }
  if (key.algorithm && usage === "encrypt" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
  }
}, "asymmetricTypeCheck");
function checkKeyType(allowJwk, alg, key, usage) {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage, allowJwk);
  } else {
    asymmetricTypeCheck(alg, key, usage, allowJwk);
  }
}
__name(checkKeyType, "checkKeyType");
var check_key_type_default = checkKeyType.bind(void 0, false);
var checkKeyTypeWithJwk = checkKeyType.bind(void 0, true);

// ../node_modules/jose/dist/browser/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");
var validate_crit_default = validateCrit;

// ../node_modules/jose/dist/browser/lib/validate_algorithms.js
var validateAlgorithms = /* @__PURE__ */ __name((option, algorithms) => {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}, "validateAlgorithms");
var validate_algorithms_default = validateAlgorithms;

// ../node_modules/jose/dist/browser/runtime/subtle_dsa.js
function subtleDsa(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: alg.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: algorithm.name };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleDsa, "subtleDsa");

// ../node_modules/jose/dist/browser/runtime/get_sign_verify_key.js
async function getCryptoKey(alg, key, usage) {
  if (usage === "sign") {
    key = await normalize_key_default.normalizePrivateKey(key, alg);
  }
  if (usage === "verify") {
    key = await normalize_key_default.normalizePublicKey(key, alg);
  }
  if (isCryptoKey(key)) {
    checkSigCryptoKey(key, alg, usage);
    return key;
  }
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalid_key_input_default(key, ...types));
    }
    return webcrypto_default.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  throw new TypeError(invalid_key_input_default(key, ...types, "Uint8Array", "JSON Web Key"));
}
__name(getCryptoKey, "getCryptoKey");

// ../node_modules/jose/dist/browser/runtime/verify.js
var verify = /* @__PURE__ */ __name(async (alg, key, signature, data) => {
  const cryptoKey = await getCryptoKey(alg, key, "verify");
  check_key_length_default(alg, cryptoKey);
  const algorithm = subtleDsa(alg, cryptoKey.algorithm);
  try {
    return await webcrypto_default.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}, "verify");
var verify_default = verify;

// ../node_modules/jose/dist/browser/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!is_disjoint_default(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validate_algorithms_default("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
    checkKeyTypeWithJwk(alg, key, "verify");
    if (isJWK(key)) {
      key = await importJWK(key, alg);
    }
  } else {
    checkKeyTypeWithJwk(alg, key, "verify");
  }
  const data = concat(encoder.encode(jws.protected ?? ""), encoder.encode("."), typeof jws.payload === "string" ? encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const verified = await verify_default(alg, key, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// ../node_modules/jose/dist/browser/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// ../node_modules/jose/dist/browser/lib/epoch.js
var epoch_default = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "default");

// ../node_modules/jose/dist/browser/lib/secs.js
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var secs_default = /* @__PURE__ */ __name((str) => {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}, "default");

// ../node_modules/jose/dist/browser/lib/jwt_claims_set.js
var normalizeTyp = /* @__PURE__ */ __name((value) => value.toLowerCase().replace(/^application\//, ""), "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
var jwt_claims_set_default = /* @__PURE__ */ __name((protectedHeader, encodedPayload, options = {}) => {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs_default(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch_default(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs_default(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}, "default");

// ../node_modules/jose/dist/browser/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = jwt_claims_set_default(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// ../node_modules/jose/dist/browser/runtime/sign.js
var sign = /* @__PURE__ */ __name(async (alg, key, data) => {
  const cryptoKey = await getCryptoKey(alg, key, "sign");
  check_key_length_default(alg, cryptoKey);
  const signature = await webcrypto_default.subtle.sign(subtleDsa(alg, cryptoKey.algorithm), cryptoKey, data);
  return new Uint8Array(signature);
}, "sign");
var sign_default = sign;

// ../node_modules/jose/dist/browser/jws/flattened/sign.js
var FlattenedSign = class {
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this._payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    if (this._protectedHeader) {
      throw new TypeError("setProtectedHeader can only be called once");
    }
    this._protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    if (this._unprotectedHeader) {
      throw new TypeError("setUnprotectedHeader can only be called once");
    }
    this._unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this._protectedHeader && !this._unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!is_disjoint_default(this._protectedHeader, this._unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this._protectedHeader,
      ...this._unprotectedHeader
    };
    const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this._protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this._protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    checkKeyTypeWithJwk(alg, key, "sign");
    let payload = this._payload;
    if (b64) {
      payload = encoder.encode(encode(payload));
    }
    let protectedHeader;
    if (this._protectedHeader) {
      protectedHeader = encoder.encode(encode(JSON.stringify(this._protectedHeader)));
    } else {
      protectedHeader = encoder.encode("");
    }
    const data = concat(protectedHeader, encoder.encode("."), payload);
    const signature = await sign_default(alg, key, data);
    const jws = {
      signature: encode(signature),
      payload: ""
    };
    if (b64) {
      jws.payload = decoder.decode(payload);
    }
    if (this._unprotectedHeader) {
      jws.header = this._unprotectedHeader;
    }
    if (this._protectedHeader) {
      jws.protected = decoder.decode(protectedHeader);
    }
    return jws;
  }
};
__name(FlattenedSign, "FlattenedSign");

// ../node_modules/jose/dist/browser/jws/compact/sign.js
var CompactSign = class {
  constructor(payload) {
    this._flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this._flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this._flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};
__name(CompactSign, "CompactSign");

// ../node_modules/jose/dist/browser/jwt/produce.js
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
__name(validateInput, "validateInput");
var ProduceJWT = class {
  constructor(payload = {}) {
    if (!isObject(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this._payload = payload;
  }
  setIssuer(issuer) {
    this._payload = { ...this._payload, iss: issuer };
    return this;
  }
  setSubject(subject) {
    this._payload = { ...this._payload, sub: subject };
    return this;
  }
  setAudience(audience) {
    this._payload = { ...this._payload, aud: audience };
    return this;
  }
  setJti(jwtId) {
    this._payload = { ...this._payload, jti: jwtId };
    return this;
  }
  setNotBefore(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, nbf: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setExpirationTime(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, exp: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setIssuedAt(input) {
    if (typeof input === "undefined") {
      this._payload = { ...this._payload, iat: epoch_default(/* @__PURE__ */ new Date()) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", epoch_default(input)) };
    } else if (typeof input === "string") {
      this._payload = {
        ...this._payload,
        iat: validateInput("setIssuedAt", epoch_default(/* @__PURE__ */ new Date()) + secs_default(input))
      };
    } else {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", input) };
    }
    return this;
  }
};
__name(ProduceJWT, "ProduceJWT");

// ../node_modules/jose/dist/browser/jwt/sign.js
var SignJWT = class extends ProduceJWT {
  setProtectedHeader(protectedHeader) {
    this._protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(encoder.encode(JSON.stringify(this._payload)));
    sig.setProtectedHeader(this._protectedHeader);
    if (Array.isArray(this._protectedHeader?.crit) && this._protectedHeader.crit.includes("b64") && this._protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};
__name(SignJWT, "SignJWT");

// api/auth.js
var JWT_SECRET = "your-secret-key";
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
async function sha256(input) {
  const data = new TextEncoder().encode(input || "");
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
async function ensureAuthSchema(env) {
  if (!env?.MIPULSE_DB)
    return;
  await env.MIPULSE_DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}
__name(ensureAuthSchema, "ensureAuthSchema");
async function ensureDefaultAdmin(env) {
  if (!env?.MIPULSE_DB)
    return;
  await ensureAuthSchema(env);
  const row = await env.MIPULSE_DB.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").first();
  if (row?.id)
    return;
  const username = "admin";
  const password = env.ADMIN_PASSWORD || "admin888";
  const passwordHash = await sha256(password);
  await env.MIPULSE_DB.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").bind(username, passwordHash, "admin").run();
}
__name(ensureDefaultAdmin, "ensureDefaultAdmin");
async function issueToken(env, user) {
  const secret = new TextEncoder().encode(env.JWT_SECRET || JWT_SECRET);
  return new SignJWT({ uid: user.id, username: user.username, role: user.role || "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h").sign(secret);
}
__name(issueToken, "issueToken");
async function login(request, env) {
  try {
    const { username, password } = await request.json();
    if (env?.MIPULSE_DB) {
      await ensureDefaultAdmin(env);
      const user = await env.MIPULSE_DB.prepare("SELECT * FROM users WHERE username = ? LIMIT 1").bind((username || "").trim()).first();
      if (!user)
        return jsonResponse({ success: false, error: "Invalid credentials" }, 401);
      const passwordHash = await sha256(password || "");
      if (passwordHash !== user.password_hash) {
        return jsonResponse({ success: false, error: "Invalid credentials" }, 401);
      }
      const token = await issueToken(env, user);
      return jsonResponse({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
    }
    const adminPassword = env.ADMIN_PASSWORD || "admin888";
    if (username === "admin" && password === adminPassword) {
      const token = await issueToken(env, { id: 0, username, role: "admin" });
      return jsonResponse({ success: true, token, user: { id: 0, username, role: "admin" } });
    }
    return jsonResponse({ success: false, error: "Invalid credentials" }, 401);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
__name(login, "login");
async function verifyAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}
__name(verifyAuth, "verifyAuth");
async function getProfile(request, env, auth) {
  if (!auth)
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  if (!env?.MIPULSE_DB) {
    return jsonResponse({ success: true, data: { username: auth.username || "admin" } });
  }
  await ensureDefaultAdmin(env);
  let user = null;
  if (auth.uid !== void 0 && auth.uid !== null) {
    user = await env.MIPULSE_DB.prepare("SELECT id, username, role FROM users WHERE id = ? LIMIT 1").bind(auth.uid).first();
  }
  if (!user && auth.username) {
    user = await env.MIPULSE_DB.prepare("SELECT id, username, role FROM users WHERE username = ? LIMIT 1").bind(auth.username).first();
  }
  if (!user)
    return jsonResponse({ success: false, error: "User not found" }, 404);
  return jsonResponse({ success: true, data: { id: user.id, username: user.username, role: user.role } });
}
__name(getProfile, "getProfile");
async function updateProfile(request, env, auth) {
  if (!auth)
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  if (!env?.MIPULSE_DB)
    return jsonResponse({ success: false, error: "Database not available" }, 500);
  await ensureDefaultAdmin(env);
  const body = await request.json();
  const currentPassword = String(body.currentPassword || "");
  const newUsername = String(body.newUsername || "").trim();
  const newPassword = String(body.newPassword || "");
  if (!currentPassword)
    return jsonResponse({ success: false, error: "Current password is required" }, 400);
  if (!newUsername && !newPassword)
    return jsonResponse({ success: false, error: "No changes provided" }, 400);
  let user = null;
  if (auth.uid !== void 0 && auth.uid !== null) {
    user = await env.MIPULSE_DB.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").bind(auth.uid).first();
  }
  if (!user && auth.username) {
    user = await env.MIPULSE_DB.prepare("SELECT * FROM users WHERE username = ? LIMIT 1").bind(auth.username).first();
  }
  if (!user)
    return jsonResponse({ success: false, error: "User not found" }, 404);
  const currentHash = await sha256(currentPassword);
  if (currentHash !== user.password_hash) {
    return jsonResponse({ success: false, error: "Current password is incorrect" }, 401);
  }
  const targetUsername = newUsername || user.username;
  if (targetUsername !== user.username) {
    const exists = await env.MIPULSE_DB.prepare("SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1").bind(targetUsername, user.id).first();
    if (exists?.id)
      return jsonResponse({ success: false, error: "Username already exists" }, 409);
  }
  const targetHash = newPassword ? await sha256(newPassword) : user.password_hash;
  await env.MIPULSE_DB.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?").bind(targetUsername, targetHash, user.id).run();
  const updated = { id: user.id, username: targetUsername, role: user.role || "admin" };
  const token = await issueToken(env, updated);
  return jsonResponse({ success: true, token, data: updated });
}
__name(updateProfile, "updateProfile");

// api/vps.js
var REPORTS_MAX_KEEP = 5e3;
var ALERTS_MAX_KEEP = 1e3;
function createJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(createJson, "createJson");
function createError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(createError, "createError");
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function isoFromMs(ms) {
  return new Date(ms).toISOString();
}
__name(isoFromMs, "isoFromMs");
function normalizeString(value) {
  if (value === null || value === void 0)
    return "";
  return String(value).trim();
}
__name(normalizeString, "normalizeString");
function clampNumber(value, min, max, fallback = null) {
  const num = Number(value);
  if (!Number.isFinite(num))
    return fallback;
  return Math.min(max, Math.max(min, num));
}
__name(clampNumber, "clampNumber");
function clampPositiveInt(value, min, max, fallback) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num))
    return fallback;
  return Math.min(max, Math.max(min, num));
}
__name(clampPositiveInt, "clampPositiveInt");
function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
__name(safeJsonStringify, "safeJsonStringify");
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || request.headers.get("X-Real-IP") || "";
}
__name(getClientIp, "getClientIp");
async function computeSignature(secret, nodeId, timestamp, payloadCanonical) {
  const data = `${nodeId}.${timestamp}.${payloadCanonical}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(computeSignature, "computeSignature");
function normalizeReportTimestamp(rawValue, fallbackIso) {
  if (rawValue === null || rawValue === void 0)
    return fallbackIso;
  if (typeof rawValue === "number") {
    const ts = rawValue > 1e12 ? rawValue : rawValue * 1e3;
    return isoFromMs(ts);
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed)
      return fallbackIso;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ts = num > 1e12 ? num : num * 1e3;
      return isoFromMs(ts);
    }
    const parsed = new Date(trimmed).getTime();
    if (Number.isFinite(parsed))
      return isoFromMs(parsed);
  }
  return fallbackIso;
}
__name(normalizeReportTimestamp, "normalizeReportTimestamp");
function isNodeOnline(lastSeenAt, thresholdMinutes) {
  if (!lastSeenAt)
    return false;
  const last = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(last))
    return false;
  const diffMs = Date.now() - last;
  return diffMs <= thresholdMinutes * 60 * 1e3;
}
__name(isNodeOnline, "isNodeOnline");
function clampPayloadUsage(value) {
  const num = Number(value);
  if (!Number.isFinite(num))
    return null;
  return Math.min(100, Math.max(0, num));
}
__name(clampPayloadUsage, "clampPayloadUsage");
function clampPayloadLoad(value) {
  const num = Number(value);
  if (!Number.isFinite(num))
    return null;
  return Math.max(0, Math.min(1e3, num));
}
__name(clampPayloadLoad, "clampPayloadLoad");
function clampPayloadUptime(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0)
    return null;
  return Math.min(10 ** 9, num);
}
__name(clampPayloadUptime, "clampPayloadUptime");
function buildNetworkCheckKey(item) {
  const type = normalizeString(item?.type).toLowerCase();
  const target = normalizeString(item?.target).toLowerCase();
  const scheme = type === "http" ? normalizeString(item?.scheme || "https").toLowerCase() : "";
  const rawPort = item?.port;
  const portNumber = rawPort === null || rawPort === void 0 || rawPort === "" ? null : Number(rawPort);
  const port = Number.isFinite(portNumber) ? String(portNumber) : "";
  const path = type === "http" ? normalizeString(item?.path || "/") : "";
  return `${type}|${target}|${scheme}|${port}|${path}`;
}
__name(buildNetworkCheckKey, "buildNetworkCheckKey");
function rehydrateCheckNames(checks, targets) {
  if (!Array.isArray(checks) || !Array.isArray(targets))
    return checks;
  const exactNameMap = /* @__PURE__ */ new Map();
  const fallbackNameMap = /* @__PURE__ */ new Map();
  targets.forEach((target) => {
    const name = normalizeString(target?.name);
    const normalizedTarget = normalizeString(target?.target).toLowerCase();
    if (!name || !normalizedTarget)
      return;
    exactNameMap.set(buildNetworkCheckKey(target), name);
    if (!fallbackNameMap.has(normalizedTarget)) {
      fallbackNameMap.set(normalizedTarget, name);
    }
  });
  return checks.map((check) => {
    if (check?.name || !check?.target)
      return check;
    const exactName = exactNameMap.get(buildNetworkCheckKey(check));
    if (exactName)
      return { ...check, name: exactName };
    const fallbackName = fallbackNameMap.get(normalizeString(check.target).toLowerCase());
    return fallbackName ? { ...check, name: fallbackName } : check;
  });
}
__name(rehydrateCheckNames, "rehydrateCheckNames");
function sanitizeNetworkChecks(checks) {
  if (!Array.isArray(checks))
    return [];
  return checks.map((item) => {
    const type = normalizeString(item?.type).toLowerCase();
    if (!["icmp", "tcp", "http"].includes(type))
      return null;
    const target = normalizeString(item?.target);
    if (!target)
      return null;
    const name = normalizeString(item?.name || "");
    const status = normalizeString(item?.status) || "unknown";
    const latencyMs = clampNumber(item?.latencyMs, 0, 60 * 1e3, null);
    const lossPercent = clampNumber(item?.lossPercent, 0, 100, null);
    const httpCode = clampNumber(item?.httpCode, 0, 999, null);
    const scheme = normalizeString(item?.scheme || "https");
    const port = item?.port !== void 0 && item?.port !== null ? Number(item.port) : null;
    const path = normalizeString(item?.path || "/");
    const dnsMs = clampNumber(item?.dnsMs, 0, 60 * 1e3, null);
    const connectMs = clampNumber(item?.connectMs, 0, 60 * 1e3, null);
    const tlsMs = clampNumber(item?.tlsMs, 0, 60 * 1e3, null);
    const checkedAt = normalizeReportTimestamp(item?.checkedAt, null);
    return {
      type,
      target,
      name,
      status,
      latencyMs,
      lossPercent,
      httpCode,
      scheme,
      port: Number.isFinite(port) ? port : null,
      path,
      dnsMs,
      connectMs,
      tlsMs,
      checkedAt
    };
  }).filter(Boolean);
}
__name(sanitizeNetworkChecks, "sanitizeNetworkChecks");
function computeOverload(report, settings) {
  const cpuThreshold = clampNumber(settings?.vpsMonitor?.cpuWarnPercent, 1, 100, 90);
  const memThreshold = clampNumber(settings?.vpsMonitor?.memWarnPercent, 1, 100, 90);
  const diskThreshold = clampNumber(settings?.vpsMonitor?.diskWarnPercent, 1, 100, 90);
  const cpu = clampNumber(report.cpu?.usage ?? report.cpuPercent, 0, 100, null);
  const mem = clampNumber(report.mem?.usage ?? report.memPercent, 0, 100, null);
  const disk = clampNumber(report.disk?.usage ?? report.diskPercent, 0, 100, null);
  const overload = {
    cpu: cpu !== null && cpu >= cpuThreshold,
    mem: mem !== null && mem >= memThreshold,
    disk: disk !== null && disk >= diskThreshold
  };
  overload.any = overload.cpu || overload.mem || overload.disk;
  return { overload, thresholds: { cpuThreshold, memThreshold, diskThreshold }, values: { cpu, mem, disk } };
}
__name(computeOverload, "computeOverload");
function computeOverloadState(previous, overloadInfo) {
  const state = {
    count: clampPositiveInt(previous?.count, 0, 1e4, 0),
    lastAt: normalizeString(previous?.lastAt || ""),
    lastSignature: normalizeString(previous?.lastSignature || "")
  };
  if (overloadInfo?.overload?.any) {
    state.count += 1;
    state.lastAt = nowIso();
  } else {
    state.count = 0;
  }
  const signature = `${overloadInfo?.values?.cpu ?? ""}|${overloadInfo?.values?.mem ?? ""}|${overloadInfo?.values?.disk ?? ""}`;
  state.lastSignature = signature;
  return state;
}
__name(computeOverloadState, "computeOverloadState");
function shouldTriggerOverload(settings, state, overloadInfo) {
  if (!overloadInfo?.overload?.any)
    return false;
  const threshold = clampPositiveInt(settings?.vpsMonitor?.overloadConfirmCount, 1, 10, 2);
  if (state.count < threshold)
    return false;
  const signature = `${overloadInfo?.values?.cpu ?? ""}|${overloadInfo?.values?.mem ?? ""}|${overloadInfo?.values?.disk ?? ""}`;
  if (signature && signature === state.lastSignature && state.count > threshold)
    return false;
  return true;
}
__name(shouldTriggerOverload, "shouldTriggerOverload");
function buildAlertMessage(title, bodyLines) {
  const lines = Array.isArray(bodyLines) ? bodyLines : [];
  return `${title}

${lines.filter(Boolean).join("\n")}`.trim();
}
__name(buildAlertMessage, "buildAlertMessage");
function buildSnapshot(report, node) {
  const cpuPercent = clampNumber(report.cpu?.usage, 0, 100, null);
  const memPercent = clampNumber(report.mem?.usage, 0, 100, null);
  const diskPercent = clampNumber(report.disk?.usage, 0, 100, null);
  return {
    at: nowIso(),
    status: node?.status || "unknown",
    cpuPercent,
    memPercent,
    diskPercent,
    load1: clampNumber(report.load?.load1, 0, 1e3, null),
    uptimeSec: clampNumber(report.uptimeSec, 0, 10 ** 9, null),
    traffic: report.traffic || null,
    network: report.network || null,
    ip: normalizeString(report.publicIp || report.ip || report.meta?.publicIp),
    receivedAt: report.receivedAt || report.createdAt || null
  };
}
__name(buildSnapshot, "buildSnapshot");
function summarizeNode(node, latestReport, settings) {
  let status = node.status;
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  if (node.lastSeenAt) {
    const lastSeen = new Date(node.lastSeenAt).getTime();
    if (Date.now() - lastSeen > threshold * 60 * 1e3) {
      status = "offline";
    }
  } else {
    status = "offline";
  }
  const overloadInfo = latestReport ? computeOverload(latestReport, settings) : null;
  return {
    id: node.id,
    name: node.name,
    tag: node.tag,
    groupTag: node.groupTag || node.group_tag,
    region: node.region,
    countryCode: node.countryCode || node.country_code,
    description: node.description,
    status,
    enabled: Boolean(node.enabled),
    useGlobalTargets: Boolean(node.useGlobalTargets || node.use_global_targets),
    totalRx: node.totalRx || node.total_rx || 0,
    totalTx: node.totalTx || node.total_tx || 0,
    trafficLimitGb: node.trafficLimitGb || node.traffic_limit_gb || 0,
    lastSeenAt: node.lastSeenAt,
    updatedAt: node.updatedAt,
    latest: latestReport || null,
    overload: overloadInfo ? overloadInfo.overload : null
  };
}
__name(summarizeNode, "summarizeNode");
function resolveSettings(config) {
  return { ...DEFAULT_SETTINGS, ...config || {} };
}
__name(resolveSettings, "resolveSettings");
function resolvePublicThemePreset(settings) {
  const preset = normalizeString(settings?.vpsMonitor?.publicThemePreset).toLowerCase();
  const supported = /* @__PURE__ */ new Set(["default", "fresh", "minimal", "tech", "glass"]);
  if (!supported.has(preset))
    return preset === "tech-dark" ? "tech" : "default";
  return preset;
}
__name(resolvePublicThemePreset, "resolvePublicThemePreset");
function buildPublicThemeConfig(settings) {
  const raw = settings?.vpsMonitor || {};
  const validSections = /* @__PURE__ */ new Set(["anomalies", "nodes", "featured", "details"]);
  const normalizedOrder = Array.isArray(raw.publicThemeSectionOrder) ? raw.publicThemeSectionOrder.filter((item) => validSections.has(normalizeString(item))) : [];
  const sectionOrder = normalizedOrder.length ? normalizedOrder : DEFAULT_SETTINGS.vpsMonitor.publicThemeSectionOrder;
  return {
    preset: resolvePublicThemePreset(settings),
    title: normalizeString(raw.publicThemeTitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeTitle,
    subtitle: normalizeString(raw.publicThemeSubtitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeSubtitle,
    logo: normalizeString(raw.publicThemeLogo),
    backgroundImage: normalizeString(raw.publicThemeBackgroundImage),
    showStats: raw.publicThemeShowStats !== false,
    showAnomalies: raw.publicThemeShowAnomalies !== false,
    showFeatured: raw.publicThemeShowFeatured !== false,
    showDetailTable: raw.publicThemeShowDetailTable !== false,
    footerText: normalizeString(raw.publicThemeFooterText) || DEFAULT_SETTINGS.vpsMonitor.publicThemeFooterText,
    sectionOrder,
    customCss: normalizeString(raw.publicThemeCustomCss)
  };
}
__name(buildPublicThemeConfig, "buildPublicThemeConfig");
function getReportRetentionCutoff(settings) {
  const days = clampNumber(settings?.vpsMonitor?.reportRetentionDays, 1, 180, 30);
  return Date.now() - days * 24 * 60 * 60 * 1e3;
}
__name(getReportRetentionCutoff, "getReportRetentionCutoff");
function getAlertCooldownMs(settings) {
  const minutes = clampNumber(settings?.vpsMonitor?.alertCooldownMinutes, 1, 1440, 15);
  return minutes * 60 * 1e3;
}
__name(getAlertCooldownMs, "getAlertCooldownMs");
function shouldSkipCooldown(settings, alertType) {
  return alertType === "recovery" && settings?.vpsMonitor?.cooldownIgnoreRecovery === true;
}
__name(shouldSkipCooldown, "shouldSkipCooldown");
async function pushAlert(db, settings, alert) {
  if (!alert)
    return;
  const cooldownMs = getAlertCooldownMs(settings);
  if (!shouldSkipCooldown(settings, alert.type)) {
    const lastSame = await db.prepare(
      "SELECT created_at FROM vps_alerts WHERE node_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(alert.nodeId, alert.type).first();
    if (lastSame?.created_at) {
      const lastTs = new Date(lastSame.created_at).getTime();
      if (Number.isFinite(lastTs) && Date.now() - lastTs < cooldownMs) {
        return;
      }
    }
  }
  await db.prepare(
    "INSERT INTO vps_alerts (id, node_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(alert.id, alert.nodeId, alert.type, alert.message, alert.createdAt).run();
  await db.prepare(
    `DELETE FROM vps_alerts
     WHERE id NOT IN (
       SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ${ALERTS_MAX_KEEP}
     )`
  ).run();
  await dispatchNotifications(settings, alert);
}
__name(pushAlert, "pushAlert");
function stripMarkdown(text) {
  return normalizeString(text).replace(/\*/g, "").replace(/`/g, "").replace(/_/g, "").trim();
}
__name(stripMarkdown, "stripMarkdown");
function escapeTelegramMarkdown(text) {
  return normalizeString(text).replace(/([_\*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
__name(escapeTelegramMarkdown, "escapeTelegramMarkdown");
async function sendTelegramNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled)
    return;
  if (!settings?.vpsMonitor?.notifyTelegram)
    return;
  const token = normalizeString(settings?.vpsMonitor?.telegramBotToken);
  const chatId = normalizeString(settings?.vpsMonitor?.telegramChatId);
  if (!token || !chatId)
    return;
  const text = escapeTelegramMarkdown(stripMarkdown(alert.message));
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`telegram ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return "telegram";
}
__name(sendTelegramNotification, "sendTelegramNotification");
async function sendWebhookNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled)
    return;
  if (!settings?.vpsMonitor?.notifyWebhook)
    return;
  const webhookUrl = normalizeString(settings?.vpsMonitor?.webhookUrl);
  if (!webhookUrl)
    return;
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "mipulse",
      type: alert.type,
      nodeId: alert.nodeId,
      message: stripMarkdown(alert.message),
      markdown: alert.message,
      createdAt: alert.createdAt,
      id: alert.id
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`webhook ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return "webhook";
}
__name(sendWebhookNotification, "sendWebhookNotification");
async function sendAppPushNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled)
    return;
  if (!settings?.vpsMonitor?.notifyAppPush)
    return;
  const appPushKey = normalizeString(settings?.vpsMonitor?.appPushKey);
  if (!appPushKey)
    return;
  const resp = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: appPushKey,
      title: `MiPulse ${alert.type.toUpperCase()} Alert`,
      content: alert.message,
      template: "markdown"
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`app_push ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return "app_push";
}
__name(sendAppPushNotification, "sendAppPushNotification");
async function dispatchNotifications(settings, alert) {
  return Promise.allSettled([
    sendTelegramNotification(settings, alert),
    sendWebhookNotification(settings, alert),
    sendAppPushNotification(settings, alert)
  ]);
}
__name(dispatchNotifications, "dispatchNotifications");
async function handleTestNotification(env) {
  const settings = await loadSettings(env);
  if (!settings?.vpsMonitor?.notificationEnabled) {
    return createError("Notification switch is disabled", 400);
  }
  const alert = {
    id: crypto.randomUUID(),
    nodeId: "system",
    type: "test",
    createdAt: nowIso(),
    message: buildAlertMessage("\u{1F9EA} MiPulse \u6D4B\u8BD5\u901A\u77E5", [
      "*\u6765\u6E90:* \u63A7\u5236\u53F0\u624B\u52A8\u6D4B\u8BD5",
      `*\u65F6\u95F4:* ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`
    ])
  };
  const results = await dispatchNotifications(settings, alert);
  const channels = ["telegram", "webhook", "app_push"];
  const detail = results.map((item, index) => ({
    channel: channels[index],
    success: item.status === "fulfilled",
    error: item.status === "rejected" ? normalizeString(item.reason?.message || item.reason) : ""
  }));
  const successCount = detail.filter((i) => i.success).length;
  if (successCount === 0) {
    return createError("All notification channels failed", 502);
  }
  return createJson({ success: true, data: { successCount, detail } });
}
__name(handleTestNotification, "handleTestNotification");
var DEFAULT_SETTINGS = {
  vpsMonitor: {
    requireSecret: true,
    requireSignature: false,
    signatureClockSkewMinutes: 5,
    offlineThresholdMinutes: 10,
    cpuWarnPercent: 90,
    memWarnPercent: 90,
    diskWarnPercent: 90,
    overloadConfirmCount: 2,
    alertCooldownMinutes: 15,
    networkSampleIntervalMinutes: 5,
    reportIntervalMinutes: 1,
    reportStoreIntervalMinutes: 1,
    networkTargetsLimit: 3,
    publicThemePreset: "default",
    publicThemeTitle: "VPS \u63A2\u9488\u516C\u5F00\u89C6\u56FE",
    publicThemeSubtitle: "\u5BF9\u5916\u5C55\u793A\u8282\u70B9\u5065\u5EB7\u3001\u8D44\u6E90\u8D1F\u8F7D\u4E0E\u5728\u7EBF\u7387\u3002\u6240\u6709\u5173\u952E\u6307\u6807\u4EE5\u6E05\u6670\u3001\u53EF\u4FE1\u7684\u65B9\u5F0F\u6C47\u603B\u5448\u73B0\u3002",
    publicThemeLogo: "",
    publicThemeBackgroundImage: "",
    publicThemeShowStats: true,
    publicThemeShowAnomalies: true,
    publicThemeShowFeatured: true,
    publicThemeShowDetailTable: true,
    publicThemeFooterText: "\u7531 MiPulse VPS \u76D1\u63A7\u5F15\u64CE\u63D0\u4F9B\u5B9E\u65F6\u6570\u636E\u9A71\u52A8",
    publicThemeSectionOrder: ["anomalies", "nodes", "featured", "details"],
    publicThemeCustomCss: "",
    alertsEnabled: true,
    notifyOffline: true,
    notifyRecovery: true,
    notifyOverload: true,
    notificationEnabled: false,
    notifyTelegram: false,
    telegramBotToken: "",
    telegramChatId: "",
    notifyWebhook: false,
    webhookUrl: "",
    notifyAppPush: false,
    appPushKey: "",
    reportRetentionDays: 30,
    cooldownIgnoreRecovery: true
  }
};
var SETTINGS_KEY = "worker_settings_v1";
function isMissingSettingsTableError(error) {
  const message2 = normalizeString(error?.message || error);
  return message2.includes("no such table: settings");
}
__name(isMissingSettingsTableError, "isMissingSettingsTableError");
async function ensureCoreSchema(env) {
  if (!env?.MIPULSE_DB)
    return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT,
      group_tag TEXT,
      region TEXT,
      country_code TEXT,
      description TEXT,
      secret TEXT NOT NULL,
      status TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      use_global_targets INTEGER DEFAULT 0,
      total_rx INTEGER DEFAULT 0,
      total_tx INTEGER DEFAULT 0,
      traffic_limit_gb INTEGER DEFAULT 0,
      last_seen_at DATETIME,
      last_report_json TEXT,
      overload_state_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_reports (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      reported_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vps_alerts (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_network_targets (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      name TEXT,
      scheme TEXT,
      port INTEGER,
      path TEXT,
      enabled INTEGER DEFAULT 1,
      force_check_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_network_samples (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      reported_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS idx_vps_nodes_updated_at ON vps_nodes(updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_vps_reports_node_time ON vps_reports(node_id, reported_at)",
    "CREATE INDEX IF NOT EXISTS idx_vps_alerts_node_time ON vps_alerts(node_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_vps_network_targets_node ON vps_network_targets(node_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_vps_network_samples_node_time ON vps_network_samples(node_id, reported_at)",
    "CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at)"
  ];
  for (const sql of statements) {
    await env.MIPULSE_DB.prepare(sql).run();
  }
}
__name(ensureCoreSchema, "ensureCoreSchema");
async function ensureSettingsTable(env) {
  if (!env?.MIPULSE_DB)
    return;
  await env.MIPULSE_DB.prepare(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
  await env.MIPULSE_DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at)"
  ).run();
}
__name(ensureSettingsTable, "ensureSettingsTable");
async function loadSettings(env) {
  if (!env?.MIPULSE_DB)
    return resolveSettings();
  let row;
  try {
    row = await env.MIPULSE_DB.prepare("SELECT value FROM settings WHERE key = ?").bind(SETTINGS_KEY).first();
  } catch (error) {
    if (!isMissingSettingsTableError(error))
      throw error;
    await ensureSettingsTable(env);
    return resolveSettings();
  }
  if (!row?.value)
    return resolveSettings();
  let parsed = {};
  try {
    parsed = JSON.parse(row.value);
  } catch {
    parsed = {};
  }
  return resolveSettings(parsed);
}
__name(loadSettings, "loadSettings");
async function saveSettings(env, settings) {
  if (!env?.MIPULSE_DB)
    return;
  const now = nowIso();
  try {
    await env.MIPULSE_DB.prepare(
      "INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).bind(SETTINGS_KEY, JSON.stringify(settings), now, now).run();
  } catch (error) {
    if (!isMissingSettingsTableError(error))
      throw error;
    await ensureSettingsTable(env);
    await env.MIPULSE_DB.prepare(
      "INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).bind(SETTINGS_KEY, JSON.stringify(settings), now, now).run();
  }
}
__name(saveSettings, "saveSettings");
function mapNodeRow(row) {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    groupTag: row.group_tag,
    region: row.region,
    countryCode: row.country_code,
    description: row.description,
    secret: row.secret,
    status: row.status,
    enabled: row.enabled === 1,
    useGlobalTargets: row.use_global_targets === 1,
    totalRx: Number(row.total_rx || 0),
    totalTx: Number(row.total_tx || 0),
    trafficLimitGb: Number(row.traffic_limit_gb || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    lastReport: row.last_report_json ? JSON.parse(row.last_report_json) : null,
    overloadState: row.overload_state_json ? JSON.parse(row.overload_state_json) : null
  };
}
__name(mapNodeRow, "mapNodeRow");
async function fetchNodes(db) {
  const result = await db.prepare("SELECT * FROM vps_nodes ORDER BY created_at DESC").all();
  return (result.results || []).map(mapNodeRow);
}
__name(fetchNodes, "fetchNodes");
async function fetchNode(db, nodeId) {
  const row = await db.prepare("SELECT * FROM vps_nodes WHERE id = ?").bind(nodeId).first();
  return row ? mapNodeRow(row) : null;
}
__name(fetchNode, "fetchNode");
async function insertNode(db, node) {
  await db.prepare(
    `INSERT INTO vps_nodes
     (id, name, tag, group_tag, region, country_code, description, secret, status, enabled, use_global_targets, total_rx, total_tx, traffic_limit_gb, created_at, updated_at, last_seen_at, last_report_json, overload_state_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    node.id,
    node.name,
    node.tag,
    node.groupTag,
    node.region,
    node.countryCode,
    node.description,
    node.secret,
    node.status,
    node.enabled ? 1 : 0,
    node.useGlobalTargets ? 1 : 0,
    node.totalRx || 0,
    node.totalTx || 0,
    node.trafficLimitGb || 0,
    node.createdAt,
    node.updatedAt,
    node.lastSeenAt,
    node.lastReport ? JSON.stringify(node.lastReport) : null,
    node.overloadState ? JSON.stringify(node.overloadState) : null
  ).run();
}
__name(insertNode, "insertNode");
async function updateNode(db, node) {
  await db.prepare(
    `UPDATE vps_nodes
     SET name = ?, tag = ?, group_tag = ?, region = ?, country_code = ?, description = ?, secret = ?, status = ?, enabled = ?,
         use_global_targets = ?, total_rx = ?, total_tx = ?, traffic_limit_gb = ?, updated_at = ?, last_seen_at = ?, last_report_json = ?, overload_state_json = ?
     WHERE id = ?`
  ).bind(
    node.name,
    node.tag,
    node.groupTag,
    node.region,
    node.countryCode,
    node.description,
    node.secret,
    node.status,
    node.enabled ? 1 : 0,
    node.useGlobalTargets ? 1 : 0,
    node.totalRx || 0,
    node.totalTx || 0,
    node.trafficLimitGb || 0,
    node.updatedAt,
    node.lastSeenAt,
    node.lastReport ? JSON.stringify(node.lastReport) : null,
    node.overloadState ? JSON.stringify(node.overloadState) : null,
    node.id
  ).run();
}
__name(updateNode, "updateNode");
async function deleteNode(db, nodeId) {
  await db.prepare("DELETE FROM vps_nodes WHERE id = ?").bind(nodeId).run();
  await db.prepare("DELETE FROM vps_reports WHERE node_id = ?").bind(nodeId).run();
  await db.prepare("DELETE FROM vps_alerts WHERE node_id = ?").bind(nodeId).run();
}
__name(deleteNode, "deleteNode");
async function insertReport(db, report) {
  await db.prepare(
    "INSERT INTO vps_reports (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)"
  ).bind(report.id, report.nodeId, report.reportedAt, report.createdAt, JSON.stringify(report)).run();
}
__name(insertReport, "insertReport");
async function pruneReports(db, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  await db.prepare("DELETE FROM vps_reports WHERE reported_at < ?").bind(cutoff).run();
  await db.prepare(
    `DELETE FROM vps_reports
     WHERE id NOT IN (
       SELECT id FROM vps_reports ORDER BY reported_at DESC LIMIT ${REPORTS_MAX_KEEP}
     )`
  ).run();
}
__name(pruneReports, "pruneReports");
async function fetchReportsForNode(db, nodeId, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    "SELECT data FROM vps_reports WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT ?"
  ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
  return (result.results || []).map((row) => JSON.parse(row.data));
}
__name(fetchReportsForNode, "fetchReportsForNode");
async function fetchNetworkSamples(db, nodeId, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    "SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT ?"
  ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
  return (result.results || []).map((row) => JSON.parse(row.data));
}
__name(fetchNetworkSamples, "fetchNetworkSamples");
async function insertNetworkSample(db, sample) {
  await db.prepare(
    "INSERT INTO vps_network_samples (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)"
  ).bind(sample.id, sample.nodeId, sample.reportedAt, sample.createdAt, JSON.stringify(sample)).run();
}
__name(insertNetworkSample, "insertNetworkSample");
async function pruneNetworkSamples(db, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  await db.prepare("DELETE FROM vps_network_samples WHERE reported_at < ?").bind(cutoff).run();
  await db.prepare(
    `DELETE FROM vps_network_samples
     WHERE id NOT IN (
       SELECT id FROM vps_network_samples ORDER BY reported_at DESC LIMIT ${REPORTS_MAX_KEEP}
     )`
  ).run();
}
__name(pruneNetworkSamples, "pruneNetworkSamples");
async function fetchNetworkTargets(db, nodeId) {
  const result = await db.prepare("SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC").bind(nodeId).all();
  return (result.results || []).map((row) => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    target: row.target,
    name: row.name || "",
    scheme: row.scheme || "https",
    port: row.port,
    path: row.path,
    forceCheckAt: row.force_check_at,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
__name(fetchNetworkTargets, "fetchNetworkTargets");
async function fetchGlobalNetworkTargets(db) {
  const result = await db.prepare("SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC").bind("global").all();
  return (result.results || []).map((row) => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    target: row.target,
    name: row.name || "",
    scheme: row.scheme || "https",
    port: row.port,
    path: row.path,
    forceCheckAt: row.force_check_at,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
__name(fetchGlobalNetworkTargets, "fetchGlobalNetworkTargets");
async function insertNetworkTarget(db, nodeId, payload) {
  const target = {
    id: crypto.randomUUID(),
    nodeId,
    type: normalizeString(payload.type).toLowerCase(),
    target: normalizeString(payload.target),
    name: normalizeString(payload.name || ""),
    scheme: normalizeString(payload.scheme || "https"),
    port: payload.port ? Number(payload.port) : null,
    path: normalizeString(payload.path),
    enabled: payload.enabled !== false,
    forceCheckAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await db.prepare(
    `INSERT INTO vps_network_targets
     (id, node_id, type, target, name, scheme, port, path, enabled, force_check_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    target.id,
    target.nodeId,
    target.type,
    target.target,
    target.name,
    target.scheme,
    target.port,
    target.path,
    target.enabled ? 1 : 0,
    null,
    target.createdAt,
    target.updatedAt
  ).run();
  return target;
}
__name(insertNetworkTarget, "insertNetworkTarget");
async function updateNetworkTarget(db, targetId, payload) {
  const existing = await db.prepare("SELECT * FROM vps_network_targets WHERE id = ?").bind(targetId).first();
  if (!existing)
    return null;
  const updated = {
    id: existing.id,
    nodeId: existing.node_id,
    type: payload.type !== void 0 ? normalizeString(payload.type).toLowerCase() : existing.type,
    target: payload.target !== void 0 ? normalizeString(payload.target) : existing.target,
    name: payload.name !== void 0 ? normalizeString(payload.name) : existing.name || "",
    scheme: payload.scheme !== void 0 ? normalizeString(payload.scheme || "https") : existing.scheme || "https",
    port: payload.port !== void 0 ? Number(payload.port) : existing.port,
    path: payload.path !== void 0 ? normalizeString(payload.path) : existing.path,
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : existing.enabled === 1,
    forceCheckAt: payload.forceCheckAt !== void 0 ? payload.forceCheckAt : existing.force_check_at,
    updatedAt: nowIso()
  };
  await db.prepare(
    `UPDATE vps_network_targets
     SET type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, force_check_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    updated.type,
    updated.target,
    updated.name,
    updated.scheme,
    updated.port,
    updated.path,
    updated.enabled ? 1 : 0,
    updated.forceCheckAt,
    updated.updatedAt,
    updated.id
  ).run();
  return updated;
}
__name(updateNetworkTarget, "updateNetworkTarget");
async function deleteNetworkTarget(db, targetId) {
  await db.prepare("DELETE FROM vps_network_targets WHERE id = ?").bind(targetId).run();
}
__name(deleteNetworkTarget, "deleteNetworkTarget");
function validateNetworkTarget(payload) {
  const type = normalizeString(payload.type).toLowerCase();
  const target = normalizeString(payload.target);
  if (!["icmp", "tcp", "http"].includes(type)) {
    return "\u7C7B\u578B\u4EC5\u652F\u6301 icmp/tcp/http";
  }
  if (!target) {
    return "\u76EE\u6807\u4E0D\u80FD\u4E3A\u7A7A";
  }
  if (type === "tcp") {
    const port = Number(payload.port);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      return "TCP \u7AEF\u53E3\u65E0\u6548";
    }
  }
  if (type === "http") {
    const path = normalizeString(payload.path || "/");
    if (!path.startsWith("/")) {
      return "HTTP \u8DEF\u5F84\u5FC5\u987B\u4EE5 / \u5F00\u5934";
    }
    const scheme = normalizeString(payload.scheme || "https");
    if (!["http", "https"].includes(scheme)) {
      return "HTTP \u534F\u8BAE\u4EC5\u652F\u6301 http/https";
    }
  }
  return null;
}
__name(validateNetworkTarget, "validateNetworkTarget");
async function checkAllNodesHeartbeat(db, settings) {
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  const cutoff = new Date(Date.now() - threshold * 60 * 1e3).toISOString();
  const staleNodesResult = await db.prepare(
    "SELECT * FROM vps_nodes WHERE status = 'online' AND (last_seen_at < ? OR last_seen_at IS NULL) AND enabled = 1"
  ).bind(cutoff).all();
  const staleNodes = staleNodesResult?.results || [];
  if (!staleNodes.length)
    return;
  for (const row of staleNodes) {
    const node = mapNodeRow(row);
    node.status = "offline";
    node.updatedAt = nowIso();
    await updateNode(db, node);
  }
}
__name(checkAllNodesHeartbeat, "checkAllNodesHeartbeat");
async function updateNodeStatus(db, settings, node, report) {
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  const wasOnline = node.status === "online";
  node.lastSeenAt = normalizeString(report.reportedAt || report.createdAt || nowIso()) || nowIso();
  const nowOnline = isNodeOnline(node.lastSeenAt, threshold);
  node.status = nowOnline ? "online" : "offline";
  if (wasOnline && !nowOnline && settings?.vpsMonitor?.notifyOffline !== false) {
    await pushAlert(db, settings, {
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: "offline",
      createdAt: nowIso(),
      message: buildAlertMessage("\u274C VPS \u79BB\u7EBF", [
        `*\u8282\u70B9:* ${node.name || node.id}`,
        node.tag ? `*\u6807\u7B7E:* ${node.tag}` : "",
        node.region ? `*\u5730\u533A:* ${node.region}` : "",
        `*\u65F6\u95F4:* ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`
      ])
    });
  }
  if (!wasOnline && nowOnline && settings?.vpsMonitor?.notifyRecovery !== false) {
    await pushAlert(db, settings, {
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: "recovery",
      createdAt: nowIso(),
      message: buildAlertMessage("\u2705 VPS \u6062\u590D\u5728\u7EBF", [
        `*\u8282\u70B9:* ${node.name || node.id}`,
        node.tag ? `*\u6807\u7B7E:* ${node.tag}` : "",
        node.region ? `*\u5730\u533A:* ${node.region}` : "",
        `*\u65F6\u95F4:* ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`
      ])
    });
  }
  const overloadInfo = computeOverload(report, settings);
  const overloadState = computeOverloadState(node.overloadState, overloadInfo);
  node.overloadState = overloadState;
  if (shouldTriggerOverload(settings, overloadState, overloadInfo) && settings?.vpsMonitor?.notifyOverload !== false) {
    const flags2 = [];
    if (overloadInfo.overload.cpu)
      flags2.push(`CPU ${overloadInfo.values.cpu}%`);
    if (overloadInfo.overload.mem)
      flags2.push(`\u5185\u5B58 ${overloadInfo.values.mem}%`);
    if (overloadInfo.overload.disk)
      flags2.push(`\u78C1\u76D8 ${overloadInfo.values.disk}%`);
    await pushAlert(db, settings, {
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: "overload",
      createdAt: nowIso(),
      message: buildAlertMessage("\u26A0\uFE0F VPS \u8D1F\u8F7D\u544A\u8B66", [
        `*\u8282\u70B9:* ${node.name || node.id}`,
        `*\u6307\u6807:* ${flags2.join(" / ")}`,
        `*\u9608\u503C:* CPU ${overloadInfo.thresholds.cpuThreshold}% / \u5185\u5B58 ${overloadInfo.thresholds.memThreshold}% / \u78C1\u76D8 ${overloadInfo.thresholds.diskThreshold}%`,
        `*\u65F6\u95F4:* ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`
      ])
    });
  }
}
__name(updateNodeStatus, "updateNodeStatus");
function buildInstallScript(reportUrl, node, settings) {
  return [
    "#!/usr/bin/env bash",
    "",
    "set -euo pipefail",
    "",
    `REPORT_URL="${reportUrl}"`,
    `NODE_ID="${node.id}"`,
    `NODE_SECRET="${node.secret}"`,
    `CONFIG_URL="${reportUrl.replace("/api/vps/report", "/api/vps/config")}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
    "",
    "cat > /usr/local/bin/mipulse-vps-probe.sh <<'EOF'",
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "for cmd in curl awk free df top hostname uname ping timeout; do",
    '  if ! command -v "$cmd" >/dev/null 2>&1; then',
    '    echo "[mipulse-probe] missing command: $cmd" >&2',
    '    echo "[mipulse-probe] please install it and rerun the script." >&2',
    "    exit 1",
    "  fi",
    "done",
    settings?.vpsMonitor?.requireSignature === true ? 'if ! command -v openssl >/dev/null 2>&1; then echo "[mipulse-probe] openssl is required when signature is enabled" >&2; exit 1; fi' : 'if ! command -v openssl >/dev/null 2>&1; then echo "[mipulse-probe] openssl missing, signature disabled" >&2; fi',
    "",
    "HAS_SOCKETS=1",
    "if [ ! -e /dev/tcp/127.0.0.1/80 ] 2>/dev/null; then",
    "  HAS_SOCKETS=0",
    "fi",
    "",
    `REPORT_URL="${reportUrl}"`,
    `NODE_ID="${node.id}"`,
    `NODE_SECRET="${node.secret}"`,
    `CONFIG_URL="${reportUrl.replace("/api/vps/report", "/api/vps/config")}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
    "",
    'HOSTNAME="$(hostname)"',
    'OS="$(. /etc/os-release && echo "$PRETTY_NAME" || uname -s)"',
    'ARCH="$(uname -m)"',
    'KERNEL="$(uname -r)"',
    `UPTIME_SEC="$(awk '{print int($1)}' /proc/uptime)"`,
    "",
    "cpu_usage() {",
    "  if command -v mpstat >/dev/null 2>&1; then",
    '    mpstat 1 2 | awk "/Average/ {printf "%.0f", 100-$NF}"',
    "    return",
    "  fi",
    "  local idle1 total1 idle2 total2",
    `  read -r idle1 total1 <<<"$(awk '/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}' /proc/stat)"`,
    "  sleep 2",
    `  read -r idle2 total2 <<<"$(awk '/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}' /proc/stat)"`,
    "  local total_diff=$((total2-total1))",
    "  local idle_diff=$((idle2-idle1))",
    '  if [ "$total_diff" -le 0 ]; then',
    "    echo 0",
    "  else",
    `    awk -v t="$total_diff" -v i="$idle_diff" 'BEGIN{printf "%.0f", (100*(t-i))/t}'`,
    "  fi",
    "}",
    'PROBE_VERSION="1.0.0"',
    'LAST_ERROR=""',
    'CPU_USAGE="$(cpu_usage)"',
    `MEM_USAGE="$(free | awk '/Mem/ {printf "%.0f", $3/$2*100}')"`,
    `DISK_USAGE="$(df -P / | awk 'NR==2 {gsub(/%/,""); print $5}')"`,
    `LOAD1="$(awk '{print $1}' /proc/loadavg)"`,
    `TRAFFIC_JSON="$(cat /proc/net/dev | awk 'NR>2 && $1 != "lo:" {rx += $2; tx += $10} END {printf "{\\"rx\\": %d, \\"tx\\": %d}", rx, tx}')"`,
    "",
    "REPORT_INTERVAL=60",
    "REPORT_STORE_INTERVAL=60",
    "NETWORK_INTERVAL=300",
    "SIGN_REQUIRED=0",
    "TARGETS=()",
    'if CONFIG_ENV=$(curl -fsSL "$CONFIG_URL" 2>/dev/null); then',
    "  while IFS= read -r line; do",
    '    case "$line" in',
    "      REPORT_INTERVAL=*) REPORT_INTERVAL=$((${line#*=} * 60)) ;;",
    "      REPORT_STORE_INTERVAL=*) REPORT_STORE_INTERVAL=$((${line#*=} * 60)) ;;",
    "      NETWORK_INTERVAL=*) NETWORK_INTERVAL=$((${line#*=} * 60)) ;;",
    "      SIGN_REQUIRED=*) SIGN_REQUIRED=${line#*=} ;;",
    '      TARGET=*) TARGETS+=("${line#*=}") ;;',
    "    esac",
    '  done <<< "$CONFIG_ENV"',
    "fi",
    "",
    'NETWORK_STATE="/var/tmp/mipulse-vps-network.ts"',
    'REPORT_STATE="/var/tmp/mipulse-vps-report.ts"',
    'REPORT_STORE_STATE="/var/tmp/mipulse-vps-report-store.ts"',
    'NETWORK_JSON="null"',
    "now_ts=$(date +%s)",
    "last_ts=0",
    'if [ -f "$NETWORK_STATE" ]; then last_ts=$(cat "$NETWORK_STATE" || echo 0); fi',
    'if [ $((now_ts-last_ts)) -ge "$NETWORK_INTERVAL" ]; then',
    "  checks=()",
    '  for item in "${TARGETS[@]}"; do',
    '    IFS="|" read -r ttype ttarget tscheme tport tpath tenabled tforce tname <<< "$item"',
    '    if [ "${tenabled:-1}" = "0" ]; then continue; fi',
    "    checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    '    if [ "$ttype" = "icmp" ]; then',
    '      ping_out=$(ping -c 3 -w 4 "$ttarget" 2>/dev/null || true)',
    `      loss=$(echo "$ping_out" | awk -F", " '/packet loss/ {print $3}' | awk '{gsub(/%/," "); print $1}')`,
    `      avg=$(echo "$ping_out" | awk -F"/" '/rtt/ {print $5}')`,
    '      if [ -z "$avg" ]; then status="down"; avg=null; else status="up"; fi',
    '      checks+=("{\\"type\\":\\"icmp\\",\\"target\\":\\"$ttarget\\",\\"name\\":\\"$tname\\",\\"status\\":\\"$status\\",\\"latencyMs\\":${avg:-null},\\"lossPercent\\":${loss:-null},\\"checkedAt\\":\\"$checked_at\\"}")',
    '    elif [ "$ttype" = "tcp" ]; then',
    "      start=$(date +%s%3N)",
    '      if [ "$HAS_SOCKETS" = "1" ] && timeout 3 bash -c "cat < /dev/null > /dev/tcp/$ttarget/$tport" 2>/dev/null; then',
    '        end=$(date +%s%3N); latency=$((end-start)); status="up"',
    "      else",
    '        latency=null; status="down"',
    "      fi",
    '      checks+=("{\\"type\\":\\"tcp\\",\\"target\\":\\"$ttarget\\",\\"name\\":\\"$tname\\",\\"port\\":$tport,\\"status\\":\\"$status\\",\\"latencyMs\\":${latency},\\"checkedAt\\":\\"$checked_at\\"}")',
    '    elif [ "$ttype" = "http" ]; then',
    '      scheme="${tscheme:-https}"',
    '      url="$scheme://$ttarget"',
    '      if [ -n "$tport" ]; then url="$url:$tport"; fi',
    '      if [ -n "$tpath" ]; then url="$url$tpath"; fi',
    '      result=$(curl -o /dev/null -s -w "%{time_total} %{http_code} %{time_namelookup} %{time_connect} %{time_appconnect}" --max-time 5 "$url" || true)',
    `      time_total=$(echo "$result" | awk '{print $1}')`,
    `      http_code=$(echo "$result" | awk '{print $2}')`,
    `      t_dns=$(echo "$result" | awk '{print $3}')`,
    `      t_connect=$(echo "$result" | awk '{print $4}')`,
    `      t_tls=$(echo "$result" | awk '{print $5}')`,
    '      if [ -n "$time_total" ] && [ "$http_code" != "000" ]; then',
    `        latency=$(awk -v t="$time_total" 'BEGIN{printf "%.0f", t*1000}')`,
    `        dns=$(awk -v t="$t_dns" 'BEGIN{printf "%.0f", t*1000}')`,
    `        connect=$(awk -v t="$t_connect" 'BEGIN{printf "%.0f", t*1000}')`,
    `        tls=$(awk -v t="$t_tls" 'BEGIN{printf "%.0f", t*1000}')`,
    '        status="up"',
    "      else",
    '        latency=null; http_code="000"; dns=null; connect=null; tls=null; status="down"',
    "      fi",
    '      checks+=("{\\"type\\":\\"http\\",\\"target\\":\\"$ttarget\\",\\"name\\":\\"$tname\\",\\"scheme\\":\\"${scheme}\\",\\"port\\":${tport:-null},\\"path\\":\\"${tpath:-/}\\",\\"status\\":\\"$status\\",\\"latencyMs\\":${latency},\\"httpCode\\":$http_code,\\"dnsMs\\":${dns},\\"connectMs\\":${connect},\\"tlsMs\\":${tls},\\"checkedAt\\":\\"$checked_at\\"}")',
    "    fi",
    "  done",
    '  NETWORK_JSON="["$(IFS=,; echo "${checks[*]}")"]"',
    '  echo "$now_ts" > "$NETWORK_STATE"',
    "fi",
    "",
    "SHOULD_SEND=0",
    'if [ ! -f "$REPORT_STATE" ]; then SHOULD_SEND=1; else',
    '  last_report=$(cat "$REPORT_STATE" || echo 0)',
    '  if [ $((now_ts-last_report)) -ge "$REPORT_INTERVAL" ]; then SHOULD_SEND=1; fi',
    "fi",
    "SHOULD_STORE=0",
    'if [ ! -f "$REPORT_STORE_STATE" ]; then SHOULD_STORE=1; else',
    '  last_store=$(cat "$REPORT_STORE_STATE" || echo 0)',
    '  if [ $((now_ts-last_store)) -ge "$REPORT_STORE_INTERVAL" ]; then SHOULD_STORE=1; fi',
    "fi",
    'if [ "$SHOULD_SEND" = "1" ]; then',
    '  if [ "$SHOULD_STORE" = "1" ]; then echo "$now_ts" > "$REPORT_STORE_STATE"; fi',
    "  PAYLOAD=$(cat <<PAYLOAD_EOF",
    "{",
    '  "hostname": "${HOSTNAME}",',
    '  "os": "${OS}",',
    '  "arch": "${ARCH}",',
    '  "kernel": "${KERNEL}",',
    '  "probeVersion": "${PROBE_VERSION}",',
    '  "lastError": "${LAST_ERROR}",',
    '  "uptimeSec": ${UPTIME_SEC},',
    '  "cpu": { "usage": ${CPU_USAGE} },',
    '  "mem": { "usage": ${MEM_USAGE} },',
    '  "disk": { "usage": ${DISK_USAGE} },',
    '  "load": { "load1": ${LOAD1} },',
    '  "traffic": ${TRAFFIC_JSON},',
    '  "network": ${NETWORK_JSON}',
    "}",
    "PAYLOAD_EOF",
    ")",
    "",
    "  TS_MS=$(date +%s%3N 2>/dev/null || true)",
    '  if [ -z "$TS_MS" ]; then TS_MS=$(($(date +%s) * 1000)); fi',
    '  SIG=""',
    "  if command -v openssl >/dev/null 2>&1; then",
    '    SIG=$(printf "%s" "${NODE_ID}.${TS_MS}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${NODE_SECRET}" -hex | awk \'{print $2}\')',
    "  else",
    '    if [ "$SIGN_REQUIRED" = "1" ]; then',
    '      echo "[mipulse-probe] openssl missing, cannot sign payload" >&2',
    "    else",
    '      echo "[mipulse-probe] openssl missing, signature disabled" >&2',
    "    fi",
    "  fi",
    "",
    `curl -sS -X POST "${reportUrl}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "x-node-id: ${node.id}" \\`,
    `  -H "x-node-secret: ${node.secret}" \\`,
    '  -H "x-node-timestamp: ${TS_MS}" \\',
    '  -H "x-node-signature: ${SIG}" \\',
    '  --data "${PAYLOAD}" >/dev/null',
    '  echo "$now_ts" > "$REPORT_STATE"',
    "fi",
    "EOF",
    "",
    "chmod +x /usr/local/bin/mipulse-vps-probe.sh",
    "",
    "cat > /etc/systemd/system/mipulse-vps-probe.service <<'EOF'",
    "[Unit]",
    "Description=MiPulse VPS Probe",
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=oneshot",
    "ExecStart=/usr/local/bin/mipulse-vps-probe.sh",
    "EOF",
    "",
    "cat > /etc/systemd/system/mipulse-vps-probe.timer <<'EOF'",
    "[Unit]",
    "Description=MiPulse VPS Probe Timer",
    "",
    "[Timer]",
    "OnBootSec=2min",
    "OnUnitActiveSec=60s",
    "Unit=mipulse-vps-probe.service",
    "Persistent=true",
    "",
    "[Install]",
    "WantedBy=timers.target",
    "EOF",
    "",
    "systemctl daemon-reload",
    "",
    "systemctl enable --now mipulse-vps-probe.timer",
    "",
    "systemctl status mipulse-vps-probe.timer --no-pager"
  ].join("\n");
}
__name(buildInstallScript, "buildInstallScript");
function buildUninstallScript() {
  return [
    "#!/usr/bin/env bash",
    "",
    "set -euo pipefail",
    "",
    'echo "[mipulse-probe] stopping and disabling mipulse-vps-probe.timer..."',
    "systemctl stop mipulse-vps-probe.timer || true",
    "systemctl disable mipulse-vps-probe.timer || true",
    "",
    'echo "[mipulse-probe] removing systemd configuration..."',
    "rm -f /etc/systemd/system/mipulse-vps-probe.timer",
    "rm -f /etc/systemd/system/mipulse-vps-probe.service",
    "systemctl daemon-reload",
    "",
    'echo "[mipulse-probe] removing probe script..."',
    "rm -f /usr/local/bin/mipulse-vps-probe.sh",
    "",
    'echo "[mipulse-probe] cleaning up temporary files..."',
    "rm -f /var/tmp/mipulse-vps-network.ts /var/tmp/mipulse-vps-report.ts /var/tmp/mipulse-vps-report-store.ts",
    "",
    'echo "[mipulse-probe] uninstallation complete."'
  ].join("\n");
}
__name(buildUninstallScript, "buildUninstallScript");
function buildPublicGuide(env, request, node) {
  const baseUrl = new URL(request.url).origin;
  const reportUrl = `${baseUrl}/api/vps/report`;
  const installScript = buildInstallScript(reportUrl, node);
  const installCommand = `curl -fsSL "${baseUrl}/api/vps/install?nodeId=${node.id}&secret=${node.secret}" | bash`;
  const uninstallScript = buildUninstallScript(node);
  const uninstallCommand = `curl -fsSL "${baseUrl}/api/vps/uninstall?nodeId=${node.id}&secret=${node.secret}" | bash`;
  return {
    reportUrl,
    nodeId: node.id,
    nodeSecret: node.secret,
    headers: {
      "Content-Type": "application/json",
      "x-node-id": node.id,
      "x-node-secret": node.secret
    },
    installScript,
    installCommand,
    uninstallScript,
    uninstallCommand
  };
}
__name(buildPublicGuide, "buildPublicGuide");
async function handleVpsRequest(path, request, env, auth) {
  const db = env.MIPULSE_DB;
  if (!db)
    return createError("D1 Binding (MIPULSE_DB) not found", 500);
  await ensureCoreSchema(env);
  const url = new URL(request.url);
  const parts = path.split("/");
  const method = request.method;
  if (parts[1] === "report" && method === "POST") {
    return handleReport(request, db, env);
  }
  if (parts[1] === "install" && method === "GET") {
    return handleInstallScript(request, db, env);
  }
  if (parts[1] === "uninstall" && method === "GET") {
    return handleUninstallScript(request, db, env);
  }
  if (parts[1] === "config" && method === "GET") {
    return handleNodeConfig(request, db, env);
  }
  if (parts[1] === "public" && method === "GET") {
    if (parts[2] === "nodes" && parts[3]) {
      return handlePublicNodeDetail(request, db, env);
    }
    return handlePublicSnapshot(request, db, env);
  }
  if (parts[1] === "settings" && method === "GET") {
    return handleGetSettings(env);
  }
  if (!auth)
    return createError("Unauthorized", 401);
  if (parts[1] === "settings" && method === "POST") {
    return handleSaveSettings(request, env);
  }
  if (parts[1] === "notifications" && parts[2] === "test" && method === "POST") {
    return handleTestNotification(env);
  }
  if (parts[1] === "nodes") {
    if (method === "GET") {
      if (parts[2])
        return handleGetNodeDetail(parts[2], db, env, request);
      return handleListNodes(db, env);
    }
    if (method === "POST")
      return handleCreateNode(request, db, env);
    if (method === "PUT" && parts[2])
      return handleUpdateNode(parts[2], request, db, env);
    if (method === "DELETE" && parts[2])
      return handleDeleteNode(parts[2], db);
  }
  if (parts[1] === "alerts") {
    if (method === "GET")
      return handleListAlerts(db);
    if (method === "DELETE")
      return handleClearAlerts(db);
  }
  if (parts[1] === "targets") {
    if (parts[2] === "check" && method === "POST")
      return handleNetworkCheck(request, db, env);
    if (method === "GET")
      return handleListTargets(url.searchParams.get("nodeId"), db);
    if (method === "POST")
      return handleCreateTarget(request, db, env);
    if (method === "PUT" && parts[2])
      return handleUpdateTarget(parts[2], request, db);
    if (method === "DELETE" && parts[2])
      return handleDeleteTarget(parts[2], db);
  }
  if (parts[1] === "network_targets") {
    return handleNetworkTargets(request, db, env);
  }
  if (parts[1] === "network_check") {
    return handleNetworkCheck(request, db, env);
  }
  return createError("Not Found", 404);
}
__name(handleVpsRequest, "handleVpsRequest");
async function handleReport(request, db, env) {
  let payload;
  let rawBody = "";
  try {
    rawBody = await request.text();
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return createError("Invalid JSON", 400);
  }
  const nodeId = normalizeString(request.headers.get("x-node-id") || payload?.nodeId);
  const nodeSecret = normalizeString(request.headers.get("x-node-secret") || payload?.secret);
  const signature = normalizeString(request.headers.get("x-node-signature") || payload?.signature);
  const signatureTs = normalizeString(request.headers.get("x-node-timestamp") || payload?.timestamp);
  if (!nodeId)
    return createError("Missing node id", 401);
  const settings = await loadSettings(env);
  const node = await fetchNode(db, nodeId);
  if (!node)
    return createError("Node not found", 404);
  if (node.enabled === false)
    return createError("Node disabled", 403);
  if (settings?.vpsMonitor?.requireSecret !== false) {
    if (!nodeSecret)
      return createError("Missing node secret", 401);
    if (node.secret !== nodeSecret)
      return createError("Unauthorized", 401);
  }
  if (settings?.vpsMonitor?.requireSignature === true) {
    if (!signature || !signatureTs)
      return createError("Missing signature", 401);
    const tsNumber = Number(signatureTs);
    if (!Number.isFinite(tsNumber))
      return createError("Invalid timestamp", 400);
    const skewMinutes = clampNumber(settings?.vpsMonitor?.signatureClockSkewMinutes, 1, 60, 5);
    const nowMs = Date.now();
    const skewMs = skewMinutes * 60 * 1e3;
    if (Math.abs(nowMs - tsNumber) > skewMs)
      return createError("Signature expired", 401);
    const bodyToSign = normalizeString(rawBody || safeJsonStringify(payload?.report || payload));
    const expected = await computeSignature(node.secret, node.id, String(tsNumber), bodyToSign);
    if (expected !== signature)
      return createError("Invalid signature", 401);
  }
  const report = payload?.report || payload;
  const receivedAt = nowIso();
  const reportedAt = normalizeReportTimestamp(report.reportedAt || report.at || report.timestamp || report.ts, receivedAt);
  const networkPayload = report.network || report.checks || null;
  const sanitizedChecks = sanitizeNetworkChecks(networkPayload);
  if (request.cf?.country) {
    node.countryCode = normalizeString(request.cf.country);
  }
  if (report.traffic) {
    const lastTraffic = node.lastReport?.traffic || {};
    const curRx = Number(report.traffic.rx || 0);
    const curTx = Number(report.traffic.tx || 0);
    const lastRx = Number(lastTraffic.rx || 0);
    const lastTx = Number(lastTraffic.tx || 0);
    const rxDelta = curRx < lastRx || lastRx === 0 ? curRx : curRx - lastRx;
    const txDelta = curTx < lastTx || lastTx === 0 ? curTx : curTx - lastTx;
    node.totalRx = (Number(node.totalRx) || 0) + rxDelta;
    node.totalTx = (Number(node.totalTx) || 0) + txDelta;
  }
  const normalizedReport = {
    id: crypto.randomUUID(),
    nodeId: node.id,
    reportedAt,
    createdAt: nowIso(),
    receivedAt,
    meta: {
      hostname: normalizeString(report.hostname || report.host),
      os: normalizeString(report.os || report.platform),
      arch: normalizeString(report.arch),
      kernel: normalizeString(report.kernel),
      version: normalizeString(report.version),
      probeVersion: normalizeString(report.probeVersion || report.agentVersion || report.version),
      lastError: normalizeString(report.lastError || report.error),
      publicIp: normalizeString(report.publicIp || report.ip || getClientIp(request)),
      countryCode: node.countryCode
    },
    cpu: { usage: clampPayloadUsage(report.cpu?.usage) },
    mem: { usage: clampPayloadUsage(report.mem?.usage) },
    disk: { usage: clampPayloadUsage(report.disk?.usage) },
    load: { load1: clampPayloadLoad(report.load?.load1) },
    uptimeSec: clampPayloadUptime(report.uptimeSec ?? report.uptime) ?? 0,
    traffic: report.traffic || null,
    network: sanitizedChecks.length ? sanitizedChecks : null
  };
  if (sanitizedChecks.length) {
    const networkSample = {
      id: crypto.randomUUID(),
      nodeId: node.id,
      reportedAt,
      createdAt: nowIso(),
      checks: sanitizedChecks
    };
    await insertNetworkSample(db, networkSample);
    await pruneNetworkSamples(db, settings);
  }
  const reportInterval = clampNumber(settings?.vpsMonitor?.reportStoreIntervalMinutes, 1, 60, 1);
  const lastSeenTs = node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : NaN;
  if (reportInterval <= 1 || !Number.isFinite(lastSeenTs) || Date.now() - lastSeenTs >= reportInterval * 60 * 1e3) {
    await insertReport(db, normalizedReport);
    await pruneReports(db, settings);
  }
  node.lastSeenAt = normalizedReport.reportedAt;
  await updateNodeStatus(db, settings, node, normalizedReport);
  await checkAllNodesHeartbeat(db, settings);
  node.lastReport = buildSnapshot(normalizedReport, node);
  node.updatedAt = nowIso();
  await updateNode(db, node);
  return createJson({ success: true });
}
__name(handleReport, "handleReport");
async function handleListNodes(db, env) {
  const settings = await loadSettings(env);
  const nodes = await fetchNodes(db);
  const data = nodes.map((node) => summarizeNode(node, node.lastReport || null, settings));
  return createJson({ success: true, data: { data } });
}
__name(handleListNodes, "handleListNodes");
async function handleCreateNode(request, db, env) {
  const body = await request.json();
  const name = normalizeString(body.name);
  if (!name)
    return createError("Name is required", 400);
  const node = {
    id: crypto.randomUUID(),
    name,
    tag: normalizeString(body.tag),
    groupTag: normalizeString(body.groupTag),
    region: normalizeString(body.region),
    countryCode: normalizeString(body.countryCode),
    description: normalizeString(body.description),
    secret: normalizeString(body.secret) || crypto.randomUUID(),
    status: "offline",
    enabled: body.enabled !== false,
    useGlobalTargets: body.useGlobalTargets === true,
    totalRx: 0,
    totalTx: 0,
    trafficLimitGb: Number(body.trafficLimitGb || 0),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastSeenAt: null,
    lastReport: null,
    overloadState: null
  };
  await insertNode(db, node);
  return createJson({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
}
__name(handleCreateNode, "handleCreateNode");
async function handleUpdateNode(id, request, db, env) {
  const body = await request.json();
  const node = await fetchNode(db, id);
  if (!node)
    return createError("Node not found", 404);
  const fields = ["name", "tag", "groupTag", "region", "countryCode", "description"];
  fields.forEach((field) => {
    if (body[field] !== void 0) {
      node[field] = normalizeString(body[field]);
    }
  });
  if (typeof body.useGlobalTargets === "boolean")
    node.useGlobalTargets = body.useGlobalTargets;
  if (typeof body.trafficLimitGb === "number")
    node.trafficLimitGb = body.trafficLimitGb;
  if (typeof body.enabled === "boolean")
    node.enabled = body.enabled;
  if (body.resetSecret)
    node.secret = crypto.randomUUID();
  node.updatedAt = nowIso();
  await updateNode(db, node);
  return createJson({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
}
__name(handleUpdateNode, "handleUpdateNode");
async function handleDeleteNode(id, db) {
  await deleteNode(db, id);
  return createJson({ success: true });
}
__name(handleDeleteNode, "handleDeleteNode");
async function handleGetNodeDetail(id, db, env, request) {
  const settings = await loadSettings(env);
  const node = await fetchNode(db, id);
  if (!node)
    return createError("Node not found", 404);
  const latestReport = node.lastReport || null;
  let reports = await fetchReportsForNode(db, id, settings);
  const nodeTargets = await fetchNetworkTargets(db, id);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
  let networkSamples = await fetchNetworkSamples(db, id, settings);
  reports = reports.map((r) => {
    if (r.network)
      r.network = rehydrateCheckNames(r.network, targets);
    return r;
  });
  networkSamples = networkSamples.map((s) => {
    if (s.checks)
      s.checks = rehydrateCheckNames(s.checks, targets);
    return s;
  });
  return createJson({
    success: true,
    data: {
      data: summarizeNode(node, latestReport, settings),
      reports,
      targets,
      networkSamples,
      guide: buildPublicGuide(env, request, node)
    }
  });
}
__name(handleGetNodeDetail, "handleGetNodeDetail");
async function handlePublicSnapshot(request, db, env) {
  const settings = await loadSettings(env);
  const layout = {
    headerEnabled: true,
    footerEnabled: true
  };
  const nodes = await fetchNodes(db);
  if (!nodes.length) {
    return createJson({ success: true, data: [], theme: buildPublicThemeConfig(settings), layout });
  }
  const nodeIds = nodes.map((n) => n.id);
  const latestSamples = await fetchLatestNetworkSamplesBatch(db, nodeIds);
  const samplesMap = new Map(latestSamples.map((s) => [s.nodeId, s.checks]));
  const placeholders = nodeIds.map(() => "?").join(",");
  const allTargetsResult = await db.prepare(
    "SELECT * FROM vps_network_targets WHERE node_id IN (" + placeholders + ") OR node_id = ?"
  ).bind(...nodeIds, "global").all();
  const allTargetsMap = /* @__PURE__ */ new Map();
  (allTargetsResult.results || []).forEach((row) => {
    const tid = row.node_id;
    if (!allTargetsMap.has(tid))
      allTargetsMap.set(tid, []);
    allTargetsMap.get(tid).push({
      type: row.type,
      target: row.target,
      name: row.name,
      scheme: row.scheme || "https",
      port: row.port,
      path: row.path
    });
  });
  const data = nodes.map((node) => {
    const summary = summarizeNode(node, node.lastReport || null, settings);
    let latestNetwork = samplesMap.get(node.id);
    const nodeSpecificTargets = allTargetsMap.get(node.id) || [];
    const globalTargets = allTargetsMap.get("global") || [];
    const targets = node.useGlobalTargets ? globalTargets : nodeSpecificTargets;
    if (latestNetwork && latestNetwork.length > 0) {
      latestNetwork = rehydrateCheckNames(latestNetwork, targets);
      if (!summary.latest)
        summary.latest = { at: nowIso() };
      summary.latest.network = latestNetwork;
    }
    if (summary.latest) {
      if (summary.latest.publicIp)
        delete summary.latest.publicIp;
      if (summary.latest.ip)
        delete summary.latest.ip;
    }
    return summary;
  });
  return createJson({
    success: true,
    data,
    theme: buildPublicThemeConfig(settings),
    layout
  });
}
__name(handlePublicSnapshot, "handlePublicSnapshot");
async function fetchLatestNetworkSamplesBatch(db, nodeIds) {
  if (!nodeIds.length)
    return [];
  const placeholders = nodeIds.map(() => "?").join(",");
  const sql = `SELECT node_id, data, reported_at FROM vps_network_samples WHERE node_id IN (${placeholders}) ORDER BY reported_at DESC`;
  const { results } = await db.prepare(sql).bind(...nodeIds).all();
  const latestMap = /* @__PURE__ */ new Map();
  for (const row of results) {
    if (!latestMap.has(row.node_id)) {
      latestMap.set(row.node_id, {
        nodeId: row.node_id,
        checks: row.data ? JSON.parse(row.data).checks : [],
        reportedAt: row.reported_at
      });
    }
  }
  return Array.from(latestMap.values());
}
__name(fetchLatestNetworkSamplesBatch, "fetchLatestNetworkSamplesBatch");
async function handlePublicNodeDetail(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  let nodeId = normalizeString(url.pathname.split("/").pop());
  if (!nodeId || nodeId === "nodes") {
    nodeId = normalizeString(url.searchParams.get("id"));
  }
  if (!nodeId)
    return createError("Node id required", 400);
  const node = await fetchNode(db, nodeId);
  if (!node)
    return createError("Node not found", 404);
  const nodeTargets = await fetchNetworkTargets(db, nodeId);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    "SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT 500"
  ).bind(nodeId, cutoff).all();
  const samples = (result.results || []).map((row) => {
    const s = JSON.parse(row.data);
    if (s.checks)
      s.checks = rehydrateCheckNames(s.checks, targets);
    return s;
  });
  const summary = summarizeNode(node, node.lastReport || null, settings);
  if (summary.latest) {
    if (summary.latest.publicIp)
      delete summary.latest.publicIp;
    if (summary.latest.ip)
      delete summary.latest.ip;
  }
  return createJson({
    success: true,
    data: summary,
    networkSamples: samples,
    layout: {
      headerEnabled: true,
      footerEnabled: true
    }
  });
}
__name(handlePublicNodeDetail, "handlePublicNodeDetail");
async function handleListAlerts(db) {
  const result = await db.prepare("SELECT * FROM vps_alerts ORDER BY created_at DESC").all();
  const alerts = (result.results || []).map((row) => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at
  }));
  return createJson({ success: true, data: { data: alerts } });
}
__name(handleListAlerts, "handleListAlerts");
async function handleClearAlerts(db) {
  await db.prepare("DELETE FROM vps_alerts").run();
  return createJson({ success: true });
}
__name(handleClearAlerts, "handleClearAlerts");
async function handleListTargets(nodeId, db) {
  const query = nodeId ? "SELECT * FROM vps_network_targets WHERE node_id = ?" : "SELECT * FROM vps_network_targets";
  const params = nodeId ? [nodeId] : [];
  const { results } = await db.prepare(query).bind(...params).all();
  return createJson({ success: true, data: results });
}
__name(handleListTargets, "handleListTargets");
async function handleCreateTarget(request, db, env) {
  const settings = await loadSettings(env);
  const body = await request.json();
  const nodeId = normalizeString(body.nodeId || "global");
  const error = validateNetworkTarget(body);
  if (error)
    return createError(error, 400);
  const current = nodeId === "global" ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
  const limit = clampNumber(settings?.vpsMonitor?.networkTargetsLimit, 1, 10, 3);
  if (current.length >= limit)
    return createError(`\u76EE\u6807\u6570\u91CF\u8D85\u8FC7\u4E0A\u9650\uFF08${limit}\uFF09`, 400);
  const target = await insertNetworkTarget(db, nodeId, body);
  return createJson({ success: true, data: target });
}
__name(handleCreateTarget, "handleCreateTarget");
async function handleUpdateTarget(id, request, db) {
  const body = await request.json();
  if (body.type || body.target || body.port || body.path || body.scheme) {
    const error = validateNetworkTarget({
      type: body.type || "icmp",
      target: body.target || "1.1.1.1",
      port: body.port,
      path: body.path,
      scheme: body.scheme
    });
    if (error)
      return createError(error, 400);
  }
  const updated = await updateNetworkTarget(db, id, body);
  if (!updated)
    return createError("Target not found", 404);
  return createJson({ success: true, data: updated });
}
__name(handleUpdateTarget, "handleUpdateTarget");
async function handleDeleteTarget(id, db) {
  await db.prepare("DELETE FROM vps_network_targets WHERE id = ?").bind(id).run();
  return createJson({ success: true });
}
__name(handleDeleteTarget, "handleDeleteTarget");
async function handleNodeConfig(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get("nodeId"));
  const nodeSecret = normalizeString(url.searchParams.get("secret"));
  const format = normalizeString(url.searchParams.get("format")) || "json";
  if (!nodeId || !nodeSecret)
    return createError("Missing node credentials", 401);
  const node = await fetchNode(db, nodeId);
  if (!node || node.secret !== nodeSecret)
    return createError("Unauthorized", 401);
  const nodeTargets = await fetchNetworkTargets(db, nodeId);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
  const interval = clampNumber(settings?.vpsMonitor?.networkSampleIntervalMinutes, 1, 60, 5);
  const reportInterval = clampNumber(settings?.vpsMonitor?.reportIntervalMinutes, 1, 60, 1);
  const reportStoreInterval = clampNumber(settings?.vpsMonitor?.reportStoreIntervalMinutes, 1, 60, 1);
  if (format === "env") {
    const lines = [
      `NETWORK_INTERVAL=${interval}`,
      `REPORT_INTERVAL=${reportInterval}`,
      `REPORT_STORE_INTERVAL=${reportStoreInterval}`,
      `SIGN_REQUIRED=${settings?.vpsMonitor?.requireSignature === true ? 1 : 0}`
    ];
    const pending = [];
    targets.forEach((target) => {
      const line = `TARGET=${target.type}|${target.target}|${target.scheme || "https"}|${target.port || ""}|${target.path || ""}|${target.enabled ? 1 : 0}|${target.forceCheckAt || ""}|${target.name || ""}`;
      lines.push(line);
      if (target.forceCheckAt)
        pending.push(target.id);
    });
    if (pending.length) {
      await db.prepare(
        `UPDATE vps_network_targets SET force_check_at = NULL, updated_at = ? WHERE id IN (${pending.map(() => "?").join(",")})`
      ).bind(nowIso(), ...pending).run();
    }
    return new Response(lines.join("\n"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  return createJson({
    success: true,
    data: {
      intervalMinutes: interval,
      targets
    }
  });
}
__name(handleNodeConfig, "handleNodeConfig");
async function handleNetworkTargets(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get("nodeId"));
  const isGlobal = nodeId === "global";
  if (!nodeId)
    return createError("Node id required", 400);
  if (!isGlobal) {
    const node = await fetchNode(db, nodeId);
    if (!node)
      return createError("Node not found", 404);
  }
  if (request.method === "GET") {
    const targets = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
    return createJson({ success: true, data: targets });
  }
  if (request.method === "POST") {
    const payload = await request.json();
    const error = validateNetworkTarget(payload);
    if (error)
      return createError(error, 400);
    const current = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
    const limit = clampNumber(settings?.vpsMonitor?.networkTargetsLimit, 1, 10, 3);
    if (current.length >= limit)
      return createError(`\u76EE\u6807\u6570\u91CF\u8D85\u8FC7\u4E0A\u9650\uFF08${limit}\uFF09`, 400);
    const target = await insertNetworkTarget(db, nodeId, payload);
    return createJson({ success: true, data: target });
  }
  if (request.method === "PATCH") {
    const payload = await request.json();
    const targetId = normalizeString(payload.id);
    if (!targetId)
      return createError("Target id required", 400);
    const error = payload.type || payload.target || payload.port || payload.path || payload.scheme ? validateNetworkTarget({
      type: payload.type || "icmp",
      target: payload.target || "1.1.1.1",
      port: payload.port,
      path: payload.path,
      scheme: payload.scheme
    }) : null;
    if (error)
      return createError(error, 400);
    const updated = await updateNetworkTarget(db, targetId, payload);
    if (!updated)
      return createError("Target not found", 404);
    return createJson({ success: true, data: updated });
  }
  if (request.method === "DELETE") {
    const payload = await request.json();
    const targetId = normalizeString(payload.id);
    if (!targetId)
      return createError("Target id required", 400);
    await deleteNetworkTarget(db, targetId);
    return createJson({ success: true });
  }
  return createError("Method Not Allowed", 405);
}
__name(handleNetworkTargets, "handleNetworkTargets");
async function handleNetworkCheck(request, db, env) {
  if (request.method !== "POST")
    return createError("Method Not Allowed", 405);
  const settings = await loadSettings(env);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return createError("Invalid JSON", 400);
  }
  const nodeId = normalizeString(payload.nodeId);
  if (!nodeId)
    return createError("Node id required", 400);
  const targetId = normalizeString(payload.targetId);
  if (!targetId)
    return createError("Target id required", 400);
  const node = await fetchNode(db, nodeId);
  if (!node)
    return createError("Node not found", 404);
  if (node.enabled === false)
    return createError("Node disabled", 403);
  const targetRow = await db.prepare(
    "SELECT * FROM vps_network_targets WHERE id = ? AND (node_id = ? OR node_id = ?)"
  ).bind(targetId, nodeId, "global").first();
  if (!targetRow)
    return createError("Target not found", 404);
  if (targetRow.enabled === 0)
    return createError("Target disabled", 400);
  const now = nowIso();
  await db.prepare(
    "UPDATE vps_network_targets SET force_check_at = ?, updated_at = ? WHERE id = ?"
  ).bind(now, now, targetRow.id).run();
  const target = {
    id: targetRow.id,
    type: targetRow.type,
    target: targetRow.target,
    scheme: targetRow.scheme || "https",
    port: targetRow.port,
    path: targetRow.path,
    forceCheckAt: now
  };
  return createJson({ success: true, data: target, message: "Probe will run check on next report" });
}
__name(handleNetworkCheck, "handleNetworkCheck");
async function handleInstallScript(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get("nodeId"));
  const nodeSecret = normalizeString(url.searchParams.get("secret"));
  if (!nodeId || !nodeSecret)
    return createError("Missing node credentials", 401);
  const node = await fetchNode(db, nodeId);
  if (!node)
    return createError("Node not found", 404);
  if (node.secret !== nodeSecret)
    return createError("Unauthorized", 401);
  const reportUrl = `${url.origin}/api/vps/report`;
  const script = buildInstallScript(reportUrl, node, settings);
  return new Response(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
__name(handleInstallScript, "handleInstallScript");
async function handleUninstallScript(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get("nodeId"));
  const nodeSecret = normalizeString(url.searchParams.get("secret"));
  if (!nodeId || !nodeSecret)
    return createError("Missing node credentials", 401);
  const node = await fetchNode(db, nodeId);
  if (!node)
    return createError("Node not found", 404);
  if (node.secret !== nodeSecret)
    return createError("Unauthorized", 401);
  const script = buildUninstallScript(node);
  return new Response(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
__name(handleUninstallScript, "handleUninstallScript");
async function handleGetSettings(env) {
  const settings = await loadSettings(env);
  return createJson({ success: true, ...settings });
}
__name(handleGetSettings, "handleGetSettings");
async function handleSaveSettings(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return createError("Invalid JSON", 400);
  }
  const current = await loadSettings(env);
  const merged = { ...current, ...payload };
  if (payload?.vpsMonitor) {
    merged.vpsMonitor = { ...current.vpsMonitor, ...payload.vpsMonitor };
  }
  await saveSettings(env, merged);
  return createJson({ success: true, data: merged });
}
__name(handleSaveSettings, "handleSaveSettings");

// api/[[path]].js
async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.path ? params.path.join("/") : "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    if (path === "auth/login" && request.method === "POST") {
      const resp = await login(request, env);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }
    if (path === "auth/profile" && request.method === "GET") {
      const auth = await verifyAuth(request, env);
      const resp = await getProfile(request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }
    if (path === "auth/profile" && request.method === "PUT") {
      const auth = await verifyAuth(request, env);
      const resp = await updateProfile(request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }
    if (path.startsWith("vps")) {
      const auth = await verifyAuth(request, env);
      const resp = await handleVpsRequest(path, request, env, auth);
      Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }
    return new Response(JSON.stringify({ error: "Not Found", path }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-FpACx6/functionsRoutes-0.76860757288041.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse2(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse2, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode2 = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode2(value, key);
        });
      } else {
        params[key.name] = decode2(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse2(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode2 = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode2(token));
    } else {
      var prefix = escapeString(encode2(token.prefix));
      var suffix = escapeString(encode2(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-TZnrd5/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-TZnrd5/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.2484551363971963.mjs.map
