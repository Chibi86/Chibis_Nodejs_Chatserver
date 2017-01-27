'use strict';

$(document).ready(function(){
  var url        = $("#url");                       // Connect address field
  var connect    = $("#connect");                   // Connect button
  var disconnect = $("#disconnect");                // Disconnect button
  var message    = $("#message");                   // Message field
  var send       = $("#send");                      // Send button
  var nick       = $("#nick");                      // Nick button
  var output     = $("#output");                    // Chat feed div
  var onlinelist = $("#onlinelist");                // Onlinelist div
  var user       = { nick: '', color: '#000000'};   // Default user
  var websocket;
  
  // Prepare to set .yourNick color
  var style      = document.createElement('style');
  style.type     = 'text/css';
  document.getElementsByTagName('head')[0].appendChild(style);
  
  // Event handler to create the websocket connection when someone clicks the button #connect
  connect.click( function(event) {
    console.log('Connection to: ' + url.val());
    
    // Close websocket if exist
    if (websocket) {
      websocket.close();
      websocket = null;
    }
    
    // Setup new websocket with chat-protocol
    websocket = new WebSocket(url.val(), 'chat-protocol');
    
    // Eventhandler when the websocket is opened
    websocket.onopen = function() {
      console.log('The websocket is now open.');
      console.log(websocket);
      prepMessageToChat('con-msg', 'Connection to chat server is open.');
    }
    
    websocket.onmessage = function(event) {
      console.log('Receiving data: ' + event.data);
      console.log(websocket);
      
      // Handle JSON-string
      var json = {};
      
      try {
        json = JSON.parse(event.data);
      }
      catch (e) {
        console.log('Data delivered from server doesn\'t not seem to be a valid json!');
      }
      
      if(json !== undefined){
        // Loop-trough sendings
        for (var key in json) {
          // If user updates
          if (key == 'user-upd') {
            setUserSettings(json[key]);
          }
          // If onlinelist updates
          else if (key == 'onlinelist') {
            updateOnlineList(json[key]);
          }
          // If message sending
          else if (key == 'msg') {
            addMessageToChat(json[key]);
          }
          // If history message sending
          else if (key == 'history') {
            addHistoryToChat(json[key]);
          }
        }
      }
    }
    
    // Eventhandler when the websocket is closed
    websocket.onclose = function() {
      console.log('The websocket is now closed.');
      console.log(websocket);
      onlinelist.html(''); // Empty onlinelist
      setUserSettings();   // Set default
      prepMessageToChat('con-msg', 'Connection to chat server is closed.');
    }
    
    // Eventhandler when error with websocket connection appear
    websocket.onerror = function(error) {
      prepMessageToChat('con-msg', 'Connection to chat server couldn\'t establish, maybe chat server is down.');
      console.log("Error with websocket connection.", error);
    };
  });
  
  // Add eventhandler to send message
  send.click( function(event){ 
    var msg = message.val();
    
    // Regex to search for commands
    var re = { 
      quit:      /^(\/quit)/i,
      connect:   /^(\/connect)/i,
    };
    
    /* /connect
       /connect [server-address] */
    if (re.connect.exec(msg)) {
      var to = msg.replace(re.connect, '').trim();
      if(to.length > 0){
        url.val(to);
      }
      
      connect.trigger('click');
      message.val('');
    }
    // If no connect message check if websocket is active
    else if(!websocket || websocket.readyState === 3) {
      console.log('The websocket is not connected to a server');
      prepMessageToChat('sys-msg', 'You need to connect to chat server for sending chat messages.');
    }
    else {
      /* /quit
         /quit [message] */
      if (re.quit.exec(msg)) {
        msg = msg.replace(re.quit, '').trim();
        if(msg.length > 0){
          var toSend = { type: 'signoff-msg', msg: msg };
          prepMessageToChat('signoff-msg', 'leaving (' + msg + ')', user.nick, user.color);
          websocket.send(JSON.stringify(toSend));
        }
        
        disconnect.trigger('click');
        message.val('');
      }
      // Otherwish send as text if is minimum 4 chars
      else if (msg.length > 3) {
        websocket.send(JSON.stringify({ type: 'chat-msg', msg: msg }));
        message.val('');
      }
      // Send error message as system to user
      else {
        prepMessageToChat('sys-msg', 'You need to write more than 3 chars.');
      }
    }
  });
  
  // Close the connection to server
  disconnect.click( function() {
    console.log('Disconnect to websocket');
    websocket.close();
    console.log(websocket);
  });
  
  // Handle retur-key click in message field as click on send button
  message.keypress( function(e) {
    if (e.which == 13) {
      e.preventDefault();
      send.trigger('click');
    }
  });
  
  // Handle click on nick button to add '/me ' (or if we are offline '/connect') to message field
  nick.click(function(){
    addNickToMessage(this);
  });
  
  // Set user nick and nick color
  var setUserSettings = function(data) {
    nick.text(''); // Empty nick button text
    
    // If data is not exist set as default (offline)
    if (data == undefined) {
      user = { nick: '', color: '#000000'};
      
      // Set offline to nick button
      $('<span></span>')
      .text('Offline')
      .addClass('offline')
      .appendTo(nick);
    }
    else{
      user = data; // Set data to user-object
      
      // Set "new" nick to nick button
      $('<span></span>')
      .text(data.nick)
      .css('color', data.color)
      .appendTo(nick);
      
      // Set nick color to yourNick class for your nick in message
      var styleNick = '.yourNick { color: ' + data.color + '; }';
      if (style.styleSheet) {
        style.styleSheet.cssText = styleNick;
      }
      else{
        style.appendChild(document.createTextNode(styleNick));
      }
    }
  };
  
  // Update onlinelist
  var updateOnlineList = function(users) {
    onlinelist.html(''); // Empty onlinelist
    var userEl;
    
    // Loop-trough and add users spans to onlinelist div
    for (var key in users) {
      if (users[key] !== undefined) {
        userEl = $('<span></span>');
        
        userEl
        .text(users[key].nick)
        .css('color', users[key].nickColor)
        .click(addNickToMessage) // When click on add nick (or '/me ' if it's your nick) to message field
        .appendTo(onlinelist);
        
        // Check if is your nick, add class yourNick for show that
        if(users[key].nick == user.nick){
          userEl.addClass('yourNick');
        }
        
        onlinelist.append($('<br />'));
      }
    }
  };
  
  // Add message to chat feed
  var addMessageToChat = function(data) {
    if(data !== undefined && data.txt !== undefined){
      
      var txt      = $('<span></span>');
      var nickEl   = $('<span></span>');
      var dateEl   = $('<time></time>');
      var date     = new Date(data.time);
      
      dateEl
      .attr('datetime', date)
      .attr('title', date)
      .text(date.toLocaleTimeString() + ' ')
      .appendTo(txt);
      
      nickEl
      .addClass('nick')
      .appendTo(txt);
      
      // If we got a system message, set nick to System and nick color to black
      if(data.type == 'sys-msg'){
        nickEl
        .text('System')
        .css('color', '#000000');
      }
      // Else if we got a sender add nick
      else if (data.sender && data.sender.length > 1) {
        nickEl
        .text(data.sender)
        .css('color', data.senderColor);
        
        if (user.nick == data.sender) {
          nickEl.addClass('yourNick');
        }
      }
      
      // If it's a msg with ':' add it
      if (data.type == 'sys-msg' || data.type == 'chat-msg' || data.type == 'private-msg' || data.type == 'notice-msg') {
        $('<span></span>')
        .text(':')
        .addClass('nick-pref')
        .appendTo(txt);
      }
      
      // If message got a color set color
      if (data.color && data.sender.length > 2) {
        txt.css('color', data.color);
      }
      
      // Find your nick and add yourNick class to it and take care of color-tags in text
      data.txt = markYourNick(data.txt);
      data.txt = data.txt.replace(/\[color=(.*)\](.*)\[\/color\]/gi, '<span style="color:$1;">$2</span>');
      
      // Finish text and add to chat feed
      txt
      .addClass(data.type)
      .html(txt.html() + ' ' + data.txt + '<br />');
      
      output.append(txt).scrollTop(output[0].scrollHeight);
    }
  };
  
  // Prepare message send by client to add to user's chat-feed
  var prepMessageToChat = function(type, txt, sender = '', senderColor = '', color = '') {
    addMessageToChat({
      time:        new Date(),
      type:        type,
      txt:         txt,
      sender:      sender,
      senderColor: senderColor,
      color:       color
    });
  }
  
  // Add history messages to chat feed
  var addHistoryToChat = function(log_history) {
    // History can't be empty
    if (log_history !== undefined) {
      // Loop-trough messages and add to message to chat feed
      for (var key in log_history) {
        // Message can't be empty
        if (log_history[key] !== undefined && log_history[key].txt !== undefined) {
          addMessageToChat(log_history[key]);
        }
      }
    }
  };
  
  // Add nick (or '/me ' or '/connect') to message field
  var addNickToMessage = function(that = '') {
    var msg = message.val();
    
    // If it's nick button that was clicked and we are offline add '/connect'
    if (that.id == 'nick' && that.text() == 'Offline') {
      msg = '/connect';
    }
    // If it's nick button or your nick that was clicked and we are online add '/me '
    else if($(this).hasClass('yourNick') || that.id == 'nick' && that.text() != 'Offline') {
      msg = '/me ' + msg;
    }
    // Otherwish add clicked nick
    else{
      msg = msg + ' ' + $(this).text();
    }
    
    message.val(msg);
  };
  
  // Mark your nick in message by adding yourNick class to it
  var markYourNick = function(txt) {
    return txt.trim().replace(new RegExp("(^|[\\*\\-\\s\\]])(" + user.nick + ")([\\[\\*\\-\\s]|$)", "gi"), '$1<span class="yourNick">' + user.nick + '</span>$3');
  };
  
  console.log('Everything is ready.'); 
});