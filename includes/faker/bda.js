//const {createCanvas} = require("canvas");
const fpjs = require("fingerprintjs2");
const fs = require("fs");
const AES = require("../encryption/aes");

class BDAFaker {
	constructor() {
		this.canvasText = "canvas winding:yes~canvas fp:data:image/png;base64,";
		this.fonts = [ 'Arial', 'Book Antiqua', 'Bookman Old Style', 'Calibri', 'Cambria', 'Cambria Math', 'Century', 'Century Gothic', 'Century Schoolbook', 'Comic Sans MS', 'Consolas', 'Courier', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Impact', 'Lucida Bright', 'Lucida Calligraphy', 'Lucida Console', 'Lucida Fax', 'Lucida Handwriting', 'Lucida Sans', 'Lucida Sans Typewriter', 'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Monotype Corsiva', 'MS Gothic', 'MS PGothic', 'MS Reference Sans Serif', 'MS Sans Serif', 'MS Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold', 'Segoe UI Symbol', 'Tahoma', 'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Wingdings', 'Wingdings 2', 'Wingdings 3' ];
		this.pickFonts = [ 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'MS Outlook', 'Palatino' ];
		this.languages = ["en-US", "en-EG", "en-AU", "en-GB", "en-CA", "en-NZ", "en-IE", "en-ZA", "en-JM", "en-BZ", "en-TT"];
		this.timezoneOffsets = [-60, -120, -180, -240];
		this.CPUcores = [4, 8, 12, 16];

		this.baseBda = [
			{"key":"api_type","value":"js"},
			{"key":"p","value":1},
			{"key":"f","value":"6942d9d60da968ef37efcb852a2e866c"}, // hash of all values in fe (x64hash128)
			{"key":"n","value":"MTU3NzgxNzg4Mw=="}, // base64 encoded seconds from epoch  Math.round(Date.now() / 1000).toString()
			{"key":"wh","value":"db2a0607aaca6e9d3062fe50f890d457|2250275f153ba3400a3b0e99319ef4e7"}, // window hash, hashes all objects
			{"key": "fe", "value": [
				"DNT:unknown", // seems to have something to do with window.doNotTrack
				"L:en-US", // language
				"D:24", // screen.colorDepth, leave as is
				"PR:1", // pixel ratio, leave as is
				"S:1920,1080", // screen res
				"AS:1920,1040", // actual resolution
				"TO:-120", // time offset Date().getTimezoneOffset()
				"SS:true", // session storage
				"LS:true", // local storage
				"IDB:true", // window.indexedDB
				"B:false", // document.body.addBehavior
				"ODB:true", // window.openDatabase ? true : false;
				"CPUC:unknown", // cpuclass
				"PK:Win32", // platform key
				"CFP:-1424337341", // canvasFP? (can also be -1424337346 , 121058022) (fake 1299140265)
				"FR:false", // fake resolution
				"FOS:false", // fake OS
				"FB:false", // facebook?
				"JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Courier New,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3",
				"P:Chrome PDF Plugin,Chrome PDF Viewer,Native Client", // plugins
				"T:0,false,false", // navigator.msMaxTouchPoints??  this.getTouch()
				"H:8", // physical cpu threads that a pc has navigator.hardwareConcurrency
				"SWF:false" // typeof window.swfobject !== "undefined"
			]},
			{"key": "ife_hash", "value": "cfc89513f051e8380077b61f0994aae7"},
			{"key":"cs","value":1},
			{"key":"jsbd","value":"{\"HL\":14,\"NCE\":true,\"DA\":null,\"DR\":null,\"DMT\":24,\"DO\":null,\"DOT\":25}"}
			// HL: window.history.length,
			// NCE: navigator.cookieEnabled,
			// DA: 
			// DR:
			// DMT: Date.now() - some date a few ms ago
		]
		//this.baseBda = [{"key":"api_type","value":"js"},{"key":"p","value":1},{"key":"f","value":"6942a8d60da968ef37efcb852a2e866c"},{"key":"n","value":"MTU4MjExNjUwNg=="},{"key":"wh","value":"40b55318f15b202f97057b902443e3da|2250275f153ba3400a3b0e99319ef4e7"},{"value":["DNT:unknown","L:en-US","D:24","PR:1","S:1920,1080","AS:1920,1040","TO:-120","SS:true","LS:true","IDB:true","B:false","ODB:true","CPUC:unknown","PK:Win32","CFP:1123400716","FR:false","FOS:false","FB:false","JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3","P:Chrome PDF Plugin,Chrome PDF Viewer,Native Client","T:0,false,false","H:8","SWF:false"],"key":"fe"},{"key":"cs","value":1},{"key":"jsbd","value":"{\"HL\":7,\"NCE\":true,\"DA\":null,\"DR\":null,\"DMT\":38,\"DO\":null,\"DOT\":38}"}];
		//this.baseBda = [{"key":"api_type","value":"js"},{"key":"p","value":1},{"key":"f","value":"e1a59558a2c14142b59b4d5e395c008e"},{"key":"n","value":"MTU5NDczMTA5NA=="},{"key":"wh","value":"aafa68151430eee2afd246969a04c4e3|5d76839801bc5904a4f12f1731a7b6d1"},{"key":"fe","value":["DNT:unknown","L:en-US","D:24","PR:1","S:1920,1080","AS:1920,1040","TO:-180","SS:true","LS:true","IDB:true","B:false","ODB:true","CPUC:unknown","PK:Win32","CFP:-1424337346","FR:false","FOS:false","FB:false","JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Courier New,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3","P:Chrome PDF Plugin,Chrome PDF Viewer,Native Client","T:0,false,false","H:8","SWF:false"]},{"key":"ife_hash","value":"cfc89513f051e8380077b61f0994aae7"},{"value":1,"key":"cs"},{"key":"jsbd","value":"{\"HL\":15,\"NCE\":true,\"DT\":\"Develop - Roblox\",\"NWD\":\"undefined\",\"DA\":null,\"DR\":null,\"DMT\":33,\"DO\":null,\"DOT\":42}"}];
		//this.baseBda = [{"key":"api_type","value":"js"},{"key":"p","value":1},{"key":"f","value":"e1a59558a2c14142b59b4d5e395c008e"},{"key":"n","value":"MTU5NTQwNzc2Ng=="},{"key":"wh","value":"a39481bca152a955d2570b6243ac2053|5d76839801bc5904a4f12f1731a7b6d1"},{"key":"fe","value":["DNT:unknown","L:en-US","D:24","PR:1","S:1920,1080","AS:1920,1040","TO:-180","SS:true","LS:true","IDB:true","B:false","ODB:true","CPUC:unknown","PK:Win32","CFP:-1424337346","FR:false","FOS:false","FB:false","JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Courier New,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3","P:Chrome PDF Plugin,Chrome PDF Viewer,Native Client","T:0,false,false","H:8","SWF:false"]},{"key":"ife_hash","value":"cfc89513f051e8380077b61f0994aae7"},{"value":1,"key":"cs"},{"key":"jsbd","value":"{\"HL\":14,\"NCE\":true,\"DT\":\"Develop - Roblox\",\"NWD\":\"undefined\",\"DA\":null,\"DR\":null,\"DMT\":35,\"DO\":null,\"DOT\":48}"}];
		this.baseBda = [{"key":"api_type","value":"js"},{"key":"p","value":1},{"key":"f","value":"e1a59558a2c14142b59b4d5e395c008e"},{"key":"n","value":"MTU5NTQyNTc0Mg=="},{"key":"wh","value":"f92b240ab549cbb21e41b66e42d28874|5d76839801bc5904a4f12f1731a7b6d1"},{"key":"fe","value":["DNT:unknown","L:en-US","D:24","PR:1","S:1920,1080","AS:1920,1040","TO:-180","SS:true","LS:true","IDB:true","B:false","ODB:true","CPUC:unknown","PK:Win32","CFP:-1424337346","FR:false","FOS:false","FB:false","JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Courier New,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3","P:Chrome PDF Plugin,Chrome PDF Viewer,Native Client","T:0,false,false","H:8","SWF:false"]},{"key":"ife_hash","value":"cfc89513f051e8380077b61f0994aae7"},{"value":1,"key":"cs"},{"key":"jsbd","value":"{\"HL\":15,\"NCE\":true,\"DT\":\"Develop - Roblox\",\"NWD\":\"undefined\",\"DA\":null,\"DR\":null,\"DMT\":34,\"DO\":null,\"DOT\":46}"}];
		this.bda = "";
		this.language = "en-US";
	}

	CanvasFP() {
		/*var result = [];
		var canvas = createCanvas(2000, 200);
		var ctx = canvas.getContext('2d'),
		x, y,
		number,
		opacity = 0.7;

		for ( x = 0; x < canvas.width; x++ ) {
			for ( y = 0; y < canvas.height; y++ ) {
			   number = Math.floor( Math.random() * 60 );
	  
			   ctx.fillStyle = "rgba(" + number + "," + number + "," + number + "," + opacity + ")";
			   ctx.fillRect(x, y, 1, 1);
			}
		 }*/
		var result = [];
		result.push('canvas fp:' + Array(this.intBetween(700, 900)).fill("0123456789abcdef").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join(''))
		//var buf = new Buffer.from(canvas.toDataURL().replace("data:image/png;base64,", ""), "base64");
		//fs.writeFileSync("./testimg.png", buf);
		return result
	}

	intBetween(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	GenerateBDA(user_agent) {
		// {"key":"n","value":"MTU3NzgxNzg4Mw=="}
		var n = Math.round(Date.now() / 1000)
		this.baseBda[3]["value"] = Buffer.from(n.toString()).toString("base64");
		// {"key":"wh","value":"a84d8c8322d3ca1aa57486543ff3cd3e|2250275f153ba3400a3b0e99319ef4e7"}
		var wh1 = Array(32).fill("0123456789abcdef").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
		var wh2 = "5d76839801bc5904a4f12f1731a7b6d1";
		this.baseBda[4]["value"] = `${wh1}|${wh2}`;

		// {"key":"fe","value": [...]}
		// fake language (L:)
		this.language = this.languages[Math.floor(Math.random()*this.languages.length)];
		this.baseBda[5]["value"][1] = `L:${this.language}`;

		// screen res (S:)
		//this.baseBda[5]["value"][4] = `S:${user_agent.data.screenSize.actual[0]},${user_agent.data.screenSize.actual[1]}`;

		// actual res (AS:)
		//this.baseBda[5]["value"][5] = `AS:${user_agent.data.screenSize.viewport[0]},${user_agent.data.screenSize.viewport[1]}`;

		// timezone offset (TO:)
		var offset = this.timezoneOffsets[Math.floor(Math.random()*this.timezoneOffsets.length)];
		this.baseBda[5]["value"][6] = `TO:${offset}`;

		// platform key (PK:)
		this.baseBda[5]["value"][13] = `PK:${user_agent.data.os}`;

		// canvasFP (CFP:)
		var cfp = this.CanvasFP();
		cfp = `canvas winding:yes~${cfp[0]}`;

		// fonts (JSF:)
		this.baseBda[5]["value"][18] = `JSF:Arial,Arial Black,Arial Narrow,Book Antiqua,Bookman Old Style,Calibri,Cambria,Cambria Math,Century,Century Gothic,Century Schoolbook,Comic Sans MS,Consolas,Courier,Courier New,Garamond,Georgia,Helvetica,Impact,Lucida Bright,Lucida Calligraphy,Lucida Console,Lucida Fax,Lucida Handwriting,Lucida Sans,Lucida Sans Typewriter,Lucida Sans Unicode,Microsoft Sans Serif,Monotype Corsiva,MS Gothic,MS PGothic,MS Reference Sans Serif,MS Sans Serif,MS Serif,Palatino Linotype,Segoe Print,Segoe Script,Segoe UI,Segoe UI Light,Segoe UI Semibold,Segoe UI Symbol,Tahoma,Times,Times New Roman,Trebuchet MS,Verdana,Wingdings,Wingdings 2,Wingdings 3`;

		// 21 cpu threads (H:)
		this.baseBda[5]["value"][21] = "H:8";//`H:${this.CPUcores[Math.floor(Math.random()*this.CPUcores.length)]}`;

		///  Outside fe  ///
		// {"key":"f","value":"6942d9d60da968ef37efcb852a2e866c"};
		var valArray = [];
		this.baseBda[5]["value"].forEach(item => {
			var value = item.split(":")[1];
			valArray.push(value);
		})
		var f = fpjs.x64hash128(valArray.join("~~~"), 31);
		this.baseBda[2]["value"] = f;

		// canvasFP again
		cfp = cfp.split("").reduce(function(R9f, G9f) {
           R9f = (R9f << 5) - R9f + G9f.charCodeAt(0);
            return R9f & R9f;
		}, 0);
		this.baseBda[5]["value"][14] = `CFP:${cfp}`; //`CFP:${this.intBetween(-1424330000, -1424379999)}`

		// {"key": "ife_hash", "value": "cfc89513f051e8380077b61f0994aae7"}
		var ife_hash = fpjs.x64hash128(this.baseBda[5]["value"].join(", "), 38);
		this.baseBda[6]["value"] = ife_hash;

		// {"key":"jsbd","value":"{\"HL\":14,\"NCE\":true,\"DA\":null,\"DR\":null,\"DMT\":24,\"DO\":null,\"DOT\":25}"}
		var jsbd = {};
		jsbd["HL"] = this.intBetween(3, 19);
		jsbd["NCE"] = true;
		jsbd["DT"] = "Develop - Roblox";
		jsbd["NWD"] = "undefined";
		jsbd["DA"] = null;
		jsbd["DR"] = null;
		jsbd["DMT"] = this.intBetween(30, 40);
		jsbd["DO"] = null;
		jsbd["DOT"] = this.intBetween(25, 50);
		this.baseBda[8]["value"] = JSON.stringify(jsbd);


		// AES encrypt bda */
		//console.log(this.baseBda);

		var curdate = new Date().getTime() / 1000;
		var divider = 21600;
		var dayDate = Math.round(curdate - curdate % divider);
		var aesBda = AES.Encrypt(JSON.stringify(this.baseBda), user_agent.data.userAgent + dayDate)
		this.bda = Buffer.from(aesBda.toString()).toString("base64");

		return this.bda;
	}

}

module.exports = BDAFaker;