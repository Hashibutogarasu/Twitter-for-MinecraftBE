const WebSocket = require('ws')
const uuid = require('uuid')
var Twitter = require('twitter');


var client = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
});



// Create a new websocket server on port 3000
console.log('Ready. On Minecraft chat, type /connect localhost:3000')
const wss = new WebSocket.Server({ port: 8000 })

// On Minecraft, when you type "/connect localhost:3000" it creates a connection
wss.on('connection', socket => {
  console.log('Connected')
  const sendQueue = []        // Queue of commands to be sent
  const awaitedQueue = {}     // Queue of responses awaited from Minecraft

  // Tell Minecraft to send all chat messages. Required once after Minecraft starts
  socket.send(JSON.stringify({
    "header": {
      "version": 1,                     // We're using the version 1 message protocol
      "requestId": uuid.v4(),           // A unique ID for the request
      "messageType": "commandRequest",  // This is a request ...
      "messagePurpose": "subscribe"     // ... to subscribe to ...
    },
    "body": {
      "eventName": "PlayerMessage"      // ... all player messages.
    },
  }))

  // When MineCraft sends a message (e.g. on player chat), act on it.
  socket.on('message', packet => {
    const msg = JSON.parse(packet)
    // If this is a chat window
    if (msg.body.eventName === 'PlayerMessage') {
      // ... and it's like "pyramid 10" (or some number), draw a pyramid
      
      const match = msg.body.properties.Message.match(/^tweet /u)
      if (match){
        const replaced = msg.body.properties.Message.replace('tweet', ' ')
        tweet_in_mc(replaced)
      }
    }
    // If we get a command response
    if (msg.header.messagePurpose == 'commandResponse') {
      // ... and it's for an awaited command
      if (msg.header.requestId in awaitedQueue) {
        // Print errors (if any)
        if (msg.body.statusCode < 0)
          console.log(awaitedQueue[msg.header.requestId].body.commandLine, msg.body.statusMessage)
        // ... and delete it from the awaited queue
        delete awaitedQueue[msg.header.requestId]
      }
    }
    // Now, we've cleared all completed commands from the awaitedQueue.
    // We can send new commands from the sendQueue -- up to a maximum of 100.
    let count = Math.min(100 - Object.keys(awaitedQueue).length, sendQueue.length)
    for (let i = 0; i < count; i++) {
      // Each time, send the first command in sendQueue, and add it to the awaitedQueue
      let command = sendQueue.shift()
      socket.send(JSON.stringify(command))
      awaitedQueue[command.header.requestId] = command
    }
    // Now we've sent as many commands as we can. Wait till the next PlayerMessage/commandResponse
  })

  // Send a command to MineCraft
  function send(cmd) {
    const msg = {
      "header": {
        "version": 1,
        "requestId": uuid.v4(),     // Send unique ID each time
        "messagePurpose": "commandRequest",
        "messageType": "commandRequest"
      },
      "body": {
        "version": 1,
        "commandLine": cmd,         // Define the command
        "origin": {
          "type": "player"          // Message comes from player
        }
      }
    }
    sendQueue.push(msg)            // Add the message to the queue
  }

  // Draw a pyramid of size "size" around the player.
  function tweet_in_mc(content) {

    send(`say tweeted:${content}`)

    client.post('statuses/update', {status: content}, function(error, tweet, response){
        if(!error) {
            console.log("tweeted:"+tweet.text);
            
        }else {
            console.log('error');
            send(`say tweet error`)
        }
    });

  }

  socket.on('close', packet => {
    const msg = JSON.parse(packet)

    console.log("Disconnected");

  })
})