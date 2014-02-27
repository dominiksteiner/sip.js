var WebSocket = require('faye-websocket');
var sip = require('sipws');
var os = require('os');
var headers   = {Origin: 'http://faye.jcoglan.com'};
var WSProxy = require('sipws/websocket-proxy');

function getWsUrl(host) {
  var port      = process.argv[2] || 8060,
    secure    = process.argv[3] === 'ssl',
    scheme    = secure ? 'wss' : 'ws';

  return scheme + '://'+host+':' + port + '/';
}

function rstring() { return Math.floor(Math.random()*1e6).toString(); }

function newUUID() {
  var UUID =  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
  return UUID;
}

var instanceId = newUUID();
var viaHost = rstring()+".invalid";
var branch = rstring();
var host = "cbridge1.exarionetworks.com";
var contactUser = rstring();
var websocket = {address:'0.0.0.0', port:5063};

function createRegisterMsg(user) {
  var contact = "<sip:"+contactUser+"@"+viaHost+";transport=ws>";
  contact += ';reg-id=1';
  contact += ';+sip.instance="<urn:uuid:'+ instanceId +'>"';
  contact += ';expires=600';

  var msg = {
    method: 'REGISTER',
    uri: 'sip:'+host,
    headers: {
      via: [{version: "2.0", protocol: 'WS', host: viaHost, params: {branch: branch}}],
      to: {uri: 'sip:'+user+'@'+host},
      from: {uri: 'sip:'+user+'@'+host, params: {tag: rstring()}},
      'call-id': rstring(),
      cseq: {method: 'REGISTER', seq: Math.floor(Math.random() * 1e5)},
      Contact: contact  // if your call doesnt get in-dialog request, maybe os.hostname() isn't resolving in your ip address
    }
  }
  return sip.stringify(msg);
}

//var proxy = new WSProxy(websocket, route);
//console.log("Listening for WebSocket connections on: "+websocket.address+":"+websocket.port);

function route(proxy, req, rem) {
  var client = 'WS://'+rem.address+':'+rem.port;
  console.log('Client request from '+client);
  var msg = sip.stringify(req);
  console.log(msg);
//	req.uri = req.headers.contact[0].uri;

  /* Uncomment next line to force TCP */
//	req.uri += ';transport=tcp';

//  if(req.method === 'REGISTER') {
//    var user = sip.parseUri(req.headers.to.uri).user;
//    var contact = {contact: req.headers.contact, remote: rem};
//    var contactUser = sip.parseUri(req.headers.contact[0].uri).user;
//    console.log('Registering user '+user+' with contact '+contactUser);
//    contacts[user] = contact;
//    contacts[contactUser] = contact;
//    var rs = sip.makeResponse(req, 200, 'OK');
//    console.log('Response : '+rs.status);
//    rs.headers.to.tag = Math.floor(Math.random() * 1e6);
//
//    // Notice  _proxy.send_ not sip.send
//    proxy.send(rs);
//  }
//  else {
//    var user = sip.parseUri(req.uri).user;
//    console.log('Looking for user : '+user);
//    if(contacts[user]) {
//      req.uri = sip.parseUri(contacts[user].contact[0].uri);
//      req.uri.host = contacts[user].remote.address;
//      req.uri.port = contacts[user].remote.port;
//
//      proxy.send(sip.makeResponse(req, 100, 'Trying'));
//
//      console.log('Sending request for user '+user+' to '+req.uri);
//      proxy.send(req);
//    }
//    else {
//      console.log('User '+user+" not found");
//      proxy.send(sip.makeResponse(req, 404, 'Not Found'));
//    }
//  }
}

//Where to bind the SIP tranport
//var sipbind = {address:'0.0.0.0', port:5064};

//Create SIP transport
//var trans = sip.create({tcp:true, udp:false, address:sipbind.address, port:sipbind.port},
//		handler);

//console.log("SIP transport bound on: "+sipbind.address+":"+sipbind.port);

var client = new WebSocket.Client(getWsUrl('load-wrs1.exarionetworks.com'), ['sip'], {headers: headers});
var client2 = new WebSocket.Client(getWsUrl('load-wrs2.exarionetworks.com'), ['sip'], {headers: headers});
console.log('Connecting websocket client to ' + client.url);
console.log('Connecting websocket client to ' + client2.url);

//function handler(req, rem) {
//  var client = rem.address+':'+rem.port;
//  console.log('UDP/TCP request received from : '+client);
//  var msg = sip.stringify(req);
//  console.log(msg);
//  console.log("Sending to wrs2");
//  client.send(msg);
//}

client.onopen = function(event) {
  console.log('connected to wrs1');
  var registerMsg = createRegisterMsg('1000');
  console.log('registering to  wrs1 : '+registerMsg);
  this.send(registerMsg);
};
client.onmessage = function(event) {
  if(event.data.toString().match(/CSeq:.*REGISTER/i)) {
    console.log('ignoring REGISTER response from wrs1 : ' + event.data.toString());
    return;
  }
  console.log('TO WRS2 : ', event.data.toString());
  client2.send(event.data.toString());
  // ws.close(1002, 'Going away');
};
client.onclose = function(event) {
  console.log('close', event.code, event.reason);
};

client2.onopen = function(event) {
  console.log('connected to wrs2');
//  var registerMsg = createRegisterMsg('bbbbb');
//  console.log('register : '+registerMsg);
//  this.send(registerMsg);
};
client2.onmessage = function(event) {
  var req = event.data.toString();
  req = req.replace(/(Contact:.*@)(.*)(:.*)/, '$1'+os.hostname()+'$3');
  console.log('TO WRS1', req);

  client.send(req);
  // ws.close(1002, 'Going away');
};
client2.onclose = function(event) {
  console.log('close', event.code, event.reason);
};

