var globaldefs = require("../globaldefs");

/* ---------------------------------------
		Globals
---------------------------------------*/
const PRODUCT_NAMES = {
	month: "Vortex | 1 Month Whitelist",
    renew: "Vortex | Whitelist Renewal",
    //perm: "Vortex | Permanent Whitelist",
    templatechanger: "Vortex | Template Changer",
	//unlimitedcookies: "Vortex | Unlimited Cookies"
	cookies10: "Vortex | 10 Cookie Limit",
	cookies20: "Vortex | 20 Cookie Limit",
	cookies30: "Vortex | 30 Cookie Limit",
	cookies40: "Vortex | 40 Cookie Limit",
	cookies50: "Vortex | 50 Cookie Limit",
	cookies50plus: "Vortex | 50+ Cookies [CUSTOM]",
}
const PRICES = {
	month: 20,
	renew: 20,
	templatechanger: 10,
	cookies10: 4,
	cookies20: 12.5,
	cookies30: 20,
	cookies40: 35,
	cookies50: 50,
	cookies50plus: 1.5, // price PER COOKIE
}
const RETURN_URL = {
	month: "https://vortex-b.xyz/home/clothingbot/purchase_success",
	renew: "https://vortex-b.xyz/home/clothingbot/renew_success",
	templatechanger: "https://vortex-b.xyz/home/clothingbot/addon_success",
}
const PURCHASE_FUNCTIONS = {
	"month": giveUserMonthWhitelist,
	"renew": renewUser,
	"perm": giveUserPermWhitelist,
	"templatechanger": enableTemplateChanger,
	"unlimitedcookies": enableUnlimitedCookies
  };

/* ---------------------------------------
		Whitelist apply functions
---------------------------------------*/
function giveUserMonthWhitelist(name, associatedUser, associatedDiscordId) {
	//chat.giveUserClothingBotRole(associatedUser);
	name = name.replace(/:/g, '');
	currentTime = Date.now();
	expirationTime = currentTime + 2678400000;
	var randPassword = Array(18).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
	globaldefs.clothingBotMysql.query("UPDATE users SET isBuyer = 1 WHERE username = ?", [associatedUser]);
	globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [name], function(error, results, fields){
	  if(error)
	  {
		console.log("giveUserMonthWhitelist ERROR #1");
		console.log(error);
		sendErrorWebhook(name, "enable 1 month whitelist for");
		console.log("----------giveUserMonthWhitelist ERROR #1---------");
  
		globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
		  if(error2){
			console.log("giveUserMonthWhitelist ERROR #2");
			console.log(error2);
			sendErrorWebhook(name, "enable 1 month whitelist for");
			console.log("----------giveUserMonthWhitelist ERROR #2---------");
		  }
		});
	  }
	  else {
		if(!results.length)
		{
		  globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
			if(error2){
			  console.log("giveUserMonthWhitelist ERROR #3");
			  console.log(error2);
			  sendErrorWebhook(name, "enable 1 month whitelist for");
			  console.log("----------giveUserMonthWhitelist ERROR #3---------");
			}
		  });
		}
		else {
		  var addonToName = Array(5).fill("0123456789abcdef").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
		  name = name + addonToName;
		  globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
			if(error2){
			  console.log("giveUserMonthWhitelist ERROR #4");
			  console.log(error2);
			  sendErrorWebhook(name, "enable 1 month whitelist for");
			  console.log("----------giveUserMonthWhitelist ERROR #4---------");
			}
		  });
		}
	  }
	})
  
  }
  
  function giveUserPermWhitelist(name, associatedUser, associatedDiscordId) {
	//chat.giveUserClothingBotRole(associatedUser);
	name = name.replace(/:/g, '');
	currentTime = Date.now();
	expirationTime = 999999999999999;
	var randPassword = Array(18).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
	globaldefs.clothingBotMysql.query("UPDATE users SET isBuyer = 1 WHERE username = ?", [associatedUser]);
	globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [name], function(error, results, fields){
	  if(error)
	  {
		console.log("giveUserPermWhitelist ERROR #1");
		console.log(error);
		sendErrorWebhook(name, "enable permanent whitelist for");
		console.log("----------giveUserPermWhitelist ERROR #1---------");
  
		globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
		  if(error2){
			console.log("giveUserPermWhitelist ERROR #2");
			console.log(error2);
			sendErrorWebhook(name, "enable permanent whitelist for");
			console.log("----------giveUserPermWhitelist ERROR #2---------");
		  }
		});
	  }
	  else {
		if(!results.length)
		{
		  globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
			if(error2){
			  console.log("giveUserPermWhitelist ERROR #3");
			  console.log(error2);
			  sendErrorWebhook(name, "enable permanent whitelist for");
			  console.log("----------giveUserPermWhitelist ERROR #3---------");
			}
		  });
		}
		else {
		  var addonToName = Array(5).fill("0123456789abcdef").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
		  name = name + addonToName;
		  globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, associatedUser, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`, [name, randPassword, associatedUser, associatedDiscordId, currentTime, expirationTime], function(error2, results2, fields2){
			if(error2){
			  console.log("giveUserPermWhitelist ERROR #4");
			  console.log(error2);
			  sendErrorWebhook(name, "enable permanent whitelist for");
			  console.log("----------giveUserPermWhitelist ERROR #4---------");
			}
		  });
		}
	  }
	})
  }
  
  function renewUser(name, associatedUser) {
	  //chat.giveUserClothingBotRole(associatedUser);
	  globaldefs.clothingBotMysql.query("UPDATE users SET isBuyer = 1 WHERE username = ?", [associatedUser]);
		globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE username = ?`, [name],  function(error, results, fields){
		  if(error){
			console.log("renewUser ERROR #1");
			console.log(error);
			sendErrorWebhook(name, "renewing whitelist for");
			console.log("renewUser ERROR #1");
		  }
  
		  if(Date.now() > results[0].timeOfExpiration)
		  {
			expirationTime = Date.now() + 2678400000;
			  globaldefs.clothingBotMysql.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired =0  WHERE username=?`, [expirationTime, name],  function(error2, results2, fields2){
			  if(error2){
				console.log("renewUser ERROR #2");
				console.log(error2);
				sendErrorWebhook(name, "renewing whitelist for");
				console.log("renewUser ERROR #2");
			 }
  
			});
		  }
		  else {
			expirationTime = results[0].timeOfExpiration + 2678400000;
			  globaldefs.clothingBotMysql.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired = 0 WHERE username = ?`, [expirationTime, name],  function(error2, results2, fields2){
			  if(error2){
				console.log("renewUser ERROR #3");
				console.log(error2);
				sendErrorWebhook(name, "renewing whitelist for");
				console.log("renewUser ERROR #3");
			 }
			});
		  }
	  });
  }
  
  function enableTemplateChanger(name) {
	globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE username = ?`, [name],  function(error, results, fields){
	  if(error){
		console.log("enableTemplateChanger ERROR #1");
		console.log(error);
		console.log("enableTemplateChanger ERROR #1");
	  }
  
		expirationTime = Date.now() + 2678400000;
		  globaldefs.clothingBotMysql.query(`UPDATE logininfo SET TemplateChangerEnabled = 1 WHERE username = ?`, [name],  function(error2, results2, fields2){
		  if(error2){
			console.log("enableTemplateChanger ERROR #2");
			console.log(error2);
			console.log("enableTemplateChanger ERROR #2");
			sendErrorWebhook(name, "enable template changer for");
		 }
	   });
	 });
  }
  
  function enableUnlimitedCookies(name) {
	globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE username = ?`, [name],  function(error, results, fields){
	  if(error){
		console.log("enableUnlimitedCookies ERROR #1");
		console.log(error);
		console.log("enableUnlimitedCookies ERROR #1");
	  }
  
		expirationTime = Date.now() + 2678400000;
		  globaldefs.clothingBotMysql.query(`UPDATE logininfo SET UnlimitedCookies = 1 WHERE username = ?`, [name],  function(error2, results2, fields2){
		  if(error2){
			console.log("enableUnlimitedCookies ERROR #2");
			console.log(error2);
			console.log("enableUnlimitedCookies ERROR #2");
			sendErrorWebhook(name, "enable unlimited cookies for");
		 }
	   });
	 });
  }

/* ---------------------------------------
  					Misc
---------------------------------------*/
function addReferral(order) {
	if(order.purchaseType !== "month" && order.purchaseType !== "perm") return;
	if(order.siteUsername === order.referredBy) return;

	var moneyEarntFromReferral = globaldefs.referralPercent * order.price;
	globaldefs.clothingBotMysql.query("UPDATE users SET referrals = referrals + 1, referralCredits = referralCredits + ? WHERE username = ?", [moneyEarntFromReferral, order.referredBy]);
}

// PURPOSE :: Gets the price of a product based on the whitelist
async function getProductPrice(whitelistName, purchaseType, additionalData) {
  return new Promise((resolve, reject) => {
	if(!PRICES.hasOwnProperty(purchaseType)) return reject(`No price exists for for "${requestData.purchaseType}".`);

	// Cookie plan
	if(purchaseType.includes("cookies")) {
		globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [whitelistName], function(error, results, _){
			if(error) return reject(`MySQL error while trying to get data for whitelist "${whitelistName}", try again later.`);
			if(!results.length) return reject(`Found no results in MySQL for whitelist "${whitelistName}", try again later.`);
			var whitelist = results[0];

			// check if there is less than 7 days left for the cookie plan, and if there is, use the full price
			// we will discount the price based on how many days there are left until the plan ends & which plan someone upgraded to
			var timeLeftUntilExpiration = Date.now() - whitelist.cookieLimitExpiration;
			if(purchaseType === "cookies50plus") {
				if(timeLeftUntilExpiration < 86400*1000*7) { // full price
					return resolve(PRICES[purchaseType] * additionalData)
				}
				// reduced price
				var daysLeftUntilPlanExpiraion = (timeLeftUntilExpiration - (timeLeftUntilExpiration % 86400000)) / 86400000
				return resolve((PRICES[purchaseType] * additionalData) * (daysLeftUntilPlanExpiraion/31) ); // additionalData will be the amount of cookies in this case
			} else {
				if(timeLeftUntilExpiration < 86400*1000*7) { // full price
					return resolve(PRICES[purchaseType])
				}
				// reduced price
				if(whitelist.maxCookieLimit > 50) return reject(`You have 50+ cookies for whitelist "${whitelistName}", to downgrade there is another API for that...`);

				return resolve(PRICES[purchaseType] - PRICES[`cookies${whitelist.maxCookieLimit}`])
			}
		});
	}

	return resolve(PRICES[purchaseType])
  })
}


/* ---------------------------------------
			Purchase callback
---------------------------------------*/
function purchaseCallback(orderInfo) {
	addReferral(orderInfo);

	PURCHASE_FUNCTIONS[orderInfo.purchaseType](orderInfo.whitelistUsername, orderInfo.siteUsername, orderInfo.discordId);
}

module.exports = {
	PRODUCT_NAMES,
	PRICES,
	RETURN_URL,
	purchaseCallback
}