var EventEmitter = require('events').EventEmitter;
var common = require('./common');
var pieces = require('./pieces');

// arbitraty piece speed scaling factor
var kPieceSpeed = 0.06;

function Board() {
    var self = this;

    this.pieces = {};
    this.disabled = true;

    // map of locations to pieces that are moving to them
    this.in_transit = {};

    // piece immobilized for this many milliseconds
    this.timeout_duration = 10000;

    // the game board
    var board = this.board = new Array(8);

    // each row has 8 columns :)
    for (var i=0 ; i< board.length ; ++i) {
        board[i] = new Array(8);
    }

    // initial starting positions
    var m = {
        // white pieces
        wk: 'e1',
        wq: 'd1',
        wb1: 'c1',
        wb2: 'f1',
        wh1: 'b1',
        wh2: 'g1',
        wr1: 'a1',
        wr2: 'h1'
    };

    // black pieces
    for(var p in m) {
        var bp = 'b' + p.slice(1);
        var lpos = m[p][0];
        this.addPiece(p, [common.l2n(lpos), 0]); //common.nLoc(m[p]));
        this.addPiece(bp, [common.l2n(lpos), 7]); //common.nLoc(lpos));
    }

    // pawns
    for(var i = 0; i < board.length; ++i) {
        this.addPiece('wp' + i, [i, 1]);
        this.addPiece('bp' + i, [i, 6]);
    }
}
Board.prototype = new EventEmitter();

// adds piece to the board and model
Board.prototype.addPiece = function(id, loc, active) {
    var self = this;

    active = !!active; // coerce to a bool

    var m = {
        p: pieces.Pawn,
        r: pieces.Rook,
        h: pieces.Horse,
        b: pieces.Bishop,
        q: pieces.Queen,
        k: pieces.King
    };

    var klass = m[id[1]];
    var piece = new klass(id, loc, active, this);

    // lookup by board position
    self.board[loc[0]][loc[1]] = piece;

    // piece lookup by id
    self.pieces[id] = piece;

    this.emit('add', id, loc, active);

    return piece;
};

// calls f(piece, Piece)
Board.prototype.eachPiece = function(f) {
    for(var p in this.pieces) {
        f(this.pieces[p]);
    }
};

Board.prototype.getPiece = function(id) {
    return this.pieces[id];
};

Board.prototype.atLoc = function(loc) {
    return this.board[loc[0]][loc[1]];
};

Board.prototype.isValidLoc = function(loc) {
    return loc[0] >= 0 && loc[0] <= 7 && loc[1] >= 0 && loc[1] <= 7;
};

Board.prototype.moveRequest = function(id, loc, side) {
    var self = this;

    // don't allow moves on inactive boards
    if(this.disabled) {
        return;
    }

    var piece = self.getPiece(id);

    if(!piece) {
        // could happen during race condition when piece
        // is captured right before it requests to move
        return false;
    }

    // don't allow moving of other side's pieces
    if(side[0] !== piece.color) {
        return;
    }

    if(!this.isValidLoc(loc)) {
        return false;
    }

    if(!piece.isValidMove(loc)) {
        return false;
    }

    for (var pid in self.pieces) {
        var other = self.pieces[pid];
        if (piece.color !== other.color) {
            continue;
        }

        // if one of our pieces is moving to a location
        // we cannot move to that location
        if (other.loc[0] === loc[0] && other.loc[1] === loc[1]) {
            return false;
        }
    }

    // move the piece
    this.move(piece, loc);
};

Board.prototype.move = function(piece, to) {
    var self = this;

    var from = piece.loc;

    // need to know if our own piece is moving to a destination
    // if it is, we can't be moving there too
    // this can't be done with the board array since opponent piece
    // should still be allowed to move to that square
    // see the moveRequest function for where this is checked
    piece.moving(to);

    // undefined for duration of move
    self.board[from[0]][from[1]] = undefined;

    // calculate time to move to destination
    // diagonal moves as fast in each component as single-component pieces
    var len = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));

    // the change in ratio per time period
    var rdelta = kPieceSpeed/len;
    var steps = 1 / rdelta;
    var duration = Math.round(steps * 50);

    this.emit('move', piece.id, from, to, duration);

    setTimeout(function() {
        self.moved(piece, to);
        piece.immobilize();
    }, duration);
};

Board.prototype.remove = function(id) {
    var loc = this.pieces[id].loc;
    delete this.pieces[id];
    this.board[loc[0]][loc[1]] = undefined;

    this.emit('taken', id);
};

Board.prototype.moved = function(piece, to) {

    piece.moved(to);

    var enemy = this.atLoc(to);
    if(enemy) {
        if(enemy.color === piece.color) {
            // huh?
            throw new Error('enemy color matches my color: ' + enemy.id + ', ' + piece.id);
        }

        // capture it!
        this.remove(enemy.id);

        // if you captured the king, game over
        if(enemy instanceof pieces.King) {
            this.emit('gameover', piece.color);
            this.disable();
        }
    }

    // set the piece in the position
    this.board[to[0]][to[1]] = piece;

    this.emit('moved', piece.id, to);
};

Board.prototype.startGame = function() {
    this.disabled = false;

    // activate all the pieces
    this.eachPiece(function(piece) {
        piece.activate();
    });

    this.emit('activateBoard');
};

Board.prototype.disable = function() {
    this.disabled = true;
    this.emit('disabled');
};

Board.prototype.state = function() {
    var self = this;
    var board = self.board;
    var pieces = [];

    for(var i=0 ; i<8 ; ++i) {
        for(var j=0 ; j<8 ; ++j) {
            var piece = board[i][j];
            if (!piece) {
                continue;
            }

            pieces.push({
                id: piece.id,
                loc: piece.loc
            });
        }
    }

    return pieces;
};

module.exports = Board;

