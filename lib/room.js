// builtin
var EventEmitter = require('events').EventEmitter;

// 3rd party
var log = require('book').default();

// local
var Board = require('./board');
var common = require('./common');
var elo = require('./elo');

var User = require('../models/user');

var kSides = ['white', 'black'];

// seconds to wait before starting game after players have sat down
var kStartWaitSeconds = 3;

function Room(id, io) {
    var self = this;

    self.id = id;
    self.rated = false;

    self.sides = {};
    self.peers = [];

    // add new socket namespace for this room
    var socket = io.of('/' + id);

    socket.on('connection', function(socket) {
        log.trace('new peer for room: %s', id);
        self.new_peer(socket);
    });

    self.socket = socket;

    self.board = new Board();

    var events = ['add', 'taken', 'move', 'moved', 'immobile', 'mobile', 'gameover'];

    common.bindPassThrough(events, self.socket, this.board);

    self.board.on('gameover', function(side) {

        // no one is sitting
        self.sides = {};

        self.emit('stand', 'white');
        self.emit('stand', 'black');

        // not a rated game
        if (!self.rated) {
            return;
        }

        var winner = self.sides[side];
        var loser = self.sides[(side === 'white') ? 'black' : 'white'];

        winner = winner.handshake.user;
        loser = loser.handshake.user;

        // lookup current ratings
        User.find_by_id(winner._id, function(err, winner) {
            if (err) {
                log.error(err);
            }

            User.find_by_id(loser._id, function(err, loser) {
                if (err) {
                    log.error(err);
                }

                //calculate the shit
                elo(winner, loser);

                // update new rating
                User.update({ _id: winner._id }, { $set: { rating: winner.rating } });
                User.update({ _id: loser._id }, { $set: { rating: loser.rating } });
            });
        });
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

    // add new socket namespace for this room
    self.overview = io.of('/' + id + '/overview').on('connection', function(socket) {
        log.trace('new overview peer for room: %s', id);
    });
}

Room.prototype = new EventEmitter();

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

    // we need to ask the peer to identify themselves
    // only identified peers can play rated games

    self.peers.push(socket);

    socket.on('ping', function() {
        socket.emit('pong');
    });

    socket.on('disconnect', function() {
        self.remove(socket);
    });

    // user sat down
    socket.on('sit', function(side) {
        self.setSide(side, socket);
        peer_side = side;

        // tell everyone this side is taken
        self.socket.emit('sat', side);
        self.overview.emit('sat', side);
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

        rated: self.rated,

        // state of the game board, null if no game
        board: self.board.state()
    });
};

Room.prototype.set_rated = function(rated) {
    var self = this;
    self.rated = rated;
};

Room.prototype.broadcast = function() {
    var self = this;
    self.socket.emit.apply(self.socket, arguments);
};

Room.prototype.setSide = function(side, socket) {
    var self = this;

    // TODO check if taken? or who has the side?
    self.sides[side] = socket;

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
    var self = this;

    log.trace('removing user');

    var index = this.peers.indexOf(socket);

    // no such user
    if(index < 0) {
        return;
    }

    this.peers.splice(index, 1);

    for(var side in self.sides) {
        if (socket === self.sides[side]) {
            self[side] = undefined;

            self.socket.emit('stand', side);
            self.overview.emit('stand', side);

            // TODO pause the game and allow player to resume?
            break;
        }
    }

    // delete the room if no one is in it
    if (self.peers.length === 0) {
        log.trace('room is empty: %s', self.id);
        self.emit('empty');
        self.overview.emit('empty');
    }
};

module.exports = Room;

