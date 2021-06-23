const WebSocket = require('ws')
const uuid = require('uuid')
var Twitter = require('twitter');


var client = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
});



//ポート8000番でサーバーを作成する
console.log('Ready. On Minecraft chat, type /connect localhost:8000')
const wss = new WebSocket.Server({ port: 8000 })

//マイクラ側から接続があった場合(/connect サーバーのIPアドレス:8000)
wss.on('connection', socket => {
  console.log('Connected')
  const sendQueue = []        // Queue of commands to be sent
  const awaitedQueue = {}     // Queue of responses awaited from Minecraft

  //すべてのチャットメッセージを送信するようにMinecraftに指示。 Minecraftの起動後に1回必要。
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

  //マイクラからメッセージが送られてきたとき
  socket.on('message', packet => {
    const msg = JSON.parse(packet)
    //それが、チャットの時
    if (msg.body.eventName === 'PlayerMessage') {
      
      //チャットの内容がtweet 何かの文字列
      const match = msg.body.properties.Message.match(/^tweet /u)
      if (match){
        //msg.body.properties.Message.matchからtweetを削除
        const replaced = msg.body.properties.Message.replace('tweet', ' ')
        //関数の実行
        tweet_in_mc(replaced)
      }
    }
    //コマンドリスポンスを受け取ったとき
    if (msg.header.messagePurpose == 'commandResponse') {
      if (msg.header.requestId in awaitedQueue) {
        if (msg.body.statusCode < 0)
          console.log(awaitedQueue[msg.header.requestId].body.commandLine, msg.body.statusMessage)
        delete awaitedQueue[msg.header.requestId]
      }
    }
   
    let count = Math.min(100 - Object.keys(awaitedQueue).length, sendQueue.length)
    for (let i = 0; i < count; i++) {
   
      let command = sendQueue.shift()
      socket.send(JSON.stringify(command))
      awaitedQueue[command.header.requestId] = command
    }
   
  })

  //コマンドをマイクラへ送る
  function send(cmd) {
    const msg = {
      "header": {
        "version": 1,
        "requestId": uuid.v4(),     
        "messagePurpose": "commandRequest",
        "messageType": "commandRequest"
      },
      "body": {
        "version": 1,
        "commandLine": cmd,         
        "origin": {
          "type": "player"          
        }
      }
    }
    sendQueue.push(msg)            
  }

  //ツイートする関数
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
//接続が切断された時のログ
  socket.on('close', packet => {
    const msg = JSON.parse(packet)

    console.log("Disconnected");

  })
})
