class Endpoints {
	constructor() {
		this.InitCaptcha = public_key => "https://roblox-api.arkoselabs.com/fc/gt2/public_key/" + public_key;
		this.FuncaptchaTokenInfo = "https://roblox-api.arkoselabs.com/fc/gfct/";
		this.Logging = "https://roblox-api.arkoselabs.com/fc/a/";
		this.Refresh = "https://roblox-api.arkoselabs.com/fc/misc/refresh/";
		this.DecryptionKey = "https://roblox-api.arkoselabs.com/fc/ekey/";
		this.CaptchaAnswer = "https://roblox-api.arkoselabs.com/fc/ca/";
	}
}
var ep = new Endpoints();

module.exports = ep;