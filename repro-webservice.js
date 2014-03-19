var http = require('http');
var restify = require('restify');
var fs = require('fs');

var client = http.createClient(8080, 'proxy.exarionetworks.com');
var username = 'admin';
var password = process.argv[2];
var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
var header = {'Host': 'proxy.exarionetworks.com', 'Authorization': auth};

var server = restify.createServer({
  name : "repro-webservice"
  // enable for https support
//  ,key: fs.readFileSync('/var/exario/ssl/domain_key_dominik.exarionetworks.com.pem')
//  ,certificate: fs.readFileSync('/var/exario/ssl/domain_cert_dominik.exarionetworks.com.pem')
});

var ip_addr = '0.0.0.0';
var port    =  process.argv[3] || '8080';

server.listen(port ,ip_addr, function(){
  console.log('%s listening at %s ', server.name , server.url);
});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

var PATH = '/registrations'
server.get({path : PATH +'/:user' , version : '0.0.1'} , findRegistration);
server.put({path : PATH +'/:user' , version : '0.0.1'} , addRegistration);


function addRegistration(req, res , next){
  var user = req.params.user;
  res.setHeader('Access-Control-Allow-Origin','*');
  addUser(user, function(added){
    if (!added) {
      console.log(user+' NOT added');
      res.send(404);
      return next();
    } else {
      console.log(user+' added successfully');
      res.send(200, {isAdded: true});
      return next();
    }
  });
}

function findRegistration(req, res , next){
  var user = req.params.user;
  res.setHeader('Access-Control-Allow-Origin','*');
  isUserRegistered(user, function(isRegistered){
    if (!isRegistered) {
      console.log(user+' NOT registered');
      res.send(404);
      return next();
    } else {
      res.send(200, {isRegistered: true});
      return next();
    }
  });
}


function addUser(user, callback) {
  var request = client.request('GET', '/addUser.html?user='+user+'&domain=broadsoftlabs.com&password=&name=&email=&submit=Add', header);
  request.end();
  var responseBody;
  request.on('response', function (response) {
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
//      console.log(chunk);
      responseBody += chunk;
    });
    response.on('end', function () {
      var userAdded = responseBody.indexOf('<p><em>Added:</em> '+user+'@broadsoftlabs.com</p>') !== -1;
      callback(userAdded);
    });
  });

}

function isUserRegistered(user, callback) {
  var request = client.request('GET', '/registrations.html', header);
  request.end();
  var responseBody;
  request.on('response', function (response) {
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      console.log(chunk);
      responseBody += chunk;
    });
    response.on('end', function () {
      var userRegistered = responseBody.indexOf('<td>sip:'+user+'@broadsoftlabs.com</td>') !== -1;
      callback(userRegistered);
    });
  });
}

