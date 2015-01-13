//remove example from name before using this file
//all conf files will be gitignored
var Scnl = require(__dirname + '/../lib/scnl.js');


function PublishScnls(){
  
  //uniquie name the subscriber will subscribe to 
  this.key = "hawks3Z";
  this.waveHost = "import02.ess.washington.edu";
  this.wavePort = 16022;
  this.redisHost = "localhost";
  this.redisPort = 6379;
  //all channels you want to publish to this key
  this.scnls = [
                new Scnl({sta: 'HWK1', chan: 'HNZ', net: 'UW', loc: '--'}),
                new Scnl({sta: 'HWK2', chan: 'HNZ', net: 'UW', loc: '00'}),
                new Scnl({sta: 'HWK3', chan: 'HNZ', net: 'UW', loc: '--'})
                ];
             
}

module.exports = PublishScnls;