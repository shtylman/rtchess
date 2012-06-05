// builtin
var path = require('path');

// 3rd party
var express = require('express');
var hbs = require('hbs');
var log = require('book').default();
var socket_io = require('socket.io');
var script = require('script');

// local
var Room = require('./lib/room');

// true when we are running in production
var kProduction = process.env.NODE_ENV === 'production';

// static assets and view locations
var asset_dir = path.join(__dirname, 'static');
var view_dir = path.join(__dirname, 'views');

var app = express();

app.set('views', view_dir);
app.set('view engine', 'hbs');
app.set('view options', {
    layout: true,
    cache: kProduction
});

/// handlebars blocks
var blocks = {};
hbs.registerHelper('block', function(name) {
    var block = (blocks[name] || []).join('\n');
    blocks[name] = [];
    return block;
});

hbs.registerHelper('extend', function(name, context) {
    var block = blocks[name];
    if (!block) {
        block = blocks[name] = [];
    }

    block.push(context(this));

    // returns nothing since the body goes into another placeholder
    return '';
});

app.use(require('connect-less')({
    src: asset_dir,
    compress: kProduction
}));

var bundle = script.bundle(__dirname + '/lib/client.js');
app.use('/js/room.js', bundle.middleware({
    // age in milliseconds of the resource
    max_age: 0,
    // if true, will cache the bundle in memory
    cache: kProduction,
    // if true, will compress with uglify-js (you will need to install it)
    compress: kProduction,
}));

if (kProduction) {
    // setup javascript minification
    app.use(require('minj').middleware({ src: asset_dir }));

    // memory cache
    app.use(express.staticCache());
}

app.use(express.static(asset_dir));
app.use(express.bodyParser());

// some useful locals
app.use(function(req, res, next) {
    res.locals.kProduction = kProduction;
    next();
});

app.use(app.router);

app.use(function(err, req, res, next) {
    if (err instanceof NotFound) {
        return res.send(404);
    }

    log.error(err);

    if (!kProduction) {
        return res.send(err.message + '\n' + err.stack);
    }

    // in production, just log log the error and display 500 page
    return res.send(500);
});

var server = app.listen(3000, function() {
    log.info('server running on port ' + server.address().port);
});

var io = socket_io.listen(server, {
    'log level': -1
});

server.on('close', function() {
    log.info('server no longer active');
});

// all of the available rooms
// room id -> Room object
var rooms = {};

/// routes!

app.get('/', function(req, res, next) {
    return res.render('index', {
        title: 'Real-Time Chess'
    });
});

app.get('/new_room', function(req, res, next) {
    var room_id = randomString(10);

    // room will be created when we try to go to it
    return res.redirect('/r/' + room_id);
});

app.get('/join_random', function(req, res, next) {
    var id;

    function redirect_to(room) {
        return res.redirect('/r/' + room.id);
    }

    // look for any room with a player waiting
    for (var id in rooms) {
        var room = rooms[id];
        if (room.num_players() === 1) {
            return redirect_to(room);
        }
    }

    // any room with watched (we assume they may sit)
    for (var id in rooms) {
        var room = rooms[id];
        if (room.num_peers() > 0) {
            return redirect_to(room);
        }
    }

    // no viable room, just make a new room
    return res.redirect('/new_room');
});

app.get('/r/:room_id', function(req, res, next) {
    var room_id = req.param('room_id');

    // TODO verify room id format?
    if(!rooms[room_id]) {
        // add new socket namespace for this room
        var namespace = io.of('/' + room_id).on('connection', function(socket) {
            log.trace('new peer for room: %s', room_id);
            room.new_peer(socket);
        });

        // new room object to manage the room state and player connections
        var room = rooms[room_id] = new Room(room_id, namespace);
    }

    return res.render('room', {
        title: 'Real-Time Chess: Game',
        room_id: room_id
    });
});

// testing only
if (!kProduction) {
    // testing route to create 500 error
    app.get('/500', function(req, res, next){
        next(new Error('This is a 500 Error'));
    });

    // testing route to create 404 error
    app.get('/404', function(req, res, next){
        next(new NotFound());
    });
}

// nice 404 pages
// always keep as the last route
app.get('*', function(req, res, next) {
    next(new NotFound());
});

// used to identify 404 pages
function NotFound(msg){
    this.name = 'NotFound';
    this.status = 404;
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

function randomString(len) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
    var ret = '';
    for (var i=0; i<len; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        ret += chars[rnum];
    }
    return ret;
}

/// app runtime

process.on('uncaughtException', function(err) {
    log.panic(err);
});

io.sockets.on('connection', function(socket) {
    // TODO room list?
});
