require('dotenv').config()
const IO_SERVER_PORT = process.env.PORT || 3000;
const path = require('path');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

/*
const osc = require('node-osc');
var oscServer = new osc.Server(3333, '0.0.0.0');
oscServer.on("message", function (msg, rinfo) {
    let droneName = msg[0].replace('/','');
    let roomName = droneName + 'Receiver';
    stationNsp.in(roomName).emit('image', msg[1]);
});
*/

const droneNsp = io.of('/drone');
const stationNsp = io.of('/station');
const droneDict = {};
const roomRecord = {};

app.get('/', (req, res) => {
    let droneName = req.query['name']? req.query['name'] : 'drone';
    res.render('station', { droneName:  droneName });
});

/*
//TODO: do auth?
// middleware
io.use((socket, next) => {
  let token = socket.handshake.query.token;
  if (isValid(token)) {
    return next();
  }
  return next(new Error('authentication error'));
});
*/

droneNsp.on('connect', (socket) => {
    socket.on('register', (name) => {
        if(droneDict.hasOwnProperty(name)) {
            let i = 1;
            while(droneDict.hasOwnProperty(name + i)) {
                i++;
            }
            name = name + i;
        }
        droneDict[name] = socket.id;
        socket['name'] = name;
        if(socket.connected) socket.emit('name', name);
        stationNsp.emit('droneOnline', name);
        console.log(name + " is online");
    });

    socket.on('disconnect', () => {
        let name = socket['name'];
        if(name) delete droneDict[name];        
    });

    socket.on('image', (img) => {
        let roomName = socket['name'] + 'Receiver';
        stationNsp.in(roomName).emit('image', img);
    });
});

function getDroneSocket(name) {
    let id = droneDict[name];
    return droneNsp.connected[id];
}

stationNsp.on('connect', (socket) => {
    socket.on('receiveVideo', (name) => {
        let droneSocket = getDroneSocket(name);
        if(droneSocket && droneSocket.connected) {
            droneSocket.emit('command', 'startVideoStreaming');
            let roomName = name + 'Receiver';
            socket.join(roomName);
            if(roomRecord.hasOwnProperty(roomName)) {
                roomRecord[roomName].add(socket.id);
            }
            else {
                roomRecord[roomName] = new Set([socket.id]);
            }
        }
    }); 
    
    socket.on('disconnecting', () => {
        let rooms = Object.keys(socket.rooms);
        for(let i = 0;i < rooms.length;i++) {
            let roomName = rooms[i];
            if(roomRecord.hasOwnProperty(roomName)) {
                let clientSet = roomRecord[roomName];
                clientSet.delete(socket.id);
                if(clientSet.size == 0) {
                    let droneName = roomName.replace('Receiver','');
                    let droneSocket = getDroneSocket(droneName);
                    if(droneSocket && droneSocket.connected) droneSocket.emit('command', 'stopVideoStreaming');
                }
            }
        }
    });

});

server.listen(IO_SERVER_PORT, () => {
    console.log('server listening at port %d', server.address().port);
});

process.on('SIGTERM', function() {
    console.log('Received SIGTERM, shutting down server');
    server.close();
    process.exit(0);
});
