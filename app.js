/*  Pulled out Pub side only with config & lib  */
/*  Redis to be removed                         */

//Connect to Earthworm waveserver to retrieve traceBuf2 packages for a given SCNL and time window 
//use redis sub/pub design to broadcast to listening node app(s)
//call with following format 
//ALL EPOCH TIMES ARE MILLISECONDS!!!!

var Waveserver = require("./lib/waveserver.js");
var PublishScnls = require("./config/hawks3ZPub.conf.js"); //config file
  
var redis = require('redis');

var scnlIndex = 0;

//get configs
var conf = new PublishScnls();
var redisKey=conf.key;
var scnls = conf.scnls;
var waveHost = conf.waveHost;
var wavePort = conf.wavePort;
var wsPort = process.env.PORT || conf.wsPort;

var daemon = true;
//for testing
var lastEndtime = Date.now();

var util = require('util');
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var http = require('http');
var express = require('express');

// Start Express
var app = express();
app.use(express.static(__dirname + '/public'));
var server = http.createServer(app);
var clientport = process.env.PORT || 9999;
server.listen(clientport);

console.log("WebSocket started on port:" + clientport);

var allSocks = {};  // associative array to store connections ; tried [] array but 'splice' doesn't seem to work.
connectionIDCounter = 0;

var wsSrc;
var wsDst = new WebSocketServer({server: server});

wsDst.broadcast = function(data) {  // broadcast data to all connnections
  for(var key in allSocks) {
    if(allSocks[key].readyState == 1) {
      allSocks[key].send(new Buffer(data, "base64"));
    }
  }
};

wsDst.on('connection', function(ws) {  // on connecting 

  ws.id = connectionIDCounter;  // set ID to counter
  ws.IP = ws._socket.remoteAddress + ':' + ws._socket.remotePort;
  allSocks[connectionIDCounter] = ws; // store socket in array object
  connectionIDCounter++; // increment counter
  
  printClientStatus(ws, 'Connected');
  printClientCount();
  
  ws.on('close', function() {
    // Remove disconnected client from the array.
    delete allSocks[ws.id];
    printClientStatus(ws, 'Disconnected');
    printClientCount();
  });

  ws.on('error', function(error) { 
   console.log(error); 
  });

});

function wsStart(){  // put the source websocket logic in a function for easy reconnect

  wsSrc = new WebSocket(config.sourceSocket);
  wsSrc.on('open', function() {
    printSourceStatus('Connected');
  });

  wsSrc.on('message', function(data, flags) {
    var message = new Buffer(data).toString('base64');
    
  });

  wsSrc.on('close', function(ws) {
    printSourceStatus('Disconnected');
    // try to reconnect
    setTimeout(wsStart(), 5000);
  });

  wsSrc.on('error', function(error) { 
    console.log(error); 
    setTimeout(wsStart(), 5000); 
  });
}

function getData(chan){
  //create connection then attach listeners 
  // header: fires when getscnlraw header is processed
  //data: fires when data is buffered
  //close fires on waverserver closes connection

  var ws = new Waveserver(waveHost, wavePort, chan, Date.now());
  ws.connect();

  //parse getScnlRaw flag and decide whether to disconnect or continue
  ws.on('header', function(header){
    //console.log("Wave header:" + header.flag);
    responseHeader = header;
    if (header.flag ==="FR" && daemon){ //most common error missed by current data not in ws yet
      ws.disconnect();
      console.log("Wave ERROR: FR & daemon");
    }else if(header.flag === 'FB'){
      console.log("Wave ERROR: there has been a terrible error of some sort or other.");
      ws.disconnect();
    }
  });

  ws.on('data', function(message){
    var chan = findChan(message);
    //console.log("Wave data: " + message);
    if(message.starttime > chan.start){
      chan.start = message.starttime;
      //pub.publish(redisKey, JSON.stringify(message));
      sendData(JSON.stringify(message));
    }
  
  });

  function sendData(data) {
      console.log("Sending data:" + data);
      console.log("from scnl:" + message.sta + ":" + message.chan + ":" + message.net + ":" + message.loc);
      // console.log(chan.sta + " " + (lastEndtime - message.starttime));
      lastEndtime = message.endtime;
      console.log("packet length " + message.data.length);
      console.log("elapsed time = " + (message.endtime - message.starttime));
  }

  ws.on('error', function(error){
    console.log("Wave Error (closed): " + error); //error
  });
  
  //called when all data are processed or socket timesout
  //keep going when running as daemon
  ws.on("close", function(){
    setTimeout(function(){
      scnlIndex ++;
      scnlIndex = scnlIndex == scnls.length ? 0 : scnlIndex;
      var chan = scnls[scnlIndex];
      getData(chan);
    }, 500);
  });

}

//the first call
var end = Date.now();
getData(scnls[0]);

process.on('uncaughtException', function(err) {
  // try to reconnect
  if(err.code == 'ECONNREFUSED'){
    setTimeout(wsStart(), 5000);
  }
});

/* FUNCTIONS */

//find channel object based on returned message
//needed to track each channels last start
function findChan(msg){
  var chan;
  for(var i=0; i < scnls.length; i++){
    var c = scnls[i];
    if(c.sta == msg.sta && c.chan == msg.chan && c.net == msg.net && c.loc == msg.loc){
     chan = c;
     break;
    }
  }
  return chan;
}

function printClientCount() {
  console.log('Total Connected Clients:  ' + this.Object.size(allSocks));
  console.log('Total Clients (lifetime): ' + connectionIDCounter);
}

function printClientStatus(ws, status) {
  console.log(new Date() + ' Client ' + status + ' id: ' + ws.id + ' IP: '+ ws.IP);
}

function printSourceStatus(status) {
  console.log(new Date() + ' ' + status + ' from: ' + config.sourceSocket);
}

// prototype to return size of associative array
Object.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
  }
  return size;
};
