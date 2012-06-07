
var socket = io.connect();

// full room list
socket.on('room list', function(list) {
    console.log(list);
});

// a room has been added
socket.on('room added', function(room_id) {

    var $room_list = $('#room-list');

    // listen to the events in that room
    var room = io.connect('/' + room_id + '/overview');

    var $room_row = $('<tr>').attr('id', room_id);

    var $label = $('<span>').addClass('label label-info').text('unrated');
    var $white = $('<span>').addClass('pawn white').text('________');
    var $black = $('<span>').addClass('pawn black').text('________');

    var $join = $('<a>').attr('href', '/r/' + room_id)
        .addClass('btn btn-mini btn-info pull-right')
        .text('join');

    $('<td>').appendTo($room_row).append($label);
    $('<td>').appendTo($room_row).append($white);
    $('<td>').appendTo($room_row).append($black);
    $('<td>').appendTo($room_row).append($join);

    $room_list.append($room_row);

    room.once('state', function(state) {
        // game is rated
        if (state.rated) {
            $label.text('rated').addClass('label-important').removeClass('label-info');
        }

        // game is currently playing
        if (state.playing) {
            $join.text('watch');
        }
    });

    room.on('stand', function(side) {
        var $side = $white;
        if (side === 'black') {
            $side = $black;
        }

        $side.text('________');
    });

    room.on('sat', function(side, player) {
        var $side = $white;
        if (side === 'black') {
            $side = $black;
        }

        if (player) {
            $side.text(player.nick + '(' + player.rating + ')');
        }
        else {
            $side.text('guest');
        }
    });

    room.on('empty', function() {
        $room_row.remove();
    });

    // add row for the room
    // new listener for this row to update the state of the row
});

