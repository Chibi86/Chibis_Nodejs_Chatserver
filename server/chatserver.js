"use strict";

var port            = 1337;
var users           = []; // List of current users
var listeners       = []; // List of current listeners on broadcast
var log_history     = []; // Latest 10 msg
// Allowed connections from domains (as ['localhost', '127.0.0.1']) 
var allowed_domains = []; 

// Require the modules we need
var http            = require('http');
var WebSocketServer = require('websocket').server;

// Create a http server with a callback handling all requests
var httpServer = http.createServer(function(request, response){
  console.log((new Date()) + ' Received request for ' + request.url);
  response.writeHead(200, {'content-type': 'text/plain'});
  response.end('Hello!\n');
});

// Setup the http-server to listen to a port
httpServer.listen(port, function(){
  console.log((new Date()) + ' HTTP server is listening on port ' + port);
});


// Create an object for the websocket
// https://github.com/Worlize/WebSocket-Node/wiki/Documentation
var wsServer = new WebSocketServer({
  httpServer:            httpServer,
  autoAcceptConnections: false
});

// Create a callback to handle each connection request
wsServer.on('request', function(request) {
  
  var acceptedConnection = false; // Variable to check if any protocol was accepted
  
  // Make sure we only accept requests from an allowed origin
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
    return;
  }
  
  if(Object.prototype.toString.call(request.requestedProtocols) == '[object Array]' && request.requestedProtocols != null) {
	var amountOfProtocols = request.requestedProtocols.length;  
	
	// Loop through protocols.
	for (var i = 0; i < amountOfProtocols; i++) {
	  if (request.requestedProtocols[i] === 'chat-protocol') {
		  acceptedConnection = acceptConnectionAsChat(request);
	  }
	}
  }
  else if(request.requestedProtocols === 'chat-protocol') {
	acceptedConnection = acceptConnectionAsChat(request);
  }
  
  // Unsupported protocol
  if (!acceptedConnection) {
    console.log('Subprotocol not supported');
    request.reject(404, 'Subprotocol not supported');
  }
});

// Always check and explicitly allow the origin
var originIsAllowed = function(origin) {
  if (allowed_domains.length > 0) {
    for(var i = 0; i < allowed_domains.length; i++) {
      if(origin === allowed_domains) {
        return true;    
      }
    }
    return false;
  }
  return true;
}

// Accept conection under chat-protocol
var acceptConnectionAsChat = function(request) {
  // Set connection and save to users for chat
  var connection           = request.accept('chat-protocol', request.origin); // Add connection
      connection.userId    = users.push(connection) - 1;                      // Add connection to userlist, and add user index to connection
      connection.nick      = "Guest" + (connection.userId + 1);               // Get guest nick
      connection.nickColor = getRandomColor();                                // Get random chat color
  
  console.log((new Date()) + ' Chat connection accepted from ' + request.origin + ' id = ' + connection.userId + ' and nick = ' + connection.nick);
  
  // Send user nick, nickColor and history
  updateUser(connection, true); 
  
  // Inform about new user has join chat
  sendToUsers('join-msg', 'has join chat.', connection.nick, connection.nickColor);
  
  // Callback to handle each connection request
  connection.on('message', function(message) {
    //console.log(message);
    var validate = false;
    
    // Only text
    if (message.type === 'utf8') { 
      if(message.utf8Data !== undefined){
        // Handle JSON-string
        var json = {};
        
        try {
          json = JSON.parse(message.utf8Data);
        }
        catch (e) {
          console.log('Data delivered from server doesn\'t not seem to be a valid json!');
        }
        
        if(json !== undefined){
          var msg  = htmlEntities(json.msg);  // Message send of user
          var type = htmlEntities(json.type); // Type of message
          
          validate = true;
          
          console.log('Received message: "' + msg + '" as ' + type + ' from ' + connection.nick);
          
          // Regex for search for commands
          var re = {
            nick:      /^(\/nick )/i,
            nickColor: /^(\/nickcolor )/i,
            msg:       /^(\/msg )/i
          };
          
          /* /nick [new nick] */
          if (re.nick.exec(msg)) {
            var nick = msg.replace(re.nick, '').replace(/\s/, '');
            changeNick(nick, connection);
          }
          /* /nickcolor [color] */
          else if (re.nickColor.exec(msg)) {
            var nickColor = msg.replace(re.nickColor, '');
            changeNickColor(nickColor, connection);
          }
          /* /msg [nick] [message] */
          else if (re.msg.exec(msg)) {
            var toNick = msg.split(' ')[1];
            msg        = msg.replace(re.msg, '').replace(toNick, '');
            sendPrivateMsg(toNick, msg, connection);
          }
          // Default send as message
          else {
            sendMsgToUsers(connection, msg, type);
          }
        }
      }
    }
    
    // Not text or valid JSON-string? Send a message about it
    if (!validate) {
      console.log('Message delivered from ' + connection.nick + ' doesn\'t not seem to be a valid UTF-8 or JSON!');
      sendToUser(connection, 'sys-msg', 'Server received a invalid message from you!');
    }
  });
  
  // Callback when client closes the connection, and send message to chat-users
  connection.on('close', function(reasonCode, description){
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected nick = ' + connection.nick + ' user id = ' + connection.userId + '.');
    sendToUsers('signoff-msg', 'has left chat.', connection.nick, connection.nickColor);
    delete users[connection.userId];
  });
  
  return true;
}

// Prepare JSON for messages
var prepMsgJSON = function (type, txt, sender, senderColor, color) {
  sender      = sender      || '';
  senderColor = senderColor || '';
  color       = color       || '';
  
  return { 
    time:         new Date(),
    type:         type,
    txt:          htmlEntities(txt),
    sender:       sender,
    senderColor:  senderColor,
    color:        color
  }
}

// Send data to users
var sendToUsers = function(type, txt, sender, senderColor, color) {
  type        = type        || 'upd';
  txt         = txt         || '';
  sender      = sender      || '';
  senderColor = senderColor || '';
  color       = color       || '';
  
  var toSend = {};
  
  // If message, prepare JSON
  if (txt) {
    var msgJSON   = prepMsgJSON(type, txt, sender, senderColor, color);
    toSend['msg'] = msgJSON;
    
    // Log to history if it's chat messages
    if (type == 'chat-msg' || type == 'slaps-msg' || type == 'me-msg' || type == 'notice-msg') {
      log_history.push(msgJSON);
      log_history = log_history.slice(-10);
    }
  }
  // Otherwish, just allowed update's
  else if (type != 'upd'){
    return;
  }
  
  // If type of sending is not chat-msg or sys-msg send with onlinelist for update to users
  if (type != 'chat-msg' && type != 'sys-msg') {
    toSend['onlinelist'] = getOnlineList();
  }
  
  // Send not empty JSON-string
  if (toSend !== undefined) {
    var clients = 0; // Count for clients in console log
    
    // Loop-trough users and send message to anyone as JSON-string and UTF
    for (var i = 0; i < users.length; i++) {
      if(users[i]){
        clients++;
        users[i].sendUTF(JSON.stringify(toSend));
      }
    }
    
    // Log to console if it's not sys-msg, then it has been log before
    if (type && type != 'sys-msg' && type != 'upd') {
      console.log('Chat message to ' + clients + ' clients (' + sender + ': ' + txt + ')');
    }
    // No message log as silent update
    else if (type == 'upd') {
      console.log('Silent update of ' + clients + ' clients.');
    }
  }
}

// Send data to user, only allowed with msg
var sendToUser = function(to, type, txt, sender, senderColor, color) {
  sender      = sender      || '';
  senderColor = senderColor || '';
  color       = color       || '';
  
  if (txt) {
    var toSend = {};
    toSend['msg'] = prepMsgJSON(type, txt, sender, senderColor, color);
    
    to.sendUTF(JSON.stringify(toSend));
  }
}

// Prepare message for sending to users
var sendMsgToUsers = function(frm, msg, type) {
  msg      = msg  || '';
  type     = type || 'chat-msg';
  
  
  // Regex for search text-commands
  var re = {
    textColor: /^(\/color )/i,
    slap:      /^(\/slap )/i,
    me:        /^(\/me )/i,
    notice:    /^(\/notice )/i
  };
  
  // Default
  var color     = '';
  var nick      = frm.nick;
  var nickColor = frm.nickColor;
  
  /* /Color [color] [message] */
  if (re.textColor.exec(msg)) {
    color = msg.split(' ')[1]; // Set text-color
    msg   = msg.replace(re.textColor, '').replace(color, ''); // Remove commands from txt
    
    // Only validate color
    if(!validateColor(color)){
      color = '';
    }
  }
  /* /slap [nick]   */
  /* /slap [random] */
  else if (re.slap.exec(msg)) {
    var toSlap      = msg.split(' ')[1]; // Who to slap (nick or any one else)
    
    // Set message data
    msg        = colorToNick(frm.nick, frm) + ' slaps ' + colorToNick(toSlap) + ' around a bit with a large trout!';
    type       = 'slaps-msg';
    nick       = '';
    nickColor  = '';
  }
  /* /me [doing] */
  else if (re.me.exec(msg)) {
    var doing  = msg.replace(re.me, ''); // Remove commands from txt
    
    // Set message data
    msg        = '* ' + colorToNick(frm.nick, frm) + ' ' + doing;
    type       = 'me-msg';
    nick       = '';
    nickColor  = '';
  }
  /* /notice [nick] [message] */
  else if (re.notice.exec(msg)) {
    var toNick      = msg.split(' ')[1]; // Who to notice
    
    // Set message data
    msg  = '-'+ colorToNick(toNick) + '- ' + msg.replace(re.notice, '').replace(toNick, ''); // Remove commands from txt
    type = 'notice-msg';
  }
  
  // Message need be over 3 chars
  if (msg.length > 3) {
    sendToUsers(type, msg, nick, nickColor, color);
  }
  else {
    sendToUser(frm, 'sys-msg', 'You need to write more than 3 chars.');
  }
};

// Send private message in chat, only be delivered to sender and receiver
var sendPrivateMsg = function(toNick, msg, frm){
  toNick  = toNick || '';
  msg     = msg    || '';
  
  // We need a msg with minmum 4 chars
  if (msg && msg.length > 3) {
    // We need a receiver
    if (toNick && toNick.length > 1) {  
      var to = getUserByNick(toNick); // Get user conection-object from nick
      
      // We need a connection-object to send message, if got send message
      if (to) {
        msg = '*' + colorToNick(toNick, to) + '* ' + msg;
        sendToUser(to, 'private-msg', msg, frm.nick, frm.nickColor);
        sendToUser(frm, 'private-msg', msg, frm.nick, frm.nickColor);
        
        return;
      }
    }
    
    // If not got a receiver send error msg to sender
    sendToUser(frm, 'sys-msg', 'No user with that nick to send private message to!');
  }
  else {
    // If we not got valid message send error-msg to sender
    sendToUser(frm, 'sys-msg', 'Private message to ' + toNick + ' need be over 3 chars!');
  }
};

// Update user with nick and nick color, if first-run send also history
var updateUser = function(to, firstRun) {
  firstRun = firstRun || false;
  
  var toSend   = {};
  
  toSend['user-upd'] = {nick: to.nick, color: to.nickColor};
  
  if (firstRun) {
    toSend['history']   = log_history;
  }
  
  to.sendUTF(JSON.stringify(toSend));
};

// Change nick if it's valid
var changeNick = function(nick, user) {
  if(!validateNick(nick)){
sendToUser(user, 'sys-msg', 'Nick was already taken, not between 2 and 15 chars or not allowed (Guest1 etc)!');
  }
  else{
    var oldNick = user.nick;
    
    // Send information about nick change
    console.log((new Date()) + ' Nick change to ' + nick + ' for id = ' + user.userId + ' and old nick = ' + user.nick);
    user.nick = nick;
    sendToUsers('rename-msg', '*** ' + oldNick + ' is now know as ' + nick);
    updateUser(user);
  }
};

// Change nick color if it's valid
var changeNickColor = function(nickColor, user) {
  if(!validateNickColor(nickColor)){
    sendToUser(user, 'sys-msg', 'Color was already taken or not valid!');
  }
  else{
    user.nickColor = nickColor;
    console.log((new Date()) + ' Color change to "' + nickColor + '" for id = ' + user.userId + ' and nick = ' + user.nick);
    
    // Update sender and users onlinelist
    sendToUsers();
    updateUser(user);
  }
};

// Get user by nick, if no user with nick return false
var getUserByNick = function(nick) {
  console.log(nick);
  if (nick.length > 1 && nick.length < 15) {
    for (var i = 0; i < users.length; i++) {
      if (users[i] && users[i].nick.toLowerCase() == nick.toLowerCase()) {
        return users[i];
      }
    }
  }
  
  return false;
}

// Prepare onlinelist to send, no need to send connections to users
var getOnlineList = function() {
  var list = [];
  for (var i = 0; i < users.length; i++) {
    if(users[i]){
      list.push({nick: users[i].nick, nickColor: users[i].nickColor});
    }
  }
  
  return list;
}

// Prepare color-tags in message, if no valid nick send back "nick"
var colorToNick = function(nick, user) {
  nick = nick || '';
  
  if (user !== undefined){
    user = getUserByNick(nick);
  }
  
  if (user) {
    nick = '[color=' + user.nickColor + ']' + user.nick + '[/color]';
  }
  
  return nick;
};

// Avoid html-injections
var htmlEntities = function(txt){
  return String(txt).replace(/&/g, '&amp;').replace(/</g, '&alt;').replace(/>/g, '&gt;').replace(/"/g, '&quote;');
};

// letronje @ Stackoverflow
// http://stackoverflow.com/a/7352887/3099392
// Six levels of brightness from 0 to 5, 0 being the darkest
var getRandomColor = function(brightness) {
  brightness = brightness || 1;
  
  var rgb = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
  var mix = [brightness*51, brightness*51, brightness*51]; //51 => 255/5
  var mixedrgb = [rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function(x){ return Math.round(x/2.0)})
  return "rgb(" + mixedrgb.join(",") + ")";
}

// Validate hex-, rgb- and hsl-colors by regex
var validateColor = function(color) {
  // Regex to search for color-standars
  var re = {
    hex: /^#[0-9a-f]{3,6}$/i,
    rgb: /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/,
    hsl:  /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/
  };
  
  // Check if color-string if in any allowed standard
  if(re.hex.exec(color) || re.rgb.exec(color) || re.hsl.exec(color)){
    return true;
  }
  
  return false;
}

// Validate nick color
var validateNickColor = function(color) {
  var validate = validateColor(color); // Validate color
  
  // If color validate is okey, check if color is free
  if (validate) {
    for (var i = 0; i < users.length; i++) {
      if(users[i] && users[i].nickColor == color){
        validate = false;
      }
    }
  }
  
  return validate;
}

// Validate nick, need to be over 1 char and under 16 char, also cannot be as a default ex "Guest1"
var validateNick = function(nick) {
  if(nick.length > 1 && nick.length < 16){
    if (!(/^Guest[\d]+$/i.exec(nick))) {
      // Check if nick is free
      for (var i = 0; i < users.length; i++) {
        if(users[i] && users[i].nick == nick){
          return false;
        }
      }
      return true;
    }
  }

  return false;
}