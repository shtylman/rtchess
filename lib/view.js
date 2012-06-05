var common = require('./common');

var EventEmitter = require('events').EventEmitter;

// pixel size of each chess square
var kSize = 80;

function BoardView(container) {
    var self = this;

    var $board = this.$board = $('<div>').appendTo(container);
    $board.click(function(e) {
        if(!$board.hasClass('clickable')) {
            return false;
        }

        var $piece = $('.piece-selected');

        // don't do anything if no piece was selected
        // this can happen when the select piece gets taken
        if(!$piece.length)
            return false;

        var pid = $piece.attr('id');

        var pos = findBoardPos(e, $board);
        if(!pos) {
            return false;
        }

        var loc = self.click2loc(pos);

        // make sure you can move here
        self.emit('move', pid, loc);

        return false;
    });

    // default watch as white
    this.color = 'w';
}

BoardView.prototype = new EventEmitter();

BoardView.prototype.set_side = function(side) {
    var self = this;

    self.color = side;

    self.draw();

    if (self.state) {
        self.state.forEach(function(piece) {
            self.add_piece(piece.id, piece.loc, true);
        });
    }
};

BoardView.prototype.set_state = function(state) {
    var self = this;

    // store the state so that changing sides works
    // it is still kinda ghetto
    self.state = state;

    state.forEach(function(piece) {
        self.add_piece(piece.id, piece.loc, true);
    });
};

// converts a pos to a loc
BoardView.prototype.pos2loc = function(pos) {
    if(this.color === 'w') {
        return [Math.round(pos.left/kSize), Math.round(7 - pos.top/kSize)];
    } else {
        return [Math.round(7 - pos.left/kSize), Math.round(pos.top/kSize)];
    }
};

// convert a loc to pos
BoardView.prototype.loc2pos = function(loc) {
    if(this.color === 'w') {
        return {
            left: (loc[0])*kSize,
            top: (7 - loc[1])*kSize
        };
    } else {
        return {
            left: (7 - loc[0])*kSize,
            top: (loc[1])*kSize
        };
    }
};

// convert a click (within a square) to a loc
BoardView.prototype.click2loc = function(click) {
    var pos = {
        left: Math.floor(click.left/kSize)*kSize,
        top: Math.floor(click.top/kSize)*kSize
    };

    return this.pos2loc(pos);
};

BoardView.prototype.draw = function() {
    var $cb = this.$board;

    // clear everything in the board
    $cb.children().remove();

    var white = this.color === 'w';

    var blackCell = false;
    var left = 0;
    var top = 0;

    for(var i=0; i < 8; ++i) {
        var n = white ? 8 - i : i + 1;

        for(var l=0; l < 8; ++l) {
            var letter = white ? common.LETTERS[l] : common.LETTERS[8-l-1];

            var cell = letter + n;
            $cb.append('<div id="' + cell + '" class="chess-cell"></div>');
            $cell = $('#' + cell);
            if(blackCell) {
                $cell.addClass('black-cell');
            }
            $cell.css('top', top).css('left', left);
            left += kSize;
            if(left >= kSize*8) {
                left = 0;
                top += kSize;
            } else {
                blackCell = !blackCell;
            }
        }
    }
};

BoardView.prototype.add_piece = function(id, loc, active) {
    var self = this;

    var $cb = self.$board;
    var pos = self.loc2pos(loc);
    $cb.append('<div class="piece unselectable" id="' + id + '"><div class="piece-holder ' + id.substr(0, 2) + '" id="piece-holder-' + id + '"></div></div>');
    //$('#piece-holder-' + id).css('background', 'url(' + id) + ') no-repeat center');
    var $piece = $('#' + id);
    $piece.css('top', pos.top).css('left', pos.left);
    $piece.click(function(e) {
        // don't select immovable pieces
        if($piece.hasClass('unselectable')) {
            return true;
        }

        if($piece.hasClass('piece-enemy')) {
            // you can treat enemy pieces as part of the board
            return true;
        }

        // don't do anything if piece is already selected
        if($piece.hasClass('piece-selected')) {
            return false;
        }

        // remove selections from all other pieces
        $('.piece-selected').removeClass('piece-selected');

        $piece.addClass('piece-selected');
        self.$board.addClass('clickable');
        return false;
    });

    if(id[0] !== self.color) {
        $piece.addClass('piece-enemy');
    } else if(active && !self.disabled) {
        activatePiece($piece);
    }
};

// finds the position of a board square (top-left corner)
// given a click event
function findBoardPos(e, board) {
    $cur = $(e.target);
    var cur = {
        left: e.offsetX,
        top: e.offsetY
    };

    while($cur.length && $cur.attr('id') !== 'chess-board') {
        var pos = $cur.position();
        cur.left += pos.left;
        cur.top += pos.top;
        $cur = $cur.parent();
    }

    if(!$cur.length)
        return null;
    else
        return cur;
}

function activatePiece($piece) {
    $piece.addClass('clickable').removeClass('unselectable');
}

function makeEvents(boardView) {
    var events = {

        // a new piece is added to the board
        // this is used for promotion
        add: function(id, loc, active) {
            boardView.add_piece(id, loc, active);
        },

        // a piece is removed from the board (taken)
        taken: function(id) {
            $('#' + id).remove();
        },

        // sent when a piece should begin moving
        move: function(id, from, to, duration) {
            var $cb = boardView.$board;
            var $piece = $('#' + id);

            $piece.removeClass('piece-selected');
            $piece.addClass('unselectable');

            // only remove clickables if no other selected pieces
            if(!$('.piece-selected').length) {
                $cb.removeClass('clickable');
            }

            // precalculate
            var fromPos = boardView.loc2pos(from);
            var toPos = boardView.loc2pos(to);

            var dx = toPos.left - fromPos.left;
            var dy = toPos.top - fromPos.top;

            var interval = 50;
            var step_x = dx * interval / duration;
            var step_y = dy * interval / duration;

            var iid = setInterval(function() {
                fromPos.top += step_y;
                fromPos.left += step_x;
                $piece.css('top', fromPos.top).css('left', fromPos.left);
            }, interval);

            // we expect the piece to have moved by now
            // the 'moved' event will snap it into position
            setTimeout(function() {
                clearInterval(iid);
            }, duration);
        },

        // sent by the server when a piece is at its final location
        moved: function(id, to) {
            var toPos = boardView.loc2pos(to);

            var $piece = $('#' + id);

            // someone joined to watch as a piece was moving
            // it will not be on their board but we will add it
            // now that we know it is done moving
            if (!$piece || $piece.length === 0) {
                boardView.add_piece(id, to, true);
            }

            $piece.css('top', toPos.top).css('left', toPos.left);
            $piece.removeClass('unselectable');
        },

        // a piece is current inactive
        immobile: function(id, duration) {
            var tid = id + '-timer';
            var $piece = $('#' + id);

            $piece.append('<div class="timer" id="' + tid + '"></div>');

            var $timer = $('#' + tid);

            function stopfunc() {
                // TODO: this is terrible, don't use the DOM to store state
                return boardView.disabled || !$timer.is(':visible');
            }

            var interval = 50;
            var step = kSize * interval / duration;

            var top = 0;
            var height = kSize;
            var iid = setInterval(function() {
                top += step;
                height -= step;
                $timer.css('top', top).css('height', height);
            }, interval);

            setTimeout(function() {
                clearInterval(iid);
            }, duration);
        },

        // a piece is now active
        mobile: function(id) {
            var tid = id + '-timer';
            var $timer = $('#' + tid);
            var $piece = $('#' + id);

            $timer.remove();
        },

        // board is active for play
        // TODO rename resume?
        activateBoard: function() {
            $('.piece').each(function(i, piece) {
                activatePiece($(piece));
            });
            boardView.disabled = false;
        },

        // board is not active
        // TODO rename pause?
        disabled: function() {
            var $cb = boardView.$board;
            $cb.removeClass('clickable');
            $('.piece').addClass('unselectable').removeClass('piece-selected');
            boardView.disabled = true;
        }

    };

    return events;
}

function bindEvents(emitter, boardView) {
    var events = emitter.__bound_events = makeEvents(boardView);

    for(var e in events) {
        emitter.on(e, events[e]);
    }
}

module.exports = {
    bindEvents: bindEvents,
    BoardView: BoardView
};
