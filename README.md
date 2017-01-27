Chibi's Node.js Chatserver, a websocket chat
============================================

A Websocket and Node.js server and webclient for chat between users,
got some irc-like comands as '/me', '/msg', '/nick', '/slap', '/connect', '/quit' and more..


By Rasmus Berg, rasmus.berg@chibidesign.se
Homepage: http://www.student.bth.se/~rabe13/dbwebb-kurser/javascript/me/kmom06/playground/kmom6_websocket-chat/ (Server is probly down, but you can use your own)

License
------------------

This software is free software and carries a MIT license.


Use of external libraries
-----------------------------------

The following external modules are included:

### jQuery
* Homepage: http://jquery.com/
* Version: v3.1.1 (slim)
* License: MIT license

The following external modules are excluded but will be needed for run this classes:

### Node.js
* Homepage: http://nodejs.org/
* Version: v0.10.28 
* License: MIT license and third-party modules has own licenses

### WebSocket-Node
* Homepage: https://github.com/theturtle32/WebSocket-Node
* Version: v1.0.3
* License: Apache License, Version 2.0


Install instructions
--------------------

### 1. First you will need to install nodejs and got that runing, follow thier instructions.

### 2. Then get WebSocket-Node, fallow thier instructions.

### 3. Has done this right just add files where you want the chat client want to be and 'server/chatserver.js' you probly should put where node is runing.

### 4. Changes recomend and sometimes needed in chatserver.js

* If needed change port on row 3.
* Highly recomend to add allowed domains to connect to server on row 8.

### 5. Run server by in nodejs's command promp write 'node server/chatserver.js' or what source your chatserver.js is from where node is runing.

### 6. If server is up and runing is only to add address to chatserver.js as at, if it's local it should be 127.0.0.1:[port]


History
-----------------------------------

###History for Database TextContent for ANAX-MVC 

v1.0.5 (2017-01-27)

* First release on Github.

v1.0.0 (2017-01-26)

* First stable version

```
Copyright (c) 2017 Rasmus Berg, rasmus.berg@chibidesign.se
```
