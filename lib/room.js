
var log = require('book').default();

var Board = require('./board');
var common = require('./common');

var kSides = ['white', 'black'];

// seconds to wait before starting game after players have sat down
var kStartWaitSeconds = 3;

function Room(id, socket) {
    var self = this;

    self.id = id;
    self.sides = {};

    self.peers = [];
    self.socket = socket;

    self.board = new Board();

    var self = this;

    var events = ['add', 'taken', 'move', 'moved', 'immobile', 'mobile', 'gameover'];

    common.bindPassThrough(events, self.socket, this.board);

    self.board.on('gameover', function() {
        self.sides = {};
    });

    self.board.on('activateBoard', function() {
        log.trace('board activate');
        for(var i=0, l = kSides.length; i < l; ++i) {
            var side = kSides[i];
            if(self.sides[side])
                self.sides[side].emit('activateBoard');
        }
    });

    self.board.on('disabled', function() {
        log.trace('board disable');
        self.broadcast('pause');
    });
}

/// return number of players
Room.prototype.num_players = function() {
    return Object.keys(this.sides).length;
};

/// return number of peers (watchers)
Room.prototype.num_peers = function() {
    return this.peers.length;
};

/// new peer has joined the room
Room.prototype.new_peer = function(socket) {
    var self = this;
    var peer_side;

    self.peers.push(socket);

    socket.on('ping', function() {
        socket.emit('pong');
    });

    socket.on('disconnect', function() {
        self.remove(socket);

        // TODO if no more peers?
    });

    // user sat down
    socket.on('sit', function(side) {
        self.setSide(side, socket);
        peer_side = side;

        // tell everyone this side is taken
        self.socket.emit('sat', side);

    });

    socket.on('move', function(id, loc) {
        // thou shall not pass!
        if (!peer_side) {
            return;
        }

        self.board.moveRequest(id, loc, peer_side);
    });

    // send the state to the client
    socket.emit('state', {
        // available sides
        sides: {
            white: !!self.sides.white,
            black: !!self.sides.black
        },

        // state of the game board, null if no game
        board: self.board.state()
    });
};

Room.prototype.broadcast = function() {
    var self = this;
    self.socket.emit.apply(self.socket, arguments);
};

Room.prototype.setSide = function(side, socket) {
    var self = this;

    // TODO check if taken? or who has the side?
    this.sides[side] = socket;

    // only start game with both players are seated
    if (Object.keys(self.sides).length !== 2) {
        return;
    }

    log.trace('starting game: %s', self.id);

    // ready to start
    self.socket.emit('starting', kStartWaitSeconds);

    // if both peers have sat, we start the game
    setTimeout(function() {
        self.board.startGame();
    }, kStartWaitSeconds * 1000);
};

Room.prototype.remove = function(socket) {
    log.trace('removing user');

    var index = this.peers.indexOf(socket);

    // no such user
    if(index < 0) {
        return
    }

    this.peers.splice(index, 1);

    // TODO inform other peers that a player disconnected
    // if peer was playing, disable the board
    //self.socket.emit('pause');

    // delete the room if no one is in it
    if(this.peers.length === 0) {
        log.trace('DELETING ROOM ' + this.id);

        // TODO remove the room?
        // maybe just emit an event so parent can do it?
        // or detect disconnected event in parent and check num peers?
    }
};

module.exports = Room;

