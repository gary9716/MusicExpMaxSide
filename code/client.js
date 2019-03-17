require('dotenv').config();
let serverURL = process.env.SERVER_URL || 'localhost:8080';
if(process.env.USE_HTTPS) {
	serverURL = "https://" + serverURL;
}
else {
	serverURL = "http://" + serverURL;
}
const Max = require("max-api");
function maxlog(str) {
	if (Max.post) {
		Max.post(str);
	} else {
		console.log(str);
	}
}
const io = require('socket.io-client');
const masterSocket = io(serverURL + '/master');

masterSocket.on('connect', () => {
	maxlog('io socket server connected');
})

masterSocket.on('error', (err) => {
	maxlog('error:' + err);
})

if(Max.addHandler)
	Max.addHandler("send", (...args) => {
		//maxlog("send args: " + args);
		if(args.length == 2) {
			masterSocket.emit(args[0], args[1]);
		}
	});

if (Max.outlet) Max.outlet("ready");