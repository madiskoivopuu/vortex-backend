const requests = require("request-promise");
const req = require("request");
//const userAgent = require("user-agents");
//var userAgentStringGenerator = require('user-agent-string-generator');
const qs = require('querystring');
const fs = require("fs");
const BDAFaker = require("../faker/bda");
const UserAgent = require("../faker/user-agent");
const AES = require("../encryption/aes");
const Endpoints = require("./endpoints");
var Cookie = require('request-cookies').Cookie;

var scopetypes = {
	"login": "9F35E182-C93C-EBCC-A31D-CF8ED317B996",
	"signup": "A2A14B1D-1AF3-C791-9BBC-EE33CC7A0A6F",
	"action": "63E4117F-E727-42B4-6DAA-C8448E9B137F"
}

class FunCaptcha {
	constructor(scope) {
		this.scope = scopetypes[scope];
		this.full_token = "";
		this.session_token = "";
		this.game_token = ""; // a.k.a challengeID
		this.region = ""; // r=eu-west-1
		this.analytics_tier = 40;
		this.user_agent = new UserAgent({os: "Win32"});
		//console.log(this.user_agent.data.userAgent);
		this.user_agent_string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"//this.user_agent.data.userAgent;
		this.fakeBda = new BDAFaker();
		this.fakeBda.GenerateBDA(this.user_agent);
		this.sarg = {};

		// Requests
		this.requests = null;
		this.xsrftoken = "";
		this.referer = "";
		this.locale = "";

		// Game Info
		this.gfct = {};
		this.ekey = {};
		this.ca = [];
		this.images = [];
		this.angle = 51.4; // angle that the images will rotate with
		this.rotations = 7; // rotations needed for full 360 degrees
		this.angles = []; // angles will be pushed to array and then array items will be added together, like [51.4, 154.2, -51.4] => "51.4,154.2,-51.4"
		this.currentWave = 1;

		Date.prototype.getTimestamp = function() {
			var t1 = new Date().getTime().toString().substring(0, 7);
			var t2 = new Date().getTime().toString().substring(7, 13);
			var res = t1 + "00" + t2;
			return res;
		}
	}

	intBetween(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	resetState() {
		this.full_token = "";
		this.session_token = "";
		this.game_token = ""; // a.k.a challengeID
		this.region = ""; // r=eu-west-1
		this.referer = "";
		this.sarg = {};
		this.locale = "";

		this.gfct = {};
		this.ekey = {};
		this.ca = [];
		this.images = [];
		this.angle = 51.4;
		this.rotations = 7;
		this.angles = [];
		this.currentWave = 1;
	}

	SetLocaleFromBDA() {
		var locales = [];
		if(this.fakeBda.language.includes("-")) {
			locales.push(this.fakeBda.language);
			locales.push(this.fakeBda.language.split("-")[0]);
		} else {
			locales.push(this.fakeBda.language);
		}
		this.locale = locales.join(",");
	}

	async InitCaptcha(proxy) {
		this.resetState();
		this.SetLocaleFromBDA();
		this.requests = requests.defaults({proxy: proxy, jar: true});

		var requestBody = {
			bda: this.fakeBda.bda,
			public_key: this.scope,
			site: "https://www.roblox.com",
			userbrowser: this.user_agent_string,
			simulate_rate_limit: 0,
			simulated: 0,
			language: "en",
			rnd: Math.random()*1
		}
		var headers = {
			"User-Agent": this.user_agent_string,
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			"Origin": "https://www.roblox.com",
			"Sec-Fetch-Site": "cross-site",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Dest": "empty",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": `${this.locale};q=0.9`,
			"Accept": "*/*",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"Referer": "https://www.roblox.com",
			"Connection": "keep-alive",
			"Cookie": ""
		};

		try {
			var response = await this.requests.post({
				url: Endpoints.InitCaptcha(this.scope),
				headers: headers,
				form: requestBody,
				timeout: 25000,
				json: true
			});
		} catch (error) {
			return {
				status: "fail",
				message: "Failed to initiate Funcaptcha session.",
			};
		}

		// parse token
		var splitData = response.token.split("|");
		var gcParams = {};
		splitData.forEach((thing, pos) => {
			if(!pos) {
				gcParams["token"] = thing;
			} else {
				var n = thing.split("=");
				gcParams[n[0]] = n[1];
			}
		})

		// token keyvalues to query params
		this.referer =  "https://roblox-api.arkoselabs.com/fc/gc/?" + qs.stringify(gcParams, null, null, { encodeURIComponent: uri => uri });

		// set some game data
		this.full_token = response.token;
		this.session_token = splitData[0];
		this.region = splitData[1].substring(2, splitData[1].length);
		this.analytics_tier = parseInt(gcParams["at"]);

		return {
			status: "success",
			message: "Initiated captcha session."
		};
	}

	async GetGameData() {

		var requestBody = {
			analytics_tier: this.analytics_tier,
			token: this.session_token,
			render_type: "canvas",
			sid: this.region,
			"data[status]": "init",
			lang: "en",
		}
		var requested_id = AES.Encrypt("", `REQUESTED${this.session_token}ID`).toString();
		var headers = {
			"User-Agent": this.user_agent_string,
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			"Origin": "https://roblox-api.arkoselabs.com",
			"Referer": this.referer,
			"Sec-Fetch-Site": "cross-site",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Dest": "empty",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": `${this.locale};q=0.9`,
			"Accept": "*/*",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"X-Requested-ID": requested_id,
			"X-NewRelic-Timestamp": new Date().getTimestamp(),
			"X-Requested-With": "XMLHttpRequest",
			"Connection": "keep-alive",
			"Cookie": ""
		};
		var headers_a = Object.assign({}, headers);

		// bs logging
		var a = `action=${encodeURIComponent("https://www.roblox.com/develop/groups/5316433?View=2")}&sid=${this.region}&render_type=canvas&category=Site+URL&session_token=${this.session_token}&analytics_tier=${this.analytics_tier}`;
		try {
			await this.requests.post({
				url: Endpoints.Logging,
				headers: headers_a,
				body  : a,
				//proxy: false,
				timeout: 25000
			}).catch(e => {});
		} catch (error) {
			
		}

		try {
			var response = await this.requests.post({
				url: Endpoints.FuncaptchaTokenInfo,
				headers: headers,
				form: requestBody,
				//proxy: false,
				timeout: 25000,
				json: true
			});
		} catch (error) {
			return {
				status: "fail",
				message: "Failed to get game data.",
			};
		}

		this.gfct = response;
		this.game_token = this.gfct.challengeID;

		// calculate angle from guifontclr (#f8fXXX)
		var calc_angle = parseInt(this.gfct.game_data.customGUI._guiFontColr.substr(4, 7), 16);
		this.angle = calc_angle / 10;
		this.rotations = parseInt(360/this.angle);

		// get all images for game
		this.gfct.game_data.customGUI._challenge_imgs.forEach(imgurl => {
			var promise = new Promise((resolve, reject) => {this.requests.get({
					url: imgurl,
					timeout: 25000,
					headers: headers,
					proxy: false, // EJHFDSYF
					json: true
				}).then(response => {
					resolve(response);
				});
			});
			this.images.push(promise);
		});

		// bs logging 2
		var misc = {
			sid: this.region,
			cache_key: this.session_token,
			analytics_tier: this.analytics_tier
		}
		try {
			await this.requests.post({
				url: Endpoints.Refresh,
				headers: headers_a,
				form : misc,
				//proxy: false,
				timeout: 25000,
				json: true
			}).catch(e => {});
		} catch (error) {
			
		}
		var a = `action=game+loaded&sid=${this.region}&render_type=canvas&category=loaded&game_type=${this.gfct.game_data.gameType}&game_token=${this.game_token}&session_token=${this.session_token}&analytics_tier=${this.analytics_tier}`;
		/*{
			game_token: this.game_token,
			analytics_tier: 40,
			game_type: this.gfct.game_data.gameType,
			session_token: this.session_token,
			render_type: "canvas",
			action: "game+loaded",
			sid: this.region,
			category: "loaded"
		}*/
		try {
			await this.requests.post({
				url: Endpoints.Logging,
				headers: headers_a,
				form : a,
				//proxy: false,
				timeout: 25000,
				json: true
			})
		} catch (error) {
			
		}


		return {
			status: "success",
			message: "",
			images: this.gfct.game_data.waves
		};
	}

	async GetDecryptionKey() {
		var requestBody = {
			sid: this.region,
			game_token: this.game_token,
			session_token: this.session_token
		}
		this.sarg["sc"] = [
			this.intBetween(150, 180),
			this.intBetween(190, 210)
		]

		var requested_id = AES.Encrypt(JSON.stringify(this.sarg), `REQUESTED${this.session_token}ID`).toString();
		var headers = {
			"User-Agent": this.user_agent_string,
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			"Origin": "https://roblox-api.arkoselabs.com",
			"Referer": this.referer,
			"Sec-Fetch-Site": "cross-site",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Dest": "empty",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": `${this.locale};q=0.9`,
			"Accept": "*/*",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"X-Requested-ID": requested_id,
			"X-NewRelic-Timestamp": new Date().getTimestamp(),
			"X-Requested-With": "XMLHttpRequest",
			"Connection": "keep-alive",
			"Cookie": ""
		}
		var headers_a = Object.assign({}, headers);

		try {
			var response = await this.requests.post({
				url: Endpoints.DecryptionKey,
				headers: headers,
				//proxy: false,
				form: requestBody,
				timeout: 25000,
				json: true
			});
		} catch(error) {
			return {
				status: "fail",
				message: "Failed to get decryption key."
			};
		}

		// bs logging
		var a = `action=user+clicked+verify&sid=${this.region}&render_type=canvas&category=begin+app&game_type=${this.gfct.game_data.gameType}&game_token=${this.game_token}&session_token=${this.session_token}&analytics_tier=${this.analytics_tier}`
		/*{
			game_token: this.game_token,
			analytics_tier: 40,
			game_type: this.gfct.game_data.gameType,
			session_token: this.session_token,
			render_type: "canvas",
			action: "user+clicked+verify",
			sid: this.region,
			category: "begin+app"
		}*/
		try {
			await this.requests.post({
				url: Endpoints.Logging,
				headers: headers_a,
				form : a,
				timeout: 25000,
				//proxy: false,
				json: true
			})
		} catch (error) {
			
		}

		this.ekey = response;
		return {
			status: "success",
			message: ""
		}
	}

	async DecryptImage() {
		if(this.currentWave-1 >= this.images.length) {
			return {
				status: "fail",
				message: "Image index out of range."
			};
		}

		var headers = {
			"User-Agent": this.user_agent_string,
			"Referer": "https://roblox-api.arkoselabs.com/fc/apps/canvas/001/?meta=6",
			"Sec-Fetch-Site": "cross-site",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Dest": "empty",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": `${this.locale};q=0.9`,
			"Accept": "*/*",
			"Connection": "keep-alive",
			"Cookie": ""
		}

		//console.log(this.gfct.game_data.customGUI._challenge_imgs[this.currentWave-1]);
		//await new Promise(resolve => setTimeout(resolve, 5000));
		try {
			var response = await this.requests.get({
				url: this.gfct.game_data.customGUI._challenge_imgs[this.currentWave-1],
				timeout: 25000,
				headers: headers,
				proxy: false, // EJHFDSYF
				json: true
			});
		} catch(error) {
			return {
				status: "fail",
				message: "Failed to fetch image."
			};
		}

		if(response.error) {
			return {
				status: "fail",
				message: "Failed to fetch image (access was denied)."
			};
		}

		var decrypt_key = this.currentWave > 1 ? this.ca[this.currentWave-2].decryption_key : this.ekey.decryption_key;
		if(!decrypt_key) {
			return {
				status: "fail",
				message: "Failed to load image."
			};
		}

		try {
			var {key, iv} = AES.DeriveKeyAndIv(decrypt_key, response.s);
			var image = AES.Decrypt(response.ct, key, iv);
		} catch (error) {
			return {
				status: "fail",
				message: "Failed to decrypt image."
			};
		}

		return {
			status: "success",
			message: `Fetched wave ${this.currentWave} image.`,
			image: image
		};
	}

	async SubmitCaptchaAnswer(angle) {
		angle = parseFloat(angle).toFixed(2);
		this.angles.push(angle);

		var angle_string = this.angles.join(",");
		var angles = AES.Encrypt(angle_string, `${this.session_token}`).toString();

		// add necessary properties to sarg
		if(!this.sarg.hasOwnProperty("dc")) {
			this.sarg["dc"] = [
				this.intBetween(120, 180),
				this.intBetween(190, 230),
			];
		}
		if(this.currentWave === this.gfct.game_data.waves) {
			this.sarg["ech"] = angle;
		}

		var requested_id = AES.Encrypt(JSON.stringify(this.sarg), `REQUESTED${this.session_token}ID`).toString();

		var requestBody = {
			game_token: this.game_token,
			session_token: this.session_token,
			sid: this.region,
			guess: angles,
			analytics_tier: this.analytics_tier
		}
		var headers = {
			"User-Agent": this.user_agent_string,
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			"Origin": "https://roblox-api.arkoselabs.com",
			"Referer": this.referer,
			"Sec-Fetch-Site": "cross-site",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Dest": "empty",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": `${this.locale};q=0.9`,
			"Accept": "*/*",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"X-Requested-ID": requested_id,
			"X-NewRelic-Timestamp": new Date().getTimestamp(),
			"X-Requested-With": "XMLHttpRequest",
			"Connection": "keep-alive",
			"Cookie": ""
		}

		try {
			var response = await this.requests.post({
				url: Endpoints.CaptchaAnswer,
				headers: headers,
				form: requestBody,
				timeout: 25000,
				//proxy: false,
				json: true
			});
		} catch(error) {
			return {
				status: "fail",
				message: "Failed to submit captcha answer (#1)."
			};
		}

		var ca = response;
		if(ca.error) {
			return {
				status: "fail",
				message: `Failed to submit captcha answer (#2). ${ca.error}`
			};
		}
		if(ca.response === "timed_mode_timeout") {
			return {
				status: "fail",
				message: "Timed mode timeout."
			};
		}
		if(ca.response === "reload") {
			return {
				status: "fail",
				message: "Received response \"reload\" (The connection to a verification server was interrupted)."
			}
		}

		this.currentWave += 1;

		if(ca.response === "answered") {
			return {
				status: "success",
				message: "",
				solved: ca.solved
			};
		} else {
			this.ca.push(response);
			return {
				status: "continue",
				message: ""
			};
		}
	}

	async CreateAccount() {
		var token = this.full_token;
		var randUsername = Array(10).fill("0123456789abcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
		var randPass = Array(10).fill("0123456789abcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');

		var req2 = req.defaults();
		req2.post({
			url: "https://auth.roblox.com/v2/signup",
			json: {
				username: randUsername,
				password: randPass,
				birthday: "09 Jun 2009",
				gender: 2,
				isTosAgreementBoxChecked: true,
				context: "MultiverseSignupForm",
				captchaToken: token,
				captchaProvider: "PROVIDER_ARKOSE_LABS"
			},
			headers: {
				"X-CSRF-TOKEN": this.xsrftoken,
				//"User-Agent": this.user_agent_string
			}
		}).on("response", (response) => {
			if(response.statusCode === 403)
			{
				this.xsrftoken = response.headers["x-csrf-token"];
				req2.post({
					url: "https://auth.roblox.com/v2/signup",
					json: {
						username: randUsername,
						password: randPass,
						birthday: "09 Jun 2001",
						gender: 2,
						isTosAgreementBoxChecked: true,
						context: "MultiverseSignupForm",
						captchaToken: token,
						captchaProvider: "PROVIDER_ARKOSE_LABS"
					},
					headers: {
						"X-CSRF-TOKEN": this.xsrftoken,
						//"User-Agent": this.user_agent_string
					}
				}).on("response", (response) => {
					if(response.statusCode === 200) {
						for(var i in response.headers['set-cookie']) {
							try {
								var cookie = new Cookie(response.headers['set-cookie'][i]);
							} catch (error) {
								continue;
							}
							if(cookie.key === ".ROBLOSECURITY") {
								fs.appendFile("./cookies.txt", `${randUsername}:${randPass}:${cookie.value}\n`, function(err){});
								console.log(`Created account ${randUsername}:${randPass}`);
							}
						}
					}
				})
			} else {
				for(var i in response.headers['set-cookie']) {
					var cookie = new Cookie(response.headers['set-cookie'][i]);
					if(cookie.key === ".ROBLOSECURITY") {
						fs.appendFile("./cookies.txt", `${randUsername}:${randPass}:${cookie.value}\n`, function(err){});
						console.log(`Created account ${randUsername}:${randPass}`);
					}
				}
			}
		})
	}
}

module.exports = {FunCaptcha, scopetypes};