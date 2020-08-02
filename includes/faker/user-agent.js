Array.prototype.random = function() {
	return this[Math.floor(Math.random()*this.length)];
};

class UserAgent {
	constructor(prefs) {
		var oss = ["Win32", "MacIntel"];//, "Linux"];
		var browsers = ["Chrome", "Firefox"];
		var screenSizes = [
			{ actual: [ 2560, 1440 ], viewport: [ 1900, 1290 ]},
			{ actual: [ 1280, 800 ], viewport: [ 1660, 630 ]},
			{ actual: [ 1920, 1200 ], viewport: [ 1900, 920 ]},
			{ actual: [ 1280, 800 ], viewport: [ 1280, 700 ]},
			{ actual: [ 1680, 1050 ], viewport: [ 700, 820 ]},
			{ actual: [ 1920, 1080 ], viewport: [ 1920, 890 ] },
  			{ actual: [ 1680, 1050 ], viewport: [ 1680, 940 ] },
  			{ actual: [ 1680, 1050 ], viewport: [ 1680, 920 ] },
  			{ actual: [ 1680, 1050 ], viewport: [ 1670, 870 ] },
  			{ actual: [ 1440, 900 ], viewport: [ 1430, 700 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1920, 980 ] },
			{ actual: [ 3440, 1440 ], viewport: [ 1340, 1240 ] },
			{ actual: [ 1280, 800 ], viewport: [ 1280, 590 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1440, 830 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1680, 970 ] },
			{ actual: [ 1920, 1200 ], viewport: [ 1920, 1100 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1430, 650 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1320, 920 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1620, 810 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1840, 940 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1630, 920 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1440, 690 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1910, 950 ] },
			{ actual: [ 2048, 1080 ], viewport: [ 2030, 970 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1440, 720 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1020, 670 ] },
			{ actual: [ 2048, 1080 ], viewport: [ 2050, 880 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1680, 950 ] },
			{ actual: [ 1680, 1050 ], viewport: [ 1680, 950 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1440, 820 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1540, 830 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1420, 800 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1920, 960 ] },
			{ actual: [ 1920, 1080 ], viewport: [ 1920, 900 ] },
			{ actual: [ 1440, 900 ], viewport: [ 1440, 730 ] }
		];
		var platforms = {
			Win32: [
				"Windows NT 10.0; Win64; x64",
				"Windows NT 6.3; Win64; x64",
				//"Windows NT 6.2; Win32; x32",
				//"Windows NT 6.1; Win32; x32"
			],
			MacIntel: [
				"Macintosh; Intel Mac OS X 10_12_6",
				"Macintosh; Intel Mac OS X 10_13_0",
				"Macintosh; Intel Mac OS X 10_13_1",
				"Macintosh; Intel Mac OS X 10_13_2",
				"Macintosh; Intel Mac OS X 10_13_3",
				"Macintosh; Intel Mac OS X 10_13_4",
				"Macintosh; Intel Mac OS X 10_13_5",
				//"Macintosh; Intel Mac OS X 10_13_6",
				"Macintosh; Intel Mac OS X 10_14_0",
				//"Macintosh; Intel Mac OS X 10_14_1",
				"Macintosh; Intel Mac OS X 10_14_2",
				"Macintosh; Intel Mac OS X 10_14_3",
				//"Macintosh; Intel Mac OS X 10_14_4",
				//"Macintosh; Intel Mac OS X 10_14_5",
				"Macintosh; Intel Mac OS X 10_14_6",
				//"Macintosh; Intel Mac OS X 10_15_0",
				"Macintosh; Intel Mac OS X 10_15_1",
				//"Macintosh; Intel Mac OS X 10_15_2",
				"Macintosh; Intel Mac OS X 10_15_3",
			],
			Linux: [
				"X11; Linux x86_64",
				"X11; Fedora; Linux x86",
				"X11; Linux i686"
			]
		}
		var browserVersions = {
			Chrome: [
				"80.0.3987.132",
				"80.0.3987.106"
			],
			Firefox: [
				"68.0",
				"69.0"
			]
		}
		

		// generate user agent
		this.data = {
			os: oss.random(),
			browser: browsers.random(),
			screenSize: screenSizes.random(),
			...prefs
		}

		var platform = platforms[this.data.os].random();
		this.data.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36";
		/*if(this.data.browser === "Firefox") {
			var browserVersion = browserVersions[this.data.browser].random();
			this.data.userAgent = `Mozilla/5.0 (${platform}; rv:${browserVersion}) Gecko/20100101 Firefox/${browserVersion}`;
		} else {
			var browserVersion = browserVersions[this.data.browser].random();
			this.data.userAgent = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
		}*/
	}
}

module.exports = UserAgent;