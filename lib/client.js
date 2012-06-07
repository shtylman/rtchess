
// add dummy console.log for IE
if(!window.console) {
    window.console = {
        log: function() {}
    };
}

var view = require('./view');
var common = require('./common');

// seconds between pings
var kPingPeriod = 3;

function init(room_id) {
    var socket = io.connect('/' + room_id);
    var mySide;

    var boardView = new view.BoardView($('#chess-board'));
    boardView.draw();

    view.bindEvents(socket, boardView);

    // send client moves to the server
    boardView.on('move', function(id, loc) {
        socket.emit('move', id, loc);
    });

    function ping() {
        var from = (new Date()).getTime();
        socket.emit('ping');
        socket.once('pong', function() {
            var to = (new Date()).getTime();
            $('#ping').text(to - from);
        });
    }

    var pingId;

    var $message = $('#chess-board > .message');
    function set_message(msg) {
        if (!msg) {
            return $message.hide();
        }
        $message.text(msg);
        $message.show();
    }

    socket.on('connect', function() {
        $('#disconnect-message').remove();
        ping();
        pingId = setInterval(ping, kPingPeriod * 1000);
    });

    socket.once('state', function(state) {
        // enable only the sides which we can still sit as
        Object.keys(state.sides).forEach(function(side) {
            if (!state.sides[side]) {
                $('#sit-' + side).removeAttr('disabled').removeClass('start-pressed');
            }
        });

        if (state.playing) {
            $('#watching-notice').hide();
        }

        boardView.set_state(state.board);
    });

    socket.on('disconnect', function() {
        set_message('You are disconnect. If you do not reconnect automatically, try refreshing the page.');
        clearInterval(pingId);
    });

    socket.on('sat', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
    });

    socket.on('starting', function(secs) {
        $('#watching-notice').hide();
        $('.side-button').removeClass('start-pressed');
        set_message('Game starting in ' + secs + ' seconds');

        secs -= 0; // convert to number
        function countDown() {
            secs--;

            if(secs === 0) {
                clearInterval(countdownId);
                return set_message();
            }
            set_message('Game starting in ' + secs + ' seconds');
        }
        var countdownId = setInterval(countDown, 1000);
    });

    socket.on('playerDisconnected', function(color) {
        var prettyColor = common.letter2color(color);
        set_message(prettyColor + ' was disconnected!');
        $('#start-game').removeAttr('disabled');
    });

    socket.on('gameover', function(winner) {
        var color = common.letter2color(winner);
        var $cb = $('#chess-board');
        set_message('Game Over! ' + color + ' wins!');
        $('#start-game').removeAttr('disabled');
    });

    $('#sit-white').click(function() {
        mySide = 'white';
        boardView.set_side('w');
        set_message('Waiting for opponent...');

        $('#watching-notice').hide();
        socket.emit('sit', 'white');
    });

    $('#sit-black').click(function() {
        mySide = 'black';
        boardView.set_side('b');
        set_message('Waiting for opponent...');

        $('#watching-notice').hide();
        socket.emit('sit', 'black');
    });
}

module.exports.init = init;

