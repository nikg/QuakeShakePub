/*  Pulled out Pub side only with config & lib  */
/*  Redis to be removed                         */

//Connect to Earthworm waveserver to retrieve traceBuf2 packages for a given SCNL and time window 
//use redis sub/pub design to broadcast to listening node app(s)
//call with following format 
//ALL EPOCH TIMES ARE MILLISECONDS!!!!

console.log("path=" + __dirname + "./lib/waveserver");

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
var redisPort = conf.redisPort;
var redisHost = conf.redisHost;

var  daemon = true;

var pub = redis.createClient(redisPort, redisHost);

console.log("To subscribe to this channel start quakeShakeSub with:");
console.log("node server/quakeShakeSub channel=" + redisKey + " port=n redisHost=thishost redisPort=" + redisPort);

//for testing
var lastEndtime = Date.now();

function getData(chan){
  //create connection then attach listeners 
  // header: fires when getscnlraw header is processed
  //data: fires when data is buffered
  //close fires on waverserver closes connection

  var ws = new Waveserver(waveHost, wavePort, chan, Date.now());
  ws.connect();
  //parse getScnlRaw flag and decide whether to disconnect or continue
  ws.on('header', function(header){
    console.log("ws header:" + header.flag);
    responseHeader = header;
    if (header.flag ==="FR" && daemon){ //most common error missed by current data not in ws yet
      ws.disconnect();
      console.log("FR & daemon");
    }else if(header.flag === 'FB'){
      console.log("there has been a terrible error of some sort or other.");
      ws.disconnect();
    }
  
  });
  ws.on('data', function(message){
    var chan = findChan(message);
    console.log("ws data: " + message);
    if(message.starttime > chan.start){
      chan.start = message.starttime;
      pub.publish(redisKey, JSON.stringify(message));
      console.log("from scnl:" + message.sta + ":" + message.chan + ":" + message.net + ":" + message.loc);
      // console.log(chan.sta + " " + (lastEndtime - message.starttime));
      lastEndtime = message.endtime;
      console.log("packet length " + message.data.length);
      console.log("elapsed time = " + (message.endtime - message.starttime));
    }
  
  });

  ws.on('error', function(error){
    // console.log("on the client error: ");// + error);
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

//the first call
var end = Date.now();
getData(scnls[0]);