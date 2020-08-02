var _crypto = require("crypto");
var fs = require("fs");
var node_cryptojs = require('node-cryptojs-aes');
var JsonFormatter = node_cryptojs.JsonFormatter;
var CryptoJS = require("crypto-js");

class AES {
	constructor() {}
	DeriveKeyAndIv(passphrase, salt) {
		salt = new Buffer.from(salt, "hex")
		var concatenatedHashes = new Buffer.from("", "hex");
		var password = new Buffer.from(passphrase, "utf8")
		var currentHash  = new Buffer.from("", "hex");
		var enoughBytesForKey = false;
		while (!enoughBytesForKey)
				{
					var preHashLength = currentHash.length + password.length + salt.length;
					// needed so the buffer initializes properly and can be copied into
					var nullbytearray = [];
					for(var i = 0; i < preHashLength; i++) {
						nullbytearray.push(0x00);
					}
					var preHash = new Buffer.from(nullbytearray, "hex");
					// remove the 1st null byte
					//preHash = preHash.slice(1, preHash.length+2);
					currentHash.copy(preHash, 0, 0, currentHash.length);
					password.copy(preHash, currentHash.length, 0, password.length);
					salt.copy(preHash, currentHash.length + password.length, 0, salt.length);
					// check if preHash has 1st null byte, if it does then remove it
					if(preHash.indexOf(0x00) === 0) preHash = preHash.slice(1, preHash.length);
	
					currentHash = _crypto.createHash("md5").update(preHash).digest("byte");
					concatenatedHashes = Buffer.concat([concatenatedHashes, currentHash])
					if (concatenatedHashes.length >= 48)
						enoughBytesForKey = true;
				}
	
		var key = new Buffer.from(concatenatedHashes.slice(0, 32));
		var iv = new Buffer.from(concatenatedHashes.slice(32, concatenatedHashes.length));
		return {
			key: key, 
			iv: iv
		};
	}
	Encrypt(text, passphrase) {
		var encrypted = CryptoJS.AES.encrypt(text, passphrase, {format: JsonFormatter});
		return encrypted;
	}
	Decrypt(ciphertext, key, iv) {
		var decrypted =  _crypto.createDecipheriv("aes-256-cbc", key, iv).update(new Buffer.from(ciphertext, "base64"));
		return decrypted;
	}
}

var aes = new AES();
module.exports = aes;