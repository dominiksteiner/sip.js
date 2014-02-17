var sip = require('sipws');
var WSProxy = require('sipws/websocket-proxy');
var util = require('sys');

// Where to listen for WebSocket connections
var websocket = {address:'0.0.0.0', port:5062};
// Where to bind the SIP tranport
//var sipbind = {address:'0.0.0.0', port:5060};

// Create SIP transport
//var trans = sip.create({tcp:true, udp:true, address:sipbind.address, port:sipbind.port},
//		handler);

// Create WebSocket proxy
var proxy = new WSProxy(websocket, route);

var contacts = {};

console.log("Listening for WebSocket connections on: "+websocket.address+":"+websocket.port);
//console.log("SIP transport bound on: "+sipbind.address+":"+sipbind.port);


function handler(req, rem) {
	// Incoming out-of-dialog request from remote SIP UAC
	// ...
	// which we aren't supporting right now
}

function route(proxy, req, rem) {
	var client = 'WS://'+rem.address+':'+rem.port;
	console.log('Client request ['+req.method+' '+req.uri+'] from '+client);
//	req.uri = req.headers.contact[0].uri;

	/* Uncomment next line to force TCP */
//	req.uri += ';transport=tcp';

  if(req.method === 'REGISTER') {
    var user = sip.parseUri(req.headers.to.uri).user;
    var contact = {contact: req.headers.contact, remote: rem};
    var contactUser = sip.parseUri(req.headers.contact[0].uri).user;
    console.log('Registering user '+user+' with contact '+contactUser);
    contacts[user] = contact;
    contacts[contactUser] = contact;
    var rs = sip.makeResponse(req, 200, 'OK');
    console.log('Response : '+rs.status);
    rs.headers.to.tag = Math.floor(Math.random() * 1e6);

    // Notice  _proxy.send_ not sip.send
    proxy.send(rs);
  }
  else {
    var user = sip.parseUri(req.uri).user;
    console.log('Looking for user : '+user);
    if(contacts[user]) {
      req.uri = sip.parseUri(contacts[user].contact[0].uri);
      req.uri.host = contacts[user].remote.address;
      req.uri.port = contacts[user].remote.port;

      proxy.send(sip.makeResponse(req, 100, 'Trying'));

      console.log('Sending request for user '+user+' to '+req.uri);
      proxy.send(req);
    }
    else {
      console.log('User '+user+" not found");
      proxy.send(sip.makeResponse(req, 404, 'Not Found'));
    }
  }


}



