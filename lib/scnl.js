//simple scnl object
function Scnl(scnl){
  this.sta = scnl.sta;
  this.chan = scnl.chan;
  this.net = scnl.net;
  this.loc = scnl.loc;
  this.stop= Date.now();
  this.start = this.stop -1000;
  this.lastBufStart = this.start;
}

module.exports = Scnl;