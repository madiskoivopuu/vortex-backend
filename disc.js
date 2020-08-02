const express = require("express")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser");
const expressValidator = require("express-validator")
const path = require("path")
const fs = require("fs")
const fsExtra = require('fs-extra')
const paypal = require("paypal-rest-sdk")
const botconfig = require("./botconfig.json");
const Discord = require("discord.js");
var lodash = require("lodash");
const mysql = require("mysql");
const base58 = require("base-58")
const requests = require("request");
var rl = require("readline");
const jwt = require("jsonwebtoken");
var base64ToImage = require('base64-to-image');
var getImageDimensions = require('image-size');

const socketIO = require('socket.io');
var jwtAuth = require('socketio-jwt-auth');
var mongoose = require('mongoose');
const AutoIncrementFactory = require('mongoose-sequence');
var Schema = mongoose.Schema;
var globaldefs = require("./globaldefs");

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

function getPasswordHash(password)
{
  var crypto = require('crypto');
  var salt = 'k/fG%jd?#)mjfd4563D%¤#"%+jF**7¤Sy6fd'

  var hashMd5 = crypto.createHash('md5').update(salt + password).digest("hex");
  var hasSha1 = crypto.createHash('sha1').update(hashMd5).digest("hex");
  return hasSha1;
}

var mongoDB = 'mongodb://localhost:27017/chat';
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
var socketIo = null;

//var CategorySchema = Schema({name: String, channels: Array})
//CategorySchema.plugin(AutoIncrement, {inc_field: "position"});

//var RoleSchema = Schema({name: String, color: String, permissions: Object})
//RoleSchema.plugin(AutoIncrement, {inc_field: "priority"});

var defaultRoleId = "5d8faf6dc0dd981c208818f1";
const MAX_MESSAGE_CONTENT_LENGTH = 3000;
var Permissions = {"SEND_MESSAGES": true, "READ_MESSAGES": true, "ATTACH_FILES": false};
var DefaultPermissions = {};
DefaultPermissions[defaultRoleId] = {...Permissions};
var RolePermissions = {"admin": false, "mentionable": true, "MANAGE_MESSAGES": false, "MANAGE_CHANNELS": false, "MANAGE_ROLES": false, "MENTION_EVERYONE": false};

var Defaults = mongoose.model('Defaults', new Schema({defaultRoleId: String}))
var Role = mongoose.model('Role', new Schema({name: String, color: String, permissions: Object, priority: Number}));
var User = mongoose.model('User', new Schema({name: String, roles: Array, avatar: String, status: Number}))
var Message = mongoose.model('Message', new Schema({attachments: Array, timestamp: Date, edited: Boolean, edited_timestamp: Date, author: User.schema, mentions: Array, content: String, channel_id: String}))
var Channel = mongoose.model('Channel', new Schema({name: String, description: String, permissions: Object}));
var Category = mongoose.model('Category', new Schema({name: String, channels: Array, position: Number}));
var Mentions = mongoose.model('Mentions', new Schema({userId: String, mentions: Array}));
var SeenChannels = mongoose.model('SeenChannels', new Schema({userId: String, lastSeenMessages: Object}))



var cachedRoles = [], cachedUsers = [], cachedMessages = [], cachedChannels = [], cachedCategories = [];
function cacheRoles() {
  Role.find({}, function(err, roles){
    cachedRoles = roles;
    cachedRoles.sort(function(a, b) {
      return b.priority-a.priority;
    });
  })
}
function cacheUsers() {
  User.find({}, function(err, users){
    cachedUsers = users;


    /*setTimeout(() => {
      var a = {};
      cachedChannels.forEach(channel => {
        a[channel._id.toString()] = "";
      })

      users.forEach(user => {
        var b = new SeenChannels({userId: user._id.toString(), lastSeenMessages: a});
        b.save();
      })
    }, 3000);*/

  })
}
function cacheChannels() {
  Channel.find({}, function(err, channels){
    cachedChannels = channels;
  })
}
function cacheCategories() {
  Category.find({}, function(err, categories){
    cachedCategories = categories;
    cachedCategories.sort(function(a, b) {
      return a.position-b.position;
    });
  });
}
function cacheDefaultRoleId() {
  Defaults.find({}, function(err, results){
    defaultRoleId = results[0].defaultRoleId;
  })
}

function firstTimeSetup() {
  var everyone = new Role({name: "everyone", color: "", permissions: {...RolePermissions}, priority: 0});
  everyone.save(function(err, everyone2){
    var defaults = new Defaults({defaultRoleId: everyone2._id.toString()});
    defaults.save();

    var owner = new Role({name: "Owner", color: "#FF0000", permissions: {"admin": true, "mentionable": true, "MANAGE_MESSAGES": true, "MANAGE_CHANNELS": true, "MANAGE_ROLES": true, "MENTION_EVERYONE": true}, priority: 1});
    owner.save(function(err2, owner2){
      var user = new User({name: "SparklyCat", roles: [everyone._id.toString(), owner._id.toString()], avatar: "", status: 0});
      user.save();

      globaldefs.clothingBotMysql.query("SELECT * FROM users", function(err, results, fields){
        results.forEach(result =>{
          if(result.username !== "SparklyCat")
          {
            var newuser = new User({name: result.username, roles: [everyone._id.toString()], avatar: "", status: 0});
            newuser.save(function(err, newuser2) {
              var mention = new Mentions({userId: newuser2._id, mentions: []});
              mention.save();
            });
          }
        })
      })

    })
  })
}

cacheRoles();
cacheChannels();
cacheCategories();
cacheUsers();
//cacheDefaultRoleId();

//function parseMessageForMentions(message, author) {
  //var parseRegex = /^@[a-zA-Z0-9]*/;

  /*userMentions = [], roleMentions = [];
  var parsedMessage = "";
  message.content.split(" ").forEach(part => {

    if(!part.length) return;

    if(parseRegex.test(part))
    {
      var newpart = part.substring(1, part.length);

      // test for user mentions
      var user = cachedUsers.find(function(user) {
        return user.name === newpart;
      });
      if(user)
      {
        userMentions.push(user._id.toString());
        parsedMessage += `<@${user._id}> `;
        return;
      }

      // test for role mentions
      var role = cachedRoles.find(function(role) {
        return role.name === newpart;
      });
      if(role && role.permissions.mentionable)
      {
        // can the user mention @everyone
        if(role._id === defaultRoleId)
        {
          var canMentionEveryone = cachedRoles.find((role) => {
            return role.permissions.MENTION_EVERYONE && author.roles.includes(role._id);
          });

          if(!canMentionEveryone)
          {
            parsedMessage += `${part} `;
          }
          else {
            roleMentions.push(role._id.toString());
            parsedMessage += `<@${role._id}> `;
            return;
          }

        }
        else {
          roleMentions.push(role._id.toString());
          parsedMessage += `<@${role._id}> `;
          return;
        }
      }

      // default return if no roles found
      parsedMessage += `${part} `;
    }
    else {
      parsedMessage += `${part} `;
    }
  });

    return [parsedMessage, userMentions, roleMentions];
}*/

function parseMessageForMentions(message, author) {
  var parsedMessage = message.content;
  var userMentions = [], roleMentions = [];
  var rn = "", un = "", cn = "";

  while(true) {
    //console.log(parsedMessage);
    var role = cachedRoles.find(role => {
      rn = `@${role.name}`;
      return parsedMessage.toLowerCase().includes(rn.toLowerCase());
    });
    if(role && role.permissions.mentionable) {
      // can the user mention @everyone
      var regEx = new RegExp(rn, "ig");
      if(role._id.toString() === defaultRoleId)
      {
        var canMentionEveryone = cachedRoles.find((role) => {
          return role.permissions.MENTION_EVERYONE && author.roles.includes(role._id);
        });

        if(!canMentionEveryone)
        {
          parsedMessage = parsedMessage.replace(regEx, `<@${role._id}>`);
          continue;
        }
        else {
          parsedMessage = parsedMessage.replace(regEx, `<@${role._id}>`);
          roleMentions.push(role._id.toString());
          continue;
        }

      }
      else {
        parsedMessage = parsedMessage.replace(regEx, `<@${role._id}>`);
        roleMentions.push(role._id.toString());
        continue;
      }
    }

    var user = cachedUsers.find(user => {
      un = `@${user.name}`;
      return parsedMessage.toLowerCase().includes(un.toLowerCase());
    })
    if(user) {
      var regEx = new RegExp(un, "ig");
      parsedMessage = parsedMessage.replace(regEx, `<@${user._id}>`);
      userMentions.push(user._id.toString());
      continue;
    }

    break;
  }

  return [parsedMessage, userMentions, roleMentions];
}

module.exports.userRegistered = function(username) {
  var user = new User({name: username, roles: [defaultRoleId], avatar: "", status: 0});
  user.save(function(err, result){
    if(err) return console.error(`FAILED TO ADD USER ${username} TO WEB CHAT USERS`);
    cachedUsers.push(result);
    socketIo.sockets.emit("newUser", result);

    var a = {};
    cachedChannels.forEach(channel => {
      a[channel._id.toString()] = "";
    })

    var b = new SeenChannels({userId: result._id.toString(), lastSeenMessages: a});
    b.save(function(error, r){
      if(error) console.error(`FAILED TO CREATE SeenChannels FOR ${username}`);
    });
  })
}

module.exports.giveUserClothingBotRole = function(username) {
  var role = cachedRoles.find(role => role.name === "Clothing Bot");
  if(!role) console.log("WTF NO ROLE FOUND IN module.exports.giveUserClothingBotRole");

  User.findOneAndUpdate({name: username}, {$addToSet: {roles: role._id}}, {new:true}, function(err, result){
    if(err) console.log(`Failed to give ${username} chat Clothing Bot role.`);

    socketIo.sockets.emit("userUpdated", result);

    // possibly update the user if he is active
    Object.keys(socketIo.sockets.sockets).forEach(socket2 => {
      if(socketIo.sockets.sockets[socket2].client.request.user._id.toString() === result._id.toString())
      {
        socketIo.sockets.sockets[socket2].client.request.user.roles = result.roles;
        var usercategories = lodash.cloneDeep(cachedCategories);;
        var userchannels = [];
        usercategories.forEach(category => {
          category.channels = category.channels.filter((channelKey, key) => {
            // finds the right channel
            var channel = cachedChannels.find(function(channel) {
              return channel._id.toString() === channelKey;
            });
            // precautionary measure
            if(!channel) return false;

            // finds the highest role perms for a user in channel
            var roleId = defaultRoleId;
            cachedRoles.some(role => {
              if(socketIo.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                roleId = role._id.toString();
                return true;
              }
            });

            if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
              socketIo.sockets.sockets[socket2].leave(channelKey);
              return true;
            }
            else {
              socketIo.sockets.sockets[socket2].join(channelKey);
              userchannels.push(channel);
              return true;
            }
          });
        });

        socketIo.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
      }
    })
  })
}

module.exports.removeUserClothingBotRole = function(username) {
  var role = cachedRoles.find(role => role.name === "Clothing Bot");
  if(!role) console.log("WTF NO ROLE FOUND IN module.exports.removeUserClothingBotRole");

  User.findOneAndUpdate({name: username}, {$pullAll: {roles: role._id}}, {new:true}, function(err, result){
    if(err) console.log(`Failed to remove ${username} chat Clothing Bot role.`);

    socketIo.sockets.emit("userUpdated", result);

    // possibly update the user if he is active
    Object.keys(socketIo.sockets.sockets).forEach(socket2 => {
      if(socketIo.sockets.sockets[socket2].client.request.user._id.toString() === result._id.toString())
      {
        socketIo.sockets.sockets[socket2].client.request.user.roles = result.roles;
        var usercategories = lodash.cloneDeep(cachedCategories);;
        var userchannels = [];
        usercategories.forEach(category => {
          category.channels = category.channels.filter((channelKey, key) => {
            // finds the right channel
            var channel = cachedChannels.find(function(channel) {
              return channel._id.toString() === channelKey;
            });
            // precautionary measure
            if(!channel) return false;

            // finds the highest role perms for a user in channel
            var roleId = defaultRoleId;
            cachedRoles.some(role => {
              if(socketIo.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                roleId = role._id.toString();
                return true;
              }
            });

            if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
              socketIo.sockets.sockets[socket2].leave(channelKey);
              return true;
            }
            else {
              socketIo.sockets.sockets[socket2].join(channelKey);
              userchannels.push(channel);
              return true;
            }
          });
        });

        socketIo.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
      }
    })
  })
}

module.exports.main = function(io) {
  socketIo = io;
  io.use(jwtAuth.authenticate({
    secret: globaldefs.jwtSecret,    // required, used to verify the token's signature
    algorithm: 'HS256',        // optional, default to be HS256
    succeedWithoutToken: true
  }, function(payload, done) {
    // you done callback will not include any payload data now
    // if no token was supplied
    if (payload && payload.username) {
      User.findOne({name: payload.username}, function(err, user) {
        if (err) {
          // return error
          return done(err);
        }
        if (!user) {
          // return fail with an error message
          return done(null, false, 'user does not exist');
        }
        // return success with a user info
        return done(null, user);
      });
    } else {
      return done() // in your connection handler user.logged_in will be false
    }
  }));

  // Online checker
  setInterval((io) => {
    var onlineUsers = [];
    var userIds = [];
    cachedUsers.forEach(user => {
      if(user.status >= 1) onlineUsers.push(user);
    });

    Object.keys(io.sockets.sockets).forEach(socket2 => {
      if(io.sockets.sockets[socket2].client.request.user.logged_in) userIds.push(io.sockets.sockets[socket2].client.request.user._id.toString());
    })

    onlineUsers.forEach(user => {
      if(!userIds.includes(user._id.toString())) {
        user.status = 0;
        User.findOneAndUpdate({_id: user._id.toString()}, {status: 0}, function(err, res){ /* void */ });
        io.sockets.emit("userUpdated", user);
      }
    })
  }, 10000, io);

  io.on('connection', socket => {
    var msgs = 0;
    // initialize crep
    socket.on("initialLoad", () => {
      if(!socket.request.user.logged_in) return;
      socket.request.user.status = 1;

      Mentions.findOne({userId: socket.request.user._id.toString()}, function(err2, mentions) {
        if(err2) return;

        SeenChannels.findOne({userId: socket.request.user._id.toString()}, function(err3, seenchannels){
          if(err3) return;

          var usercategories = lodash.cloneDeep(cachedCategories);;
          var userchannels = [];
          usercategories.forEach(category => {
            category.channels = category.channels.filter((channelKey, key) => {
              // finds the right channel
              var channel = cachedChannels.find(function(channel) {
                return channel._id.toString() === channelKey;
              });
              // precautionary measure
              if(!channel) return false;

              // finds the highest role perms for a user in channel
              var roleId = defaultRoleId;
              cachedRoles.some(role => {
                if(socket.request.user.roles.includes(role._id) && channel.permissions.hasOwnProperty(role._id)) {
                  roleId = role._id;
                  return true;
                }
              });

              if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                return false;
              }
              else {
                socket.join(channelKey);
                userchannels.push(channel);
                return true;
              }
            });
          });

          socket.emit('initialLoad', {users: cachedUsers, mentions: mentions.mentions, seenchannels: seenchannels.lastSeenMessages, categories: usercategories, channels: userchannels, roles: cachedRoles, currentUser: socket.request.user, channelPermissions: Permissions, defaultRoleId: defaultRoleId});

          cachedUsers = cachedUsers.filter(user => {
            if(user._id.toString() === socket.request.user._id.toString())
            {
              user.status = 1;
            }
            return user;
          });
          User.findOneAndUpdate({_id: socket.request.user._id.toString()}, {status: 1}, function(err, res){ /* void */ });
          io.sockets.emit("userUpdated", socket.request.user);
        })
      });
    });

    socket.on("fetchMessagesForChannel", info => {
      if(!socket.request.user.logged_in) return;

      var channel = cachedChannels.find(function(channel) {
        return channel._id.toString() === info.channelId;
      });
      // precautionary measure
      if(!channel) return;

      var roleId = defaultRoleId;
      cachedRoles.some(role => {
        if(socket.request.user.roles.includes(role._id) && channel.permissions.hasOwnProperty(role._id)) {
          roleId = role._id;
          return true;
        }
      });
      // check for message read perms
      if(channel.permissions[roleId]["READ_MESSAGES"] === false) return;

      if(info.before === "")
      {
        Message.find({channel_id: info.channelId}).sort('-timestamp').limit(50).exec(function(err, results) {
          if(err) return;

          socket.emit("messagesFetched", {channelId: info.channelId, messages: results, old: false});
        })
      }
      else {
        Message.find({_id: {$lt: info.before}, channel_id: info.channelId}).sort('-timestamp').limit(50).exec(function(err, results) {
          if(err) return;

          socket.emit("messagesFetched", {channelId: info.channelId, messages: results, old: true});
        })
      }
    })

    socket.on("sendMessage", async message => {
      if(!socket.request.user.logged_in) return;

      if(message.content.length > MAX_MESSAGE_CONTENT_LENGTH) return;

      //if(msgs > 3) return;

      // check if channel exists
      var channel = cachedChannels.find(function(channel) {
        return channel._id.toString() === message.channelId;
      });
      if(!channel) return;

      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });

      // get users highest role id
      var roleId = defaultRoleId;
      cachedRoles.some(role => {
        if(socket.request.user.roles.includes(role._id) && channel.permissions.hasOwnProperty(role._id)) {
          roleId = role._id;
          return true;
        }
      });
      // check for message send/read perms
      if((channel.permissions[roleId]["READ_MESSAGES"] === false || channel.permissions[roleId]["SEND_MESSAGES"] === false) && !admin) return;

      // parse mentions
      var [parsedMessage, userMentions, roleMentions] = parseMessageForMentions(message, socket.request.user);
      var attachments = [];
      if(message.attachment !== null && (channel.permissions[roleId]["ATTACH_FILES"] || admin))
      {
        var randpath = Array(18).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
        try {
          fs.mkdirSync(`./webfiles/images/${randpath}/`);
          var imageInfo = await base64ToImage(message.attachment, `./webfiles/images/${randpath}/`, {debug: true});
          var dimensions = getImageDimensions(`./webfiles/images/${randpath}/${imageInfo.fileName}`);
          attachments.push({type: "image", url: `https://vortex-b.xyz/api/images/${randpath}/${imageInfo.fileName}`, width: dimensions.width, height: dimensions.height});
        } catch(e) {
          console.log(e);
          console.log("INVALID ATTACHMENT PASSED BY ", socket.request.user.name);
        }
      }
      if(message.content.trim() === "" && message.attachment === null) return;

      // send message out to everyone, then work on notifying the mentioned users
      var m = new Message({attachments: attachments, timestamp: Date.now(), edited: false, edited_timestamp: null, author: socket.request.user, mentions: userMentions.concat(roleMentions), content: parsedMessage.trimRight().trimLeft(), channel_id: message.channelId});
      m.save(function(err, result) {
        if(err) return;

        msgs += 1;
        io.sockets.in(message.channelId).emit("newMessage", result);

        setTimeout(() => {msgs -= 1}, 7000);
      });

      // start mention process
      var mentionUsers = [];
      // remove duplicate parsed mentions
      userMentions = userMentions.filter((item, pos, self) => self.indexOf(item) === pos);
      roleMentions = roleMentions.filter((item, pos, self) => self.indexOf(item) === pos);

      mentionUsers = mentionUsers.concat(userMentions);
      // loop rolementions to find all users
      for(let i = 0; i < roleMentions.length; ++i)
      {
        var a = await new Promise((resolve, reject) => {
          User.find({roles: {$in: roleMentions[i]}}, function(err, users){
            if(err) resolve();

            users.forEach(user => {
              if(!mentionUsers.includes(user._id.toString())) mentionUsers.push(user._id.toString());
            })
            resolve();
          })
        });
      }

      // add mentions to db
      mentionUsers.forEach(userId => {
        Mentions.findOne({userId: userId}, function(err2, mention) {
          if(err2) return;
          if(!mention) return;

          var channelMention = mention.mentions.find((m) => {
            return m.channelId === message.channelId;
          });

          if(!channelMention)
          {
            mention.mentions.push({channelId: message.channelId, count: 1});
          }
          else {
            channelMention.count += 1;
          }

          mention.markModified("mentions");
          mention.save();

        });

        Object.keys(io.sockets.sockets).forEach(socket => {
          if(io.sockets.sockets[socket].client.request.user._id.toString() === userId)
          {
            io.sockets.sockets[socket].emit("newMention", {channelId: message.channelId});
          }
        })
      });
    });

    socket.on("editMessage", info => {
      if(!socket.request.user.logged_in) return;

      if(info.content.trim() === "") return;

      if(info.content.length > MAX_MESSAGE_CONTENT_LENGTH) return;

      var channel = cachedChannels.find(function(channel) {
        return channel._id.toString() === info.channelId;
      });
      if(!channel) return;

      // get users highest role id
      var roleId = defaultRoleId;
      cachedRoles.some(role => {
        if(socket.request.user.roles.includes(role._id) && channel.permissions.hasOwnProperty(role._id)) {
          roleId = role._id;
          return true;
        }
      });
      // check for message read perms
      if(channel.permissions[roleId]["READ_MESSAGES"] === false || channel.permissions[roleId]["SEND_MESSAGES"] === false) return;

      Message.findOne({_id: info.messageId}, function(err, message){
        if(err) return;
        if(!message) return;

        // block the edit if the message author isnt the one who is trying to edit his message
        if(message.author._id.toString() !== socket.request.user._id.toString()) return;

        var [parsedMessage, userMentions, roleMentions] = parseMessageForMentions(info);
        userMentions = userMentions.filter((item, pos, self) => self.indexOf(item) === pos);
        roleMentions = roleMentions.filter((item, pos, self) => self.indexOf(item) === pos);

        message.content = parsedMessage.trimRight().trimLeft();
        message.mentions = userMentions.concat(roleMentions);
        message.edited = true;
        message.edited_timestamp = Date.now();
        message.save(function(err2, result){
          if(err2) return;

          io.sockets.in(message.channel_id).emit("messageEdited", result);
        });

      });
    });

    socket.on("deleteMessage", messageId => {
      if(!socket.request.user.logged_in) return;

      // check if user can manage messages or if he has admin perms
      var canManageMessages = cachedRoles.find((role) => {
        return role.permissions.MANAGE_MESSAGES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageMessages && !admin) return;

      Message.findOneAndRemove({_id: messageId}, function(err, message){
        if(err) return;
        if(!message) return;

        io.sockets.in(message.channel_id).emit("messageDeleted", {messageId, channelId: message.channel_id});
      })
    })

    socket.on("createRole", info => {
      if(!socket.request.user.logged_in) return;

      // check if user can manage roles
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;

      Role.updateMany({priority: {$gt: 0}}, {$inc: {priority: 1}}, function(err2, res) {
        if(err2) return;

        var role = new Role({name: "new role", color: "", permissions: {...RolePermissions}, priority: 1});
        role.save(function(err) {
          if(err) return;

          // update cached priorities
          cachedRoles = cachedRoles.filter(role => {
            if(role.priority !== 0) {
              role.priority += 1;
              return role;
            }
            else {
              return role;
            }
          });

          cachedRoles.push(role);
          cachedRoles.sort(function(a, b) {
            return b.priority-a.priority;
          });

          io.sockets.emit("reloadRoles", cachedRoles);
        })
      });
    })

    socket.on("deleteRole", roleId => {
      if(!socket.request.user.logged_in) return;

      // check if user can manage roles
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;

      // check if role exists
      var role = cachedRoles.find(role => {
        return role._id.toString() === roleId;
      })
      if(!role) return;

      Role.findOneAndRemove({_id: roleId}, function(err, res){
        if(err) return;

        cachedRoles = cachedRoles.filter(role => {
          return role._id.toString() !== roleId;
        });
        // update cached priorities
        cachedRoles = cachedRoles.filter(role => {
          if(role.priority >= res.priority) {
            role.priority -= 1;
            return role;
          }
          else {
            return role;
          }
        });

        io.sockets.emit("reloadRoles", cachedRoles);

        // remove role from all users who have that role
        User.updateMany({}, {$pullAll: {roles: [roleId]}}, function(err, res) { /* void */ });
        // update all roles above that role, subtract -1 from their priority to avoid number gaps
        Role.updateMany({priority: {$gte: res.priority}}, {$inc: {priority: -1}}, function(err, res) { /* void */ });

        // possible update active users' accessible categories & channels
        Object.keys(io.sockets.sockets).forEach(socket2 => {
          var usercategories = lodash.cloneDeep(cachedCategories);
          var userchannels = [];
          usercategories.forEach(category => {
            category.channels = category.channels.filter((channelKey, key) => {
              // finds the right channel
              var channel = cachedChannels.find(function(channel) {
                return channel._id.toString() === channelKey;
              });
              // precautionary measure
              if(!channel) return false;

              // finds the highest role perms for a user in channel
              var roleId = defaultRoleId;
              cachedRoles.some(role => {
                if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                  roleId = role._id.toString();
                  return true;
                }
              });

              if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                io.sockets.sockets[socket2].leave(channelKey);
                return false;
              }
              else {
                io.sockets.sockets[socket2].join(channelKey);
                userchannels.push(channel);
                return true;
              }
            });
          });
          io.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
        })
      })
    })

    socket.on("editRolePosition", data => {
      if(!socket.request.user.logged_in) return;

      var currentUserHighestRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id)) {
          return role;
        }
      });

      // check if the id is not out of array bounds
      if(data.startIndex < 0 || data.startIndex > cachedRoles.length) return;
      if(data.endIndex < 0 || data.endIndex > cachedRoles.length) return;
      if(data.startIndex === data.endIndex) return;

      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;

      var startId = cachedRoles[data.startIndex]._id;
      var startPosition = cachedRoles[data.startIndex].priority;
      var endPosition = cachedRoles[data.endIndex].priority;

      // dont allow default role to be moved
      if(endPosition === 0 || startPosition === 0) return;

      var queryFilter = {priority: {$gte: startPosition, $lte: endPosition}}
      var add = -1;

      // swap values if needed (if the user drags something down, end index is bigger than start index)
      if(data.endIndex > data.startIndex)
      {
        // before swapping, check if the user is trying to put a lower priority role over his max priority role
        // return immediately if he is
        if(endPosition > currentUserHighestRole.priority) return;

        queryFilter = {priority: {$gte: endPosition, $lte: startPosition}};
        add = 1;
      }

      Role.updateMany(queryFilter, {$inc: {priority: add}}, function(err2, res) {
        if(err2) return;

        Role.findOneAndUpdate({_id: startId}, {priority: endPosition}, function(err, res2){
          if(err) return;

          Role.find({}, function(err3, results){
            if(err3) return;

            cachedRoles = results;
            cachedRoles.sort(function(a, b) {
              return b.priority-a.priority;
            });

            io.sockets.emit("reloadRoles", cachedRoles);
          });
        })
      })
    })

    socket.on("updateRoles", async data => {
      if(!socket.request.user.logged_in) return;

      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });

      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;

      var currentUserHighestRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id)) {
          return role;
        }
      });

      for(var i = 0; i < data.length; ++i)
      {
        var idx = -1;
        var cachedRole = cachedRoles.find((a, index) => {
          if(a._id.toString() === data[i]._id)
          {
            idx = index;
            return true;
          }
        })
        if(!cachedRole) continue;

        // cannot edit higher priority role
        if(!admin && cachedRole.priority >= currentUserHighestRole.priority) continue;

        if(!data[i].hasOwnProperty("name")) continue;
        if(!data[i].hasOwnProperty("color")) continue;
        if(!data[i].hasOwnProperty("permissions")) continue;
        if(!data[i].name.trim() === "") continue;
        if(data[i].color !== "" && !/\b[0-9A-F]{6}\b/gi.test(data[i].color)) continue;

        // compare if properties are same
        // if updates < 1, don't update
        var updates = 0;
        if(data[i].name !== cachedRole.name) updates += 1;
        if(data[i].color !== cachedRole.color) updates += 1;

        // updated permissions check
        // can also replace keys that dont exist
        Object.keys(RolePermissions).forEach(perm => {
          if(!data[i].permissions.hasOwnProperty(perm)) {
            data[i].permissions[perm] = RolePermissions[perm];
            updates += 1;
          }
          else {
            if(data[i].permissions[perm] !== cachedRole.permissions[perm]) updates += 1;
          }
        });

        // special checks
        // 1. user isn't admin, dont allow him to enable admin perms
        if(!admin && data[i].permissions.admin === true) data[i].permissions.admin = false;

        if(updates > 0)
        {
          if(data[i]._id === defaultRoleId)
          {
            var a = await new Promise((resolve, reject) => {
              Role.findOneAndUpdate({_id: data[i]._id}, {permissions: data[i].permissions}, {new:true}, function(err, result){
                if(err) resolve();

                cachedRoles[idx] = result;
                resolve();
              })
            });
          }
          else {
            var a = await new Promise((resolve, reject) => {
              Role.findOneAndUpdate({_id: data[i]._id}, {name: data[i].name, color: data[i].color, permissions: data[i].permissions}, {new:true}, function(err, result){
                if(err) resolve();

                cachedRoles[idx] = result;
                resolve();
              })
            });
          }
        }
      }

      io.sockets.emit("reloadRoles", cachedRoles);

      // possible update active users' accessible categories & channels
      Object.keys(io.sockets.sockets).forEach(socket2 => {
        var usercategories = lodash.cloneDeep(cachedCategories);
        var userchannels = [];
        usercategories = usercategories.forEach(category => {
          category.channels = category.channels.filter((channelKey, key) => {
            // finds the right channel
            var channel = cachedChannels.find(function(channel) {
              return channel._id.toString() === channelKey;
            });
            // precautionary measure
            if(!channel) return false;

            // finds the highest role perms for a user in channel
            var roleId = defaultRoleId;
            cachedRoles.some(role => {
              if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                roleId = role._id.toString();
                return true;
              }
            });

            if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
              io.sockets.sockets[socket2].leave(channelKey);
              return false;
            }
            else {
              io.sockets.sockets[socket2].join(channelKey);
              userchannels.push(channel);
              return true;
            }
          });
        });
        io.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
      })
    })

    socket.on("addRoleToUser", info => {
      if(!socket.request.user.logged_in) return;

      // check if user can manage roles
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;

      var role = cachedRoles.find(role => {
        return role._id.toString() === info.roleId;
      })
      if(!role) return;

      // get user's highest role and check if it has a lower priority than the role he is trying to add
      var userRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id.toString())) {
          return role;
        }
      });

      if(!admin && userRole.priority <= role.priority) return;

      User.findOne({_id: info.userId}, function(err, user) {
        if(err) return;
        if(!user) return;

        var roleIndex = user.roles.indexOf(info.roleId);
        if(roleIndex === -1)
        {
          user.roles.push(info.roleId);
          user.save(function(err2, result) {
            if(err2) return;

            cachedUsers[cachedUsers.findIndex(user => user._id.toString() === result._id.toString())] = result;
            io.sockets.emit("userUpdated", result);

            // possibly update the user if he is active
            Object.keys(io.sockets.sockets).forEach(socket2 => {
              if(io.sockets.sockets[socket2].client.request.user._id.toString() === result._id.toString())
              {
                io.sockets.sockets[socket2].client.request.user.roles = result.roles;
                var usercategories = lodash.cloneDeep(cachedCategories);
                var userchannels = [];
                usercategories.forEach(category => {
                  category.channels = category.channels.filter((channelKey, key) => {
                    // finds the right channel
                    var channel = cachedChannels.find(function(channel) {
                      return channel._id.toString() === channelKey;
                    });
                    // precautionary measure
                    if(!channel) return false;

                    // finds the highest role perms for a user in channel
                    var roleId = defaultRoleId;
                    cachedRoles.some(role => {
                      if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                        roleId = role._id.toString();
                        return true;
                      }
                    });

                    if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                      io.sockets.sockets[socket2].leave(channelKey);
                      return false;
                    }
                    else {
                      io.sockets.sockets[socket2].join(channelKey);
                      userchannels.push(channel);
                      return true;
                    }
                  });
                });

                io.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
              }
            })
          });
        }
        else {
          return;
        }
      });
    })

    socket.on("removeRoleFromUser", info => {
      if(!socket.request.user.logged_in) return;

      // check if user can manage roles
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageRoles && !admin) return;
      if(info.roleId === defaultRoleId) return;

      // check if role exists
      var role = cachedRoles.find(role => {
        return role._id.toString() === info.roleId;
      })
      if(!role) return;

      // get user's highest role and check if it has a lower priority than the role he is trying to remove
      var userRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id.toString())) {
          return role;
        }
      });

      if(!admin && userRole.priority <= role.priority) return;

      User.findOne({_id: info.userId}, function(err, user) {
        if(err) return;
        if(!user) return;

        var roleIndex = user.roles.indexOf(info.roleId);
        if(roleIndex !== -1)
        {
          user.roles.splice(roleIndex, 1);
          user.save(function(err2, result) {
            if(err2) return;

            cachedUsers[cachedUsers.findIndex(user => user._id.toString() === result._id.toString())] = result;
            io.sockets.emit("userUpdated", result);

            // possibly update the user if he is active
            Object.keys(io.sockets.sockets).forEach(socket2 => {
              if(io.sockets.sockets[socket2].client.request.user._id.toString() === result._id.toString())
              {
                io.sockets.sockets[socket2].client.request.user.roles = result.roles;
                var usercategories = lodash.cloneDeep(cachedCategories);
                var userchannels = [];
                usercategories.forEach(category => {
                  category.channels = category.channels.filter((channelKey, key) => {
                    // finds the right channel
                    var channel = cachedChannels.find(function(channel) {
                      return channel._id.toString() === channelKey;
                    });
                    // precautionary measure
                    if(!channel) return false;

                    // finds the highest role perms for a user in channel
                    var roleId = defaultRoleId;
                    cachedRoles.some(role => {
                      if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                        roleId = role._id.toString();
                        return true;
                      }
                    });

                    if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                      io.sockets.sockets[socket2].leave(channelKey);
                      return false;
                    }
                    else {
                      io.sockets.sockets[socket2].join(channelKey);
                      userchannels.push(channel);
                      return true;
                    }
                  });
                });

                io.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
              }
            })
          });
        }
      })
    })

    socket.on("createChannel", info => {
      if(!socket.request.user.logged_in) return;

      // check if category exists
      var category = cachedCategories.find(category => {
        return category._id.toString() === info.categoryId;
      })
      if(!category) return;

      // check if user can manage channels
      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      if(!info.channelName || !info.channelName.length) return;
      info.channelName = info.channelName.replace(/[\s#]/g, "-");

      var channel = new Channel({name: info.channelName, description: "", permissions: {[defaultRoleId]: Permissions}});
      channel.save(function(err, result){
        if(err) return;

        Category.findOneAndUpdate({_id: info.categoryId}, {$push: { channels: result._id.toString()}}, function(err, res){ /* void */} )

        category.channels.push(result._id.toString());
        cachedChannels.push(result);

        Object.keys(io.sockets.sockets).forEach(socket2 => {
          io.sockets.sockets[socket2].join(result._id.toString());
        });

        io.sockets.emit("newChannel", {categoryId: info.categoryId, channel: result})
      });
    });

    socket.on("deleteChannel", channelId => {
      if(!socket.request.user.logged_in) return;

      var channel = cachedChannels.find(function(channel) {
        return channel._id.toString() === channelId;
      });
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      Category.updateMany({}, {$pullAll: {channels: [channelId]}}, function(err, result) {
        if(err) return;

        Channel.findOneAndRemove({_id: channelId}, function(err2, res2){
          if(err2) return;

          // successfully removed channel from category & Channel model
          // now remove it from cache

          var id = -1;
          cachedChannels.some((channel, key) => {
            if(channel._id.toString() === channelId)
            {
              id = key
              return true;
            }
          })
          if(id !== -1) cachedChannels.splice(id, 1);

          cachedCategories.forEach(ctg => {
            var id = ctg.channels.indexOf(channelId);
            if(id !== -1) ctg.channels.splice(id, 1);
          })

          io.sockets.emit("channelRemoved", channelId);
        })
      })
    })

    socket.on("editChannelNameAndDescription", data => {
      if(!socket.request.user.logged_in) return;

      var channel = cachedChannels.find(function(channel) {
        return channel._id.toString() === data.channelId;
      });
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      if(!data.channelName || data.channelName.trim() === "") return;
      data.channelName = data.channelName.replace(/[\s#]/g, "-");

      Channel.findOneAndUpdate({_id: data.channelId}, {name: data.channelName, description: data.channelDescription}, {new: true}, function(err2, result){
        if(err2) return;

        channel.name = data.channelName;
        channel.description = data.channelDescription;

        io.sockets.in(data.channelId).emit("channelUpdated", result);
      });
    })

    socket.on("editChannelPosition", data => {
      if(!socket.request.user.logged_in) return;

      var startCategory = cachedCategories.find(category => {
        return category._id.toString() === data.startCategory;
      })
      if(!startCategory) return;

      var endCategory = cachedCategories.find(category => {
        return category._id.toString() === data.endCategory;
      })
      if(!endCategory) return;

      var channel = startCategory.channels.find(channel => {
        return channel === data.channelId;
      });
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      Category.findOneAndUpdate({_id: data.startCategory}, {$pullAll: {channels: [data.channelId]}}, {new: true}, function(err, res){
        if(err) return;
        if(!res) return;
        startCategory.channels = res.channels;

        Category.findOneAndUpdate({_id: data.endCategory}, {$push: {channels: {$each: [data.channelId], $position: data.endIndex}}}, {new: true}, function(err2, res2){
          if(err2) return;
          if(!res2) return;
          endCategory.channels = res2.channels;

          io.sockets.emit("reloadCategories", {categories: cachedCategories});
        });
      })
    })

    socket.on("addRolePermsToChannel", data => {
      if(!socket.request.user.logged_in) return;

      // check if channel exists
      var channel = cachedChannels.find(channel => {
        return channel._id.toString() === data.channelId;
      })
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !canManageRoles && !admin) return;

      // check if the role he is trying to add has lower priority than his highest role
      var currentUserHighestRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id)) {
          return role;
        }
      });
      var role = cachedRoles.find(role => {
        return role._id.toString() === data.roleId;
      })
      if(!role) return;
      if(!admin && currentUserHighestRole.priority <= role.priority) return;

      // check if perms already exist
      if(Object.keys(channel.permissions).includes(data.roleId)) return;

      Channel.findOne({_id: data.channelId}, function(err, result) {
        if(err) return;

        var new_perms = {};
        result.permissions[data.roleId] = {...Permissions};

        // reorder by priority
        cachedRoles.forEach(cachedRole => {
          var id = cachedRole._id.toString();
          if(Object.keys(result.permissions).includes(id)) new_perms[id] = result.permissions[id]
        })
        result.permissions = new_perms;
        result.markModified("permissions");

        result.save(function(err2, result2) {
          if(err2) return;

          channel.permissions = result2.permissions;
            io.sockets.in(data.channelId).emit("channelUpdated", result2);
        })
      })
    })

    socket.on("removeRolePermsFromChannel", data => {
      if(!socket.request.user.logged_in) return;

      // check if channel exists
      var channel = cachedChannels.find(channel => {
        return channel._id.toString() === data.channelId;
      })
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !canManageRoles && !admin) return;

      // check if the role he is trying to add has lower priority than his highest role
      var currentUserHighestRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id)) {
          return role;
        }
      });
      var role = cachedRoles.find(role => {
        return role._id.toString() === data.roleId;
      })
      if(!role) return;
      if(!admin && currentUserHighestRole.priority <= role.priority) return;

      // check if role is default role
      if(role._id.toString() === defaultRoleId) return;

      // check if perms already exist
      if(!Object.keys(channel.permissions).includes(data.roleId)) return;

      Channel.findOne({_id: data.channelId}, function(err, result) {
        if(err) return;

        delete result.permissions[data.roleId];
        result.markModified("permissions");

        result.save(function(err2, result2) {
          if(err2) return;

          channel.permissions = result2.permissions;
          io.sockets.in(data.channelId).emit("channelUpdated", result2);
        });
      })
    })

    socket.on("editChannelPermissions", data => {
      if(!socket.request.user.logged_in) return;

      var channel = cachedChannels.find(channel => {
        return channel._id.toString() === data.channelId;
      })
      if(!channel) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var canManageRoles = cachedRoles.find((role) => {
        return role.permissions.MANAGE_ROLES && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !canManageRoles && !admin) return;

      // keep this later to check permissions against role priority
      var currentUserHighestRole = cachedRoles.find(role => {
        if(socket.request.user.roles.includes(role._id)) {
          return role;
        }
      });

      Channel.findOne({_id: data.channelId}, function(err, result) {
        if(err) return;

        // start checking permissions
        Object.keys(data.permissions).forEach(key => {
          // check if channel even has that role's permissions stored
          if(!result.permissions.hasOwnProperty(key)) {
            delete data.permissions[key];
            return;
          }

          // check if role exists & users highest role is higher than the role he is trying to change perms of
          var role = cachedRoles.find(role => {
            return role._id.toString() === key;
          });
          if(!role) {
            delete data.permissions[key];
            return;
          }
          if(currentUserHighestRole.priority <= role.priority) {
            delete data.permissions[key];
            return;
          }

          // MISSING PERMISSIONS CHECK
          Object.keys(Permissions).forEach(perm => {
            if(!data.permissions[key].hasOwnProperty(perm)) data.permissions[key][perm] = Permissions[perm];
          })

          result.permissions[key] = data.permissions[key];
        });

        result.markModified("permissions");
        result.save(function(err2, result2) {
          if(err2) return;

          channel.permissions = result2.permissions;
          io.sockets.in(data.channelId).emit("channelUpdated", result2);

          // update active users' channel perms in case
          Object.keys(io.sockets.sockets).forEach(socket2 => {
            var usercategories = lodash.cloneDeep(cachedCategories);
            var userchannels = [];
            usercategories.forEach(category => {
              category.channels = category.channels.filter((channelKey, key) => {
                // finds the right channel
                var channel = cachedChannels.find(function(channel) {
                  return channel._id.toString() === channelKey;
                });
                // precautionary measure
                if(!channel) return false;

                // finds the highest role perms for a user in channel
                var roleId = defaultRoleId;
                cachedRoles.some(role => {
                  if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                    roleId = role._id.toString();
                    return true;
                  }
                });

                if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                  io.sockets.sockets[socket2].leave(channelKey);
                  return false;
                }
                else {
                  io.sockets.sockets[socket2].join(channelKey);
                  userchannels.push(channel);
                  return true;
                }
              });
            });

              io.sockets.sockets[socket2].emit('reloadCategoriesAndChannels', {categories: usercategories, channels: userchannels});
          })
        })
      })
    })

    socket.on("channelSeen", data => {
      if(!socket.request.user.logged_in) return;

      var channel = cachedChannels.find(channel => {
        return channel._id.toString() === data.channelId;
      })
      if(!channel) return;

      Mentions.findOne({userId: socket.request.user._id.toString()}, function(err2, mention) {
        if(err2) return;
        if(!mention) return;

        var index = mention.mentions.findIndex(el => el.channelId === data.channelId);
        if(index !== -1)
        {
          mention.mentions.set(index, {channelId: data.channelId, count: 0});
          mention.save();
        }

      });

      if(data.messageId) {
        var d = `lastSeenMessages.${data.channelId}`;
        SeenChannels.findOneAndUpdate({userId: socket.request.user._id.toString()}, {$set: {[d]: data.messageId}}, {new: true}, function(err, result) { /* void */});
      }
    })


    socket.on("createCategory", data => {
      if(!socket.request.user.logged_in) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      if(!data.categoryName || data.categoryName.trim() === "") return;

      var category = new Category({name: data.categoryName, channels: [], position: cachedCategories.length+1});
      category.save(function(err, result) {
        if(err) return;

        cachedCategories.push(result);
        io.sockets.emit("newCategory", result);
      })
    });

    socket.on("deleteCategory", categoryId => {
      if(!socket.request.user.logged_in) return;

      var category = cachedCategories.find(function(category) {
        return category._id.toString() === categoryId;
      });
      if(!category) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      Category.findOneAndRemove({_id: categoryId}, function(err, result) {
        if(err) return;
          // successfully removed category
          // now remove it from cache

          cachedCategories = cachedCategories.filter(category => {
            return category._id.toString() !== categoryId;
          })
          io.sockets.emit("categoryRemoved", categoryId);

          // update category positions to avoid number gaps
          Category.updateMany({position: {$gte: result.position}}, {$inc: {position: -1}}, function(err, res) { /* void */ });
      })
    })

    socket.on("editCategoryPosition", data => {
      if(!socket.request.user.logged_in) return;

      // check if the id is not out of array bounds
      if(data.startIndex < 0 || data.startIndex > cachedCategories.length) return;
      if(data.endIndex < 0 || data.endIndex > cachedCategories.length) return;
      if(data.startIndex === data.endIndex) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      var startId = cachedCategories[data.startIndex]._id;
      var startPosition = cachedCategories[data.startIndex].position;
      var endPosition = cachedCategories[data.endIndex].position;

      var queryFilter = {position: {$gte: startPosition, $lte: endPosition}}
      var add = -1;
      // swap values if needed (if endIndex is smaller than startIndex)
      if(data.endIndex < data.startIndex)
      {
        queryFilter = {position: {$gte: endPosition, $lte: startPosition}};
        add = 1;
      }

      Category.updateMany(queryFilter, {$inc: {position: add}}, function(err2, res) {
        if(err2) return;

        Category.findOneAndUpdate({_id: startId}, {position: endPosition}, function(err, res){
          if(err) return;

          Category.find({}, function(err3, results){
            if(err3) return;

            cachedCategories = results;
            cachedCategories.sort(function(a, b) {
              return a.position-b.position;
            });

            Object.keys(io.sockets.sockets).forEach(socket2 => {
              if(socketIo.sockets.sockets[socket2].client.request.user.logged_in)
              {
                var usercategories = lodash.cloneDeep(cachedCategories);;
                usercategories.forEach(category => {
                  category.channels = category.channels.filter((channelKey, key) => {
                    // finds the right channel
                    var channel = cachedChannels.find(function(channel) {
                      return channel._id.toString() === channelKey;
                    });
                    // precautionary measure
                    if(!channel) return false;

                    // finds the highest role perms for a user in channel
                    var roleId = defaultRoleId;
                    cachedRoles.some(role => {
                      if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                        roleId = role._id.toString();
                        return true;
                      }
                    });

                    if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                      io.sockets.sockets[socket2].leave(channelKey);
                      return false;
                    }
                    else {
                      io.sockets.sockets[socket2].join(channelKey);
                      return true;
                    }
                  });
                });

                io.sockets.emit("reloadCategories", {categories: usercategories});
              }
            });
          });
        })
      })
    })

    socket.on("updateCategories", async data => {
      if(!socket.request.user.logged_in) return;

      var canManageChannels = cachedRoles.find((role) => {
        return role.permissions.MANAGE_CHANNELS && socket.request.user.roles.includes(role._id.toString());
      });
      var admin = cachedRoles.find((role) => {
        return role.permissions.admin && socket.request.user.roles.includes(role._id.toString());
      });
      if(!canManageChannels && !admin) return;

      for(var i = 0; i < data.length; ++i)
      {
        var idx = -1;
        var cachedCategory = cachedCategories.find((a, index) => {
          if(a._id.toString() === data[i]._id)
          {
            idx = index;
            return true;
          }
        })
        if(!cachedCategory) continue;

        if(!data[i].hasOwnProperty("name")) continue;
        if(!data[i].name.trim() === "") continue;

        // compare if properties are same
        // if true, dont update
        if(data[i].name === cachedCategory.name) continue;

        var a = await new Promise((resolve, reject) => {
          Category.findOneAndUpdate({_id: data[i]._id}, {name: data[i].name}, {new:true}, function(err, result){
            if(err) resolve();

            cachedCategories[idx] = result;
            resolve();
          })
        });
      }

      Object.keys(io.sockets.sockets).forEach(socket2 => {
        if(socketIo.sockets.sockets[socket2].client.request.user.logged_in)
        {
          var usercategories = lodash.cloneDeep(cachedCategories);;
          usercategories.forEach(category => {
            category.channels = category.channels.filter((channelKey, key) => {
              // finds the right channel
              var channel = cachedChannels.find(function(channel) {
                return channel._id.toString() === channelKey;
              });
              // precautionary measure
              if(!channel) return false;

              // finds the highest role perms for a user in channel
              var roleId = defaultRoleId;
              cachedRoles.some(role => {
                if(io.sockets.sockets[socket2].client.request.user.roles.includes(role._id.toString()) && channel.permissions.hasOwnProperty(role._id.toString())) {
                  roleId = role._id.toString();
                  return true;
                }
              });

              if(channel.permissions[roleId]["READ_MESSAGES"] === false) {
                io.sockets.sockets[socket2].leave(channelKey);
                return false;
              }
              else {
                io.sockets.sockets[socket2].join(channelKey);
                return true;
              }
            });
          });

          io.sockets.emit("reloadCategories", {categories: usercategories});
        }
      });
    })

    socket.on("updateProfile", async data => {
      if(!socket.request.user.logged_in) return;

      var user = cachedUsers.find(user => {
        return user._id.toString() === socket.request.user._id.toString();
      })
      if(!user) return;

      try {
        if (!fs.existsSync(`./webfiles/avatars/${socket.request.user.name}/`)) fs.mkdirSync(`./webfiles/avatars/${socket.request.user.name}/`);
        fsExtra.emptyDirSync(`./webfiles/avatars/${socket.request.user.name}/`);
        var imageInfo = await base64ToImage(data.avatar, `./webfiles/avatars/${socket.request.user.name}/`, {debug: true});
        var dimensions = getImageDimensions(`./webfiles/avatars/${socket.request.user.name}/${imageInfo.fileName}`);
        if(dimensions.width < 128 || dimensions.height < 128) return;
      } catch(e) {
        console.log(e);
        console.log("INVALID AVATAR BY ", socket.request.user.name);
      }

      User.findOneAndUpdate({_id: socket.request.user._id}, {avatar: `https://vortex-b.xyz/api/avatars/${socket.request.user.name}/${imageInfo.fileName}`}, {new: true}, function(err, res){
        if(err) return;

        user.avatar = `https://vortex-b.xyz/api/avatars/${socket.request.user.name}/${imageInfo.fileName}`;
        socket.request.user.avatar = `https://vortex-b.xyz/api/avatars/${socket.request.user.name}/${imageInfo.fileName}`;
        io.sockets.emit("userUpdated", user);
      })
    })

    socket.on('disconnect', () => {
      if(!socket.request.user.logged_in) return;

      // unnecessary after recent addition
      /*socket.request.user.status = 0;
      cachedUsers = cachedUsers.filter(user => {
        if(user._id.toString() === socket.request.user._id.toString())
        {
          user.status = 0;
        }
        return user;
      });
      io.sockets.emit("userUpdated", socket.request.user);
      User.findOneAndUpdate({_id: socket.request.user._id.toString()}, {status: 0}, function(err, res){ /* void *\/ });*/
    })
  })
}

function secondsToHms(d) {
    d = Number(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    return h + " hours, " + ('' + m).slice(-2) + " minutes, " + ('' + s).slice(-2) + " seconds."; //('' + h).slice(-2)
}
