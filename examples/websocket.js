var sip = require('sipws');
var WSProxy = require('sipws/websocket-proxy');
var util = require('sys');
var restify = require('restify');
var fs = require('fs');

var ip_addr = '0.0.0.0';
var port    =  '5063';

var server = restify.createServer({
  name : "sipws-webservice"
  // enable for https support
//  ,key: fs.readFileSync('/var/exario/ssl/domain_key_dominik.exarionetworks.com.pem')
//  ,certificate: fs.readFileSync('/var/exario/ssl/domain_cert_dominik.exarionetworks.com.pem')
});

server.listen(port ,ip_addr, function(){
  console.log('%s listening at %s ', server.name , server.url);
});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

var PATH = '/registrations'
server.get({path : PATH +'/:user' , version : '0.0.1'} , findRegistration);

var Sequelize = require('sequelize')
  , sequelize = new Sequelize('sipws', 'root', 'root', {
    dialect: "mysql", // or 'sqlite', 'postgres', 'mariadb'
    port:    3306 // or 5432 (for postgres)
  });

sequelize
  .authenticate()
  .complete(function(err) {
    if (!!err) {
      console.log('Unable to connect to the database:', err)
    } else {
      console.log('Connection has been established successfully.')
    }
  });

var Registration = sequelize.define("Registration", {
  "remote_address": Sequelize.STRING,
  "remote_port": Sequelize.INTEGER,
  "contact_uri": Sequelize.STRING,
  "contact_user": Sequelize.STRING,
  "to_user": Sequelize.STRING
}, {
  tableName: 'registrations', // this will define the table's name
  timestamps: false           // this will deactivate the timestamp columns
  });

sequelize
  .sync()
  .complete(function(err) {
    if (!!err) {
      console.log('An error occurred while create the table:', err)
    } else {
      console.log('It worked!')
    }
  })

// Where to listen for WebSocket connections
var websocket = {address:'0.0.0.0', port:5062};
// Where to bind the SIP tranport
//var sipbind = {address:'0.0.0.0', port:5060};

// Create SIP transport
//var trans = sip.create({tcp:true, udp:true, address:sipbind.address, port:sipbind.port},
//		handler);

// Create WebSocket proxy
var proxy = new WSProxy(websocket, route);

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
    var toUser = sip.parseUri(req.headers.to.uri).user;
    var contactUri = req.headers.contact[0].uri;
    var contactUser = sip.parseUri(contactUri).user;
    console.log('Registering user '+toUser+' with contact '+contactUser);
    Registration
      .findOrCreate(Sequelize.or(
      { contact_user: contactUser }, { to_user: toUser }
    ))
      .success(function(registration, created) {
        console.log((created ? 'Persisted' : 'Updated')+' registration for '+contactUri+' at '+rem.address+':'+rem.port);
        registration.remote_address = rem.address;
        registration.remote_port = rem.port;
        registration.contact_uri = contactUri;
        registration.contact_user = contactUser;
        registration.to_user = toUser;
        registration.save();

        var rs = sip.makeResponse(req, 200, 'OK');
        console.log('Response : '+rs.status);
        rs.headers.to.tag = Math.floor(Math.random() * 1e6);

        // Notice  _proxy.send_ not sip.send
        proxy.send(rs);
      });
  }
  else {
    var user = sip.parseUri(req.uri).user;
    console.log('Finding registration for user : '+user);
    Registration
      .find({ where:  Sequelize.or(
      { contact_user: user },
      { to_user: user }
    ) })
      .complete(function(err, registration) {
        if (!!err) {
          console.log('An error occurred while searching for '+user+':', err)
        } else if (!registration) {
          console.log('No registration for '+user+' has been found.')
          proxy.send(sip.makeResponse(req, 404, 'Not Found'));
        } else {
          req.uri = sip.parseUri(registration.contact_uri);
          req.uri.host = registration.remote_address;
          req.uri.port = registration.remote_port;

          proxy.send(sip.makeResponse(req, 100, 'Trying'));

          console.log('Sending request for user '+user+' to '+req.uri.host+":"+req.uri.port);
          proxy.send(req);
        }
      });
  }
}

function findRegistration(req, res , next){
  var user = req.params.user;
  res.setHeader('Access-Control-Allow-Origin','*');
  Registration
    .find({ where:  Sequelize.or(
    { contact_user: user },
    { to_user: user }
  ) })
    .complete(function(err, registration) {
      if(err){
        return next(err);
      }
      else if (!registration) {
        console.log('No registration for '+user+' has been found.')
        res.send(404);
        return next();
      } else {
        res.send(200, registration);
        return next();
      }
    });
}


