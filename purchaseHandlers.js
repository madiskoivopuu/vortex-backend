const express = require("express")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser");
const expressValidator = require("express-validator")
const path = require("path")
const fs = require("fs")
const paypal = require("paypal-rest-sdk")
const botconfig = require("./botconfig.json");
const Discord = require("discord.js");
const mysql = require("mysql");
const base58 = require("base-58")
const requests = require("request-promise");
var rl = require("readline");

const jwt = require("jsonwebtoken");
var globaldefs = require("./globaldefs");
var ClothingBotPurchases = require("./purchaseHandlers/clothingbot");

var pendingPurchases = {};
var chat = null;

/* Definitions */
const REDUCTION_PERCENT = 0.5;
const PURCHASE_CALLBACKS = {
  ClothingBot: ClothingBotPurchases.purchaseCallback
};
const PRODUCTS = {
  ClothingBot: ClothingBotPurchases
};
const enumPriceReduction = {
  MYSQL_FETCH_FAILED: -1
}
const enumGetOrder = {
  ORDER_DOESNT_EXIST: -1,
  ERROR: 0
}
const DISCORD_WEBHOOK = "https://discordapp.com/api/webhooks/671022860005015553/H1axsPzD6f_QoBP9NLD_N_doqIf8l32c6LjeBRhHWK3sbtZHvVKimwi6sxVQt4z97CVC";


/* Purchase functions */
function verifyJwtToken(req, res, next)
{
  const header = req.headers['authorization'];
  if(!header)
  {
    res.status(403).json({status: "fail", message: "Missing header"})
  }
  else {
    const bearer = header.split(' ');
    req.token = bearer[1];
    next();
  }
}

// Purpose :: calculates how much discount a person should get
function getPriceReductionForProduct(user, price, useCredits, creditAmount) {
	var reducePriceBy = 0;
	if(user.isStaff) reducePriceBy += price * REDUCTION_PERCENT;
	if(useCredits) {
    // check if credit amount is over max
		if(user.credits < creditAmount) creditAmount = user.credits;
    reducePriceBy += creditAmount;
  }
	return reducePriceBy;
}

// Purpose :: conditionally check if whitelist exists
async function doesWhitelistExist(whitelistName, product, purchaseType) {
  return new Promise((resolve, reject) => {
	  switch(product) {
      case "ClothingBot": 
        if(["renew", "templatechanger", "cookies10", "cookies20", "cookies30", "cookies40", "cookies50", "cookies50plus"].includes(purchaseType)) {
          globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [whitelistName], function(error, results, _){
            if(error || !results.length) resolve(false);
            resolve(true);
          });
        }
        break;
	  }
	  
	   // i mean i could have made this part better
	resolve(true);
  })
}

// Purpose :: create an order and store it in the MySQL database
async function createOrder(orderId, gateway, paymentMethod, email, ip, discordId, product, purchaseType, totalPrice, siteUsername, whitelistName, referredBy) {
  return new Promise((resolve, reject) => {
    globaldefs.clothingBotMysql.query("INSERT INTO orders (orderId, gateway, paymentMethod, email, ip, discordId, product, purchaseType, price, siteUsername, whitelistUsername, referredBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
      [orderId, gateway, paymentMethod, email, ip, discordId, product, purchaseType, totalPrice, siteUsername, whitelistName, referredBy], (error2, r, f) => {
      
        resolve(error2 ? false : true);          
    })
  });
}

// Purpose :: get an order from the MySQL database
async function getOrder(orderId) {
  return new Promise((resolve, reject) => {
    globaldefs.clothingBotMysql.query("SELECT * FROM orders WHERE orderId = ?", [orderId], (err, results, _) => {
      if(err) reject(enumGetOrder.ERROR);
      if(!results.length) reject(enumGetOrder.ORDER_DOESNT_EXIST);

      resolve(results[0])
    })
  })
}

// Purpose :: updates the status of an order [Failed, Pending, Success]
function updateOrderStatus(orderId, status) {
  return globaldefs.clothingBotMysql.query("UPDATE orders SET status = ? WHERE orderId = ?", [status, orderId]);
}

function sendNewOrderWebhook(id, product, purchaseType, totalPrice, whitelistName, siteUsername, discordId, gateway, paymentMethod, referredBy) {
  requests.post({url: DISCORD_WEBHOOK,
    json: {
      "embeds": [{
        "title": `New Order | ID: ${id}`,
        "description": `Item: ${PRODUCTS[product].PRODUCT_NAMES[purchaseType]}`,
        "fields": [
                {
                    "name": "Payment Gateway",
                    "value": gateway,
                    "inline": true
                },
                {
                     "name": "Payment Method",
                     "value": paymentMethod,
                     "inline": true
                },
                {
                     "name": "Price",
                     "value": `${totalPrice}$`,
                     "inline": true
                },
                {
                  "name": "Whitelist Name",
                  "value": whitelistName,
                  "inline": true
                },
                {
                  "name": "Website Name",
                  "value": siteUsername,
                  "inline": true
                },
                {
                   "name": "Discord ID",
                   "value": (discordId ? discordId : "None"),
                   "inline": true
                },
                {
                     "name": "Referred by",
                     "value": (referredBy ? referredBy: "None"),
                     "inline": true
                },
             ],
         "color": 2464480
       }]
    }
  }).catch(e => console.error("sendNewOrderWebhook ERROR :: ", e));
}
function sendOrderCompleteWebhook(order) {
  requests.post({url: DISCORD_WEBHOOK,
    json: {
      "embeds": [{
        "title": `Order Complete | ID: ${order.orderId}`,
        "description": `Item: ${PRODUCTS[order.product].PRODUCT_NAMES[order.purchaseType]}\nOrder successful.`,
        "fields": [
                 {
                     "name": "Whitelist Name",
                     "value":  order.whitelistUsername,
                     "inline": true
                 },
                 {
                     "name": "Site User",
                     "value":  order.siteUsername,
                     "inline": true
                 },
                 {
                  "name": "Payment Gateway",
                  "value": order.gateway,
                  "inline": true
                },
                 {
                     "name": "Payment Method",
                     "value": order.paymentMethod,
                     "inline": true
                 },
                 {
                     "name": "Status",
                     "value": "Complete",
                     "inline": true
                 },
             ],
         "color": 65280
       }]
    }
 }).catch(e => console.error("sendOrderCompleteWebhook ERROR :: ", e));
}

module.exports = function(app){
  function handlePurchase(req, res) {
    var requestData = req.body;
    if(!req.query.secret) return res.status(400).send("");

    switch(req.query.secret) {
      case "k6hD53aVr8BdL74sRw": // Coinbase Commerce
        getOrder(requestData.event.data.code).then(order => {
          res.status(200).send("");

          // status != 0 | order has already been handled
          if(order.status !== 0) return;

          if(requestData.event.type === "charge:failed") return updateOrderStatus(order.orderId, -1);
          // resolve this payment
          if(requestData.event.type === "charge:delayed") {
            requests.post({
              url: `https://api.commerce.coinbase.com/charges/${order.orderId}/resolve`,
              headers: {
                "X-CC-Api-Key": "0138ec9d-2aab-4088-ac90-7fabf4498fa7",
                "X-CC-Version": "2018-03-22"
              }
            }).catch(e => {console.log("COINBASE COMMERCE ", e)})
          }

          // continue with the whitelisting process.....
          sendOrderCompleteWebhook(order);
          updateOrderStatus(order.orderId, 1);
          try {
            PURCHASE_CALLBACKS[order.product](order);
          } catch (e) {
            console.log("Order Callback ERROR")
            console.log(e);
            console.log("-----------Order Callback ERROR-----------");
          }

        }).catch(errorCode => {
          if(errorCode === enumGetOrder.ORDER_DOESNT_EXIST) return res.status(200).send("Order doesn't exist.");
          handlePurchase(req,res);
        });

        break;
      default:
        return res.status(400).send("");
    }
  }
  app.post("/api/purchase_webhook", handlePurchase);

  // TODO: make purchases/discounts with vortex credits possible
  app.post("/api/purchase", verifyJwtToken, async function(req, res){
    // validate parameters
    req.checkBody('product', '').notEmpty();
    req.checkBody('purchaseType', '').notEmpty();
    req.checkBody('whitelistName', '').notEmpty();
    req.checkBody('payMethod', '').notEmpty();
    //req.checkBody('useCredits', '').notEmpty();
    //req.checkBody('creditAmount', '').notEmpty();

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Missing parameters."});
    }

    var requestData = req.body;
    // check if the product even exists
    if(!PRODUCTS.hasOwnProperty(requestData.product)) return res.json({status: "fail", message: `Product "${requestData.product}" is off-sale or it doesn't exist.`});
    
    // for certain products like renewing the clothing bot we need to check if the whitelist exists
    if(!(await doesWhitelistExist(requestData.whitelistName, requestData.product, requestData.purchaseType))) {
      return res.status(200).json({status: "fail", message: `Whitelist "${requestData.whitelistName}" doesn't exist.`});
    }

    // check if user is valid
    jwt.verify(req.token, globaldefs.jwtSecret, (err, data) => {
      if(err) return res.status(200).json({status: "fail", message: "Expired token"});

      // get the user from mysql database
      globaldefs.clothingBotMysql.query("SELECT * FROM users WHERE username = ?", [data.username], async (error, results, _) => {
        if(error) return res.status(200).json({status: "fail", message: "Failed to get user data (internal server error), try again later."});
        if(!results.length) return res.status(200).json({status: "fail", message: "User not found in database, wtf?"});
        var user = results[0];
		
        // get the price for a product, reduce it if
        // 1. the user uses vortex credits
        // 2. if the user is staff
        try {
          var priceForProduct = await PRODUCTS[requestData.product].getProductPrice(requestData.whitelistName, requestData.purchaseType, requestData.additionalData);
        } catch(priceFetchError) {
          return res.status(200).json({status: "fail", message: priceFetchError});
        }
        
        var priceReduction = getPriceReductionForProduct(user, requestData.product, requestData.purchaseType, requestData.useCredits, requestData.creditAmount);
		    var totalPrice = priceForProduct - priceReduction;

        // change payment provider based on payment method
        switch(requestData.payMethod) {
          case "Bitcoin": case "Ethereum":
            var gateway = "Coinbase Commerce";
            try {
              var response = await requests.post({
                url: "https://api.commerce.coinbase.com/charges",
                headers: {
                  "X-CC-Api-Key": "0138ec9d-2aab-4088-ac90-7fabf4498fa7",
                  "X-CC-Version": "2018-03-22"
                },
                body: {
                  name: PRODUCTS[requestData.product].PRODUCT_NAMES[requestData.purchaseType],
                  description: "Vortex product purchase",
                  local_price: {
                    amount: totalPrice,
                    currency: "USD"
                  },
                  pricing_type: "fixed_price",
                  redirect_url: PRODUCTS[requestData.product].RETURN_URL[requestData.purchaseType]
                },
                json: true
              })
            } catch(e) {
              console.error("Coinbase Commerce: ", e);
              return res.status(200).json({status: "fail", message: "Failed to create payment, try again later."});
            }

            var success = await createOrder(response.data.code, gateway, requestData.payMethod, user.email, "", requestData.discordId, requestData.product, requestData.purchaseType, totalPrice, user.username, requestData.whitelistName, requestData.referredBy)
            if(!success) return res.status(200).json({status: "fail", message: "Failed to store order info in database, try again later."});

            // send webhook and we're done with this order!
            console.log("sendNewOrderWebhook");
            sendNewOrderWebhook(response.data.code, requestData.product, requestData.purchaseType, totalPrice, requestData.whitelistName, user.username, requestData.discordId, gateway, requestData.payMethod, requestData.referredBy);
            res.status(200).json({status: "success", type: "redirect", message: response.data.hosted_url});
            break;

          default:
            return res.json({status: "fail", message: `Payment method ${requestData.payMethod} isn't supported.`});
        }
      })
    });
  });
}
