var WebSocket = require('ws');
var wshandler = require("./wshandler");
var config = require('./config');

WebSocket.prototype.sendJson = function(msgid, v) {
    var ret
    var typ = typeof(v)
    if (typ == "undefined") {
        return;
    } else if (typ == "object") {
        ret = {id: msgid, body: v}
    } else if (v == 0) {
        ret = {id: msgid}
    } else {
        ret = {id: msgid, err: {code:v}}
    }
    ret = JSON.stringify(ret);
    console.log("Send: "+ret);
    this.send(ret)
}

var app = {}
module.exports = app;

app.start = function() {
    var li = new WebSocket.Server({
        port: config.port,
        perMessageDeflate: false 
    }, function() {
        console.log("WS listening on port " + config.port);
    });

    li.on('connection', function(ws) {
        var sock = ws._socket;
        var addr = sock.remoteAddress+":"+sock.remotePort;
        console.log("WS conn: "+addr);
    
        function close(error) {
            console.log("WS conn close: "+addr+" "+error);
            wshandler.logout(ws)
        }

        ws.on('message', function(data) {
            console.log("Msg: "+data);
            var msg = JSON.parse(data);
            var h = wshandler[msg.id];
            if (!h) {
                console.log("Msg invalid: "+msg.id);
                return;
            }
            var ret = h(ws, msg.body, msg.id);
            if (ret) {
                ws.sendJson(msg.id, ret);
            }
        });

        ws.on('error', close);
        ws.on('close', close);
    });

    li.on('error', function (e) {
        console.log("WS listen error: "+e.code);
        process.exit(1); 
    });
}
